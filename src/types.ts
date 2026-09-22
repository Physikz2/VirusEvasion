export interface Point {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export type VirusStrain = 'alpha' | 'drifter' | 'pulsar';

export interface VirusEntity {
  id: string;
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  baseSpeed: number;
  angle: number;
  wanderTimer: number;
  strain: VirusStrain;
  pulsePhase: number;
  color: string;
  glowColor: string;
}

export interface PlayerEntity {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  invulnerableTime: number; // in seconds
  trail: Point[];
  tiltX: number;
  tiltY: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  is3dShard?: boolean;
}

export interface SpawnIndicator {
  id: string;
  x: number;
  y: number;
  size: number;
  progress: number; // 0 to 1
  strain: VirusStrain;
  duration: number; // in seconds
}

export type GameStatus = 'idle' | 'playing' | 'gameover';

export interface GameStats {
  survivalTime: number; // in milliseconds
  activeViruses: number;
  highScore: number; // in milliseconds
  nextSpawnCountdown: number; // 0 to 5 seconds
}
