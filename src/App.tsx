import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus } from './types';
import { HUD } from './components/HUD';
import { GameCanvas } from './components/GameCanvas';
import { GameOverModal } from './components/GameOverModal';
import { IntroSequence } from './components/IntroSequence';
import { soundManager } from './utils/audio';
// CHANGED: added fetchGlobalRecord to the import
import { fetchGlobalRunCount, recordGameStart, recordGameOver, fetchGlobalRecord } from './utils/telemetry';

const HIGH_SCORE_KEY = 'virus_evasion_best_score_v1';

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [survivalTime, setSurvivalTime] = useState<number>(0);
  const [activeViruses, setActiveViruses] = useState<number>(0);
  const [nextSpawnCountdown, setNextSpawnCountdown] = useState<number>(5.0);
  const [highScore, setHighScore] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [totalGlobalRuns, setTotalGlobalRuns] = useState<number>(0);
  const [globalPercentile, setGlobalPercentile] = useState<number | null>(null);
  const [isLoadingGlobalStats, setIsLoadingGlobalStats] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(true);
  // CHANGED: new state for the world record HUD cell
  const [globalRecord, setGlobalRecord] = useState<number>(0);

  // Guards against React StrictMode double-invoking effects and prevents
  // logging the same game-over more than once per run.
  const gameOverLoggedRef = useRef(false);

  // Play BossIntro.wav on the user's very first click or keypress anywhere on the page
  useEffect(() => {
    const handleFirstInteraction = () => {
      soundManager.playIntroStinger();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // Load high score from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setHighScore(parsed);
        }
      }
    } catch {
      // Ignore localStorage restrictions
    }
  }, []);

  // Fetch the current global run count for display before the player starts
  useEffect(() => {
    fetchGlobalRunCount()
      .then(setTotalGlobalRuns)
      .catch(() => {});
  }, []);

  // CHANGED: fetch the current world record on mount for HUD display
  useEffect(() => {
    fetchGlobalRecord()
      .then(setGlobalRecord)
      .catch(() => {});
  }, []);

  // Update high score in storage if beaten
  const updateHighScoreIfBeaten = useCallback(
    (timeMs: number) => {
      if (timeMs > highScore) {
        setHighScore(timeMs);
        setIsNewRecord(true);
        try {
          localStorage.setItem(HIGH_SCORE_KEY, timeMs.toString());
        } catch {
          // Ignore
        }
      } else {
        setIsNewRecord(false);
      }
    },
    [highScore]
  );

  // Handlers for game lifecycle
  const handleStartGame = useCallback(() => {
    soundManager.startBackgroundLoop(); // Starts the random background music rotation when Defense Grid is clicked!
    setSurvivalTime(0);
    setIsNewRecord(false);
    setGameStatus('playing');

    // Reset the game-over guard so the upcoming run can be logged.
    gameOverLoggedRef.current = false;

    // Do NOT optimistically bump the counter — the backend is the source of truth.
    // recordGameStart() only reads the count, so it's safe to call more than once.
    recordGameStart()
      .then(setTotalGlobalRuns)
      .catch(() => {});
  }, []);

  const handleGameOver = useCallback(
    (finalTimeMs: number, virusCount: number) => {
      // Guard: only log one game-over per run, even if GameCanvas fires twice.
      if (gameOverLoggedRef.current) return;
      gameOverLoggedRef.current = true;

      setSurvivalTime(finalTimeMs);
      setActiveViruses(virusCount);
      updateHighScoreIfBeaten(finalTimeMs);
      setGameStatus('gameover');

      setGlobalPercentile(null);
      setIsLoadingGlobalStats(true);
      recordGameOver(finalTimeMs)
        .then((stats) => {
          setTotalGlobalRuns(stats.totalGlobalRuns);
          setGlobalPercentile(stats.percentile);
        })
        .catch(() => {})
        .finally(() => setIsLoadingGlobalStats(false));

      // CHANGED: refresh world record in case this run just set a new one
      fetchGlobalRecord().then(setGlobalRecord).catch(() => {});
    },
    [updateHighScoreIfBeaten]
  );

  const handleUpdateStats = useCallback(
    (timeMs: number, activeCount: number, nextSpawnSec: number) => {
      setSurvivalTime(timeMs);
      setActiveViruses(activeCount);
      setNextSpawnCountdown(nextSpawnSec);
      if (timeMs > highScore) {
        setHighScore(timeMs);
        setIsNewRecord(true);
      }
    },
    [highScore]
  );

  const handleToggleSound = useCallback(() => {
    const next = soundManager.toggle();
    setSoundEnabled(next);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard shortcut listener (Space for start/retry)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showIntro) return;
      if (e.code === 'Space') {
        if (gameStatus === 'idle' || gameStatus === 'gameover') {
          e.preventDefault();
          handleStartGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, handleStartGame, showIntro]);

  if (showIntro) {
    return <IntroSequence onComplete={() => setShowIntro(false)} />;
  }

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#06080d] text-slate-100 overflow-hidden select-none font-cyber">
      {/* Top HUD */}
      <HUD
        survivalTime={survivalTime}
        activeViruses={activeViruses}
        highScore={highScore}
        globalRecord={globalRecord}   {/* CHANGED: pass world record */}
        nextSpawnCountdown={nextSpawnCountdown}
        gameStatus={gameStatus}
        soundEnabled={soundEnabled}
        totalGlobalRuns={totalGlobalRuns}
        onToggleSound={handleToggleSound}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Interactive Canvas Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        <GameCanvas
          gameStatus={gameStatus}
          onGameOver={handleGameOver}
          onUpdateStats={handleUpdateStats}
          onStartGame={handleStartGame}
          totalGlobalRuns={totalGlobalRuns}
        />

        {/* Game Over Modal Screen */}
        {gameStatus === 'gameover' && (
          <GameOverModal
            survivalTime={survivalTime}
            highScore={highScore}
            isNewRecord={isNewRecord}
            activeViruses={activeViruses}
            totalGlobalRuns={totalGlobalRuns}
            globalPercentile={globalPercentile}
            isLoadingGlobalStats={isLoadingGlobalStats}
            onRestart={handleStartGame}
          />
        )}
      </main>

      {/* Bottom Status Ticker Bar */}
      <footer className="w-full px-4 py-1.5 bg-[#070a12] border-t border-cyan-500/15 flex items-center justify-between text-[11px] text-slate-400 font-mono-hud z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-300 font-semibold">ARENA GRID: NOMINAL</span>
          </div>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-400">
            HOSTILE REPRODUCTION CYCLE: 5.0 SECONDS
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-slate-400">
            AVOID RECTANGULAR INTERSECTIONS
          </span>
          <span className="text-cyan-400/80">[PRESS SPACE TO REBOOT]</span>
        </div>
      </footer>
    </div>
  );
}