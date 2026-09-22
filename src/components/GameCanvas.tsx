import React, { useRef, useEffect, useCallback } from 'react';
import {
  PlayerEntity,
  VirusEntity,
  Particle,
  SpawnIndicator,
  GameStatus,
  VirusStrain,
} from '../types';
import {
  drawCyberGrid,
  draw3DBlock,
  drawPlayerTrail,
  drawSpawnIndicator,
  drawParticles,
} from '../utils/canvasRenderer';
import { soundManager } from '../utils/audio';

interface GameCanvasProps {
  gameStatus: GameStatus;
  onGameOver: (finalTimeMs: number, virusCount: number) => void;
  onUpdateStats: (survivalTime: number, activeCount: number, nextSpawnSec: number) => void;
  onStartGame: () => void;
  totalGlobalRuns?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameStatus,
  onGameOver,
  onUpdateStats,
  onStartGame,
  totalGlobalRuns,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // CHANGED: mirror gameStatus into a ref so the pointer listeners (which run
  // once with [] deps) can read the current value without a stale closure.
  const gameStatusRef = useRef<GameStatus>(gameStatus);
  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  const stateRef = useRef<{
    width: number;
    height: number;
    startTime: number;
    elapsedMs: number;
    lastFrameTime: number;
    nextSpawnTimer: number;
    totalSpawned: number;
    player: PlayerEntity;
    viruses: VirusEntity[];
    indicators: SpawnIndicator[];
    particles: Particle[];
    screenShake: number;
    isMouseInside: boolean;
  }>({
    width: 800,
    height: 600,
    startTime: 0,
    elapsedMs: 0,
    lastFrameTime: 0,
    nextSpawnTimer: 5.0,
    totalSpawned: 0,
    player: {
      x: 400,
      y: 300,
      targetX: 400,
      targetY: 300,
      size: 30,
      invulnerableTime: 1.5,
      trail: [],
      tiltX: 0,
      tiltY: 0,
    },
    viruses: [],
    indicators: [],
    particles: [],
    screenShake: 0,
    isMouseInside: false,
  });

  const createExplosion = useCallback(
    (x: number, y: number, color1: string, color2: string, count: number = 35) => {
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7 + 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 5 + 3,
          color: Math.random() > 0.5 ? color1 : color2,
          alpha: 1,
          life: 0,
          maxLife: Math.random() * 0.4 + 0.5,
          is3dShard: Math.random() > 0.3,
        });
      }
      stateRef.current.particles.push(...particles);
    },
    []
  );

  const getSafeSpawnLocation = useCallback((playerX: number, playerY: number, size: number) => {
    const { width, height } = stateRef.current;
    const margin = 45;
    let attempts = 0;
    let x = width / 2;
    let y = height / 2;

    while (attempts < 20) {
      x = margin + Math.random() * (width - margin * 2);
      y = margin + Math.random() * (height - margin * 2);
      const dist = Math.hypot(x - playerX, y - playerY);
      if (dist > 180) {
        break;
      }
      attempts++;
    }
    return { x, y, size };
  }, []);

  const queueNewVirus = useCallback(() => {
    const { player } = stateRef.current;
    const loc = getSafeSpawnLocation(player.x, player.y, 30);

    const strains: VirusStrain[] = ['alpha', 'drifter', 'pulsar'];
    const strain = strains[Math.floor(Math.random() * strains.length)];

    stateRef.current.indicators.push({
      id: Math.random().toString(),
      x: loc.x,
      y: loc.y,
      size: loc.size,
      progress: 0,
      strain,
      duration: 0.8,
    });

    soundManager.playSpawnWarning();
  }, [getSafeSpawnLocation]);

  const materializeVirus = useCallback((ind: SpawnIndicator) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.4 + Math.random() * 1.5;

    let color = '#f87171';
    let glowColor = 'rgba(239, 68, 68, 0.4)';
    if (ind.strain === 'drifter') {
      color = '#c084fc';
      glowColor = 'rgba(168, 85, 247, 0.4)';
    } else if (ind.strain === 'pulsar') {
      color = '#fb923c';
      glowColor = 'rgba(249, 115, 22, 0.4)';
    }

    stateRef.current.viruses.push({
      id: ind.id,
      x: ind.x,
      y: ind.y,
      size: ind.size,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseSpeed: speed,
      angle,
      wanderTimer: Math.random() * 2,
      strain: ind.strain,
      pulsePhase: Math.random() * Math.PI * 2,
      color,
      glowColor,
    });

    createExplosion(ind.x, ind.y, color, '#ffffff', 18);
    soundManager.playVirusSpawned();

    stateRef.current.totalSpawned += 1;
    if (stateRef.current.totalSpawned % 10 === 0) {
      soundManager.playMilestoneChime();
    }
  }, [createExplosion]);

  const resetGame = useCallback(() => {
    const { width, height } = stateRef.current;
    const cx = width / 2;
    const cy = height / 2;

    stateRef.current.startTime = performance.now();
    stateRef.current.elapsedMs = 0;
    stateRef.current.lastFrameTime = performance.now();
    stateRef.current.nextSpawnTimer = 5.0;
    stateRef.current.totalSpawned = 0;
    stateRef.current.viruses = [];
    stateRef.current.indicators = [];
    stateRef.current.particles = [];
    stateRef.current.screenShake = 0;

    stateRef.current.player = {
      x: cx,
      y: cy,
      targetX: cx,
      targetY: cy,
      size: 30,
      invulnerableTime: 1.5,
      trail: [],
      tiltX: 0,
      tiltY: 0,
    };

    queueNewVirus();
  }, [queueNewVirus]);

  useEffect(() => {
    if (gameStatus === 'playing') {
      resetGame();
      soundManager.startBackgroundLoop();
    }
  }, [gameStatus, resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      // CHANGED: only preventDefault while actively playing. Calling it during
      // idle/gameover suppresses the synthesized click event on mobile, which
      // blocked the "Engage Defense Grid" button from ever firing.
      if ('touches' in e && gameStatusRef.current === 'playing') {
        e.preventDefault();
      }

      const rect = canvas.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e) {
        if (e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        }
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;

      const pad = 24;
      const targetX = Math.max(pad, Math.min(stateRef.current.width - pad, rawX));
      const targetY = Math.max(pad, Math.min(stateRef.current.height - pad, rawY));

      stateRef.current.player.targetX = targetX;
      stateRef.current.player.targetY = targetY;
      stateRef.current.isMouseInside = true;
    };

    const handlePointerEnter = () => {
      stateRef.current.isMouseInside = true;
    };

    const handlePointerLeave = () => {
      stateRef.current.isMouseInside = false;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchstart', handlePointerMove, { passive: false });
    canvas.addEventListener('mouseenter', handlePointerEnter);
    canvas.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchstart', handlePointerMove);
      canvas.removeEventListener('mouseenter', handlePointerEnter);
      canvas.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (w > 0 && h > 0) {
        stateRef.current.width = w;
        stateRef.current.height = h;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Main game loop
  useEffect(() => {
    let animId: number;
    let runEnded = false;
    let lastStatsUpdate = 0;

    const loop = (currentTime: number) => {
      animId = requestAnimationFrame(loop);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const state = stateRef.current;
      const { width, height } = state;

      if (!state.lastFrameTime) state.lastFrameTime = currentTime;
      const dt = Math.min((currentTime - state.lastFrameTime) / 1000, 0.1);
      state.lastFrameTime = currentTime;

      if (gameStatus === 'playing' && !runEnded) {
        state.elapsedMs += dt * 1000;

        if (state.player.invulnerableTime > 0) {
          state.player.invulnerableTime = Math.max(0, state.player.invulnerableTime - dt);
        }

        const lerpFactor = 0.28;
        const prevPx = state.player.x;
        const prevPy = state.player.y;
        state.player.x += (state.player.targetX - state.player.x) * lerpFactor;
        state.player.y += (state.player.targetY - state.player.y) * lerpFactor;

        const distMoved = Math.hypot(state.player.x - prevPx, state.player.y - prevPy);
        if (distMoved > 1.5) {
          state.player.trail.push({ x: state.player.x, y: state.player.y });
          if (state.player.trail.length > 7) {
            state.player.trail.shift();
          }
        }

        state.nextSpawnTimer -= dt;
        if (state.nextSpawnTimer <= 0) {
          queueNewVirus();
          state.nextSpawnTimer = 5.0;
        }

        for (let i = state.indicators.length - 1; i >= 0; i--) {
          const ind = state.indicators[i];
          ind.progress += dt / ind.duration;
          if (ind.progress >= 1) {
            materializeVirus(ind);
            state.indicators.splice(i, 1);
          }
        }

        const arenaPad = 18;
        for (const v of state.viruses) {
          v.pulsePhase += dt * 3.5;
          v.wanderTimer -= dt;

          if (v.wanderTimer <= 0) {
            v.wanderTimer = 0.8 + Math.random() * 1.5;
            const steerAngle = (Math.random() - 0.5) * (Math.PI / 2.5);
            v.angle += steerAngle;
            v.vx = Math.cos(v.angle) * v.baseSpeed;
            v.vy = Math.sin(v.angle) * v.baseSpeed;
          }

          if (v.strain === 'drifter') {
            const wave = Math.sin(currentTime * 0.003 + v.pulsePhase) * 1.2;
            v.x += (v.vx + -v.vy * 0.3 * wave) * dt * 60;
            v.y += (v.vy + v.vx * 0.3 * wave) * dt * 60;
          } else if (v.strain === 'pulsar') {
            const burst = 0.7 + Math.pow(Math.sin(v.pulsePhase * 2), 2) * 0.8;
            v.x += v.vx * burst * dt * 60;
            v.y += v.vy * burst * dt * 60;
          } else {
            v.x += v.vx * dt * 60;
            v.y += v.vy * dt * 60;
          }

          const half = v.size / 2;
          let bounced = false;

          if (v.x - half < arenaPad) {
            v.x = arenaPad + half;
            v.vx = Math.abs(v.vx);
            v.angle = Math.atan2(v.vy, v.vx);
            bounced = true;
          } else if (v.x + half > width - arenaPad) {
            v.x = width - arenaPad - half;
            v.vx = -Math.abs(v.vx);
            v.angle = Math.atan2(v.vy, v.vx);
            bounced = true;
          }

          if (v.y - half < arenaPad) {
            v.y = arenaPad + half;
            v.vy = Math.abs(v.vy);
            v.angle = Math.atan2(v.vy, v.vx);
            bounced = true;
          } else if (v.y + half > height - arenaPad) {
            v.y = height - arenaPad - half;
            v.vy = -Math.abs(v.vy);
            v.angle = Math.atan2(v.vy, v.vx);
            bounced = true;
          }

          if (bounced) {
            createExplosion(v.x, v.y, v.color, '#ffffff', 5);
            soundManager.playWallBounce();
          }

          if (state.player.invulnerableTime <= 0) {
            const pHalf = (state.player.size * 0.82) / 2;
            const vHalf = (v.size * 0.82) / 2;

            const collision =
              Math.abs(state.player.x - v.x) < pHalf + vHalf &&
              Math.abs(state.player.y - v.y) < pHalf + vHalf;

            if (collision) {
              runEnded = true;
              state.screenShake = 16;
              createExplosion(state.player.x, state.player.y, '#38bdf8', '#ffffff', 30);
              createExplosion(v.x, v.y, v.color, '#ef4444', 30);
              soundManager.playCollisionExplosion();
              soundManager.playGameOverSound();

              onGameOver(state.elapsedMs, state.viruses.length);
              return;
            }
          }
        }

        if (currentTime - lastStatsUpdate > 100) {
          onUpdateStats(state.elapsedMs, state.viruses.length, Math.max(0, state.nextSpawnTimer));
          lastStatsUpdate = currentTime;
        }
      }

      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life += dt;
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.alpha = 1 - p.life / p.maxLife;

        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      ctx.save();
      if (state.screenShake > 0) {
        const sx = (Math.random() - 0.5) * state.screenShake;
        const sy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(sx, sy);
        state.screenShake *= 0.88;
        if (state.screenShake < 0.3) state.screenShake = 0;
      }

      drawCyberGrid(ctx, width, height, currentTime * 0.001);

      for (const ind of state.indicators) {
        drawSpawnIndicator(ctx, ind, currentTime * 0.002);
      }

      for (const v of state.viruses) {
        draw3DBlock(
          ctx,
          v.x,
          v.y,
          v.size,
          7,
          v.strain === 'alpha' ? 'virus' : v.strain,
          v.pulsePhase,
          false
        );
      }

      if (gameStatus === 'playing' && !runEnded) {
        drawPlayerTrail(ctx, state.player.trail, state.player.size);
        draw3DBlock(
          ctx,
          state.player.x,
          state.player.y,
          state.player.size,
          8,
          'player',
          currentTime * 0.004,
          state.player.invulnerableTime > 0
        );
      }

      drawParticles(ctx, state.particles);

      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameStatus, onGameOver, onUpdateStats, queueNewVirus, materializeVirus, createExplosion]);

  return (
    <div
      ref={containerRef}
      id="game-canvas-container"
      className="relative w-full h-full flex-1 overflow-hidden bg-[#06080d] cursor-crosshair touch-none"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {gameStatus === 'idle' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-black/65 backdrop-blur-sm text-center">
          <div className="max-w-md p-8 rounded-sm bg-[#090e1a]/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-4">
              Reverse-Snake Cyberpunk Survival
            </div>
            <h2 className="text-4xl font-extrabold font-display tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-cyan-400 uppercase drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              Virus Evasion
            </h2>
            <p className="text-sm text-slate-300 font-cyber mt-3 leading-relaxed">
              Your mouse cursor or finger controls the glowing cyan defense core. Autonomous virus blocks
              spawn every <strong className="text-red-400">5 seconds</strong>. Evade collisions,
              out-maneuver threat vectors, and survive for maximum score.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="btn-start-game"
                onClick={onStartGame}
                className="w-full sm:w-auto px-8 py-3 rounded-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display font-bold text-base tracking-widest uppercase shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Engage Defense Grid
              </button>
            </div>

            <div className="mt-5 text-xs text-slate-400 font-mono flex items-center justify-center gap-4">
              <span>[Mouse / Touch Slide to Track]</span>
            </div>

            {typeof totalGlobalRuns === 'number' && (
              <div className="mt-4 text-[11px] text-emerald-300 font-mono uppercase tracking-widest">
                Total Global Runs: {totalGlobalRuns.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};