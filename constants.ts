
export const COLORS = {
  BLUE: '#2E4583',
  WHITE: '#FFFFFF',
  ORANGE: '#FF4500',
  GREY: '#A9A9A9',
  BLACK: '#000000',
  HONEY_YELLOW: '#FFC30B',
  // Episode Palettes
  EPISODE_1: { bg: '#9FAF90', player: '#34113F' },
  EPISODE_2: { bg: '#eff7cf', player: '#bad9b5' },
  EPISODE_3: { bg: '#564138', player: '#ff8811' },
  EPISODE_4: { bg: '#5d2a42', player: '#225560' },
  BOSS: '#b86f52'
};

export const PHYSICS = {
  GRAVITY: 0.8,
  JUMP_FORCE: -14,
  MOVE_SPEED: 5,
  FRICTION: 0.85,
  MAX_SPEED: 12,
};

export const WORLD = {
  HEIGHT: 600,
  GROUND_Y: 500,
  VIEWPORT_WIDTH: 800,
};

export const JUICE = {
  SHAKE_DECAY: 0.9,
  HIT_STOP_DURATION: 0.08,
};

export const TASKS = {
  TOTAL: 5,
  SPEED_PENALTY: 0.12, // Cumulative penalty per burden carried
};
