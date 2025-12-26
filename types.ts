
export enum GameState {
  INTRO = 'INTRO',
  PLAYING = 'PLAYING',
  CUTSCENE = 'CUTSCENE',
  FINISHED = 'FINISHED'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export enum EntityType {
  PLATFORM = 'PLATFORM',
  MOUND = 'MOUND',
  PILLAR = 'PILLAR',
  INVISIBLE_PLATFORM = 'INVISIBLE_PLATFORM',
  DRAGGABLE_STONE = 'DRAGGABLE_STONE',
  PEDESTAL = 'PEDESTAL',
  DOOR = 'DOOR',
  // New Types
  WIND_TUNNEL = 'WIND_TUNNEL',
  OFFERING_BOWL = 'OFFERING_BOWL',
  COLLECTIBLE_BONE = 'COLLECTIBLE_BONE',
  BOSS = 'BOSS',
  PROJECTILE = 'PROJECTILE',
  // Puzzle Items
  ITEM_GEAR = 'ITEM_GEAR',
  ITEM_KEY = 'ITEM_KEY',
  ITEM_INGREDIENT = 'ITEM_INGREDIENT', // Salt, Sulfur, Mercury
  ITEM_HEART = 'ITEM_HEART',
  // Puzzle Machines
  MACHINE_TURBINE = 'MACHINE_TURBINE',
  ALCHEMY_CAULDRON = 'ALCHEMY_CAULDRON'
}

export interface Entity extends Box {
  id: string;
  type: EntityType;
  interacted: boolean;
  visible: boolean;
  data?: any; 
}

export interface Hint {
  x: number;
  y: number;
  text: string;
  range: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface PlayerState {
  pos: Vector2;
  vel: Vector2;
  grounded: boolean;
  facingRight: boolean;
  isSlashing: boolean;
  isInteracting: boolean; // True if key is currently held
  isShielding: boolean;   // New superpower for Episode 4
  interactionPressed: boolean; // True only on the frame the key was pressed
  draggingItem: string | null; 
  carriedItem: string | null;  
  carriedItemId: string | null; // ID of the specific entity instance
  tasksCompleted: number;
  items: string[];
  animTimer: number;
  hp: number;
  maxHp: number;
}
