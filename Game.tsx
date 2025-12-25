import React, { useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GameState, EntityType, Entity, Particle, PlayerState, Box } from './types';
import { COLORS, PHYSICS, WORLD, JUICE } from './constants';

interface GameProps {
  gameState: GameState;
  episode: number;
  onTaskComplete: (count: number) => void;
  onZoneChange: (zone: string) => void;
  onDialogue: (text: string | null) => void;
  onFinish: () => void;
}

export const Game: React.FC<GameProps> = ({ 
  gameState, 
  episode,
  onTaskComplete, 
  onZoneChange, 
  onDialogue, 
  onFinish 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const aiRef = useRef<GoogleGenAI | null>(null);
  
  const stateRef = useRef<{
    player: PlayerState;
    entities: Entity[];
    particles: Particle[];
    camera: { x: number };
    keys: { [key: string]: boolean };
    lastTime: number;
    dialogueActive: boolean;
    cutsceneTimer: number;
    bossPhase: number;
    bossTimer: number;
    bossAction: string;
    bossInvuln: number;
    shake: number;
    hitStop: number;
    weatherParticles: {x: number, y: number, v: number, size: number}[];
    lastGrounded: boolean;
    bgLayers: {x: number, speed: number, h: number, color: string}[];
  }>({
    player: {
      pos: { x: 100, y: WORLD.GROUND_Y - 80 },
      vel: { x: 0, y: 0 },
      grounded: false,
      facingRight: true,
      isSlashing: false,
      isInteracting: false,
      interactionPressed: false,
      draggingItem: null,
      carriedItem: null,
      tasksCompleted: 0,
      items: [],
      animTimer: 0,
      hp: 3,
      maxHp: 3
    },
    entities: [],
    particles: [],
    camera: { x: 0 },
    keys: {},
    lastTime: 0,
    dialogueActive: false,
    cutsceneTimer: 0,
    bossPhase: 0,
    bossTimer: 0,
    bossAction: 'WAIT',
    bossInvuln: 0,
    shake: 0,
    hitStop: 0,
    weatherParticles: Array.from({length: 60}, () => ({
      x: Math.random() * WORLD.VIEWPORT_WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      v: 1 + Math.random() * 3,
      size: 1 + Math.random() * 2
    })),
    lastGrounded: false,
    bgLayers: [
      { x: 0, speed: 0.05, h: 400, color: 'rgba(0,0,0,0.05)' },
      { x: 0, speed: 0.15, h: 300, color: 'rgba(0,0,0,0.1)' },
      { x: 0, speed: 0.3, h: 200, color: 'rgba(0,0,0,0.2)' }
    ]
  });

  const generateWhisper = async (prompt: string) => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return;
      if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey });
      const response = await aiRef.current.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { systemInstruction: "You are the haunting voice of the Sands. Speak in short, poetic, dark whispers. Max 10 words." }
      });
      if (response.text) {
        onDialogue(response.text);
        stateRef.current.dialogueActive = true;
      }
    } catch (e) {
      console.error("AI Whisper failed", e);
    }
  };

  useEffect(() => {
    // Reset state on episode change
    const s = stateRef.current;
    s.dialogueActive = false;
    onDialogue(null);
    s.player.pos = { x: 100, y: WORLD.GROUND_Y - 80 };
    s.player.vel = { x: 0, y: 0 };
    s.player.items = [];
    s.player.tasksCompleted = 0;
    s.player.draggingItem = null;
    s.player.carriedItem = null;
    s.camera.x = 0;
    s.shake = 0;
    s.particles = [];
    
    const entities: Entity[] = [];
    if (episode === 1) {
      onZoneChange("The Barren Sands");
      entities.push({ id: 'm1', type: EntityType.MOUND, x: 1200, y: WORLD.GROUND_Y - 60, w: 50, h: 60, interacted: false, visible: true, data: { hits: 0 } });
      entities.push({ id: 'm2', type: EntityType.MOUND, x: 2200, y: WORLD.GROUND_Y - 70, w: 40, h: 70, interacted: false, visible: true, data: { hits: 0, hasRing: true } });
      entities.push({ id: 'p1', type: EntityType.PILLAR, x: 3400, y: WORLD.GROUND_Y - 180, w: 40, h: 180, interacted: false, visible: true, data: { tilt: -24 } });
      entities.push({ id: 'p2', type: EntityType.PILLAR, x: 3800, y: WORLD.GROUND_Y - 180, w: 40, h: 180, interacted: false, visible: true, data: { tilt: 24 } });
      entities.push({ id: 'stone', type: EntityType.DRAGGABLE_STONE, x: 5000, y: WORLD.GROUND_Y - 60, w: 60, h: 60, interacted: false, visible: true });
      entities.push({ id: 'pedestal', type: EntityType.PEDESTAL, x: 6000, y: WORLD.GROUND_Y - 20, w: 100, h: 20, interacted: false, visible: true });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 7000, y: WORLD.GROUND_Y - 140, w: 80, h: 140, interacted: false, visible: true });
    } else if (episode === 2) {
      onZoneChange("The Weaver's Tongue");
      entities.push({ id: 'w1', type: EntityType.WIND_TUNNEL, x: 800, y: WORLD.GROUND_Y - 250, w: 800, h: 250, interacted: false, visible: true, data: { force: -0.6 } });
      entities.push({ id: 'm3', type: EntityType.MOUND, x: 1800, y: WORLD.GROUND_Y - 80, w: 40, h: 80, interacted: false, visible: true, data: { hits: 0, hasCore: true } });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 4000, y: WORLD.GROUND_Y - 140, w: 80, h: 140, interacted: false, visible: true });
    } else if (episode === 3) {
      onZoneChange("The Feast of Ash");
      entities.push({ id: 'b1', type: EntityType.COLLECTIBLE_BONE, x: 1200, y: WORLD.GROUND_Y - 30, w: 30, h: 30, interacted: false, visible: true });
      entities.push({ id: 'bowl1', type: EntityType.OFFERING_BOWL, x: 2800, y: WORLD.GROUND_Y - 40, w: 80, h: 40, interacted: false, visible: true, data: { filled: false } });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 4500, y: WORLD.GROUND_Y - 140, w: 80, h: 140, interacted: false, visible: true });
    } else if (episode === 4) {
      onZoneChange("The Recurrence");
      s.player.pos.x = 200;
      entities.push({ id: 'boss', type: EntityType.BOSS, x: 600, y: WORLD.GROUND_Y - 100, w: 40, h: 80, interacted: false, visible: true, data: { hp: 15, maxHp: 15 } });
    }
    s.entities = entities;
    generateWhisper(`A spirit returns. Episode ${episode}.`);
  }, [episode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = true;
      if (e.code === 'KeyE') {
        if (stateRef.current.dialogueActive) { onDialogue(null); stateRef.current.dialogueActive = false; }
        else { stateRef.current.player.isInteracting = true; if (!e.repeat) stateRef.current.player.interactionPressed = true; }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = false;
      if (e.code === 'Space') stateRef.current.player.isSlashing = false;
      if (e.code === 'KeyE') { stateRef.current.player.isInteracting = false; stateRef.current.player.draggingItem = null; }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [onDialogue]);

  const checkOverlap = (r1: Box, r2: Box) => r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;

  const triggerJuice = (shake: number, hitStop: number = 0) => {
    stateRef.current.shake = Math.max(stateRef.current.shake, shake);
    stateRef.current.hitStop = hitStop;
  };

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        stateRef.current.particles.push({
            x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 0.5, color,
        });
    }
  };

  const completeTask = (id: string, msg: string) => {
    const p = stateRef.current.player;
    if (!p.items.includes(id)) {
      p.items.push(id);
      p.tasksCompleted++;
      onTaskComplete(p.tasksCompleted);
      generateWhisper(msg);
      triggerJuice(10);
    }
  };

  const updateBoss = (dt: number) => {
    const s = stateRef.current;
    const boss = s.entities.find(e => e.type === EntityType.BOSS);
    if (!boss || boss.interacted) return;

    s.bossTimer += dt;
    if (s.bossInvuln > 0) s.bossInvuln -= dt;

    const dist = s.player.pos.x - boss.x;
    const phase = boss.data.hp > 8 ? 1 : 2;

    if (s.bossTimer > (3.5 - phase)) {
      s.bossTimer = 0;
      if (Math.abs(dist) > 250) s.bossAction = 'THROW';
      else s.bossAction = 'DASH';
    }

    if (s.bossAction === 'DASH') {
      boss.x += Math.sign(dist) * (15 + phase * 2);
      if (Math.abs(dist) < 50) s.bossAction = 'WAIT';
    } else if (s.bossAction === 'THROW') {
      s.entities.push({ id: `p${Date.now()}`, type: EntityType.PROJECTILE, x: boss.x, y: boss.y + 30, w: 20, h: 5, visible: true, interacted: false, data: { vx: Math.sign(dist) * 12 } });
      s.bossAction = 'WAIT';
    } else {
      boss.x += Math.sign(dist) * 3;
    }

    if (checkOverlap({x: s.player.pos.x, y: s.player.pos.y, w: 40, h: 80}, boss)) {
      s.player.vel.x = -Math.sign(dist) * 12;
      triggerJuice(10, 0.05);
    }
  };

  const updateEntities = (dt: number) => {
    const s = stateRef.current;
    const p = s.player;

    const slashBox = { x: p.facingRight ? p.pos.x + 40 : p.pos.x - 110, y: p.pos.y, w: 120, h: 80 };
    const interactBox = { x: p.pos.x - 20, y: p.pos.y - 10, w: 80, h: 100 };

    for (let i = s.entities.length - 1; i >= 0; i--) {
      const ent = s.entities[i];
      if (!ent.visible) continue;

      // Projectiles
      if (ent.type === EntityType.PROJECTILE) {
        ent.x += ent.data.vx;
        if (checkOverlap({x: p.pos.x, y: p.pos.y, w: 40, h: 80}, ent)) {
          s.entities.splice(i, 1);
          triggerJuice(15, 0.05);
          p.vel.x = -Math.sign(ent.data.vx) * 15;
        }
      }

      // Interaction
      if (checkOverlap(interactBox, ent)) {
        if (ent.type === EntityType.DOOR && p.interactionPressed) {
          const req = episode === 1 ? 3 : 1;
          if (p.tasksCompleted >= req) onFinish();
          else generateWhisper("Burdens still remain.");
        }
        if (ent.type === EntityType.PILLAR && p.interactionPressed && !ent.interacted) {
          ent.data.tilt += (ent.data.tilt < 0 ? 12 : -12);
          if (Math.abs(ent.data.tilt) < 5) {
            ent.data.tilt = 0; ent.interacted = true;
            if (s.entities.filter(e => e.type === EntityType.PILLAR).every(p => p.interacted)) completeTask('pillar', "The void aligns.");
          }
        }
        if (ent.type === EntityType.DRAGGABLE_STONE && p.isInteracting) {
          p.draggingItem = ent.id;
          ent.x = p.facingRight ? p.pos.x + 40 : p.pos.x - 60;
        }
        if (ent.type === EntityType.COLLECTIBLE_BONE && !ent.interacted && p.interactionPressed) {
          ent.visible = false; p.carriedItem = 'bone'; generateWhisper("A memory of bone.");
        }
        if (ent.type === EntityType.OFFERING_BOWL && p.carriedItem === 'bone' && p.interactionPressed) {
          ent.data.filled = true; p.carriedItem = null; completeTask('bowl', "Sacrifice accepted.");
        }
      }

      // Auto check pedestal
      if (ent.type === EntityType.PEDESTAL && !ent.interacted) {
        const stone = s.entities.find(e => e.id === 'stone');
        if (stone && checkOverlap(stone, ent)) {
          ent.interacted = true; completeTask('altar', "The anchor holds.");
        }
      }

      // Slashing
      if (p.isSlashing && checkOverlap(slashBox, ent)) {
        if (ent.type === EntityType.MOUND && !ent.interacted) {
          ent.data.hits++;
          spawnParticles(ent.x + 20, ent.y + 40, COLORS.WHITE, 4);
          if (ent.data.hits >= 4) {
            ent.interacted = true; ent.visible = false;
            if (ent.data.hasRing || ent.data.hasCore) completeTask('mound', "Unearthed guilt.");
          }
        }
        if (ent.type === EntityType.BOSS && s.bossInvuln <= 0) {
          ent.data.hp--; s.bossInvuln = 0.5;
          triggerJuice(20, 0.1);
          spawnParticles(ent.x + 20, ent.y + 40, '#f00', 10);
          if (ent.data.hp <= 0) { ent.interacted = true; onFinish(); }
        }
      }
    }
    p.interactionPressed = false;
  };

  const updatePhysics = (dt: number) => {
    const s = stateRef.current;
    const p = s.player;
    let wind = 0;
    s.entities.forEach(e => {
      if (e.type === EntityType.WIND_TUNNEL && checkOverlap({x: p.pos.x, y: p.pos.y, w: 40, h: 80}, e)) wind = e.data.force;
    });

    const speed = PHYSICS.MOVE_SPEED * (1 - p.tasksCompleted * 0.12);
    if (!s.dialogueActive) {
      if (s.keys['ArrowRight']) { p.vel.x += speed * 0.4; p.facingRight = true; }
      else if (s.keys['ArrowLeft']) { p.vel.x -= speed * 0.4; p.facingRight = false; }
      else p.vel.x *= PHYSICS.FRICTION;
    }
    p.vel.x += wind;
    const max = p.draggingItem ? 2.5 : PHYSICS.MAX_SPEED;
    p.vel.x = Math.max(-max, Math.min(max, p.vel.x));

    p.vel.y += PHYSICS.GRAVITY;
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;

    if (p.pos.y > WORLD.GROUND_Y - 80) {
      if (!s.lastGrounded) triggerJuice(Math.abs(p.vel.y) * 0.4);
      p.pos.y = WORLD.GROUND_Y - 80; p.vel.y = 0; p.grounded = true;
    } else p.grounded = false;
    s.lastGrounded = p.grounded;

    if (s.keys['Space'] && p.grounded) { p.vel.y = PHYSICS.JUMP_FORCE; p.grounded = false; }
    if (s.keys['Space'] && !p.grounded) p.isSlashing = true;
    if (p.pos.x < 0) p.pos.x = 0;
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    const w = WORLD.VIEWPORT_WIDTH;
    s.bgLayers.forEach(l => {
      ctx.fillStyle = l.color;
      const xOffset = -(s.camera.x * l.speed) % w;
      for (let i = 0; i < 2; i++) {
        const drawX = xOffset + (i * w);
        ctx.fillRect(drawX, WORLD.GROUND_Y - l.h, w, l.h);
        // Silhouettes
        ctx.fillRect(drawX + 100, WORLD.GROUND_Y - l.h - 100, 40, 100);
        ctx.fillRect(drawX + 400, WORLD.GROUND_Y - l.h - 50, 80, 50);
      }
    });
    // Drifting particles
    ctx.fillStyle = episode === 3 ? 'rgba(255,100,0,0.2)' : 'rgba(255,255,255,0.1)';
    s.weatherParticles.forEach(p => {
      p.x -= p.v; if (p.x < 0) p.x = w;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const p = stateRef.current.player;
    const squash = 1 + (Math.abs(p.vel.y) * 0.02);
    const stretch = 1 / squash;
    const dark = Math.min(0.8, p.tasksCompleted * 0.2);

    ctx.save(); ctx.translate(p.pos.x + 20, p.pos.y + 80); if (!p.facingRight) ctx.scale(-1, 1);
    ctx.scale(stretch, squash);
    
    // Body
    ctx.fillStyle = COLORS.WHITE; ctx.fillRect(-10, -70, 20, 35); ctx.fillRect(-8, -86, 16, 16); 
    ctx.fillRect(-8, -35, 6, 35); ctx.fillRect(2, -35, 6, 35);
    // Darkness overlay
    ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(-10, -70, 20, 70);
    // Arm
    ctx.fillStyle = COLORS.ORANGE; ctx.save(); ctx.translate(0, -60);
    if (p.isSlashing) ctx.rotate(Math.sin(Date.now()/50)*2); ctx.fillRect(-4, 0, 8, 30); ctx.restore();
    ctx.restore();
  };

  const drawBird = (ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean) => {
    ctx.save(); ctx.translate(x + 20, y + 80); if (!facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(-35, 0); ctx.lineTo(-15, -60); ctx.lineTo(10, -110); ctx.lineTo(45, -60); ctx.lineTo(25, 0); ctx.fill(); 
    ctx.fillStyle = COLORS.ORANGE; ctx.beginPath(); ctx.arc(10, -95, 6, 0, Math.PI*2); ctx.fill(); 
    ctx.lineWidth = 14; ctx.strokeStyle = COLORS.ORANGE; ctx.beginPath(); ctx.moveTo(20,-70); ctx.quadraticCurveTo(50, -50, 60, 20); ctx.stroke();
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;
    
    ctx.fillStyle = episode === 4 ? COLORS.HONEY_YELLOW : COLORS.BLUE;
    if (episode === 3) ctx.fillStyle = '#100505';
    ctx.fillRect(0, 0, 800, 600);

    drawBackground(ctx);

    ctx.save();
    const sx = (Math.random() - 0.5) * s.shake;
    const sy = (Math.random() - 0.5) * s.shake;
    ctx.translate(-s.camera.x + sx, sy);

    ctx.fillStyle = '#000'; ctx.fillRect(s.camera.x, WORLD.GROUND_Y, 800, 100);

    s.entities.forEach(ent => {
      if (!ent.visible) return;
      if (ent.type === EntityType.PILLAR) {
        ctx.save(); ctx.translate(ent.x + 20, ent.y + 180); ctx.rotate(ent.data.tilt * Math.PI / 180);
        ctx.fillStyle = '#556'; ctx.fillRect(-20, -180, 40, 180); ctx.restore();
      } else if (ent.type === EntityType.DOOR) {
        ctx.fillStyle = '#000'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
        if (Math.abs(s.player.pos.x - ent.x) < 150) {
          ctx.strokeStyle = COLORS.ORANGE; ctx.lineWidth = 4; ctx.globalAlpha = 0.5 + Math.sin(Date.now()/200)*0.5;
          ctx.strokeRect(ent.x, ent.y, ent.w, ent.h); ctx.globalAlpha = 1;
        }
      } else if (ent.type === EntityType.PEDESTAL) { ctx.fillStyle = '#222'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.MOUND) { ctx.fillStyle = COLORS.GREY; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.DRAGGABLE_STONE) { ctx.fillStyle = '#654'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.OFFERING_BOWL) {
        ctx.fillStyle = '#333'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
        if (ent.data.filled) { ctx.fillStyle = COLORS.ORANGE; ctx.fillRect(ent.x + 10, ent.y - 10, 60, 10); }
      } else if (ent.type === EntityType.BOSS) drawPlayer(ctx);
      else if (ent.type === EntityType.PROJECTILE) { ctx.fillStyle = '#fff'; ctx.fillRect(ent.x, ent.y, 20, 5); }
    });

    if (episode === 4) drawBird(ctx, s.player.pos.x, s.player.pos.y, s.player.facingRight);
    else drawPlayer(ctx);

    s.particles.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); });
    ctx.restore();
  };

  const loop = (time: number) => {
    let dt = (time - stateRef.current.lastTime) / 1000; stateRef.current.lastTime = time;
    if (dt > 0.1) dt = 0.016;
    if (stateRef.current.hitStop > 0) { stateRef.current.hitStop -= dt; dt = 0; }
    stateRef.current.shake *= JUICE.SHAKE_DECAY;

    if (gameState === GameState.PLAYING && dt > 0) {
      updatePhysics(dt); updateEntities(dt);
      if (episode === 4) updateBoss(dt);
      const tx = episode === 4 ? 0 : stateRef.current.player.pos.x - 300;
      stateRef.current.camera.x += (tx - stateRef.current.camera.x) * 0.1;
      if (stateRef.current.camera.x < 0) stateRef.current.camera.x = 0;
    }
    draw(); requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => { requestRef.current = requestAnimationFrame(loop); return () => cancelAnimationFrame(requestRef.current!); }, [gameState, episode]);

  return (
    <div className="relative w-full h-full flex justify-center items-center">
      <canvas ref={canvasRef} width={800} height={600} className="border-4 border-black shadow-2xl bg-black" style={{ width: '100%', maxWidth: '800px', height: 'auto', aspectRatio: '4/3' }} />
    </div>
  );
};