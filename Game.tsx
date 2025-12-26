
import React, { useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GameState, EntityType, Entity, Particle, PlayerState, Box, Hint } from './types';
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
    hints: Hint[];
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
      carriedItemId: null,
      tasksCompleted: 0,
      items: [],
      animTimer: 0,
      hp: 3,
      maxHp: 3
    },
    entities: [],
    particles: [],
    hints: [],
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
      boss.y = WORLD.GROUND_Y - 240;
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
    s.player.carriedItemId = null;
    s.camera.x = 0;
    s.shake = 0;
    s.particles = [];
    s.hints = [];
    s.player.hp = 3;
    
    const entities: Entity[] = [];
    
    // --- LEVEL 1: The Barren Sands (Tutorial) ---
    if (episode === 1) {
      onZoneChange("The Barren Sands");
      
      // Hints
      s.hints.push({ x: 300, y: WORLD.GROUND_Y - 200, text: "USE ARROW KEYS TO MOVE", range: 300 });
      s.hints.push({ x: 900, y: WORLD.GROUND_Y - 200, text: "SPACE TO JUMP", range: 300 });
      s.hints.push({ x: 1500, y: WORLD.GROUND_Y - 200, text: "SPACE IN AIR TO SLASH", range: 300 });
      s.hints.push({ x: 2800, y: WORLD.GROUND_Y - 200, text: "SEARCH THE EARTH", range: 300 });
      s.hints.push({ x: 4000, y: WORLD.GROUND_Y - 350, text: "PRESS E TO ALIGN", range: 300 });
      s.hints.push({ x: 5600, y: WORLD.GROUND_Y - 200, text: "HOLD E TO DRAG", range: 300 });

      // Entities
      entities.push({ id: 'm1', type: EntityType.MOUND, x: 1500, y: WORLD.GROUND_Y - 60, w: 80, h: 60, interacted: false, visible: true, data: { hits: 0 } });
      entities.push({ id: 'm2', type: EntityType.MOUND, x: 2800, y: WORLD.GROUND_Y - 70, w: 80, h: 70, interacted: false, visible: true, data: { hits: 0, hasRing: true } });
      entities.push({ id: 'p1', type: EntityType.PILLAR, x: 4000, y: WORLD.GROUND_Y - 220, w: 40, h: 220, interacted: false, visible: true, data: { tilt: -24 } });
      entities.push({ id: 'p2', type: EntityType.PILLAR, x: 4400, y: WORLD.GROUND_Y - 220, w: 40, h: 220, interacted: false, visible: true, data: { tilt: 24 } });
      entities.push({ id: 'stone', type: EntityType.DRAGGABLE_STONE, x: 5600, y: WORLD.GROUND_Y - 80, w: 80, h: 80, interacted: false, visible: true });
      entities.push({ id: 'pedestal', type: EntityType.PEDESTAL, x: 6800, y: WORLD.GROUND_Y - 40, w: 120, h: 40, interacted: false, visible: true });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 8200, y: WORLD.GROUND_Y - 200, w: 140, h: 200, interacted: false, visible: true });
    } 
    
    // --- LEVEL 2: The Weaver's Tongue (Puzzle: Wind Turbine) ---
    else if (episode === 2) {
      onZoneChange("The Weaver's Tongue");
      
      // Hints
      s.hints.push({ x: 400, y: WORLD.GROUND_Y - 300, text: "THE WIND REJECTS YOU", range: 400 });
      s.hints.push({ x: 2200, y: WORLD.GROUND_Y - 250, text: "A MACHINE BROKEN", range: 300 });
      s.hints.push({ x: 1000, y: WORLD.GROUND_Y - 400, text: "SEEK THE GEAR", range: 300 });

      // Obstacle: Strong Wind Tunnel blocking progress at x=2500
      entities.push({ id: 'wind_force', type: EntityType.WIND_TUNNEL, x: 3000, y: WORLD.GROUND_Y - 400, w: 1500, h: 400, interacted: false, visible: true, data: { force: -2.5, active: true } });
      
      // Puzzle Item: Rusty Gear (Platforms lowered to be reachable with Jump Force -14 and Gravity 0.8)
      // Max Jump Height ~122px.
      // Ground: 500. P1: 390 (Diff 110). P2: 280 (Diff 110).
      entities.push({ id: 'platform_1', type: EntityType.PLATFORM, x: 1200, y: WORLD.GROUND_Y - 110, w: 200, h: 20, interacted: false, visible: true });
      entities.push({ id: 'platform_2', type: EntityType.PLATFORM, x: 900, y: WORLD.GROUND_Y - 220, w: 150, h: 20, interacted: false, visible: true });
      entities.push({ id: 'gear', type: EntityType.ITEM_GEAR, x: 950, y: WORLD.GROUND_Y - 260, w: 40, h: 40, interacted: false, visible: true });

      // Puzzle Machine: Broken Turbine (Before the wind tunnel)
      entities.push({ id: 'turbine', type: EntityType.MACHINE_TURBINE, x: 2200, y: WORLD.GROUND_Y - 200, w: 100, h: 200, interacted: false, visible: true, data: { fixed: false } });

      // Reward: Key (In the wind tunnel area, only accessible after wind is off)
      entities.push({ id: 'key', type: EntityType.ITEM_KEY, x: 3800, y: WORLD.GROUND_Y - 40, w: 40, h: 40, interacted: false, visible: true });

      // Exit Door (Locked)
      entities.push({ id: 'door', type: EntityType.DOOR, x: 4800, y: WORLD.GROUND_Y - 200, w: 140, h: 200, interacted: false, visible: true, data: { locked: true } });
    } 
    
    // --- LEVEL 3: The Feast of Ash (Puzzle: Alchemy) ---
    else if (episode === 3) {
      onZoneChange("The Feast of Ash");

      // Hints
      s.hints.push({ x: 400, y: WORLD.GROUND_Y - 200, text: "THE GATE THIRSTS", range: 400 });
      s.hints.push({ x: 2500, y: WORLD.GROUND_Y - 300, text: "GATHER THE TRINITY", range: 400 });
      s.hints.push({ x: 2500, y: WORLD.GROUND_Y - 150, text: "SULFUR. MERCURY. SALT.", range: 400 });

      // Central Hub: Alchemy Cauldron
      entities.push({ id: 'cauldron', type: EntityType.ALCHEMY_CAULDRON, x: 2500, y: WORLD.GROUND_Y - 120, w: 120, h: 120, interacted: false, visible: true, data: { ingredients: 0, maxIngredients: 3, complete: false } });

      // Ingredient 1: Sulfur (Yellow) - Hidden in a mound
      entities.push({ id: 'mound_sulfur', type: EntityType.MOUND, x: 1000, y: WORLD.GROUND_Y - 60, w: 80, h: 60, interacted: false, visible: true, data: { hits: 0, hasItem: 'sulfur' } });
      
      // Ingredient 2: Salt (White) - On top of pillars (Lowered to be reachable)
      entities.push({ id: 'plat_salt', type: EntityType.PLATFORM, x: 3500, y: WORLD.GROUND_Y - 110, w: 100, h: 20, interacted: false, visible: true });
      entities.push({ id: 'salt', type: EntityType.ITEM_INGREDIENT, x: 3530, y: WORLD.GROUND_Y - 150, w: 40, h: 40, interacted: false, visible: true, data: { type: 'salt', color: '#fff' } });

      // Ingredient 3: Mercury (Silver) - Far right, guarded by dragging puzzle
      entities.push({ id: 'drag_block', type: EntityType.DRAGGABLE_STONE, x: 4200, y: WORLD.GROUND_Y - 100, w: 100, h: 100, interacted: false, visible: true });
      // Mercury is hidden under the stone effectively (placed behind it initially?) No, let's put it on a ledge reachable by standing on stone
      // Stone Top: 400. Platform: 310. Gap: 90 (Reachable).
      entities.push({ id: 'plat_mercury', type: EntityType.PLATFORM, x: 4200, y: WORLD.GROUND_Y - 190, w: 100, h: 20, interacted: false, visible: true });
      entities.push({ id: 'mercury', type: EntityType.ITEM_INGREDIENT, x: 4230, y: WORLD.GROUND_Y - 230, w: 40, h: 40, interacted: false, visible: true, data: { type: 'mercury', color: '#C0C0C0' } });

      // Exit Door (Locked)
      entities.push({ id: 'door', type: EntityType.DOOR, x: 5500, y: WORLD.GROUND_Y - 200, w: 140, h: 200, interacted: false, visible: true, data: { locked: true } });
    } 
    
    // --- LEVEL 4: The Recurrence (Boss) ---
    else if (episode === 4) {
      onZoneChange("The Recurrence");
      s.hints.push({ x: 400, y: WORLD.GROUND_Y - 200, text: "END THE CYCLE", range: 400 });
      s.player.pos.x = 200;
      entities.push({ id: 'boss', type: EntityType.BOSS, x: 600, y: WORLD.GROUND_Y - 240, w: 100, h: 240, interacted: false, visible: true, data: { hp: 20, maxHp: 20, stunTimer: 0, hitsTaken: 0 } });
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
        spawnParticles(boss.x + 50, WORLD.GROUND_Y, COLORS.WHITE, 5);
      }
    } else if (s.bossAction === 'THROW') {
      s.entities.push({ 
        id: `p${Date.now()}`, 
        type: EntityType.PROJECTILE, 
        x: boss.x + 50, 
        y: boss.y + 100, 
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
        // --- ITEM PICKUP LOGIC ---
        if ((ent.type === EntityType.ITEM_GEAR || ent.type === EntityType.ITEM_KEY || ent.type === EntityType.ITEM_INGREDIENT || ent.type === EntityType.ITEM_HEART) && p.interactionPressed) {
          if (p.carriedItem === null) {
            ent.visible = false;
            p.carriedItem = ent.type;
            p.carriedItemId = ent.id;
            generateWhisper(ent.type === EntityType.ITEM_GEAR ? "A rusted mechanism." : ent.type === EntityType.ITEM_KEY ? "The way forward." : "An offering for the flame.");
            triggerJuice(5);
          } else {
            generateWhisper("Hands are full.");
          }
        }

        // --- LEVEL 1 LOGIC ---
        if (ent.type === EntityType.DOOR && p.interactionPressed) {
          if (episode === 1) {
            const req = 3;
            if (p.tasksCompleted >= req) onFinish();
            else { generateWhisper(`The path is closed. Seek more.`); triggerJuice(8); }
          } else if (episode === 2) {
             if (p.carriedItem === EntityType.ITEM_KEY) {
               p.carriedItem = null;
               ent.data.locked = false;
               onFinish();
             } else {
               generateWhisper("Locked by a crystal mechanism.");
             }
          } else if (episode === 3) {
            if (p.carriedItem === EntityType.ITEM_HEART) {
               p.carriedItem = null;
               ent.data.locked = false;
               onFinish();
            } else {
               generateWhisper("It craves a heart.");
            }
          } else if (episode === 4 && ent.interacted) {
             onFinish();
          }
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

        // --- LEVEL 2 PUZZLE LOGIC (TURBINE) ---
        if (ent.type === EntityType.MACHINE_TURBINE && p.interactionPressed) {
          if (p.carriedItem === EntityType.ITEM_GEAR) {
             p.carriedItem = null;
             ent.data.fixed = true;
             // Disable wind tunnel
             const wind = s.entities.find(e => e.type === EntityType.WIND_TUNNEL);
             if (wind) wind.data.active = false;
             generateWhisper("The machine groans and halts.");
             triggerJuice(20, 0.1);
             spawnParticles(ent.x + 50, ent.y + 100, COLORS.GREY, 30);
          } else if (!ent.data.fixed) {
             generateWhisper("Missing a gear.");
          }
        }

        // --- LEVEL 3 PUZZLE LOGIC (ALCHEMY) ---
        if (ent.type === EntityType.ALCHEMY_CAULDRON && p.interactionPressed) {
           if (p.carriedItem === EntityType.ITEM_INGREDIENT) {
             p.carriedItem = null;
             ent.data.ingredients++;
             triggerJuice(10);
             spawnParticles(ent.x + 60, ent.y + 60, COLORS.ORANGE, 20);
             if (ent.data.ingredients >= 3) {
                ent.data.complete = true;
                // Spawn Heart
                s.entities.push({ id: 'heart', type: EntityType.ITEM_HEART, x: ent.x + 40, y: ent.y - 50, w: 40, h: 40, interacted: false, visible: true });
                generateWhisper("The mixture solidifies.");
             } else {
               generateWhisper(`${ent.data.ingredients} of 3 added.`);
             }
           } else if (!ent.data.complete) {
             generateWhisper("Requires Sulfur, Salt, and Mercury.");
           }
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
          spawnParticles(ent.x + 40, ent.y + 30, COLORS.WHITE, 5);
          triggerJuice(6, 0.05);
          if (ent.data.hits >= 4) {
            ent.interacted = true; ent.visible = false;
            // Reveal Item inside mound
            if (ent.data.hasRing) completeTask('mound_' + ent.id, "Unearthed.");
            if (ent.data.hasItem === 'sulfur') {
               s.entities.push({ id: 'sulfur', type: EntityType.ITEM_INGREDIENT, x: ent.x + 20, y: ent.y, w: 40, h: 40, interacted: false, visible: true, data: { type: 'sulfur', color: '#FFD700' } });
               generateWhisper("Sulfur revealed.");
            }
          }
        }
        if (ent.type === EntityType.BOSS && s.bossInvuln <= 0 && ent.data.stunTimer <= 0) {
          ent.data.hp--; 
          ent.data.hitsTaken++;
          s.bossInvuln = 0.4;
          triggerJuice(35, 0.18);
          spawnParticles(ent.x + 50, ent.y + 120, '#ff0000', 25);
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
    
    // Check Platforms first to set grounded height
    let platformY = WORLD.GROUND_Y;
    s.entities.forEach(e => {
       if (e.type === EntityType.PLATFORM && 
           p.pos.x + 20 > e.x && p.pos.x < e.x + e.w && 
           p.pos.y + 80 <= e.y + 10 && p.pos.y + 80 >= e.y - 10 && p.vel.y >= 0) {
           platformY = e.y;
       }
       if (e.type === EntityType.WIND_TUNNEL && e.data.active && checkOverlap({x: p.pos.x, y: p.pos.y, w: 40, h: 80}, e)) {
           windForce = e.data.force;
       }
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

    if (p.pos.y > platformY - 80) {
      if (!s.lastGrounded) {
        triggerJuice(Math.abs(p.vel.y) * 0.5);
        spawnParticles(p.pos.x + 20, platformY, COLORS.GREY, 10);
      }
      p.pos.y = platformY - 80; p.vel.y = 0; p.grounded = true;
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
    
    // Cloak/Torso with depth
    ctx.fillStyle = palette.player; 
    ctx.beginPath();
    ctx.roundRect(-18, -80, 36, 50, 8);
    ctx.fill();
    // Shading on cloak
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(8, -80, 10, 50);

    // Mask/Head
    ctx.fillStyle = COLORS.WHITE;
    ctx.beginPath();
    ctx.roundRect(-14, -100, 28, 28, 4);
    ctx.fill();
    // Eyes
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(-8, -88, 4, 4);
    ctx.fillRect(4, -88, 4, 4);

    // Legs with joints
    ctx.fillStyle = palette.player;
    ctx.fillRect(-12, -35, 10, 35);  
    ctx.fillRect(2, -35, 10, 35);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(-12, -15, 10, 5);
    ctx.fillRect(2, -15, 10, 5);

    if (p.isShielding) {
       ctx.strokeStyle = COLORS.WHITE; ctx.lineWidth = 4; ctx.strokeRect(-28, -110, 56, 115);
       ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-28, -110, 56, 115);
       ctx.shadowBlur = 10; ctx.shadowColor = COLORS.WHITE;
    }
    
    ctx.fillStyle = `rgba(0,0,0,${burdenAlpha})`; 
    ctx.fillRect(-18, -80, 36, 80);
    
    // Scythe/Arm or Holding Item
    if (p.carriedItem) {
        // Draw held item above head
        if (p.carriedItem === EntityType.ITEM_GEAR) {
            ctx.fillStyle = '#8B4513'; ctx.fillRect(-10, -130, 20, 20);
        } else if (p.carriedItem === EntityType.ITEM_KEY) {
            ctx.fillStyle = '#00FFFF'; ctx.fillRect(-5, -130, 10, 20);
        } else if (p.carriedItem === EntityType.ITEM_INGREDIENT) {
            ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(0, -120, 10, 0, Math.PI*2); ctx.fill();
        } else if (p.carriedItem === EntityType.ITEM_HEART) {
            ctx.fillStyle = '#DC143C'; ctx.beginPath(); ctx.arc(0, -120, 12, 0, Math.PI*2); ctx.fill();
        }
        // Hands up
        ctx.fillStyle = palette.player; ctx.fillRect(-20, -90, 10, 30); ctx.fillRect(10, -90, 10, 30);
    } else {
        // Normal Scythe
        ctx.fillStyle = COLORS.ORANGE; 
        ctx.save(); ctx.translate(12, -65);
        if (p.isSlashing) { ctx.rotate(Math.sin(Date.now()/30) * 2.8); ctx.fillRect(-10, 0, 20, 60); }
        else { ctx.rotate(0.4 + Math.sin(Date.now()/400) * 0.15); ctx.fillRect(-8, 0, 16, 45); }
        ctx.restore();
    }
    
    ctx.restore();
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean, stunTimer: number) => {
    const bob = Math.sin(Date.now() / 250) * 15;
    ctx.save(); ctx.translate(x + 50, y + 240 + bob); if (!facingRight) ctx.scale(-1, 1);
    
    if (stunTimer > 0) ctx.globalAlpha = 0.5 + Math.sin(Date.now()/50)*0.5;

    // Body (Black and taller, more defined)
    ctx.fillStyle = COLORS.BLACK;
    ctx.beginPath();
    ctx.moveTo(-100, 0);
    ctx.quadraticCurveTo(-110, -180, 0, -260); // Curved back/neck
    ctx.quadraticCurveTo(110, -180, 100, 0);
    ctx.fill();

    // Mask/Face
    ctx.fillStyle = COLORS.WHITE;
    ctx.beginPath();
    ctx.roundRect(-20, -240, 40, 50, 10);
    ctx.fill();
    
    // Orange eye
    ctx.fillStyle = COLORS.ORANGE; ctx.beginPath(); ctx.arc(0, -215, 12, 0, Math.PI*2); ctx.fill(); 
    
    // Shimmering Wings animation
    const wingAngle = Math.sin(Date.now() / 150) * 0.4;
    const shimmer = 0.8 + Math.sin(Date.now() / 100) * 0.2;
    ctx.save();
    ctx.globalAlpha *= shimmer;
    ctx.fillStyle = COLORS.BLACK;
    // L Wing
    ctx.save(); ctx.translate(-40, -180); ctx.rotate(wingAngle); 
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-150, -20); ctx.lineTo(-140, 40); ctx.closePath(); ctx.fill();
    ctx.restore();
    // R Wing
    ctx.save(); ctx.translate(60, -180); ctx.rotate(-wingAngle); 
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(150, -20); ctx.lineTo(140, 40); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();

    // Orange feather-arm (scythe) - more like a blade
    ctx.lineWidth = 35; ctx.strokeStyle = COLORS.ORANGE; 
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(70,-180); 
    ctx.quadraticCurveTo(150, -150, 180, 140); 
    ctx.stroke();
    // Blade edge
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(75,-175); ctx.quadraticCurveTo(155, -145, 185, 135); ctx.stroke();

    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;
    const palette = [COLORS.EPISODE_1, COLORS.EPISODE_2, COLORS.EPISODE_3, COLORS.EPISODE_4][episode - 1];
    ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, 800, 600);
    drawBackground(ctx);
    
    // Draw Camera Space Entities
    ctx.save();
    const sx = (Math.random() - 0.5) * s.shake;
    const sy = (Math.random() - 0.5) * s.shake;
    ctx.translate(-s.camera.x + sx, sy);
    ctx.fillStyle = '#000'; ctx.fillRect(s.camera.x - 500, WORLD.GROUND_Y, 2000, 100);

    s.entities.forEach(ent => {
      if (!ent.visible) return;
      if (ent.type === EntityType.PILLAR) {
        ctx.save(); ctx.translate(ent.x + 20, ent.y + ent.h); ctx.rotate(ent.data.tilt * Math.PI / 180);
        ctx.fillStyle = '#3A3F4B'; ctx.fillRect(-20, -ent.h, 40, ent.h); 
        // Brick details
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for(let j=0; j<ent.h; j+=30) ctx.fillRect(-15, -j-5, 10, 10);
        ctx.fillStyle = '#1C1E26'; ctx.fillRect(-30, -ent.h - 5, 60, 20);
        ctx.restore();
      } else if (ent.type === EntityType.DOOR) {
        ctx.fillStyle = '#000'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
        // Arch detail
        ctx.strokeStyle = COLORS.ORANGE; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(ent.x + ent.w/2, ent.y + ent.h/2, 40, 0, Math.PI, true); ctx.stroke();
        if (Math.abs(s.player.pos.x - ent.x) < 300) { 
           ctx.strokeStyle = COLORS.ORANGE; ctx.lineWidth = 8; ctx.strokeRect(ent.x - 12, ent.y - 12, ent.w + 24, ent.h + 24); 
        }
      } else if (ent.type === EntityType.PEDESTAL) { 
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); 
        ctx.fillStyle = '#111'; ctx.fillRect(ent.x + 10, ent.y - 10, ent.w - 20, 10);
      } else if (ent.type === EntityType.MOUND) { 
        ctx.fillStyle = '#444'; ctx.beginPath(); ctx.ellipse(ent.x + ent.w/2, ent.y + ent.h, ent.w/2, ent.h, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(ent.x + ent.w/2, ent.y + ent.h, ent.w/4, ent.h/2, 0, Math.PI, 0); ctx.fill();
      } else if (ent.type === EntityType.DRAGGABLE_STONE) { 
        ctx.fillStyle = '#4B3621'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); 
        ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 4; ctx.strokeRect(ent.x+10, ent.y+10, ent.w-20, ent.h-20);
      } else if (ent.type === EntityType.OFFERING_BOWL) { 
        ctx.fillStyle = '#111'; 
        ctx.beginPath(); ctx.moveTo(ent.x, ent.y); ctx.lineTo(ent.x + ent.w, ent.y); ctx.lineTo(ent.x + ent.w - 20, ent.y + ent.h); ctx.lineTo(ent.x + 20, ent.y + ent.h); ctx.closePath(); ctx.fill();
        if (ent.data.filled) { ctx.fillStyle = COLORS.ORANGE; ctx.fillRect(ent.x + 10, ent.y - 25, ent.w - 20, 25); ctx.shadowBlur = 10; ctx.shadowColor = COLORS.ORANGE; } 
      } else if (ent.type === EntityType.BOSS) { 
        drawBoss(ctx, ent.x, ent.y, s.player.pos.x > ent.x, ent.data.stunTimer); 
      } else if (ent.type === EntityType.PROJECTILE) { 
        ctx.fillStyle = COLORS.WHITE; ctx.beginPath(); ctx.roundRect(ent.x, ent.y, ent.w, ent.h, 4); ctx.fill();
      } else if (ent.type === EntityType.PLATFORM) {
        ctx.fillStyle = '#222'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
      } else if (ent.type === EntityType.ITEM_GEAR) {
        ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.arc(ent.x + 20, ent.y + 20, 15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ent.x + 20, ent.y + 20, 5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#654321'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ent.x+20, ent.y+20, 18, 0, Math.PI*2); ctx.stroke();
      } else if (ent.type === EntityType.ITEM_KEY) {
         ctx.fillStyle = '#00FFFF'; ctx.fillRect(ent.x+15, ent.y+5, 10, 30); ctx.fillRect(ent.x+15, ent.y+25, 20, 10);
      } else if (ent.type === EntityType.MACHINE_TURBINE) {
        ctx.fillStyle = '#555'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
        // Blades
        ctx.save(); ctx.translate(ent.x + 50, ent.y + 50); 
        if (!ent.data.fixed) ctx.rotate(0.2);
        else ctx.rotate(Date.now() / 100);
        ctx.fillStyle = '#888'; ctx.fillRect(-80, -10, 160, 20); ctx.fillRect(-10, -80, 20, 160);
        ctx.restore();
      } else if (ent.type === EntityType.ALCHEMY_CAULDRON) {
        ctx.fillStyle = '#222'; 
        ctx.beginPath(); ctx.arc(ent.x+60, ent.y+60, 50, 0, Math.PI, false); ctx.fill();
        ctx.fillRect(ent.x + 10, ent.y, 100, 60);
        // Liquid
        const fill = ent.data.ingredients / 3;
        if (fill > 0) {
            ctx.fillStyle = ent.data.complete ? '#DC143C' : '#32CD32';
            ctx.fillRect(ent.x + 20, ent.y + 60 - (50 * fill), 80, 50 * fill);
        }
      } else if (ent.type === EntityType.ITEM_INGREDIENT) {
        ctx.fillStyle = ent.data.color || '#fff';
        ctx.beginPath(); ctx.arc(ent.x+20, ent.y+20, 15, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      } else if (ent.type === EntityType.ITEM_HEART) {
        ctx.fillStyle = '#DC143C';
        ctx.beginPath(); ctx.arc(ent.x+20, ent.y+20, 15, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 15; ctx.shadowColor = '#DC143C';
      }
    });

    drawPlayer(ctx);
    for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 6, 6); }
    ctx.restore(); // END CAMERA TRANSFORM

    // --- SCREEN SPACE UI LAYER ---
    // Draw Hints (Centered Screen Space)
    ctx.save();
    ctx.font = '24px "Press Start 2P"';
    ctx.textAlign = 'center';
    
    // Find the closest active hint to display
    let activeHint = null;
    let maxAlpha = 0;

    s.hints.forEach(hint => {
        const dist = Math.abs((s.player.pos.x + 20) - hint.x);
        if (dist < hint.range) {
            const alpha = Math.max(0, 1 - (dist / hint.range));
            if (alpha > maxAlpha) {
               maxAlpha = alpha;
               activeHint = hint.text;
            }
        }
    });

    if (activeHint && maxAlpha > 0) {
       // Draw centered in screen
       const centerX = 800 / 2;
       const centerY = 150; // Top third of screen
       
       ctx.fillStyle = `rgba(0, 0, 0, ${maxAlpha * 0.8})`;
       ctx.fillText(activeHint, centerX + 2, centerY + 2); // Shadow
       ctx.fillStyle = `rgba(255, 255, 255, ${maxAlpha})`;
       ctx.fillText(activeHint, centerX, centerY);
    }
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
        ctx.fillStyle = '#000'; ctx.font = '10px monospace'; ctx.fillText("BIRD OF THE CYCLE", 150, 35);
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
