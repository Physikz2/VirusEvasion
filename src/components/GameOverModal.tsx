import React, { useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Trophy,
  Skull,
  Clock,
  AlertTriangle,
  Award,
  Share2,
  Copy,
  Check,
  Mail,
  Globe,
  Loader2,
  BarChart3,
  X,
} from 'lucide-react';
import { formatTime } from './HUD';
import { soundManager } from '../utils/audio';
import {
  fetchHistogramBuckets,
  getHistogramBinIndex,
  HISTOGRAM_BIN_LABELS,
  fetchTopScores,
  submitLeaderboardEntry,
  LeaderboardEntry,
} from '../utils/telemetry';
import { validateHandle, MIN_NAME_LENGTH, MAX_NAME_LENGTH } from '../utils/profanityFilter';

const LEADERBOARD_DISPLAY_LIMIT = 10;

interface GameOverModalProps {
  survivalTime: number;
  highScore: number;
  isNewRecord: boolean;
  activeViruses: number;
  totalGlobalRuns: number;
  globalPercentile: number | null;
  isLoadingGlobalStats: boolean;
  onRestart: () => void;
}

const LOG_SCALE_TICKS = [10, 100, 1000, 10000];
const LOG_SCALE_MAX = Math.log10(LOG_SCALE_TICKS[LOG_SCALE_TICKS.length - 1]);

function barHeightPercent(count: number): number {
  if (count <= 0) return 0;
  return Math.min(100, (Math.log10(count + 1) / LOG_SCALE_MAX) * 100);
}

function getRating(timeMs: number): { title: string; desc: string; color: string } {
  const sec = timeMs / 1000;
  if (sec >= 90) {
    return {
      title: 'CYBER GHOST // CLASS S',
      desc: 'Legendary neural agility. Unmatched evasive reflexes.',
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20',
    };
  }
  if (sec >= 60) {
    return {
      title: 'NETRUNNER ELITE // CLASS A',
      desc: 'Superior threat detection and evasive maneuvers.',
      color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20',
    };
  }
  if (sec >= 35) {
    return {
      title: 'FIREWALL DEFENDER // CLASS B',
      desc: 'Competent spatial navigation under hostile pressure.',
      color: 'text-amber-400 border-amber-500/40 bg-amber-950/20',
    };
  }
  if (sec >= 15) {
    return {
      title: 'GRID OPERATOR // CLASS C',
      desc: 'Standard reflex response. Continued calibration required.',
      color: 'text-purple-400 border-purple-500/40 bg-purple-950/20',
    };
  }
  return {
    title: 'RECRUIT PROBE // CLASS D',
    desc: 'Core corrupted early. Stay away from walls and corners.',
    color: 'text-red-400 border-red-500/40 bg-red-950/20',
  };
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  survivalTime,
  highScore,
  isNewRecord,
  activeViruses,
  totalGlobalRuns,
  globalPercentile,
  isLoadingGlobalStats,
  onRestart,
}) => {
  const rating = getRating(survivalTime);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isHistogramOpen, setIsHistogramOpen] = useState(false);
  const [histogramData, setHistogramData] = useState<number[] | null>(null);
  const [isHistogramLoading, setIsHistogramLoading] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [qualifiesForTopTen, setQualifiesForTopTen] = useState(false);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [isHallOfFameOpen, setIsHallOfFameOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);

  const topTenBannerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const playerBinIndex = getHistogramBinIndex(survivalTime);

  useEffect(() => {
    if (!isHistogramOpen || histogramData !== null) return;
    setIsHistogramLoading(true);
    fetchHistogramBuckets()
      .then(setHistogramData)
      .catch(() => setHistogramData(HISTOGRAM_BIN_LABELS.map(() => 0)))
      .finally(() => setIsHistogramLoading(false));
  }, [isHistogramOpen, histogramData]);

  useEffect(() => {
    fetchTopScores()
      .then((entries) => {
        setLeaderboard(entries);
        const qualifies =
          entries.length < LEADERBOARD_DISPLAY_LIMIT ||
          survivalTime > entries[entries.length - 1].survivalTimeMs;
        setQualifiesForTopTen(qualifies);
        const betterCount = entries.filter((e) => e.survivalTimeMs > survivalTime).length;
        setPlayerRank(betterCount + 1);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qualifiesForTopTen || hasSubmittedScore) return;

    const chimeTimer = window.setTimeout(() => {
      soundManager.playTopTenFanfare();
    }, 250);

    const scrollTimer = window.setTimeout(() => {
      topTenBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 1200);

    return () => {
      window.clearTimeout(chimeTimer);
      window.clearTimeout(scrollTimer);
      window.clearTimeout(focusTimer);
    };
  }, [qualifiesForTopTen, hasSubmittedScore]);

  const handleSubmitScore = async () => {
    soundManager.playUiTick();
    const error = validateHandle(nameInput);
    if (error) {
      setNameError(error);
      return;
    }
    setNameError(null);
    setIsSubmittingScore(true);
    try {
      const updated = await submitLeaderboardEntry(nameInput.trim(), survivalTime);
      setLeaderboard(updated);
      setHasSubmittedScore(true);
    } catch {
      setNameError('Could not submit score. Please try again.');
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const handleSkipName = () => {
    soundManager.playUiTick();
    setHasSubmittedScore(true);
    setNameInput('');
    setNameError(null);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText =
    `I survived ${formatTime(survivalTime)} in Virus Evasion` +
    (globalPercentile !== null ? ` — longer than ${globalPercentile}% of players worldwide!` : '!') +
    ' Can you beat me?';

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    soundManager.playUiTick();
    setShareError(null);
    try {
      await navigator.share({ title: 'Virus Evasion', text: shareText, url: shareUrl });
    } catch {
      // User cancelled the share sheet or it failed silently; nothing to do.
    }
  };

  const handleCopy = async () => {
    soundManager.playUiTick();
    const payload = `${shareText} ${shareUrl}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = payload;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setShareError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError('Could not copy to clipboard');
    }
  };

  const handleEmailShare = () => {
    soundManager.playUiTick();
    const subject = encodeURIComponent('Check out my Virus Evasion score!');
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div
      id="game-over-overlay"
      className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#0b0f19] border border-red-500/40 p-5 sm:p-6 rounded-sm shadow-[0_0_50px_rgba(239,68,68,0.3)]">
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-red-500" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-red-500" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-red-500" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-red-500" />

        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-red-500/30 bg-red-950/40 text-red-400 text-xs font-mono uppercase tracking-widest mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            Fatal Collision Detected
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-display tracking-wider text-red-500 uppercase drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">
            Game Over
          </h2>
          <p className="text-xs text-slate-400 font-cyber tracking-widest uppercase mt-1">
            Hostile entity compromised player node
          </p>
        </div>

        {qualifiesForTopTen && (
          <div
            ref={topTenBannerRef}
            className="relative mb-4 p-5 rounded-sm border-2 border-purple-400/60 bg-gradient-to-br from-purple-950/60 via-[#130a1c] to-purple-950/60 shadow-[0_0_40px_rgba(168,85,247,0.5)] overflow-hidden"
          >
            <div className="absolute inset-0 rounded-sm pointer-events-none">
              <div className="absolute inset-0 rounded-sm border border-purple-400/40 animate-pulse" />
            </div>

            {hasSubmittedScore ? (
              <div className="relative flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2 text-purple-200">
                  <Trophy className="w-6 h-6 text-purple-300" />
                  <span className="text-lg font-display font-extrabold uppercase tracking-widest text-purple-200">
                    Entry Confirmed
                  </span>
                </div>
                <div className="text-[12px] text-purple-300 font-cyber">
                  Your score is now live in the Global Hall of Fame.
                </div>
              </div>
            ) : (
              <div className="relative flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-amber-300 animate-bounce" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-purple-300">
                    Congratulations
                  </span>
                  <Trophy className="w-5 h-5 text-amber-300 animate-bounce" />
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-200 to-purple-300 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)] mb-2">
                  You Made the Global Top 10
                </h3>

                <div className="text-[13px] sm:text-sm text-purple-100 font-cyber mb-3 leading-relaxed">
                  You ranked{' '}
                  <strong className="text-amber-300 font-mono-hud text-base">
                    #{playerRank ?? '?'}
                  </strong>{' '}
                  globally.
                  <br />
                  <span className="text-[12px] text-purple-300">
                    Based on{' '}
                    <strong className="text-purple-200">
                      {totalGlobalRuns.toLocaleString()}
                    </strong>{' '}
                    total runs logged.
                  </span>
                </div>

                <div className="w-full max-w-md">
                  <div className="text-[11px] text-purple-300 uppercase tracking-widest font-bold mb-1.5">
                    Enter your handle to claim your spot:
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={nameInputRef}
                      id="input-hall-of-fame-name"
                      type="text"
                      value={nameInput}
                      onChange={(e) => {
                        setNameInput(e.target.value);
                        setNameError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitScore()}
                      minLength={MIN_NAME_LENGTH}
                      maxLength={MAX_NAME_LENGTH}
                      placeholder="Your handle..."
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-sm bg-[#070b13] border border-purple-500/50 text-slate-100 text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-purple-300 focus:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all"
                    />
                    <button
                      id="btn-submit-score"
                      onClick={handleSubmitScore}
                      disabled={isSubmittingScore}
                      className="px-5 py-2.5 rounded-sm bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_0_20px_rgba(168,85,247,0.6)]"
                    >
                      {isSubmittingScore ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Submit'
                      )}
                    </button>
                  </div>
                  {nameError && (
                    <div className="text-[11px] text-red-400 mt-1.5">{nameError}</div>
                  )}

                  <button
                    onClick={handleSkipName}
                    className="mt-2.5 text-[11px] text-slate-500 hover:text-slate-300 uppercase tracking-widest font-mono underline-offset-2 hover:underline transition-colors cursor-pointer"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative bg-[#070b13] border border-red-500/25 p-4 rounded-sm text-center mb-4">
          {isNewRecord && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-black text-[11px] font-bold tracking-widest uppercase flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.6)]">
              <Trophy className="w-3 h-3" />
              New High Score!
            </div>
          )}

          <div className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Final Survival Time
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold font-mono-hud text-white tracking-wider my-1 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            {formatTime(survivalTime)}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800">
            {isLoadingGlobalStats ? (
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-300 font-cyber">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculating your global rank...
              </div>
            ) : globalPercentile !== null ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Globe className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Global Rank
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-300 tracking-wide drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                  Top {100 - globalPercentile}%
                </div>
                <div className="text-[12px] text-slate-300 font-cyber">
                  You survived longer than{' '}
                  <strong className="text-emerald-300">{globalPercentile}%</strong> of players
                  worldwide
                </div>
                <div className="text-[11px] text-slate-500 font-mono-hud mt-1">
                  {totalGlobalRuns.toLocaleString()} runs logged
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 font-cyber">
                Global rank unavailable right now.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#070b13] border border-slate-800 p-3 rounded-sm flex items-center gap-3">
                <div className="p-2 rounded bg-red-950/40 border border-red-500/20 text-red-400">
                  <Skull className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Threats Spawned</div>
                  <div className="text-lg font-bold font-mono-hud text-slate-200">
                    {activeViruses} Blocks
                  </div>
                </div>
              </div>

              <div className="bg-[#070b13] border border-slate-800 p-3 rounded-sm flex items-center gap-3">
                <div className="p-2 rounded bg-amber-950/40 border border-amber-500/20 text-amber-400">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Your Best</div>
                  <div className="text-lg font-bold font-mono-hud text-amber-300">
                    {formatTime(highScore)}
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-sm border flex items-start gap-3 ${rating.color}`}>
              <Award className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider font-display">
                  {rating.title}
                </div>
                <div className="text-[11px] text-slate-300 font-cyber mt-0.5">
                  {rating.desc}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                id="btn-share-score"
                onClick={handleNativeShare}
                disabled={!canNativeShare}
                title={canNativeShare ? 'Share your score' : 'Sharing not supported on this device'}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-sm border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-[11px] font-bold uppercase tracking-wide"
              >
                <Share2 className="w-4 h-4" />
                Share Score
              </button>

              <button
                id="btn-copy-score"
                onClick={handleCopy}
                title="Copy score to clipboard"
                className="relative flex flex-col items-center justify-center gap-1 py-2.5 rounded-sm border border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800/70 transition-all cursor-pointer text-[11px] font-bold uppercase tracking-wide"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Score
                  </>
                )}
                {shareError && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-red-950 border border-red-500/40 text-red-300 text-[10px] whitespace-nowrap">
                    {shareError}
                  </span>
                )}
              </button>

              <button
                id="btn-share-email"
                onClick={handleEmailShare}
                title="Share via email"
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-sm border border-amber-500/30 bg-amber-950/20 text-amber-300 hover:bg-amber-900/30 transition-all cursor-pointer text-[11px] font-bold uppercase tracking-wide"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-open-histogram"
                onClick={() => {
                  soundManager.playUiTick();
                  setIsHistogramOpen(true);
                }}
                className="w-full group relative py-3 px-4 rounded-sm bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 hover:from-slate-700 hover:to-slate-600 border border-yellow-400/30 text-yellow-300 font-display font-bold text-xs tracking-wide uppercase transition-all duration-200 shadow-[0_0_20px_rgba(250,204,21,0.15)] hover:shadow-[0_0_30px_rgba(250,204,21,0.35)] flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
              >
                <BarChart3 className="w-4 h-4" />
                <span>📊 Rank Distribution</span>
              </button>

              <button
                id="btn-open-hall-of-fame"
                onClick={() => {
                  soundManager.playUiTick();
                  setIsHallOfFameOpen(true);
                }}
                className="w-full group relative py-3 px-4 rounded-sm bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 hover:from-slate-700 hover:to-slate-600 border border-purple-400/30 text-purple-300 font-display font-bold text-xs tracking-wide uppercase transition-all duration-200 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:shadow-[0_0_30px_rgba(168,85,247,0.35)] flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
              >
                <Trophy className="w-4 h-4" />
                <span>🏆 Hall of Fame</span>
              </button>
            </div>
          </div>
        </div>

        <button
          id="btn-retry-game"
          onClick={() => {
            soundManager.playUiTick();
            onRestart();
          }}
          autoFocus
          className="w-full group relative mt-4 py-3.5 px-6 rounded-sm bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-display font-bold text-base tracking-widest uppercase transition-all duration-200 shadow-[0_0_25px_rgba(239,68,68,0.45)] hover:shadow-[0_0_35px_rgba(239,68,68,0.7)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span>Restart Game</span>
        </button>
      </div>

      {isHistogramOpen && (
        <div
          id="histogram-overlay"
          onClick={() => setIsHistogramOpen(false)}
          className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#0b0f19] border border-yellow-400/30 p-6 rounded-sm shadow-[0_0_50px_rgba(250,204,21,0.2)]"
          >
            <button
              id="btn-close-histogram"
              onClick={() => setIsHistogramOpen(false)}
              title="Close"
              className="absolute top-3 right-3 p-1.5 rounded-sm border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-yellow-400/30 bg-yellow-950/20 text-yellow-300 text-xs font-mono uppercase tracking-widest mb-3">
                <BarChart3 className="w-3.5 h-3.5" />
                Global Rank Distribution
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-display tracking-wider text-yellow-300 uppercase drop-shadow-[0_0_12px_rgba(250,204,21,0.4)]">
                Global Survival Time Distribution
              </h3>
            </div>

            {isHistogramLoading || histogramData === null ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading global data...
              </div>
            ) : (
              <div className="flex items-stretch gap-3">
                <div className="flex flex-col-reverse justify-between h-48 text-[10px] text-slate-500 font-mono-hud pb-6">
                  {LOG_SCALE_TICKS.map((tick) => (
                    <span key={tick} style={{ transform: 'translateY(50%)' }}>
                      {tick >= 1000 ? `${tick / 1000}k` : tick}
                    </span>
                  ))}
                </div>

                <div className="relative flex-1">
                  <div className="absolute left-0 right-0 top-0 h-48">
                    {LOG_SCALE_TICKS.map((tick) => (
                      <div
                        key={tick}
                        className="absolute left-0 right-0 border-t border-slate-800"
                        style={{ bottom: `${(Math.log10(tick) / LOG_SCALE_MAX) * 100}%` }}
                      />
                    ))}
                  </div>

                  <div className="flex items-end h-48 gap-3">
                    {HISTOGRAM_BIN_LABELS.map((label, i) => {
                      const count = histogramData[i] ?? 0;
                      const isPlayerBin = i === playerBinIndex;
                      return (
                        <div key={label} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[10px] text-slate-300 font-mono-hud mb-1">
                            {count.toLocaleString()}
                          </span>
                          <div
                            className={`w-full rounded-t-sm transition-all duration-500 ${
                              isPlayerBin
                                ? 'bg-yellow-300 ring-2 ring-yellow-200 shadow-[0_0_25px_rgba(250,204,21,0.9)]'
                                : 'bg-yellow-400/70'
                            }`}
                            style={{ height: `${barHeightPercent(count)}%`, minHeight: count > 0 ? 3 : 0 }}
                            title={`${label}: ${count.toLocaleString()} runs`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 mt-2">
                    {HISTOGRAM_BIN_LABELS.map((label, i) => (
                      <div
                        key={label}
                        className={`flex-1 text-center text-[10px] font-mono-hud uppercase tracking-wide ${
                          i === playerBinIndex ? 'text-yellow-300 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-2">
              Runs (Log Scale)
            </div>

            <div className="text-center text-[11px] text-slate-400 font-cyber mt-4 pt-4 border-t border-slate-800">
              Based on {totalGlobalRuns.toLocaleString()} total global runs logged.
            </div>
          </div>
        </div>
      )}

      {isHallOfFameOpen && (
        <div
          id="hall-of-fame-overlay"
          onClick={() => setIsHallOfFameOpen(false)}
          className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[#0b0f19] border border-purple-400/30 p-6 rounded-sm shadow-[0_0_50px_rgba(168,85,247,0.2)]"
          >
            <button
              id="btn-close-hall-of-fame"
              onClick={() => setIsHallOfFameOpen(false)}
              title="Close"
              className="absolute top-3 right-3 p-1.5 rounded-sm border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-purple-400/30 bg-purple-950/20 text-purple-300 text-xs font-mono uppercase tracking-widest mb-3">
                <Trophy className="w-3.5 h-3.5" />
                Global Hall of Fame
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-display tracking-wider text-purple-300 uppercase drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                Top 10 Survivors
              </h3>
            </div>

            {leaderboard === null ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading rankings...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                No runs logged yet. Be the first Hall of Famer!
              </div>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {leaderboard.map((entry, i) => {
                  const isCurrentRun =
                    hasSubmittedScore &&
                    entry.name === nameInput.trim() &&
                    entry.survivalTimeMs === survivalTime;
                  return (
                    <li
                      key={`${entry.name}-${entry.survivalTimeMs}-${i}`}
                      className={`flex items-center gap-3 px-3 py-2 rounded-sm border ${
                        isCurrentRun
                          ? 'border-purple-400/60 bg-purple-950/40 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                          : 'border-slate-800 bg-[#070b13]'
                      }`}
                    >
                      <span
                        className={`w-6 text-center font-mono-hud font-bold text-sm ${
                          i === 0
                            ? 'text-amber-300'
                            : i === 1
                              ? 'text-slate-300'
                              : i === 2
                                ? 'text-amber-600'
                                : 'text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm font-cyber text-slate-200">
                        {entry.name}
                      </span>
                      <span className="text-sm font-mono-hud text-purple-300 font-semibold">
                        {formatTime(entry.survivalTimeMs)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="text-center text-[11px] text-slate-400 font-cyber mt-4 pt-4 border-t border-slate-800">
              Based on {totalGlobalRuns.toLocaleString()} total global runs logged.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};