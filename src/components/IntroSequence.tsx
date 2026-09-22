import React, { useEffect, useMemo, useState } from 'react';
import { Globe } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface IntroSequenceProps {
  onComplete: () => void;
}

type IntroStage = 'warning' | 'corridor' | 'reveal' | 'landing';

// Timeline for the visual intro stages
const STAGE_TIMINGS: Array<{ stage: IntroStage; at: number }> = [
  { stage: 'corridor', at: 1500 },
  { stage: 'reveal', at: 2500 },
  { stage: 'landing', at: 3500 },
];

interface RainColumn {
  id: number;
  left: number;
  fontSize: number;
  duration: number;
  delay: number;
  colorClass: string;
  text: string;
}

function BinaryRain({ variant }: { variant: 'red' | 'mixed' }) {
  const columns = useMemo<RainColumn[]>(() => {
    const count = 26;
    return Array.from({ length: count }, (_, i) => {
      const length = 34;
      const chars = Array.from({ length }, () => (Math.random() > 0.5 ? '1' : '0'));
      const isRed = variant === 'red' || Math.random() > 0.45;
      return {
        id: i,
        left: (i / count) * 100 + Math.random() * 2,
        fontSize: 11 + Math.random() * 7,
        duration: 3.5 + Math.random() * 4,
        delay: -(Math.random() * 6),
        colorClass: isRed ? 'text-red-500/70' : 'text-cyan-400/60',
        text: chars.join('\n'),
      };
    });
  }, [variant]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {columns.map((col) => (
        <pre
          key={col.id}
          className={`absolute top-0 font-mono-hud leading-tight whitespace-pre ${col.colorClass}`}
          style={{
            left: `${col.left}%`,
            fontSize: `${col.fontSize}px`,
            animation: `binary-fall ${col.duration}s linear infinite`,
            animationDelay: `${col.delay}s`,
          }}
        >
          {`${col.text}\n${col.text}`}
        </pre>
      ))}
    </div>
  );
}

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<IntroStage>('warning');

  // Advance through the visual storyboard stages, then stop and wait on 'landing'
  useEffect(() => {
    const timers = STAGE_TIMINGS.map(({ stage: s, at }) => window.setTimeout(() => setStage(s), at));
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleInteract = () => {
    soundManager.playIntroStinger(); // Fires BossIntro.wav on user click/keypress
    onComplete();
  };

  // Space or a click anywhere triggers the sound and moves to the main screen.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleInteract();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  return (
    <div
      id="intro-sequence"
      onClick={handleInteract}
      className="fixed inset-0 z-50 bg-black overflow-hidden flex items-center justify-center cursor-pointer select-none"
    >
      {(stage === 'warning' || stage === 'corridor') && (
        <div className="absolute inset-0 bg-red-950/20" />
      )}

      {stage === 'corridor' && (
        <div
          className="absolute inset-0 animate-corridor-zoom"
          style={{ perspective: '600px' }}
        >
          <BinaryRain variant="mixed" />
        </div>
      )}
      {stage !== 'corridor' && <BinaryRain variant={stage === 'warning' ? 'red' : 'mixed'} />}

      {stage === 'warning' && (
        <p className="relative z-10 px-6 text-center font-display font-extrabold uppercase tracking-widest text-2xl sm:text-4xl md:text-5xl leading-tight text-red-500 animate-glitch-flicker drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
          WARNING:
          <br />
          HOSTILE ENTITY DETECTED
          <br />
          // BREACH IMMINENT
        </p>
      )}

      {stage === 'corridor' && (
        <p className="relative z-10 px-6 text-center font-display font-bold uppercase tracking-widest text-lg sm:text-3xl text-red-400 animate-glitch-flicker-fast drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
          // BREACH IMMINENT
        </p>
      )}

      {stage === 'reveal' && (
        <div className="relative z-10 flex flex-col items-center justify-center animate-title-reveal">
          <h1 className="font-display font-extrabold uppercase tracking-widest text-6xl sm:text-8xl text-cyan-300 drop-shadow-[0_0_35px_rgba(6,182,212,0.9)]">
            VIRUS
          </h1>
          <h1 className="-mt-2 sm:-mt-4 font-display font-extrabold uppercase tracking-widest text-4xl sm:text-6xl text-pink-400 drop-shadow-[0_0_35px_rgba(236,72,153,0.9)]">
            EVASION
          </h1>
        </div>
      )}

      {stage === 'landing' && (
        <div className="relative z-10 flex flex-col items-center justify-center gap-2 animate-fade-in-settle">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-400/60 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] mb-2">
            <Globe className="w-8 h-8 text-cyan-300" />
          </div>
          <h1 className="font-display font-extrabold uppercase tracking-widest text-5xl sm:text-7xl text-cyan-300 drop-shadow-[0_0_25px_rgba(6,182,212,0.7)]">
            VIRUS
          </h1>
          <h1 className="-mt-3 font-display font-extrabold uppercase tracking-widest text-3xl sm:text-5xl text-pink-400 drop-shadow-[0_0_25px_rgba(236,72,153,0.7)]">
            EVASION
          </h1>
          <p className="mt-4 text-sm sm:text-base font-mono-hud tracking-[0.3em] text-cyan-200 animate-pulse">
            INITIALIZE // PRESS <span className="text-pink-400">[SPACE]</span> OR CLICK TO ENTER
          </p>
        </div>
      )}

      <div className="absolute bottom-4 inset-x-0 text-center text-[10px] sm:text-xs text-slate-500 font-mono tracking-widest z-20">
        CLICK ANYWHERE TO START
      </div>

      {/* CHANGED: creator credit — small, dim, bottom-right corner */}
      <div className="absolute bottom-3 right-4 text-[10px] text-slate-600 font-mono tracking-widest uppercase opacity-70 z-20 pointer-events-none">
        Created by Kevin Tamkei
      </div>
    </div>
  );
};