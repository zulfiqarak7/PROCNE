import React, { useRef, useEffect } from 'react';
import { GameState, EntityType, Entity, Particle, PlayerState, Box } from './types';
import { COLORS, PHYSICS, WORLD, TASKS } from './constants';

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
    bossInvuln: 0
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    stateRef.current.dialogueActive = false;
    onDialogue(null);

    const p = stateRef.current.player;
    p.pos = { x: 100, y: WORLD.GROUND_Y - 80 };
    p.vel = { x: 0, y: 0 };
    p.grounded = false;
    p.items = [];
    p.tasksCompleted = 0;
    p.draggingItem = null;
    p.carriedItem = null;
    p.isInteracting = false;
    p.interactionPressed = false;

    stateRef.current.camera = { x: 0 };
    stateRef.current.cutsceneTimer = 0;
    stateRef.current.bossPhase = 0;
    stateRef.current.bossTimer = 0;
    stateRef.current.bossInvuln = 0;
    stateRef.current.particles = [];
    
    const entities: Entity[] = [];
    
    if (episode === 1) {
      entities.push({ id: 'm1', type: EntityType.MOUND, x: 1200, y: WORLD.GROUND_Y - 60, w: 50, h: 60, interacted: false, visible: true, data: { hits: 0, style: 'urn' } });
      entities.push({ id: 'm2', type: EntityType.MOUND, x: 2000, y: WORLD.GROUND_Y - 70, w: 40, h: 70, interacted: false, visible: true, data: { hits: 0, style: 'effigy', hasRing: true } });
      entities.push({ id: 'p1', type: EntityType.PILLAR, x: 3200, y: WORLD.GROUND_Y - 180, w: 50, h: 180, interacted: false, visible: true, data: { tilt: -25 } });
      entities.push({ id: 'p2', type: EntityType.PILLAR, x: 3800, y: WORLD.GROUND_Y - 180, w: 50, h: 180, interacted: false, visible: true, data: { tilt: 25 } });
      entities.push({ id: 'stone', type: EntityType.DRAGGABLE_STONE, x: 5000, y: WORLD.GROUND_Y - 60, w: 60, h: 60, interacted: false, visible: true });
      entities.push({ id: 'pedestal', type: EntityType.PEDESTAL, x: 6000, y: WORLD.GROUND_Y - 20, w: 100, h: 20, interacted: false, visible: true });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 7000, y: WORLD.GROUND_Y - 140, w: 100, h: 140, interacted: false, visible: true });
    } else if (episode === 2) {
      entities.push({ id: 'w1', type: EntityType.WIND_TUNNEL, x: 800, y: WORLD.GROUND_Y - 250, w: 800, h: 250, interacted: false, visible: true, data: { force: -0.6 } });
      entities.push({ id: 'm3', type: EntityType.MOUND, x: 1200, y: WORLD.GROUND_Y - 80, w: 40, h: 80, interacted: false, visible: true, data: { hits: 0 } });
      entities.push({ id: 'w2', type: EntityType.WIND_TUNNEL, x: 2000, y: WORLD.GROUND_Y - 250, w: 1200, h: 250, interacted: false, visible: true, data: { force: -0.8 } });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 4000, y: WORLD.GROUND_Y - 140, w: 100, h: 140, interacted: false, visible: true });
    } else if (episode === 3) {
      entities.push({ id: 'b1', type: EntityType.COLLECTIBLE_BONE, x: 1000, y: WORLD.GROUND_Y - 30, w: 30, h: 30, interacted: false, visible: true });
      entities.push({ id: 'bowl1', type: EntityType.OFFERING_BOWL, x: 2000, y: WORLD.GROUND_Y - 40, w: 80, h: 40, interacted: false, visible: true, data: { filled: false } });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 4500, y: WORLD.GROUND_Y - 140, w: 100, h: 140, interacted: false, visible: true });
    } else if (episode === 4) {
      stateRef.current.player.pos.x = 200;
      entities.push({ id: 'boss', type: EntityType.BOSS, x: 600, y: WORLD.GROUND_Y - 100, w: 40, h: 80, interacted: false, visible: true, data: { hp: 15, maxHp: 15 } });
      entities.push({ id: 'wall_left', type: EntityType.PLATFORM, x: -50, y: 0, w: 50, h: WORLD.HEIGHT, interacted: false, visible: true });
      entities.push({ id: 'wall_right', type: EntityType.PLATFORM, x: 800, y: 0, w: 50, h: WORLD.HEIGHT, interacted: false, visible: true });
    }

    stateRef.current.entities = entities;

    setTimeout(() => {
        if (episode === 2) onDialogue("The Weaver's Tongue lashes. I must brace against the Gale.");
        if (episode === 3) onDialogue("Ash is all that remains of the hunger.");
        if (episode === 4) onDialogue("You remember this form? It was yours once.");
        if (episode > 1) stateRef.current.dialogueActive = true; 
    }, 100);
  }, [episode]);

  // --- INPUT ---
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

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        stateRef.current.particles.push({
            x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 0.8, color,
        });
    }
  };

  // --- UPDATES ---
  const updateBoss = (dt: number) => {
      const { entities, player } = stateRef.current;
      const boss = entities.find(e => e.type === EntityType.BOSS);
      if (!boss || boss.interacted) return;

      stateRef.current.bossTimer += dt;
      if (stateRef.current.bossInvuln > 0) stateRef.current.bossInvuln -= dt;

      const dist = player.pos.x - boss.x;
      const absDist = Math.abs(dist);
      const phase = boss.data.hp > 10 ? 1 : boss.data.hp > 5 ? 2 : 3;

      if (stateRef.current.bossTimer > (3.5 - phase * 0.7)) {
          stateRef.current.bossTimer = 0;
          if (absDist > 300) {
              stateRef.current.bossAction = 'THROW';
              entities.push({
                  id: `p${Date.now()}`,
                  type: EntityType.PROJECTILE,
                  x: boss.x + 20,
                  y: boss.y + 40,
                  w: 30,
                  h: 5,
                  visible: true,
                  interacted: false,
                  data: { vx: Math.sign(dist) * (10 + phase * 2) }
              });
          } else if (absDist < 200 && Math.random() > 0.4) {
              stateRef.current.bossAction = 'DASH';
              spawnParticles(boss.x + 20, boss.y + 70, COLORS.WHITE, 10);
          } else {
              stateRef.current.bossAction = 'JUMP';
          }
      }

      if (stateRef.current.bossAction === 'DASH') {
          boss.x += Math.sign(dist) * 15;
          if (absDist < 30) stateRef.current.bossAction = 'WAIT';
      } else if (stateRef.current.bossAction === 'JUMP') {
          boss.y -= 15;
          boss.x += Math.sign(dist) * 6;
          if (boss.y < WORLD.GROUND_Y - 250) stateRef.current.bossAction = 'FALL';
      } else if (stateRef.current.bossAction === 'FALL') {
          boss.y += 20;
          if (boss.y >= WORLD.GROUND_Y - 80) {
              boss.y = WORLD.GROUND_Y - 80;
              stateRef.current.bossAction = 'WAIT';
              spawnParticles(boss.x + 20, boss.y + 80, COLORS.GREY, 15);
          }
      } else {
          boss.x += Math.sign(dist) * (2 + phase);
      }

      // Contact Damage
      if (checkOverlap({x: player.pos.x, y: player.pos.y, w: 40, h: 80}, boss)) {
          player.vel.x = -Math.sign(dist) * 12;
          player.vel.y = -5;
          spawnParticles(player.pos.x + 20, player.pos.y + 40, "#FF0000", 5);
      }
  };

  const updateEntities = (dt: number) => {
    const { player, entities, particles } = stateRef.current;

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (ent.type === EntityType.PROJECTILE) {
            ent.x += ent.data.vx;
            if (ent.x < 0 || ent.x > WORLD.VIEWPORT_WIDTH) entities.splice(i, 1);
            else if (checkOverlap({x: player.pos.x, y: player.pos.y, w: 40, h: 80}, ent)) {
                spawnParticles(player.pos.x + 20, player.pos.y + 40, COLORS.ORANGE, 10);
                player.vel.x = -Math.sign(ent.data.vx) * 15;
                entities.splice(i, 1);
            }
        }
    }

    entities.forEach(ent => {
        const slashBox = { x: player.facingRight ? player.pos.x + 40 : player.pos.x - 100, y: player.pos.y, w: 110, h: 80 };
        const interactBox = { x: player.pos.x - 20, y: player.pos.y - 10, w: 80, h: 100 };

        if (player.isSlashing && checkOverlap(slashBox, ent)) {
            if (ent.type === EntityType.MOUND && !ent.interacted) {
                ent.data.hits = (ent.data.hits || 0) + 1;
                spawnParticles(ent.x + ent.w/2, ent.y + ent.h/2, COLORS.WHITE, 4);
                if (ent.data.hits >= 4) { ent.interacted = true; ent.visible = false; if (ent.data.hasRing) completeTask(1, "A ring. Burned, but whole."); }
            }
            if (ent.type === EntityType.BOSS && stateRef.current.bossInvuln <= 0) {
                ent.data.hp -= 1;
                stateRef.current.bossInvuln = 0.5;
                spawnParticles(ent.x + 20, ent.y + 40, "#FF0000", 20);
                if (ent.data.hp <= 0) { ent.interacted = true; startCutscene(); }
            }
        }

        if (checkOverlap(interactBox, ent)) {
            if (ent.type === EntityType.PILLAR && !ent.interacted && player.interactionPressed) {
                ent.data.tilt = (ent.data.tilt || 0) + (ent.data.tilt < 0 ? 12 : -12);
                if (Math.abs(ent.data.tilt) < 5) { ent.data.tilt = 0; ent.interacted = true; checkPillarCompletion(); }
            }
            if (ent.type === EntityType.DRAGGABLE_STONE && player.isInteracting) {
                player.draggingItem = ent.id;
                ent.x = player.facingRight ? player.pos.x + 45 : player.pos.x - 65;
                const pedestal = entities.find(e => e.type === EntityType.PEDESTAL);
                if (pedestal && Math.abs(ent.x - pedestal.x) < 50) {
                    ent.x = pedestal.x + 20; ent.y = pedestal.y - ent.h; ent.interacted = true; player.draggingItem = null;
                    completeTask(4, "The earth remembers.");
                }
            }
            if (ent.type === EntityType.COLLECTIBLE_BONE && !ent.interacted && player.interactionPressed) {
                if (!player.carriedItem) player.carriedItem = ent.id;
                else if (player.carriedItem === ent.id) {
                    const bowl = entities.find(e => e.type === EntityType.OFFERING_BOWL && checkOverlap(interactBox, e));
                    if (bowl) { bowl.data.filled = true; ent.interacted = true; ent.visible = false; player.carriedItem = null; completeTask(5, "Feeding the ghosts."); }
                    else player.carriedItem = null;
                }
            }
            if (ent.type === EntityType.DOOR && player.interactionPressed) startCutscene();
        }
    });
    player.interactionPressed = false;
  };

  const updatePhysics = (dt: number) => {
    const { player, keys, entities } = stateRef.current;
    
    let windForce = 0;
    entities.forEach(ent => {
        if (ent.type === EntityType.WIND_TUNNEL && checkOverlap({x: player.pos.x, y: player.pos.y, w: 40, h: 80}, ent)) {
            windForce = ent.data.force || 0;
            if (player.isSlashing) windForce *= 0.2; // Brace harder
        }
    });

    const currentSpeed = PHYSICS.MOVE_SPEED * (1 - player.tasksCompleted * 0.08);

    if (!stateRef.current.dialogueActive) {
      if (keys['ArrowRight']) { player.vel.x += currentSpeed * 0.3; player.facingRight = true; }
      else if (keys['ArrowLeft']) { player.vel.x -= currentSpeed * 0.3; player.facingRight = false; }
      else player.vel.x *= PHYSICS.FRICTION;
    }

    player.vel.x += windForce;
    const maxS = player.draggingItem ? 3 : PHYSICS.MAX_SPEED;
    player.vel.x = Math.max(-maxS, Math.min(maxS, player.vel.x));

    player.vel.y += PHYSICS.GRAVITY;
    player.pos.x += player.vel.x;
    player.pos.y += player.vel.y;

    if (player.pos.y > WORLD.GROUND_Y - 80) { player.pos.y = WORLD.GROUND_Y - 80; player.vel.y = 0; player.grounded = true; }
    else player.grounded = false;

    if (keys['Space'] && player.grounded) { player.vel.y = PHYSICS.JUMP_FORCE; player.grounded = false; spawnParticles(player.pos.x+20, player.pos.y+80, COLORS.WHITE, 5); }
    if (keys['Space'] && !player.grounded) player.isSlashing = true;

    // Collisions
    entities.forEach(ent => {
        if ((ent.type === EntityType.PLATFORM || ent.type === EntityType.MOUND) && ent.visible) {
            if (checkOverlap({x: player.pos.x, y: player.pos.y, w: 40, h: 80}, ent)) {
                if (player.vel.y > 0 && player.pos.y + 80 - player.vel.y <= ent.y) { player.pos.y = ent.y - 80; player.vel.y = 0; player.grounded = true; }
            }
        }
    });

    if (player.carriedItem) {
        const item = entities.find(e => e.id === player.carriedItem);
        if (item) { item.x = player.pos.x + (player.facingRight ? 10 : -10); item.y = player.pos.y + 20; }
    }
    if (player.pos.x < 0) player.pos.x = 0;
  };

  const updateCamera = () => {
    if (episode === 4) stateRef.current.camera.x = 0;
    else {
        const targetX = stateRef.current.player.pos.x - WORLD.VIEWPORT_WIDTH / 3;
        stateRef.current.camera.x += (targetX - stateRef.current.camera.x) * 0.1;
        if (stateRef.current.camera.x < 0) stateRef.current.camera.x = 0;
    }
  };

  const completeTask = (idx: number, msg: string) => {
    if (!stateRef.current.player.items.includes(`t${idx}`)) {
        stateRef.current.player.items.push(`t${idx}`);
        stateRef.current.player.tasksCompleted++;
        onTaskComplete(stateRef.current.player.tasksCompleted);
        onDialogue(msg);
        stateRef.current.dialogueActive = true;
    }
  };

  const checkPillarCompletion = () => {
    if (stateRef.current.entities.filter(e => e.type === EntityType.PILLAR).every(p => p.interacted)) completeTask(2, "Ruins aligned. The path opens.");
  };

  const startCutscene = () => {
    stateRef.current.cutsceneTimer = 0.01;
    setTimeout(onFinish, 10000);
  };

  // --- DRAWING HELPERS ---
  const drawAncientPillar = (ctx: CanvasRenderingContext2D, ent: Entity) => {
      ctx.save();
      ctx.translate(ent.x + ent.w/2, ent.y + ent.h);
      ctx.rotate((ent.data.tilt || 0) * Math.PI / 180);
      ctx.fillStyle = "#556";
      ctx.fillRect(-ent.w/2, -ent.h, ent.w, ent.h);
      ctx.strokeStyle = "#889";
      ctx.lineWidth = 2;
      ctx.strokeRect(-ent.w/2 + 5, -ent.h + 10, ent.w - 10, ent.h - 20);
      // Cracks
      ctx.beginPath(); ctx.moveTo(-10, -50); ctx.lineTo(10, -80); ctx.stroke();
      ctx.restore();
  };

  const drawPatternedBox = (ctx: CanvasRenderingContext2D, ent: Entity) => {
      ctx.fillStyle = "#654"; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
      ctx.strokeStyle = "#432"; ctx.strokeRect(ent.x + 5, ent.y + 5, ent.w - 10, ent.h - 10);
      ctx.beginPath(); ctx.moveTo(ent.x, ent.y); ctx.lineTo(ent.x+ent.w, ent.y+ent.h); ctx.stroke();
  };

  const drawHuman = (ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean, bodyColor: string, armColor: string, isSlashing: boolean) => {
    ctx.save(); ctx.translate(x + 20, y + 80); if (!facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = bodyColor; ctx.fillRect(-8, -35, 6, 35); ctx.fillRect(2, -35, 6, 35); // Legs
    ctx.fillRect(-10, -70, 20, 35); ctx.fillRect(-8, -86, 16, 16); // Body & Head
    ctx.fillStyle = armColor; ctx.save(); ctx.translate(0, -60);
    if (isSlashing) ctx.rotate(Math.sin(Date.now()/50)*1.8); ctx.fillRect(-4, 0, 8, 30); ctx.restore(); ctx.restore();
  };

  const drawBird = (ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean, isSlashing: boolean) => {
    ctx.save(); ctx.translate(x + 20, y + 80); if (!facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(-35, 0); ctx.lineTo(-15, -60); ctx.lineTo(10, -110); ctx.lineTo(45, -60); ctx.lineTo(25, 0); ctx.fill(); // Big dark body
    ctx.fillStyle = COLORS.ORANGE; ctx.beginPath(); ctx.arc(10, -95, 6, 0, Math.PI*2); ctx.fill(); // Eye
    // Feather Arm
    ctx.lineWidth = 14; ctx.strokeStyle = COLORS.ORANGE;
    ctx.beginPath(); ctx.moveTo(20, -70); 
    const armRot = isSlashing ? Math.sin(Date.now()/40)*1.5 : -0.5;
    ctx.save(); ctx.translate(20, -70); ctx.rotate(armRot); ctx.moveTo(0,0); ctx.quadraticCurveTo(40, 20, 60, 60); ctx.stroke(); ctx.restore();
    ctx.restore();
  };

  const drawCutscene = (ctx: CanvasRenderingContext2D, timer: number) => {
     const w = WORLD.VIEWPORT_WIDTH; const h = WORLD.HEIGHT;
     const cx = w/2; const cy = h/2;
     ctx.fillStyle = "#000"; ctx.fillRect(0,0,w,h);
     let text = "";
     if (episode === 1) {
         ctx.fillStyle = COLORS.BLUE; ctx.fillRect(0, cy-100, w, 200);
         ctx.fillStyle = COLORS.WHITE; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI*2); ctx.fill();
         text = "I am the watcher. I am the cage.";
     } else if (episode === 2) {
         for(let i=0; i<10; i++) { ctx.strokeStyle = COLORS.ORANGE; ctx.beginPath(); ctx.moveTo(0, cy + Math.sin(timer+i)*50); ctx.lineTo(w, cy - Math.sin(timer+i)*50); ctx.stroke(); }
         text = "I tried to sing. Only wind came out.";
     } else if (episode === 3) {
         ctx.fillStyle = "#2e0b0b"; ctx.fillRect(cx-150, cy-150, 300, 300);
         text = "It tastes like ash. It tastes like him.";
     } else if (episode === 4) {
         const alpha = Math.min(1, timer/6); ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0,0,w,h);
     }
     if (text) {
         ctx.font = '16px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillStyle = "#fff"; ctx.fillText(text, cx, h-100);
     }
  };

  const drawParallaxBird = (ctx: CanvasRenderingContext2D, cameraX: number) => {
    const px = cameraX * 0.85; 
    ctx.save(); ctx.translate(300 + px, 200); ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(50, -100, 150, -50, 200, 0); ctx.fill();
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas || !canvas.getContext('2d')) return;
    const ctx = canvas.getContext('2d')!;
    const { player, entities, particles, camera, cutsceneTimer } = stateRef.current;

    ctx.fillStyle = episode === 4 ? COLORS.HONEY_YELLOW : COLORS.BLUE;
    if (episode === 3) ctx.fillStyle = "#2e0b0b";
    ctx.fillRect(0, 0, WORLD.VIEWPORT_WIDTH, WORLD.HEIGHT);

    if (cutsceneTimer > 0) { drawCutscene(ctx, cutsceneTimer); return; }
    if (episode !== 4) drawParallaxBird(ctx, camera.x);

    ctx.save(); ctx.translate(-camera.x, 0);
    ctx.fillStyle = episode === 4 ? "#333" : "#000"; 
    ctx.fillRect(camera.x, WORLD.GROUND_Y, WORLD.VIEWPORT_WIDTH, 100);

    entities.forEach(ent => {
        if (!ent.visible) return;
        if (ent.type === EntityType.WIND_TUNNEL) {
            ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
            for(let i=0; i<6; i++) {
                const tx = (ent.x + (Date.now()/2 + i*130) % ent.w);
                ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(tx, ent.y + i*40, 50, 2);
            }
        } else if (ent.type === EntityType.PILLAR) drawAncientPillar(ctx, ent);
        else if (ent.type === EntityType.DRAGGABLE_STONE) drawPatternedBox(ctx, ent);
        else if (ent.type === EntityType.MOUND) { ctx.fillStyle = COLORS.GREY; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); ctx.strokeStyle="#000"; ctx.strokeRect(ent.x, ent.y, ent.w, ent.h); }
        else if (ent.type === EntityType.COLLECTIBLE_BONE) { ctx.fillStyle = "#eee"; ctx.fillRect(ent.x, ent.y, 30, 10); ctx.beginPath(); ctx.arc(ent.x, ent.y+5, 6, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(ent.x+30, ent.y+5, 6, 0, Math.PI*2); ctx.fill(); }
        else if (ent.type === EntityType.OFFERING_BOWL) { ctx.fillStyle = "#444"; ctx.beginPath(); ctx.arc(ent.x+40, ent.y, 40, 0, Math.PI); ctx.fill(); if (ent.data.filled) { ctx.fillStyle=COLORS.ORANGE; ctx.fillRect(ent.x+10, ent.y+5, 60, 10); } }
        else if (ent.type === EntityType.BOSS) drawHuman(ctx, ent.x, ent.y, player.pos.x > ent.x, COLORS.WHITE, COLORS.ORANGE, stateRef.current.bossAction === 'DASH');
        else if (ent.type === EntityType.PROJECTILE) { ctx.fillStyle = COLORS.WHITE; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
        else if (ent.type === EntityType.DOOR) { ctx.fillStyle = "#000"; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); ctx.strokeStyle="#444"; ctx.strokeRect(ent.x, ent.y, ent.w, ent.h); }
    });

    if (episode === 4) drawBird(ctx, player.pos.x, player.pos.y, player.facingRight, player.isSlashing);
    else drawHuman(ctx, player.pos.x, player.pos.y, player.facingRight, COLORS.WHITE, COLORS.ORANGE, player.isSlashing);

    particles.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); });
    ctx.restore();
  };

  const loop = (time: number) => {
    let dt = (time - stateRef.current.lastTime) / 1000; stateRef.current.lastTime = time;
    if (dt > 0.05) dt = 0.016;
    if (stateRef.current.cutsceneTimer > 0) stateRef.current.cutsceneTimer += dt;
    else if (gameState === GameState.PLAYING) { 
        updatePhysics(dt); updateEntities(dt); updateCamera(); 
        if (episode === 4) updateBoss(dt);
    }
    draw(); requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => { requestRef.current = requestAnimationFrame(loop); return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, [gameState, episode]);

  return (
    <div className="relative w-full h-full flex justify-center items-center">
      <canvas ref={canvasRef} width={WORLD.VIEWPORT_WIDTH} height={WORLD.HEIGHT} className="border-4 border-black border-opacity-60 shadow-2xl" style={{ width: '100%', maxWidth: '800px', height: 'auto', aspectRatio: '4/3' }} />
    </div>
  );
};