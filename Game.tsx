
import React, { useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GameState, EntityType, Entity, Particle, PlayerState, Box, Hint } from './types';
import { COLORS, PHYSICS, WORLD, JUICE } from './constants';
import { WandererModel, BirdModel } from './CharacterModels';

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
  const requestRef = useRef<number>(0);
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
    windGustTimer: number;
    isGusting: boolean;
    envParticles: {x: number, y: number, vx: number, vy: number, size: number, color: string}[];
    lastGrounded: boolean;
    bgLayers: {speed: number, h: number, color: string, objects: {x: number, y: number, w: number, h: number, type: 'rect' | 'arch' | 'pillar' | 'monolith', drift?: number, color?: string}[]}[];
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
      idleTime: 0,
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
    windGustTimer: 0,
    isGusting: false,
    envParticles: Array.from({length: 150}, () => ({
      x: Math.random() * WORLD.VIEWPORT_WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      vx: 0,
      vy: 0,
      size: Math.random() * 3 + 1,
      color: 'rgba(255,255,255,0.4)'
    })),
    lastGrounded: false,
    bgLayers: [
      { 
        speed: 0.03, h: 500, color: 'rgba(0,0,0,0.1)', 
        objects: [
          {x: 100, y: 50, w: 120, h: 400, type: 'rect'}, 
          {x: 800, y: 100, w: 200, h: 300, type: 'arch'}, 
          {x: 1500, y: 20, w: 80, h: 480, type: 'pillar'},
          {x: 2200, y: 150, w: 150, h: 350, type: 'monolith', drift: 0.2}
        ]
      },
      { 
        speed: 0.1, h: 400, color: 'rgba(0,0,0,0.15)', 
        objects: [
          {x: 300, y: 200, w: 50, h: 200, type: 'pillar'}, 
          {x: 1000, y: 180, w: 120, h: 220, type: 'arch'}, 
          {x: 1800, y: 250, w: 40, h: 150, type: 'rect'},
          {x: 2500, y: 200, w: 100, h: 200, type: 'monolith', drift: 0.4}
        ]
      },
      { 
        speed: 0.25, h: 280, color: 'rgba(0,0,0,0.25)', 
        objects: [
          {x: 150, y: 350, w: 30, h: 120, type: 'pillar'}, 
          {x: 700, y: 400, w: 40, h: 80, type: 'rect'}, 
          {x: 1200, y: 380, w: 60, h: 100, type: 'arch'},
          {x: 2000, y: 400, w: 20, h: 80, type: 'monolith', drift: 0.8}
        ]
      }
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
    } catch (e) { console.error("AI Whisper failed", e); }
  };

  const triggerJuice = (shake: number, hitStop: number = 0) => {
    stateRef.current.shake = Math.max(stateRef.current.shake, shake);
    stateRef.current.hitStop = hitStop;
  };

  const checkOverlap = (r1: Box, r2: Box) => r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;

  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        stateRef.current.particles.push({
            x, y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, life: 1.2, color,
        });
    }
  };

  const completeTask = (id: string, msg: string) => {
    const p = stateRef.current.player;
    if (!p.items.includes(id)) {
      p.items.push(id); p.tasksCompleted++;
      onTaskComplete(p.tasksCompleted);
      generateWhisper(msg);
      triggerJuice(20, 0.15);
      spawnParticles(p.pos.x + 20, p.pos.y + 40, COLORS.GOLD, 40);
    }
  };

  const resetBossLevel = () => {
    const s = stateRef.current;
    s.player.hp = s.player.maxHp;
    s.player.pos = { x: 200, y: WORLD.GROUND_Y - 80 };
    s.player.vel = { x: 0, y: 0 };
    const boss = s.entities.find(e => e.type === EntityType.BOSS);
    if (boss) {
      boss.x = 600; boss.y = WORLD.GROUND_Y - 240;
      boss.data.hp = 20; boss.data.stunTimer = 0; boss.data.hitsTaken = 0;
    }
    s.shake = 15;
    generateWhisper("The cycle resets. Endure.");
  };

  useEffect(() => {
    const s = stateRef.current;
    s.dialogueActive = false; onDialogue(null);
    s.player.pos = { x: 100, y: WORLD.GROUND_Y - 80 }; s.player.vel = { x: 0, y: 0 };
    s.player.items = []; s.player.tasksCompleted = 0;
    s.player.draggingItem = null; s.player.carriedItem = null;
    s.camera.x = 0; s.shake = 0; s.particles = []; s.hints = [];
    s.player.hp = 3; s.windGustTimer = 0; s.isGusting = false;
    
    const entities: Entity[] = [];
    if (episode === 1) {
      onZoneChange("The Barren Sands");
      s.hints.push({ x: 300, y: WORLD.GROUND_Y - 200, text: "USE ARROWS OR WASD TO MOVE", range: 350 });
      s.hints.push({ x: 1500, y: WORLD.GROUND_Y - 200, text: "SPACE TO SLICE", range: 300 });
      s.hints.push({ x: 4000, y: WORLD.GROUND_Y - 350, text: "E TO REALIGN", range: 300 });

      entities.push({ id: 'm1', type: EntityType.MOUND, x: 1500, y: WORLD.GROUND_Y - 60, w: 100, h: 80, interacted: false, visible: true, data: { hits: 0 } });
      entities.push({ id: 'm2', type: EntityType.MOUND, x: 2800, y: WORLD.GROUND_Y - 70, w: 100, h: 90, interacted: false, visible: true, data: { hits: 0, hasRing: true } });
      entities.push({ id: 'trap1', type: EntityType.SAND_TRAP, x: 2200, y: WORLD.GROUND_Y - 20, w: 250, h: 30, interacted: false, visible: true });
      entities.push({ id: 'p1', type: EntityType.PILLAR, x: 4000, y: WORLD.GROUND_Y - 220, w: 50, h: 220, interacted: false, visible: true, data: { tilt: -24 } });
      entities.push({ id: 'p2', type: EntityType.PILLAR, x: 4400, y: WORLD.GROUND_Y - 220, w: 50, h: 220, interacted: false, visible: true, data: { tilt: 24 } });
      entities.push({ id: 'stone', type: EntityType.DRAGGABLE_STONE, x: 5600, y: WORLD.GROUND_Y - 100, w: 100, h: 100, interacted: false, visible: true });
      entities.push({ id: 'pedestal', type: EntityType.PEDESTAL, x: 6800, y: WORLD.GROUND_Y - 60, w: 140, h: 60, interacted: false, visible: true });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 8200, y: WORLD.GROUND_Y - 240, w: 160, h: 240, interacted: false, visible: true });
    } else if (episode === 2) {
      onZoneChange("The Weaver's Tongue");
      entities.push({ id: 'wind_force', type: EntityType.WIND_TUNNEL, x: 3000, y: WORLD.GROUND_Y - 400, w: 1500, h: 400, interacted: false, visible: true, data: { force: -2.5, active: true } });
      entities.push({ id: 'platform_1', type: EntityType.PLATFORM, x: 1200, y: WORLD.GROUND_Y - 110, w: 250, h: 30, interacted: false, visible: true });
      entities.push({ id: 'platform_2', type: EntityType.PLATFORM, x: 900, y: WORLD.GROUND_Y - 220, w: 200, h: 30, interacted: false, visible: true });
      entities.push({ id: 'gear', type: EntityType.ITEM_GEAR, x: 950, y: WORLD.GROUND_Y - 260, w: 50, h: 50, interacted: false, visible: true });
      entities.push({ id: 'turbine', type: EntityType.MACHINE_TURBINE, x: 2200, y: WORLD.GROUND_Y - 200, w: 120, h: 220, interacted: false, visible: true, data: { fixed: false } });
      entities.push({ id: 'key', type: EntityType.ITEM_KEY, x: 3800, y: WORLD.GROUND_Y - 50, w: 50, h: 50, interacted: false, visible: true });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 4800, y: WORLD.GROUND_Y - 240, w: 160, h: 240, interacted: false, visible: true, data: { locked: true } });
    } else if (episode === 3) {
      onZoneChange("The Feast of Ash");
      entities.push({ id: 'cauldron', type: EntityType.ALCHEMY_CAULDRON, x: 2500, y: WORLD.GROUND_Y - 140, w: 140, h: 140, interacted: false, visible: true, data: { ingredients: 0, maxIngredients: 3, complete: false } });
      entities.push({ id: 'mound_sulfur', type: EntityType.MOUND, x: 1000, y: WORLD.GROUND_Y - 60, w: 100, h: 80, interacted: false, visible: true, data: { hits: 0, hasItem: 'sulfur' } });
      entities.push({ id: 'plat_salt', type: EntityType.PLATFORM, x: 3500, y: WORLD.GROUND_Y - 110, w: 120, h: 30, interacted: false, visible: true });
      entities.push({ id: 'salt', type: EntityType.ITEM_INGREDIENT, x: 3530, y: WORLD.GROUND_Y - 150, w: 50, h: 50, interacted: false, visible: true, data: { type: 'salt', color: '#fff' } });
      entities.push({ id: 'drag_block', type: EntityType.DRAGGABLE_STONE, x: 4200, y: WORLD.GROUND_Y - 120, w: 120, h: 120, interacted: false, visible: true });
      entities.push({ id: 'plat_mercury', type: EntityType.PLATFORM, x: 4200, y: WORLD.GROUND_Y - 200, w: 120, h: 30, interacted: false, visible: true });
      entities.push({ id: 'mercury', type: EntityType.ITEM_INGREDIENT, x: 4230, y: WORLD.GROUND_Y - 240, w: 50, h: 50, interacted: false, visible: true, data: { type: 'mercury', color: '#E5E7E9' } });
      entities.push({ id: 'door', type: EntityType.DOOR, x: 5500, y: WORLD.GROUND_Y - 240, w: 160, h: 240, interacted: false, visible: true, data: { locked: true } });
    } else if (episode === 4) {
      onZoneChange("The Recurrence");
      s.player.pos.x = 200;
      entities.push({ id: 'boss', type: EntityType.BOSS, x: 600, y: WORLD.GROUND_Y - 240, w: 120, h: 260, interacted: false, visible: true, data: { hp: 20, maxHp: 20, stunTimer: 0, hitsTaken: 0 } });
    }
    s.entities = entities;
    generateWhisper(`The journey deepens. Episode ${episode}.`);
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

  const updateBoss = (dt: number) => {
    const s = stateRef.current;
    const boss = s.entities.find(e => e.type === EntityType.BOSS);
    if (!boss || boss.interacted) return;
    if (boss.data.stunTimer > 0) { boss.data.stunTimer -= dt; boss.data.hitsTaken = 0; return; }
    s.bossTimer += dt; if (s.bossInvuln > 0) s.bossInvuln -= dt;
    const dist = s.player.pos.x - boss.x;
    const phase = boss.data.hp > 10 ? 1 : 2;
    if (s.bossTimer > (3.5 - phase * 0.7)) {
      s.bossTimer = 0; s.bossAction = Math.abs(dist) > 350 ? 'THROW' : 'DASH';
    }
    if (s.bossAction === 'DASH') {
      boss.x += Math.sign(dist) * (14 + phase * 4);
      if (Math.abs(dist) < 50) { s.bossAction = 'WAIT'; triggerJuice(20); spawnParticles(boss.x + 50, WORLD.GROUND_Y, COLORS.WHITE, 15); }
    } else if (s.bossAction === 'THROW') {
      s.entities.push({ id: `p${Date.now()}`, type: EntityType.PROJECTILE, x: boss.x + 50, y: boss.y + 100, w: 40, h: 10, visible: true, interacted: false, data: { vx: Math.sign(dist) * (18 + phase * 2) } });
      s.bossAction = 'WAIT';
    } else { boss.x += Math.sign(dist) * (4 + phase); }
    
    if (checkOverlap({x: s.player.pos.x, y: s.player.pos.y, w: 40, h: 80}, boss)) {
      if (s.player.isShielding) { 
        s.player.vel.x = -Math.sign(dist) * 10; 
        spawnParticles(s.player.pos.x + 20, s.player.pos.y + 40, COLORS.WHITE, 15); 
      } else { 
        s.player.vel.x = -Math.sign(dist) * 25; 
        s.player.hp--; 
        triggerJuice(20, 0.1); 
        spawnParticles(s.player.pos.x + 20, s.player.pos.y + 40, "#ff0000", 10); 
        if (s.player.hp <= 0) resetBossLevel(); 
      }
    }
  };

  const updateEntities = (dt: number) => {
    const s = stateRef.current; const p = s.player;
    const slashBox = { x: p.facingRight ? p.pos.x + 40 : p.pos.x - 120, y: p.pos.y, w: 140, h: 80 };
    const interactBox = { x: p.pos.x - 40, y: p.pos.y - 30, w: 120, h: 140 };
    
    for (let i = s.entities.length - 1; i >= 0; i--) {
      const ent = s.entities[i]; if (!ent.visible) continue;
      
      if (checkOverlap(interactBox, ent)) {
        if ((ent.type === EntityType.ITEM_GEAR || ent.type === EntityType.ITEM_KEY || ent.type === EntityType.ITEM_INGREDIENT || ent.type === EntityType.ITEM_HEART) && p.interactionPressed) {
          if (p.carriedItem === null) { ent.visible = false; p.carriedItem = ent.type; p.carriedItemId = ent.id; generateWhisper("A fragment found."); triggerJuice(10); }
          else generateWhisper("Too many burdens.");
        }
        if (ent.type === EntityType.DOOR && p.interactionPressed) {
          if (episode === 1 && p.tasksCompleted >= 3) onFinish();
          else if (episode === 2 && p.carriedItem === EntityType.ITEM_KEY) { p.carriedItem = null; onFinish(); }
          else if (episode === 3 && p.carriedItem === EntityType.ITEM_HEART) { p.carriedItem = null; onFinish(); }
          else if (episode === 4 && ent.interacted) onFinish();
          else { generateWhisper("The gate remains cold."); triggerJuice(10); }
        }
        if (ent.type === EntityType.PILLAR && p.interactionPressed && !ent.interacted) {
          ent.data.tilt += (ent.data.tilt < 0 ? 12 : -12); triggerJuice(12);
          if (Math.abs(ent.data.tilt) < 5) { ent.data.tilt = 0; ent.interacted = true; if (s.entities.filter(e => e.type === EntityType.PILLAR).every(p => p.interacted)) completeTask('pillar', "Monoliths aligned."); }
        }
        if (ent.type === EntityType.DRAGGABLE_STONE && p.isInteracting && episode !== 4) { 
          p.draggingItem = ent.id; 
          ent.x = p.facingRight ? p.pos.x + 50 : p.pos.x - 70; 
        }
        if (ent.type === EntityType.MACHINE_TURBINE && p.interactionPressed) {
          if (p.carriedItem === EntityType.ITEM_GEAR) { 
            p.carriedItem = null; ent.data.fixed = true; 
            const wind = s.entities.find(e => e.type === EntityType.WIND_TUNNEL); 
            if (wind) wind.data.active = false; 
            generateWhisper("Peace returns."); triggerJuice(25, 0.1); spawnParticles(ent.x + 50, ent.y + 100, COLORS.GREY, 40); 
          }
          else if (!ent.data.fixed) generateWhisper("Mechanical failure.");
        }
        if (ent.type === EntityType.ALCHEMY_CAULDRON && p.interactionPressed) {
          if (p.carriedItem === EntityType.ITEM_INGREDIENT) { 
            p.carriedItem = null; ent.data.ingredients++; triggerJuice(15); spawnParticles(ent.x + 70, ent.y + 70, COLORS.ORANGE, 30); 
            if (ent.data.ingredients >= 3) { 
              ent.data.complete = true; 
              s.entities.push({ id: 'heart', type: EntityType.ITEM_HEART, x: ent.x + 40, y: ent.y - 70, w: 60, h: 60, interacted: false, visible: true }); 
              generateWhisper("Ritual complete."); 
            } 
          }
        }
      }
      
      if (p.isSlashing && checkOverlap(slashBox, ent)) {
        if (ent.type === EntityType.MOUND && !ent.interacted) {
          ent.data.hits++; spawnParticles(ent.x + 50, ent.y + 40, COLORS.WHITE, 8); triggerJuice(10, 0.05);
          if (ent.data.hits >= 4) { 
            ent.interacted = true; ent.visible = false; 
            if (ent.data.hasRing) completeTask('mound_' + ent.id, "Unearthed."); 
            if (ent.data.hasItem === 'sulfur') { 
              s.entities.push({ id: 'sulfur', type: EntityType.ITEM_INGREDIENT, x: ent.x + 25, y: ent.y, w: 50, h: 50, interacted: false, visible: true, data: { type: 'sulfur', color: '#FFD700' } }); 
            } 
          }
        }
        if (ent.type === EntityType.BOSS && s.bossInvuln <= 0 && ent.data.stunTimer <= 0) {
          ent.data.hp--; ent.data.hitsTaken++; s.bossInvuln = 0.4; triggerJuice(40, 0.2); spawnParticles(ent.x + 60, ent.y + 120, '#ff0000', 30);
          if (ent.data.hitsTaken >= 4) { ent.data.stunTimer = 5; generateWhisper("The beast falters."); }
          if (ent.data.hp <= 0) { ent.interacted = true; onFinish(); }
        }
      }
      
      if (ent.type === EntityType.PROJECTILE) { 
        ent.x += ent.data.vx; 
        if (checkOverlap({x: p.pos.x, y: p.pos.y, w: 40, h: 80}, ent)) { 
          s.entities.splice(i, 1); 
          if (p.isShielding) { triggerJuice(8, 0.05); spawnParticles(p.pos.x + 20, p.pos.y + 40, COLORS.WHITE, 20); } 
          else { 
            p.hp--; triggerJuice(30, 0.15); p.vel.x = -Math.sign(ent.data.vx) * 25; 
            spawnParticles(p.pos.x + 20, p.pos.y + 40, COLORS.WHITE, 15); 
            if (p.hp <= 0) resetBossLevel(); 
          } 
        } else if (Math.abs(ent.x - s.camera.x) > 1500) s.entities.splice(i, 1); 
      }
    }
    
    if (s.entities.find(e => e.id === 'stone') && s.entities.find(e => e.type === EntityType.PEDESTAL)) {
        const stone = s.entities.find(e => e.id === 'stone')!;
        const ped = s.entities.find(e => e.type === EntityType.PEDESTAL)!;
        if (!ped.interacted && checkOverlap(stone, ped)) { ped.interacted = true; completeTask('altar', "Balance restored."); }
    }
    p.interactionPressed = false;
  };

  const updateEnvironment = (dt: number) => {
    const s = stateRef.current; const w = WORLD.VIEWPORT_WIDTH; const h = WORLD.HEIGHT;
    if (episode === 1) { const intensity = 1 + (s.player.tasksCompleted * 0.5); s.envParticles.forEach(p => { p.vx = intensity * 3 * (p.size * 0.4); p.vy = 0.5; p.color = `rgba(255, 215, 0, ${0.4 + (s.player.tasksCompleted * 0.1)})`; }); }
    else if (episode === 2) { s.windGustTimer += dt; if (s.isGusting && s.windGustTimer > 2.0) { s.isGusting = false; s.windGustTimer = 0; } else if (!s.isGusting && s.windGustTimer > 8.0) { if (Math.random() < 0.005) { s.isGusting = true; // FIX: Corrected typo from windGustimer to windGustTimer
s.windGustTimer = 0; generateWhisper("Winds roar."); } }
    const isW = (s.entities.find(e => e.type === EntityType.WIND_TUNNEL)?.data.active ?? false) || s.isGusting; s.envParticles.forEach(p => { const tvx = isW ? -30 : -2; p.vx += (tvx - p.vx) * 0.05; p.vy = Math.sin(Date.now() * 0.005 + p.x) * 3; p.color = isW ? 'rgba(230, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)'; }); }
    else if (episode === 3) { const heat = s.entities.find(e => e.type === EntityType.ALCHEMY_CAULDRON)?.data.ingredients ?? 0; s.envParticles.forEach(p => { p.vy = -1.5 - (heat * 2); p.vx = Math.sin(Date.now() * 0.002 + p.y * 0.05) * 1; if (heat >= 3) p.color = 'rgba(255, 87, 51, 0.8)'; else if (heat >= 1) p.color = 'rgba(255, 195, 11, 0.6)'; else p.color = 'rgba(150, 150, 150, 0.4)'; }); }
    else if (episode === 4) { s.envParticles.forEach(p => { if (Math.random() < 0.05) { p.x = Math.random() * w; p.y = Math.random() * h; } p.vy = 8; p.color = 'rgba(52, 152, 219, 0.4)'; }); }
    s.envParticles.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x > w) p.x = 0; if (p.x < 0) p.x = w; if (p.y > h) p.y = 0; if (p.y < 0) p.y = h; });
  };

  const updatePhysics = (dt: number) => {
    const s = stateRef.current; const p = s.player;
    let wF = 0; let inS = false; let pY = WORLD.GROUND_Y;
    
    s.entities.forEach(e => { 
      if (e.type === EntityType.PLATFORM && p.pos.x + 20 > e.x && p.pos.x < e.x + e.w && p.pos.y + 80 <= e.y + 10 && p.pos.y + 80 >= e.y - 10 && p.vel.y >= 0) {
        pY = e.y; 
      }
      if (e.type === EntityType.WIND_TUNNEL && e.data.active && checkOverlap({x: p.pos.x, y: p.pos.y, w: 40, h: 80}, e)) {
        wF += e.data.force; 
      }
      if (e.type === EntityType.SAND_TRAP && checkOverlap({x: p.pos.x + 10, y: p.pos.y + 60, w: 20, h: 20}, e)) {
        inS = true; 
      }
    });

    if (s.isGusting) wF += -2.0; 
    
    const moveRight = s.keys['ArrowRight'] || s.keys['KeyD'];
    const moveLeft = s.keys['ArrowLeft'] || s.keys['KeyA'];
    const jumpAction = s.keys['Space'] || s.keys['KeyW'] || s.keys['ArrowUp'];
    const interactHold = s.keys['KeyE'];

    if (episode === 4 && interactHold) { 
      p.isShielding = true; 
      p.vel.x *= 0.6; 
    } else {
      p.isShielding = false;
    }

    const sM = 1 - (p.tasksCompleted * 0.15); 
    let mS = PHYSICS.MOVE_SPEED * sM; 
    if (inS) mS *= 0.35;
    
    if (!s.dialogueActive) { 
      if (moveRight) { 
        p.vel.x += mS * 0.8; 
        p.facingRight = true; 
      } else if (moveLeft) { 
        p.vel.x -= mS * 0.8; 
        p.facingRight = false; 
      } else {
        p.vel.x *= PHYSICS.FRICTION;
      }
    } else {
      p.vel.x *= PHYSICS.FRICTION;
    }

    p.vel.x += wF; 
    const maxS = p.draggingItem || p.isShielding ? 2.5 : PHYSICS.MAX_SPEED; 
    p.vel.x = Math.max(-maxS, Math.min(maxS, p.vel.x));
    
    p.idleTime = (Math.abs(p.vel.x) < 0.1 && p.grounded && !p.isSlashing && !p.isInteracting) ? p.idleTime + dt : 0;
    
    if (Math.abs(p.vel.x) > 4 && Math.random() < 0.4) {
      spawnParticles(p.pos.x + 20, p.pos.y + 80, [COLORS.EPISODE_1, COLORS.EPISODE_2, COLORS.EPISODE_3, COLORS.EPISODE_4][episode - 1].player, 1);
    }

    p.vel.y += PHYSICS.GRAVITY; 
    p.pos.x += p.vel.x; 
    p.pos.y += p.vel.y;

    if (p.pos.y >= pY - 80) { 
      if (!s.lastGrounded) { 
        triggerJuice(Math.abs(p.vel.y) * 0.6); 
        spawnParticles(p.pos.x + 20, pY, COLORS.WHITE, 12); 
      } 
      p.pos.y = pY - 80; 
      p.vel.y = 0; 
      p.grounded = true; 
      if (inS) p.pos.y += 12; 
    } else {
      p.grounded = false;
    }

    s.lastGrounded = p.grounded; 
    
    if (jumpAction && p.grounded && !s.dialogueActive) { 
      p.vel.y = PHYSICS.JUMP_FORCE; 
      p.grounded = false; 
    } 
    
    if (s.keys['Space'] && !p.grounded) {
      p.isSlashing = true; 
    }
    
    if (p.pos.x < 0) p.pos.x = 0;
  };

  const drawPixelModel = (ctx: CanvasRenderingContext2D, model: (string | null)[][], x: number, y: number, pixelSize: number, facingRight: boolean = true) => {
    ctx.save();
    ctx.translate(x, y);
    if (!facingRight) {
        ctx.scale(-1, 1);
        ctx.translate(-(model[0].length * pixelSize), 0);
    }
    for (let r = 0; r < model.length; r++) {
      for (let c = 0; c < model[r].length; c++) {
        const color = model[r][c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
        }
      }
    }
    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current; const w = WORLD.VIEWPORT_WIDTH; const h = WORLD.HEIGHT;
    s.bgLayers.forEach(l => {
      ctx.fillStyle = l.color; const xO = -(s.camera.x * l.speed) % w;
      for (let i = -1; i < 3; i++) {
        const dX = xO + (i * w); ctx.fillRect(dX, WORLD.GROUND_Y - l.h, w, l.h);
        l.objects.forEach(o => {
          const dY = o.drift ? Math.sin(Date.now()/2000 * o.drift) * 20 : 0; const ox = dX + o.x; const oy = WORLD.GROUND_Y - o.h - o.y + dY;
          ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.5)';
          if (o.type === 'rect') ctx.fillRect(ox, oy, o.w, o.h);
          else if (o.type === 'arch') { ctx.fillRect(ox, oy, o.w, o.h); ctx.clearRect(ox + 20, oy + 40, o.w - 40, o.h); ctx.strokeStyle = o.color || 'white'; ctx.strokeRect(ox, oy, o.w, o.h); }
          else if (o.type === 'pillar') { ctx.fillRect(ox, oy, o.w, o.h); ctx.fillRect(ox - 20, oy, o.w + 40, 25); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(ox + o.w/2 - 2, oy, 4, o.h); }
          else if (o.type === 'monolith') { ctx.beginPath(); ctx.moveTo(ox, oy + o.h); ctx.lineTo(ox + o.w / 2, oy); ctx.lineTo(ox + o.w, oy + o.h); ctx.fill(); ctx.strokeStyle = 'white'; ctx.stroke(); }
          ctx.restore();
        });
      }
    });
    s.envParticles.forEach(p => { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const p = stateRef.current.player; let sq = 1 + (Math.abs(p.vel.y) * 0.04); let st = 1 / sq;
    ctx.save();
    ctx.translate(p.pos.x + 20, p.pos.y + 80);
    
    if (p.idleTime > 0.5) {
        const t = Date.now();
        if (episode === 1) st = 1 + Math.sin(t / 400) * 0.04;
        else if (episode === 2) ctx.translate(Math.random() * 2 - 1, 0);
        else if (episode === 3) { if (Math.random() < 0.02) sq = 0.85; }
        else if (episode === 4) { if (Math.random() < 0.1) { ctx.translate(Math.random() * 4 - 2, 0); } }
    }
    
    const bA = Math.min(0.9, p.tasksCompleted * 0.22); 
    ctx.scale(st, sq);
    
    const pixelSize = 1.3;
    const modelWidth = WandererModel[0].length * pixelSize;
    const modelHeight = WandererModel.length * pixelSize;
    
    drawPixelModel(ctx, WandererModel, -modelWidth / 2, -modelHeight + 15, pixelSize, p.facingRight);

    if (p.isShielding) { 
        ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.shadowBlur = 15; ctx.shadowColor = 'white'; 
        ctx.strokeRect(-modelWidth/4, -modelHeight * 0.7, modelWidth/2, modelHeight * 0.6); 
    }
    
    ctx.fillStyle = `rgba(0,0,0,${bA})`; 
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(-modelWidth/2, -modelHeight, modelWidth, modelHeight);
    ctx.globalCompositeOperation = 'source-over';

    if (!p.carriedItem) {
        ctx.fillStyle = COLORS.ORANGE; ctx.save(); 
        ctx.translate(p.facingRight ? 15 : -15, -75);
        if (p.isSlashing) { 
            ctx.rotate(Math.sin(Date.now()/25) * 3); 
            ctx.shadowBlur = 20; ctx.shadowColor = COLORS.ORANGE; 
            ctx.fillRect(-8, 0, 16, 70); 
        } else { 
            ctx.rotate(0.5 + Math.sin(Date.now()/400) * 0.2); 
            ctx.fillRect(-6, 0, 12, 50); 
        }
        ctx.restore();
    } else {
        ctx.fillStyle = COLORS.GOLD; ctx.shadowBlur = 10; ctx.shadowColor = COLORS.GOLD;
        ctx.beginPath(); ctx.arc(0, -modelHeight * 0.9, 12, 0, Math.PI*2); ctx.fill();
    }
    
    ctx.restore(); ctx.filter = 'none';
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean, stun: number) => {
    const b = Math.sin(Date.now() / 200) * 20;
    ctx.save();
    ctx.translate(x + 60, y + 260 + b);
    if (stun > 0) ctx.globalAlpha = 0.4 + Math.sin(Date.now()/40)*0.4;
    
    const pixelSize = 6;
    const modelWidth = BirdModel[0].length * pixelSize;
    const modelHeight = BirdModel.length * pixelSize;
    
    drawPixelModel(ctx, BirdModel, -modelWidth / 2, -modelHeight, pixelSize, facingRight);

    ctx.lineWidth = 40; ctx.strokeStyle = COLORS.ORANGE; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(80,-modelHeight/2); ctx.quadraticCurveTo(180, -modelHeight/2 + 50, 210, 180); ctx.stroke();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 8; 
    ctx.beginPath(); ctx.moveTo(85,-modelHeight/2 + 5); ctx.quadraticCurveTo(185, -modelHeight/2 + 55, 215, 175); ctx.stroke();
    ctx.restore();
  };

  const draw = () => {
    const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d')!; const s = stateRef.current;
    const pal = [COLORS.EPISODE_1, COLORS.EPISODE_2, COLORS.EPISODE_3, COLORS.EPISODE_4][episode - 1];
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, 800, 600); drawBackground(ctx);
    if (s.player.hp < 2) { ctx.fillStyle = `rgba(255, 0, 0, ${(Math.sin(Date.now() / 150) + 1) * 0.15})`; ctx.fillRect(0, 0, 800, 600); }
    ctx.save(); const sx = (Math.random() - 0.5) * s.shake; const sy = (Math.random() - 0.5) * s.shake;
    ctx.translate(-s.camera.x + sx, sy); ctx.fillStyle = '#111'; ctx.fillRect(s.camera.x - 500, WORLD.GROUND_Y, 2000, 100);
    s.entities.forEach(ent => {
      if (!ent.visible) return; ctx.save();
      if (ent.type === EntityType.PILLAR) {
        ctx.translate(ent.x + 25, ent.y + ent.h); ctx.rotate(ent.data.tilt * Math.PI / 180);
        ctx.fillStyle = '#2C3E50'; ctx.fillRect(-25, -ent.h, 50, ent.h); ctx.strokeStyle = ent.interacted ? COLORS.GOLD : '#1A252F'; ctx.lineWidth = 4; ctx.strokeRect(-25, -ent.h, 50, ent.h);
      } else if (ent.type === EntityType.DOOR) {
        ctx.fillStyle = '#000'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
        ctx.strokeStyle = COLORS.GOLD; ctx.lineWidth = 8; ctx.strokeRect(ent.x, ent.y, ent.w, ent.h);
      } else if (ent.type === EntityType.MOUND) {
        ctx.fillStyle = '#3E2723'; ctx.beginPath(); ctx.ellipse(ent.x + ent.w/2, ent.y + ent.h, ent.w/2, ent.h, 0, Math.PI, 0); ctx.fill();
      } else if (ent.type === EntityType.DRAGGABLE_STONE) {
        ctx.fillStyle = '#34495E'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
      } else if (ent.type === EntityType.SAND_TRAP) {
        ctx.fillStyle = '#21110a'; ctx.fillRect(ent.x, ent.y + 10, ent.w, ent.h);
      } else if (ent.type === EntityType.BOSS) drawBoss(ctx, ent.x, ent.y, s.player.pos.x > ent.x, ent.data.stunTimer);
      else if (ent.type === EntityType.PROJECTILE) { ctx.fillStyle = 'white'; ctx.beginPath(); ctx.roundRect(ent.x, ent.y, ent.w, ent.h, 5); ctx.fill(); }
      else if (ent.type === EntityType.PLATFORM) { ctx.fillStyle = '#1B2631'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      else if (ent.type === EntityType.ITEM_GEAR) { ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.arc(ent.x + 25, ent.y + 25, 20, 0, Math.PI*2); ctx.fill(); }
      else if (ent.type === EntityType.ITEM_KEY) { ctx.fillStyle = '#00FFFF'; ctx.fillRect(ent.x+20, ent.y+5, 12, 40); }
      else if (ent.type === EntityType.MACHINE_TURBINE) {
        ctx.fillStyle = '#2C3E50'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); ctx.save(); ctx.translate(ent.x + 60, ent.y + 60);
        ctx.rotate(!ent.data.fixed ? 0.3 : Date.now() / 150); ctx.fillStyle = '#7F8C8D'; ctx.fillRect(-100, -12, 200, 24); ctx.restore();
      } else if (ent.type === EntityType.ALCHEMY_CAULDRON) {
        ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(ent.x+70, ent.y+70, 65, 0, Math.PI, false); ctx.fill();
      } else if (ent.type === EntityType.ITEM_INGREDIENT) { ctx.fillStyle = ent.data.color || '#fff'; ctx.beginPath(); ctx.arc(ent.x+25, ent.y+25, 20, 0, Math.PI*2); ctx.fill(); }
      else if (ent.type === EntityType.ITEM_HEART) { ctx.fillStyle = '#E74C3C'; ctx.beginPath(); ctx.arc(ent.x+30, ent.y+30, 25, 0, Math.PI*2); ctx.fill(); }
      else if (ent.type === EntityType.PEDESTAL) { ctx.fillStyle = '#111'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); }
      ctx.restore();
    });
    drawPlayer(ctx);
    for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 7, 7); }
    ctx.restore();
    
    ctx.save(); ctx.font = 'bold 28px "Press Start 2P"'; ctx.textAlign = 'center';
    let aH = null; let mA = 0; s.hints.forEach(h => { const d = Math.abs((s.player.pos.x + 20) - h.x); if (d < h.range) { const a = 1 - (d / h.range); if (a > mA) { mA = a; aH = h.text; } } });
    if (aH && mA > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${mA})`; ctx.fillText(aH, 400, 160); } 
    ctx.restore();
    
    if (episode === 4) {
      const boss = s.entities.find(e => e.type === EntityType.BOSS);
      if (boss) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(100, 30, 600, 35);
        const bP = Math.max(0, boss.data.hp / boss.data.maxHp);
        ctx.fillStyle = '#C0392B'; ctx.fillRect(105, 35, 590 * bP, 25);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(40, 40, 150, 30);
      const pP = s.player.hp / s.player.maxHp; ctx.fillStyle = pal.player; ctx.fillRect(45, 45, 140 * pP, 20);
    }
  };

  const loop = (t: number) => {
    let dt = (t - stateRef.current.lastTime) / 1000; 
    stateRef.current.lastTime = t; 
    if (dt > 0.1) dt = 0.016;
    if (stateRef.current.hitStop > 0) { stateRef.current.hitStop -= dt; dt = 0; }
    
    stateRef.current.shake *= JUICE.SHAKE_DECAY; 
    if (stateRef.current.shake < 0.1) stateRef.current.shake = 0;
    
    for (let i = stateRef.current.particles.length - 1; i >= 0; i--) { 
      const p = stateRef.current.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt; 
      if (p.life <= 0) stateRef.current.particles.splice(i, 1); 
    }
    
    if (gameState === GameState.PLAYING && dt > 0) {
      updatePhysics(dt); 
      updateEntities(dt); 
      updateEnvironment(dt);
      if (episode === 4) updateBoss(dt);
      const tx = episode === 4 ? 0 : stateRef.current.player.pos.x - 400;
      stateRef.current.camera.x += (tx - stateRef.current.camera.x) * 0.15;
      if (stateRef.current.camera.x < 0) stateRef.current.camera.x = 0;
    }
    draw(); 
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => { 
    requestRef.current = requestAnimationFrame(loop); 
    return () => cancelAnimationFrame(requestRef.current!); 
  }, [gameState, episode]);

  return (
    <div className="relative w-full h-full flex justify-center items-center">
      <canvas ref={canvasRef} width={800} height={600} className="border-8 border-white shadow-[0_0_50px_rgba(255,255,255,0.3)] bg-black" style={{ width: '100%', maxWidth: '800px', height: 'auto', aspectRatio: '4/3' }} />
    </div>
  );
};
