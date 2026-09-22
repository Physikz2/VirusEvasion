// Lightweight global telemetry client backed by a Supabase (PostgREST) table.
// Falls back to a per-browser localStorage simulation when no backend is configured,
// so the game remains fully playable without any setup.

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/game_runs` : null;
const LEADERBOARD_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/leaderboard` : null;

const LOCAL_RUNS_KEY = 'virus_evasion_local_runs_v1';
const LOCAL_LEADERBOARD_KEY = 'virus_evasion_leaderboard_v1';
const MAX_LOCAL_RUNS = 500;
const LEADERBOARD_LIMIT = 10;

export const isRemoteTelemetryEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export interface GameOverStats {
  totalGlobalRuns: number;
  percentile: number; // 0-100, share of players this run beat
}

// Bin edges in ms: [0-30s), [30s-1m), [1m-2m), [2m-3m), [3m+]
export const HISTOGRAM_BIN_EDGES_MS = [0, 30_000, 60_000, 120_000, 180_000, Infinity];
export const HISTOGRAM_BIN_LABELS = ['0-30s', '30s-1m', '1m-2m', '2m-3m', '3m+'];

export function getHistogramBinIndex(survivalTimeMs: number): number {
  for (let i = 0; i < HISTOGRAM_BIN_LABELS.length; i++) {
    if (survivalTimeMs < HISTOGRAM_BIN_EDGES_MS[i + 1]) return i;
  }
  return HISTOGRAM_BIN_LABELS.length - 1;
}

let pendingRunId: number | null = null;

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY as string,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// PostgREST returns the total row count in a "Content-Range: 0-0/123" style header.
function parseCountFromContentRange(res: Response): number {
  const range = res.headers.get('content-range');
  if (!range) return 0;
  const total = range.split('/')[1];
  return total && total !== '*' ? parseInt(total, 10) : 0;
}

function readLocalRuns(): number[] {
  try {
    const raw = localStorage.getItem(LOCAL_RUNS_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRuns(runs: number[]): void {
  try {
    localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(runs.slice(-MAX_LOCAL_RUNS)));
  } catch {
    // Ignore storage restrictions (private browsing, quota, etc.)
  }
}

export async function fetchGlobalRunCount(): Promise<number> {
  if (TABLE_ENDPOINT) {
    try {
      const res = await fetch(`${TABLE_ENDPOINT}?select=id`, {
        headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
      });
      if (res.ok) return parseCountFromContentRange(res);
    } catch {
      // fall through to local
    }
  }
  return readLocalRuns().length;
}

// Call once per game start. Returns the updated "Total Global Runs" count.
export async function recordGameStart(): Promise<number> {
  if (TABLE_ENDPOINT) {
    try {
      const res = await fetch(TABLE_ENDPOINT, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ survival_time_ms: 0 }),
      });
      if (res.ok) {
        const rows = (await res.json()) as Array<{ id: number }>;
        pendingRunId = rows[0]?.id ?? null;
        return await fetchGlobalRunCount();
      }
    } catch {
      // fall through to local
    }
  }

  pendingRunId = null;
  return readLocalRuns().length + 1;
}

// Call once per death. Sends the final survival time and returns the global percentile rank.
export async function recordGameOver(survivalTimeMs: number): Promise<GameOverStats> {
  if (TABLE_ENDPOINT && pendingRunId !== null) {
    try {
      await fetch(`${TABLE_ENDPOINT}?id=eq.${pendingRunId}`, {
        method: 'PATCH',
        headers: supabaseHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ survival_time_ms: survivalTimeMs }),
      });

      const [totalRes, lowerRes, allRes] = await Promise.all([
        fetch(`${TABLE_ENDPOINT}?select=id&survival_time_ms=gt.0`, {
          headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
        }),
        fetch(
          `${TABLE_ENDPOINT}?select=id&survival_time_ms=gt.0&survival_time_ms=lt.${survivalTimeMs}`,
          { headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }) }
        ),
        fetch(`${TABLE_ENDPOINT}?select=id`, {
          headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
        }),
      ]);

      const total = parseCountFromContentRange(totalRes);
      const lower = parseCountFromContentRange(lowerRes);
      const totalGlobalRuns = parseCountFromContentRange(allRes);
      const percentile = total > 0 ? Math.round((lower / total) * 100) : 100;
      pendingRunId = null;
      return { totalGlobalRuns, percentile };
    } catch {
      // fall through to local
    }
  }

  pendingRunId = null;
  const runs = readLocalRuns();
  const lower = runs.filter((t) => t < survivalTimeMs).length;
  const percentile = runs.length > 0 ? Math.round((lower / runs.length) * 100) : 100;
  runs.push(survivalTimeMs);
  writeLocalRuns(runs);
  return { totalGlobalRuns: runs.length, percentile };
}

// Returns the completed-run count for each histogram bin (0-30s, 30s-1m, 1m-2m, 2m-3m, 3m+).
export async function fetchHistogramBuckets(): Promise<number[]> {
  if (TABLE_ENDPOINT) {
    try {
      const counts = await Promise.all(
        HISTOGRAM_BIN_LABELS.map((_, i) => {
          const lo = HISTOGRAM_BIN_EDGES_MS[i];
          const hi = HISTOGRAM_BIN_EDGES_MS[i + 1];
          const params = new URLSearchParams();
          params.set('select', 'id');
          params.append('survival_time_ms', `gte.${Math.max(lo, 1)}`);
          if (Number.isFinite(hi)) params.append('survival_time_ms', `lt.${hi}`);
          return fetch(`${TABLE_ENDPOINT}?${params.toString()}`, {
            headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
          }).then(parseCountFromContentRange);
        })
      );
      return counts;
    } catch {
      // fall through to local
    }
  }

  const runs = readLocalRuns();
  return HISTOGRAM_BIN_LABELS.map((_, i) => {
    const lo = HISTOGRAM_BIN_EDGES_MS[i];
    const hi = HISTOGRAM_BIN_EDGES_MS[i + 1];
    return runs.filter((t) => t >= lo && t < hi).length;
  });
}

export interface LeaderboardEntry {
  name: string;
  survivalTimeMs: number;
}

function readLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocalLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage restrictions
  }
}

// Fetches the current Top N (default 10), sorted descending by survival time.
export async function fetchTopScores(limit: number = LEADERBOARD_LIMIT): Promise<LeaderboardEntry[]> {
  if (LEADERBOARD_ENDPOINT) {
    try {
      const res = await fetch(
        `${LEADERBOARD_ENDPOINT}?select=player_name,survival_time_ms&order=survival_time_ms.desc&limit=${limit}`,
        { headers: supabaseHeaders() }
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{ player_name: string; survival_time_ms: number }>;
        return rows.map((r) => ({ name: r.player_name, survivalTimeMs: r.survival_time_ms }));
      }
    } catch {
      // fall through to local
    }
  }

  return readLocalLeaderboard()
    .slice()
    .sort((a, b) => b.survivalTimeMs - a.survivalTimeMs)
    .slice(0, limit);
}

// Submits a Hall of Fame entry and returns the refreshed Top 10.
export async function submitLeaderboardEntry(
  name: string,
  survivalTimeMs: number
): Promise<LeaderboardEntry[]> {
  if (LEADERBOARD_ENDPOINT) {
    try {
      const res = await fetch(LEADERBOARD_ENDPOINT, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ player_name: name, survival_time_ms: survivalTimeMs }),
      });
      if (res.ok) return await fetchTopScores();
    } catch {
      // fall through to local
    }
  }

  const entries = readLocalLeaderboard();
  entries.push({ name, survivalTimeMs });
  entries.sort((a, b) => b.survivalTimeMs - a.survivalTimeMs);
  writeLocalLeaderboard(entries.slice(0, 100));
  return entries.slice(0, LEADERBOARD_LIMIT);
}
