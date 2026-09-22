import React from 'react';
import { Volume2, VolumeX, Shield, Maximize2, Trophy, Skull, Globe } from 'lucide-react';
import { GameStatus } from '../types';
import { soundManager } from '../utils/audio';

interface HUDProps {
  survivalTime: number;
  activeViruses: number;
  highScore: number;
  globalRecord: number; // ← NEW: highest score across all players
  nextSpawnCountdown: number; // in seconds (0 to 5)
  gameStatus: GameStatus;
  soundEnabled: boolean;
  totalGlobalRuns: number;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
}

export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((ms % 1000) / 10);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}.${pad(milliseconds)}`;
}

export const HUD: React.FC<HUDProps> = ({
  survivalTime,
  activeViruses,
  highScore,
  globalRecord, // ← NEW
  nextSpawnCountdown,
  gameStatus,
  soundEnabled,
  totalGlobalRuns,
  onToggleSound,
  onToggleFullscreen,
}) => {
  const spawnProgress = Math.max(0, Math.min(1, (5 - nextSpawnCountdown) / 5));

  return (
    <header className="w-full flex items-center justify-between px-4 py-3 bg-[#090d16]/80 backdrop-blur-md border-b border-cyan-500/20 shadow-lg text-slate-100 z-20 select-none">
      {/* Brand & System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-sm bg-gradient-to-br from-cyan-400 to-blue-600 p-[1px] shadow-[0_0_12px_rgba(6,182,212,0.4)] flex items-center justify-center">
            <div className="w-full h-full bg-[#070b14] flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wider uppercase font-display text-white">
                Virus Evasion
              </h1>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-sm">
                v2.4
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-cyber flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              SYS DEFENSE ACTIVE
            </div>
          </div>
        </div>
      </div>

      {/* Primary Metrics Group */}
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Live Survival Timer */}
        <div className="flex flex-col items-center bg-[#0d1322] border border-cyan-500/30 px-3.5 py-1 rounded-sm shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
            Survival Time
          </span>
          <span className="text-xl sm:text-2xl font-bold tracking-wider font-mono-hud text-white">
            {formatTime(survivalTime)}
          </span>
        </div>

        {/* Active Virus Counter & Next Spawner */}
        <div className="hidden md:flex flex-col items-center bg-[#130d17] border border-red-500/30 px-3.5 py-1 rounded-sm shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <div className="flex items-center justify-between w-full gap-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-red-400 flex items-center gap-1">
              <Skull className="w-3 h-3 text-red-400" />
              Threats
            </span>
            <span className="text-xs font-mono-hud text-red-300 font-semibold">
              +1 in {nextSpawnCountdown.toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center gap-2 w-full mt-0.5">
            <span className="text-lg font-bold font-mono-hud text-red-100">
              {activeViruses}
            </span>
            {/* 5-second progress bar to next spawn */}
            <div className="w-16 h-1.5 bg-red-950/80 rounded-full overflow-hidden border border-red-500/20">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-amber-400 transition-all duration-100"
                style={{ width: `${spawnProgress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Personal Best (local, per-device) */}
        <div className="flex flex-col items-end sm:items-center bg-[#14120a] border border-amber-500/30 px-3 py-1 rounded-sm">
          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            Your Best
          </span>
          <span className="text-sm sm:text-base font-bold font-mono-hud text-amber-200">
            {formatTime(highScore)}
          </span>
        </div>

        {/* World Record (global, from leaderboard) — hidden on smallest screens */}
        <div className="hidden sm:flex flex-col items-center bg-[#130a14] border border-pink-500/30 px-3 py-1 rounded-sm shadow-[0_0_15px_rgba(236,72,153,0.12)]">
          <span className="text-[10px] uppercase font-bold tracking-widest text-pink-400 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-pink-400" />
            World Record
          </span>
          <span className="text-sm sm:text-base font-bold font-mono-hud text-pink-200">
            {globalRecord > 0 ? formatTime(globalRecord) : '--:--.--'}
          </span>
        </div>

        {/* Global Run Counter */}
        <div className="hidden lg:flex flex-col items-center bg-[#0a1414] border border-emerald-500/30 px-3.5 py-1 rounded-sm shadow-[0_0_15px_rgba(16,185,129,0.12)]">
          <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1">
            <Globe className="w-3 h-3 text-emerald-400" />
            Total Global Runs
          </span>
          <span className="text-sm sm:text-base font-bold font-mono-hud text-emerald-200">
            {totalGlobalRuns.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Control Utility Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Audio Toggle */}
        <button
          id="btn-toggle-sound"
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute Audio SFX' : 'Enable Audio SFX'}
          className={`p-2 rounded-sm border transition-all cursor-pointer ${
            soundEnabled
              ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:bg-slate-800'
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        {/* Fullscreen Toggle */}
        <button
          id="btn-toggle-fullscreen"
          onClick={() => {
            soundManager.playUiTick();
            onToggleFullscreen();
          }}
          title="Toggle Fullscreen"
          className="p-2 rounded-sm border border-slate-700 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-600 text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};