
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
    bossTimer: number;
    bossAction: string;
    bossInvuln: number;
    shake: number;
    hitStop: number;
    weatherParticles: {x: number, y: number, v: number, size: number}[];
    lastGrounded: boolean;
    bgLayers: {speed: number, h: number, color: string, objects: {x: number, y: number, w: number, h: number, type: 'rect' | 'arch' | 'pillar' | 'monolith', drift?: number}[]}[];
  }>({
    player: {
      pos: { x: 100, y: WORLD.GROUND_Y - 80 },
      vel: { x: 0, y: 0 },
      grounded: false,
      facingRight: true,
      isSlashing: false,
      isInteracting: false,
      isShielding: false,
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
    bossTimer: 0,
    bossAction: 'WAIT',
    bossInvuln: 0,
    shake: 0,
    hitStop: 0,
    weatherParticles: Array.from({length: 120}, () => ({
      x: Math.random() * WORLD.VIEWPORT_WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      v: 0.5 + Math.random() * 2,
      size: 1 + Math.random() * 2
    })),
    lastGrounded: false,
    bgLayers: [
      { 
        speed: 0.03, h: 500, color: 'rgba(0,0,0,0.08)', 
        objects: [
          {x: 100, y: 50, w: 120, h: 400, type: 'rect'}, 
          {x: 800, y: 100, w: 200, h: 300, type: 'arch'}, 
          {x: 1500, y: 20, w: 80, h: 480, type: 'pillar'},
          {x: 2200, y: 150, w: 150, h: 350, type: 'monolith', drift: 0.2}
        ]
      },
      { 
        speed: 0.1, h: 400, color: 'rgba(0,0,0,0.12)', 
        objects: [
          {x: 300, y: 200, w: 50, h: 200, type: 'pillar'}, 
          {x: 1000, y: 180, w: 120, h: 220, type: 'arch'}, 
          {x: 1800, y: 250, w: 40, h: 150, type: 'rect'},
          {x: 2500, y: 200, w: 100, h: 200, type: 'monolith', drift: 0.4}
        ]
      },
      { 
        speed: 0.25, h: 280, color: 'rgba(0,0,0,0.2)', 
        objects: [
          {x: 150, y: 350, w: 30, h: 120, type: 'pillar'}, 
          {x: 700, y: 400, w: 40, h: 80, type: 'rect'}, 
          {x: 1200, y: 380, w: 60, h: 100, type: 'arch'},
          {x: 2000, y: 400, w: 20, h: 80, type: 'monolith', drift: 0.8}
        ]
      }
    ]
  });

  const resetBossLevel = () => {
    const s = stateRef.current;
    s.player.hp = s.player.maxHp;
    s.player.pos = { x: 200, y: WORLD.GROUND_Y - 80 };
    s.player.vel = { x: 0, y: 0 };
    const boss = s.entities.find(e => e.type === EntityType.BOSS);
    if (boss) {
      boss.x = 600;
      boss.y = WORLD.GROUND_Y - 180;
      boss.data.hp = 20;
      boss.data.stunTimer = 0;
      boss.data.hitsTaken = 0;
    }
    s.shake = 10;
    generateWhisper("Death is but a stutter in the cycle.");
  };

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

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        stateRef.current.particles.push({
            x, y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, life: 0.8, color,
        });
    }
  };

  const triggerJuice = (shake: number, hitStop: number = 0) => {
    stateRef.current.shake = Math.max(stateRef.current.shake, shake);
    stateRef.current.hitStop = hitStop;
  };

  const completeTask = (id: string, msg: string) => {
    const p = stateRef.current.player;
    if (!p.items.includes(id)) {
      p.items.push(id);
      p.tasksCompleted++;
      onTaskComplete(p.tasksCompleted);
      generateWhisper(msg);
      triggerJuice(18, 0.12);
      spawnParticles(p.pos.x + 20, p.pos.y + 40, COLORS.ORANGE, 25);
    }
  };

  useEffect(() => {
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
    s.player.hp = 3;
    
    const entities: Entity[] = [];
    if (episode === 1) {
      onZoneChange("The Barren Sands");
      entities.push({ id: 'm1', type: EntityType.MOUND, x: 1500, y: WORLD.GROUND_Y - 60, w: 50, h: 60, interacted: false, visible: true, data: { hits: 0 } });
      entities.push({ id: 'm2', type: EntityType.MOUND, x: 2800, y: WORLD.GROUND_Y - 70, w: 40, h: 70, interacted: false, visible: true, data: { hits: 0, hasRing: true } });
      entities.push({ id: 'p1', type: EntityType.PILLAR, x: 4000, y: WORLD.GROUND_Y - 180, w: 40, h: 180, interacted: false, visible: true, data: { tilt: -24 } });
      entities.push({ id: 'p2', type: EntityType.PILLAR, x: 4400, y: WORLD.GROUND_Y - 180, w: 40, h: 180, interacted: false, visible: true, data: { tilt: 24 } });
      entities.push({ id: 'stone', type: EntityType.DRAGGABLE_STONE, x: 5600, y: WORLD.GROUND_Y - 60, w: 60, h: 60, interacted: false, visible: true });
      entities.push({ id: 'pedestal', type: EntityType.PEDESTAL, x: 6800, y: WORLD.GROUND_Y - 20, w: 100, h: 20, interacted: false, visible: true });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 8200, y: WORLD.GROUND_Y - 140, w: 100, h: 140, interacted: false, visible: true });
    } else if (episode === 2) {
      onZoneChange("The Weaver's Tongue");
      entities.push({ id: 'w1', type: EntityType.WIND_TUNNEL, x: 1200, y: WORLD.GROUND_Y - 250, w: 1200, h: 250, interacted: false, visible: true, data: { force: -0.7 } });
      entities.push({ id: 'm3', type: EntityType.MOUND, x: 2800, y: WORLD.GROUND_Y - 80, w: 40, h: 80, interacted: false, visible: true, data: { hits: 0, hasCore: true } });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 4800, y: WORLD.GROUND_Y - 140, w: 100, h: 140, interacted: false, visible: true });
    } else if (episode === 3) {
      onZoneChange("The Feast of Ash");
      entities.push({ id: 'b1', type: EntityType.COLLECTIBLE_BONE, x: 1800, y: WORLD.GROUND_Y - 30, w: 30, h: 30, interacted: false, visible: true });
      entities.push({ id: 'bowl1', type: EntityType.OFFERING_BOWL, x: 3600, y: WORLD.GROUND_Y - 40, w: 80, h: 40, interacted: false, visible: true, data: { filled: false } });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 5500, y: WORLD.GROUND_Y - 140, w: 100, h: 140, interacted: false, visible: true });
    } else if (episode === 4) {
      onZoneChange("The Recurrence");
      s.player.pos.x = 200;
      entities.push({ id: 'boss', type: EntityType.BOSS, x: 600, y: WORLD.GROUND_Y - 180, w: 60, h: 180, interacted: false, visible: true, data: { hp: 20, maxHp: 20, stunTimer: 0, hitsTaken: 0 } });
    }
    s.entities = entities;
    generateWhisper(`A watcher returns to the cycle. Episode ${episode}.`);
  }, [episode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = true;
      if (e.code === 'KeyE') {
        if (stateRef.current.dialogueActive) { 
          onDialogue(null); 
          stateRef.current.dialogueActive = false; 
        } else { 
          stateRef.current.player.isInteracting = true; 
          stateRef.current.player.interactionPressed = true;
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = false;
      if (e.code === 'Space') stateRef.current.player.isSlashing = false;
      if (e.code === 'KeyE') { 
        stateRef.current.player.isInteracting = false; 
        stateRef.current.player.draggingItem = null; 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { 
      window.removeEventListener('keydown', handleKeyDown); 
      window.removeEventListener('keyup', handleKeyUp); 
    };
  }, [onDialogue]);

  const checkOverlap = (r1: Box, r2: Box) => r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;

  const updateBoss = (dt: number) => {
    const s = stateRef.current;
    const boss = s.entities.find(e => e.type === EntityType.BOSS);
    if (!boss || boss.interacted) return;

    if (boss.data.stunTimer > 0) {
      boss.data.stunTimer -= dt;
      boss.data.hitsTaken = 0;
      return;
    }

    s.bossTimer += dt;
    if (s.bossInvuln > 0) s.bossInvuln -= dt;

    const dist = s.player.pos.x - boss.x;
    const phase = boss.data.hp > 10 ? 1 : 2;

    if (s.bossTimer > (3.5 - phase * 0.7)) {
      s.bossTimer = 0;
      if (Math.abs(dist) > 350) s.bossAction = 'THROW';
      else s.bossAction = 'DASH';
    }

    if (s.bossAction === 'DASH') {
      boss.x += Math.sign(dist) * (14 + phase * 4);
      if (Math.abs(dist) < 50) { 
        s.bossAction = 'WAIT'; 
        triggerJuice(15);
        spawnParticles(boss.x + 30, WORLD.GROUND_Y, COLORS.WHITE, 5);
      }
    } else if (s.bossAction === 'THROW') {
      s.entities.push({ 
        id: `p${Date.now()}`, 
        type: EntityType.PROJECTILE, 
        x: boss.x + 30, 
        y: boss.y + 60, 
        w: 35, h: 8, 
        visible: true, 
        interacted: false, 
        data: { vx: Math.sign(dist) * (18 + phase * 2) } 
      });
      s.bossAction = 'WAIT';
    } else {
      boss.x += Math.sign(dist) * (4 + phase);
    }

    if (checkOverlap({x: s.player.pos.x, y: s.player.pos.y, w: 40, h: 80}, boss)) {
      if (s.player.isShielding) {
        s.player.vel.x = -Math.sign(dist) * 8;
        spawnParticles(s.player.pos.x + 20, s.player.pos.y + 40, COLORS.WHITE, 10);
      } else {
        s.player.vel.x = -Math.sign(dist) * 22;
        s.player.hp--;
        triggerJuice(15, 0.05);
        spawnParticles(s.player.pos.x + 20, s.player.pos.y + 40, "#ff0000", 6);
        if (s.player.hp <= 0) resetBossLevel();
      }
    }
  };

  const updateEntities = (dt: number) => {
    const s = stateRef.current;
    const p = s.player;

    const slashBox = { x: p.facingRight ? p.pos.x + 40 : p.pos.x - 120, y: p.pos.y, w: 140, h: 80 };
    const interactBox = { x: p.pos.x - 40, y: p.pos.y - 30, w: 120, h: 140 };

    for (let i = s.entities.length - 1; i >= 0; i--) {
      const ent = s.entities[i];
      if (!ent.visible) continue;

      if (checkOverlap(interactBox, ent)) {
        if (ent.type === EntityType.DOOR && p.interactionPressed) {
          const req = episode === 1 ? 3 : 1;
          if (p.tasksCompleted >= req) onFinish();
          else { generateWhisper(`Blocked.`); triggerJuice(8); }
        }
        if (ent.type === EntityType.PILLAR && p.interactionPressed && !ent.interacted) {
          ent.data.tilt += (ent.data.tilt < 0 ? 12 : -12);
          triggerJuice(10);
          if (Math.abs(ent.data.tilt) < 5) {
            ent.data.tilt = 0; ent.interacted = true;
            if (s.entities.filter(e => e.type === EntityType.PILLAR).every(p => p.interacted)) {
              completeTask('pillar', "Monoliths aligned.");
            }
          }
        }
        if (ent.type === EntityType.DRAGGABLE_STONE && p.isInteracting && episode !== 4) {
          p.draggingItem = ent.id;
          ent.x = p.facingRight ? p.pos.x + 50 : p.pos.x - 70;
        }
        if (ent.type === EntityType.COLLECTIBLE_BONE && !ent.interacted && p.interactionPressed) {
          ent.visible = false; p.carriedItem = 'bone'; 
          completeTask('bone_collect', "Marrow of memory.");
        }
        if (ent.type === EntityType.OFFERING_BOWL && p.carriedItem === 'bone' && p.interactionPressed) {
          ent.data.filled = true; p.carriedItem = null; 
          completeTask('bowl_fill', "Offering accepted.");
        }
      }

      if (ent.type === EntityType.PEDESTAL && !ent.interacted) {
        const stone = s.entities.find(e => e.id === 'stone');
        if (stone && checkOverlap(stone, ent)) {
          ent.interacted = true; completeTask('altar', "Altar set.");
        }
      }

      if (p.isSlashing && checkOverlap(slashBox, ent)) {
        if (ent.type === EntityType.MOUND && !ent.interacted) {
          ent.data.hits++;
          spawnParticles(ent.x + 20, ent.y + 30, COLORS.WHITE, 5);
          triggerJuice(6, 0.05);
          if (ent.data.hits >= 4) {
            ent.interacted = true; ent.visible = false;
            if (ent.data.hasRing || ent.data.hasCore) completeTask('mound_' + ent.id, "Unearthed.");
          }
        }
        if (ent.type === EntityType.BOSS && s.bossInvuln <= 0 && ent.data.stunTimer <= 0) {
          ent.data.hp--; 
          ent.data.hitsTaken++;
          s.bossInvuln = 0.4;
          triggerJuice(35, 0.18);
          spawnParticles(ent.x + 30, ent.y + 60, '#ff0000', 25);
          if (ent.data.hitsTaken >= 4) {
             ent.data.stunTimer = 5;
             generateWhisper("Stunned by your resolve.");
          }
          if (ent.data.hp <= 0) { ent.interacted = true; onFinish(); }
        }
      }

      if (ent.type === EntityType.PROJECTILE) {
        ent.x += ent.data.vx;
        if (checkOverlap({x: p.pos.x, y: p.pos.y, w: 40, h: 80}, ent)) {
          s.entities.splice(i, 1);
          if (p.isShielding) {
            triggerJuice(5, 0.05);
            spawnParticles(p.pos.x + 20, p.pos.y + 40, COLORS.WHITE, 15);
          } else {
            p.hp--;
            triggerJuice(25, 0.12);
            p.vel.x = -Math.sign(ent.data.vx) * 22;
            spawnParticles(p.pos.x + 20, p.pos.y + 40, COLORS.WHITE, 12);
            if (p.hp <= 0) resetBossLevel();
          }
        } else if (Math.abs(ent.x - s.camera.x) > 1500) {
          s.entities.splice(i, 1);
        }
      }
    }
    p.interactionPressed = false;
  };

  const updatePhysics = (dt: number) => {
    const s = stateRef.current;
    const p = s.player;
    let windForce = 0;
    s.entities.forEach(e => {
      if (e.type === EntityType.WIND_TUNNEL && checkOverlap({x: p.pos.x, y: p.pos.y, w: 40, h: 80}, e)) windForce = e.data.force;
    });

    if (episode === 4 && s.keys['KeyE']) {
      p.isShielding = true;
      p.vel.x *= 0.7; // Slow down while shielding
    } else {
      p.isShielding = false;
    }

    const speedMod = 1 - (p.tasksCompleted * 0.15);
    const moveS = PHYSICS.MOVE_SPEED * speedMod;
    
    if (!s.dialogueActive) {
      if (s.keys['ArrowRight']) { p.vel.x += moveS * 0.5; p.facingRight = true; }
      else if (s.keys['ArrowLeft']) { p.vel.x -= moveS * 0.5; p.facingRight = false; }
      else p.vel.x *= PHYSICS.FRICTION;
    }
    p.vel.x += windForce;
    
    const maxS = p.draggingItem || p.isShielding ? 2.5 : PHYSICS.MAX_SPEED;
    p.vel.x = Math.max(-maxS, Math.min(maxS, p.vel.x));
    
    p.vel.y += PHYSICS.GRAVITY;
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;

    if (p.pos.y > WORLD.GROUND_Y - 80) {
      if (!s.lastGrounded) {
        triggerJuice(Math.abs(p.vel.y) * 0.5);
        spawnParticles(p.pos.x + 20, WORLD.GROUND_Y, COLORS.GREY, 10);
      }
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
    const h = WORLD.HEIGHT;
    s.bgLayers.forEach(l => {
      ctx.fillStyle = l.color;
      const xOffset = -(s.camera.x * l.speed) % w;
      for (let i = -1; i < 3; i++) {
        const drawX = xOffset + (i * w);
        ctx.fillRect(drawX, WORLD.GROUND_Y - l.h, w, l.h);
        l.objects.forEach(obj => {
          const driftY = obj.drift ? Math.sin(Date.now()/2000 * obj.drift) * 20 : 0;
          const ox = drawX + obj.x;
          const oy = WORLD.GROUND_Y - obj.h - obj.y + driftY;
          if (obj.type === 'rect') ctx.fillRect(ox, oy, obj.w, obj.h);
          else if (obj.type === 'arch') { ctx.fillRect(ox, oy, obj.w, obj.h); ctx.clearRect(ox + 20, oy + 40, obj.w - 40, obj.h); }
          else if (obj.type === 'pillar') { ctx.fillRect(ox, oy, obj.w, obj.h); ctx.fillRect(ox - 15, oy, obj.w + 30, 20); }
          else if (obj.type === 'monolith') { ctx.beginPath(); ctx.moveTo(ox, oy + obj.h); ctx.lineTo(ox + obj.w / 2, oy); ctx.lineTo(ox + obj.w, oy + obj.h); ctx.fill(); }
        });
      }
    });
    ctx.fillStyle = episode === 3 ? 'rgba(255,120,0,0.2)' : 'rgba(255,255,255,0.18)';
    s.weatherParticles.forEach(p => {
      p.x -= p.v; p.y += Math.sin(Date.now()/2000 + p.x) * 0.4;
      if (p.x < 0) p.x = w; if (p.y > h) p.y = 0;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const p = stateRef.current.player;
    const squash = 1 + (Math.abs(p.vel.y) * 0.03);
    const stretch = 1 / squash;
    const burdenAlpha = Math.min(0.9, p.tasksCompleted * 0.25);
    const palette = [COLORS.EPISODE_1, COLORS.EPISODE_2, COLORS.EPISODE_3, COLORS.EPISODE_4][episode - 1];

    ctx.save(); ctx.translate(p.pos.x + 20, p.pos.y + 80); if (!p.facingRight) ctx.scale(-1, 1);
    ctx.scale(stretch, squash);
    
    // Core
    ctx.fillStyle = palette.player; 
    ctx.fillRect(-15, -80, 30, 45); 
    ctx.fillRect(-12, -98, 24, 24);  
    ctx.fillRect(-12, -35, 10, 35);  
    ctx.fillRect(2, -35, 10, 35);   

    if (p.isShielding) {
       ctx.strokeStyle = COLORS.WHITE; ctx.lineWidth = 4; ctx.strokeRect(-25, -110, 50, 115);
       ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-25, -110, 50, 115);
    }
    
    ctx.fillStyle = `rgba(0,0,0,${burdenAlpha})`; 
    ctx.fillRect(-15, -80, 30, 80);
    
    ctx.fillStyle = COLORS.ORANGE; 
    ctx.save(); ctx.translate(8, -70);
    if (p.isSlashing) { ctx.rotate(Math.sin(Date.now()/30) * 2.8); ctx.fillRect(-8, 0, 16, 55); }
    else { ctx.rotate(0.4 + Math.sin(Date.now()/400) * 0.15); ctx.fillRect(-6, 0, 12, 40); }
    ctx.restore();
    ctx.restore();
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean, stunTimer: number) => {
    const bob = Math.sin(Date.now() / 250) * 15;
    ctx.save(); ctx.translate(x + 30, y + 180 + bob); if (!facingRight) ctx.scale(-1, 1);
    
    if (stunTimer > 0) ctx.globalAlpha = 0.5 + Math.sin(Date.now()/50)*0.5;

    ctx.fillStyle = COLORS.BOSS; ctx.beginPath(); 
    ctx.moveTo(-60, 0); ctx.lineTo(-30, -110); ctx.lineTo(30, -180); ctx.lineTo(90, -110); ctx.lineTo(50, 0); ctx.fill(); 
    ctx.fillStyle = COLORS.ORANGE; ctx.beginPath(); ctx.arc(30, -150, 12, 0, Math.PI*2); ctx.fill(); 
    
    // Wings animation
    const wingAngle = Math.sin(Date.now() / 150) * 0.5;
    ctx.save(); ctx.translate(-20, -120); ctx.rotate(wingAngle); ctx.fillStyle = COLORS.BOSS; ctx.fillRect(-100, -20, 100, 40); ctx.restore();
    ctx.save(); ctx.translate(40, -120); ctx.rotate(-wingAngle); ctx.fillStyle = COLORS.BOSS; ctx.fillRect(0, -20, 100, 40); ctx.restore();

    ctx.lineWidth = 26; ctx.strokeStyle = COLORS.ORANGE; ctx.beginPath(); ctx.moveTo(45,-120); 
    ctx.quadraticCurveTo(100, -100, 130, 80); ctx.stroke();
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;
    const palette = [COLORS.EPISODE_1, COLORS.EPISODE_2, COLORS.EPISODE_3, COLORS.EPISODE_4][episode - 1];
    ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, 800, 600);
    drawBackground(ctx);
    ctx.save();
    const sx = (Math.random() - 0.5) * s.shake;
    const sy = (Math.random() - 0.5) * s.shake;
    ctx.translate(-s.camera.x + sx, sy);
    ctx.fillStyle = '#000'; ctx.fillRect(s.camera.x - 500, WORLD.GROUND_Y, 2000, 100);

    s.entities.forEach(ent => {
      if (!ent.visible) return;
      if (ent.type === EntityType.PILLAR) {
        ctx.save(); ctx.translate(ent.x + 20, ent.y + 180); ctx.rotate(ent.data.tilt * Math.PI / 180);
        ctx.fillStyle = '#3A3F4B'; ctx.fillRect(-20, -180, 40, 180); ctx.fillStyle = '#1C1E26'; ctx.fillRect(-30, -185, 60, 20);
        ctx.restore();
      } else if (ent.type === EntityType.DOOR) {
        ctx.fillStyle = '#000'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
        if (Math.abs(s.player.pos.x - ent.x) < 300) { ctx.strokeStyle = COLORS.ORANGE; ctx.lineWidth = 8; ctx.strokeRect(ent.x - 12, ent.y - 12, ent.w + 24, ent.h + 24); }
      } else if (ent.type === EntityType.PEDESTAL) { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.MOUND) { ctx.fillStyle = '#555'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.DRAGGABLE_STONE) { ctx.fillStyle = '#4B3621'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.OFFERING_BOWL) { ctx.fillStyle = '#111'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); if (ent.data.filled) { ctx.fillStyle = COLORS.ORANGE; ctx.fillRect(ent.x + 10, ent.y - 25, ent.w - 20, 25); } }
      else if (ent.type === EntityType.BOSS) { drawBoss(ctx, ent.x, ent.y, s.player.pos.x > ent.x, ent.data.stunTimer); }
      else if (ent.type === EntityType.PROJECTILE) { ctx.fillStyle = '#fff'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.COLLECTIBLE_BONE) { ctx.fillStyle = COLORS.WHITE; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); ctx.fillStyle = '#ddd'; ctx.fillRect(ent.x + 2, ent.y + 2, ent.w - 4, ent.h - 4); }
    });

    drawPlayer(ctx);
    for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 6, 6); }
    ctx.restore();

    // Episode 4 HUD
    if (episode === 4) {
      const boss = s.entities.find(e => e.type === EntityType.BOSS);
      if (boss) {
        // Boss Health Bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(150, 40, 500, 25);
        const bPct = Math.max(0, boss.data.hp / boss.data.maxHp);
        ctx.fillStyle = COLORS.ORANGE; ctx.fillRect(155, 45, 490 * bPct, 15);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(150, 40, 500, 25);
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText("BIRD OF THE CYCLE", 150, 35);
      }
      // Player Health Bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(40, 40, 100, 20);
      const pPct = s.player.hp / s.player.maxHp;
      ctx.fillStyle = palette.player; ctx.fillRect(45, 45, 90 * pPct, 10);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(40, 40, 100, 20);
    }
  };

  const loop = (time: number) => {
    let dt = (time - stateRef.current.lastTime) / 1000; stateRef.current.lastTime = time;
    if (dt > 0.1) dt = 0.016;
    if (stateRef.current.hitStop > 0) { stateRef.current.hitStop -= dt; dt = 0; }
    stateRef.current.shake *= JUICE.SHAKE_DECAY;
    if (stateRef.current.shake < 0.1) stateRef.current.shake = 0;
    for (let i = stateRef.current.particles.length - 1; i >= 0; i--) { const p = stateRef.current.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt; if (p.life <= 0) stateRef.current.particles.splice(i, 1); }
    if (gameState === GameState.PLAYING && dt > 0) {
      updatePhysics(dt); updateEntities(dt);
      if (episode === 4) updateBoss(dt);
      const tx = episode === 4 ? 0 : stateRef.current.player.pos.x - 400;
      stateRef.current.camera.x += (tx - stateRef.current.camera.x) * 0.14;
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
