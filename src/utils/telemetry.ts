// Lightweight global telemetry client backed by a Supabase (PostgREST) table.

// ---------------------------------------------------------------------------
// Config & endpoints
// ---------------------------------------------------------------------------

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const RAW_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const SUPABASE_URL = RAW_SUPABASE_URL?.trim().replace(/\/$/, '') || null;
const SUPABASE_ANON_KEY = RAW_SUPABASE_KEY?.trim() || null;

const TABLE_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/game_runs` : null;
const LEADERBOARD_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/leaderboard` : null;

export const isRemoteTelemetryEnabled = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY
);

// Loud, one-time diagnostic so you can see in DevTools whether env vars loaded.
if (!isRemoteTelemetryEnabled) {
  console.warn(
    '[telemetry] Remote telemetry DISABLED. ' +
      `VITE_SUPABASE_URL=${RAW_SUPABASE_URL ? 'set' : 'MISSING'}, ` +
      `VITE_SUPABASE_ANON_KEY=${RAW_SUPABASE_KEY ? 'set' : 'MISSING'}. ` +
      'Restart the Vite dev server after editing .env.'
  );
} else {
  console.info('[telemetry] Remote telemetry enabled →', SUPABASE_URL);
}

// ---------------------------------------------------------------------------
// Local fallback storage
// ---------------------------------------------------------------------------

const LOCAL_RUNS_KEY = 'virus_evasion_local_runs_v1';
const LOCAL_LEADERBOARD_KEY = 'virus_evasion_leaderboard_v1';
const MAX_LOCAL_RUNS = 500;
const LEADERBOARD_LIMIT = 10;

export interface GameOverStats {
  totalGlobalRuns: number;
  percentile: number;
}

export const HISTOGRAM_BIN_EDGES_MS = [0, 30_000, 60_000, 120_000, 180_000, Infinity];
export const HISTOGRAM_BIN_LABELS = ['0-30s', '30s-1m', '1m-2m', '2m-3m', '3m+'];

export function getHistogramBinIndex(survivalTimeMs: number): number {
  for (let i = 0; i < HISTOGRAM_BIN_LABELS.length; i++) {
    if (survivalTimeMs < HISTOGRAM_BIN_EDGES_MS[i + 1]) return i;
  }
  return HISTOGRAM_BIN_LABELS.length - 1;
}

// ---------------------------------------------------------------------------
// Headers / helpers
// ---------------------------------------------------------------------------

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY as string,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
    ...extra,
  };
}

function parseCountFromContentRange(res: Response): number {
  const range = res.headers.get('content-range');
  if (!range) return 0;
  const total = range.split('/')[1];
  return total && total !== '*' ? parseInt(total, 10) : 0;
}

/**
 * Throws a descriptive error if a Supabase REST response is not OK.
 * Reads the body exactly once so PostgREST doesn't leak the connection.
 */
async function assertOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  let body = '';
  try {
    body = await res.text();
  } catch {
    body = '<unreadable response body>';
  }
  throw new Error(
    `[telemetry] ${label} failed: HTTP ${res.status} ${res.statusText} — ${body}`
  );
}

// ---------------------------------------------------------------------------
// Local run history
// ---------------------------------------------------------------------------

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
    /* quota errors are non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Count / start
// ---------------------------------------------------------------------------

export async function fetchGlobalRunCount(): Promise<number> {
  if (TABLE_ENDPOINT) {
    try {
      const res = await fetch(`${TABLE_ENDPOINT}?select=id`, {
        headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
      });
      await assertOk(res, 'fetchGlobalRunCount');
      return parseCountFromContentRange(res);
    } catch (err) {
      console.error('[telemetry] fetchGlobalRunCount error:', err);
    }
  }
  return readLocalRuns().length;
}

export async function recordGameStart(): Promise<number> {
  return await fetchGlobalRunCount();
}

// ---------------------------------------------------------------------------
// Game over → insert run + compute percentile
// ---------------------------------------------------------------------------

export async function recordGameOver(
  survivalTimeMs: number,
  // CHANGED: playerName kept for API compatibility but no longer used.
  // The leaderboard is only written when the player explicitly submits
  // a name from GameOverModal.
  _playerName: string = 'Kevin'
): Promise<GameOverStats> {
  // Round once so Postgres int4 always accepts it.
  const ms = Math.max(0, Math.round(survivalTimeMs));

  // CHANGED: removed the auto-submit to leaderboard that lived here.
  // That call was producing duplicate entries — every game-over auto-inserted
  // a row with the default name 'Kevin', and then GameOverModal submitted a
  // second row when the user typed their handle. The leaderboard is now
  // exclusively written by submitLeaderboardEntry from the modal.

  if (TABLE_ENDPOINT) {
    try {
      const postRes = await fetch(TABLE_ENDPOINT, {
        method: 'POST',
        headers: supabaseHeaders({
          // Ask PostgREST to return the inserted row so we can verify it landed.
          Prefer: 'return=representation',
        }),
        body: JSON.stringify({ survival_time_ms: ms }),
      });
      await assertOk(postRes, 'game_runs INSERT');

      // Consume the response body (required to release the connection & surface errors).
      const inserted = (await postRes.json()) as Array<{ id: number }>;
      if (!Array.isArray(inserted) || inserted.length === 0) {
        throw new Error('[telemetry] game_runs INSERT returned no rows — likely blocked by RLS.');
      }
      console.info('[telemetry] game_runs INSERT ok, id =', inserted[0]?.id);

      // Now compute percentile stats.
      const [totalRes, lowerRes, allRes] = await Promise.all([
        fetch(`${TABLE_ENDPOINT}?select=id&survival_time_ms=gt.0`, {
          headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
        }),
        fetch(
          `${TABLE_ENDPOINT}?select=id&survival_time_ms=gt.0&survival_time_ms=lt.${ms}`,
          { headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }) }
        ),
        fetch(`${TABLE_ENDPOINT}?select=id`, {
          headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
        }),
      ]);

      await Promise.all([
        assertOk(totalRes, 'count total'),
        assertOk(lowerRes, 'count lower'),
        assertOk(allRes, 'count all'),
      ]);

      const total = parseCountFromContentRange(totalRes);
      const lower = parseCountFromContentRange(lowerRes);
      const totalGlobalRuns = parseCountFromContentRange(allRes);
      const percentile = total > 0 ? Math.round((lower / total) * 100) : 100;

      return { totalGlobalRuns, percentile };
    } catch (err) {
      console.error('[telemetry] recordGameOver remote path failed:', err);
      // Fall through to local fallback below.
    }
  }

  // Local fallback
  const runs = readLocalRuns();
  const lower = runs.filter((t) => t < ms).length;
  const percentile = runs.length > 0 ? Math.round((lower / runs.length) * 100) : 100;
  runs.push(ms);
  writeLocalRuns(runs);
  return { totalGlobalRuns: runs.length, percentile };
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

export async function fetchHistogramBuckets(): Promise<number[]> {
  if (TABLE_ENDPOINT) {
    try {
      const counts = await Promise.all(
        HISTOGRAM_BIN_LABELS.map(async (_, i) => {
          const lo = HISTOGRAM_BIN_EDGES_MS[i];
          const hi = HISTOGRAM_BIN_EDGES_MS[i + 1];
          const params = new URLSearchParams();
          params.set('select', 'id');
          params.append('survival_time_ms', `gte.${Math.max(lo, 1)}`);
          if (Number.isFinite(hi)) params.append('survival_time_ms', `lt.${hi}`);

          const res = await fetch(`${TABLE_ENDPOINT}?${params.toString()}`, {
            headers: supabaseHeaders({ Prefer: 'count=exact', Range: '0-0' }),
          });
          await assertOk(res, `histogram bin ${i}`);
          return parseCountFromContentRange(res);
        })
      );
      return counts;
    } catch (err) {
      console.error('[telemetry] fetchHistogramBuckets error:', err);
    }
  }

  const runs = readLocalRuns();
  return HISTOGRAM_BIN_LABELS.map((_, i) => {
    const lo = HISTOGRAM_BIN_EDGES_MS[i];
    const hi = HISTOGRAM_BIN_EDGES_MS[i + 1];
    return runs.filter((t) => t >= lo && t < hi).length;
  });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

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
    /* ignore quota errors */
  }
}

export async function fetchTopScores(
  limit: number = LEADERBOARD_LIMIT
): Promise<LeaderboardEntry[]> {
  if (LEADERBOARD_ENDPOINT) {
    try {
      const res = await fetch(
        `${LEADERBOARD_ENDPOINT}?select=player_name,survival_time_ms&order=survival_time_ms.desc&limit=${limit}`,
        { headers: supabaseHeaders() }
      );
      await assertOk(res, 'fetchTopScores');
      const rows = (await res.json()) as Array<{
        player_name: string;
        survival_time_ms: number;
      }>;
      return rows.map((r) => ({
        name: r.player_name,
        survivalTimeMs: r.survival_time_ms,
      }));
    } catch (err) {
      console.error('[telemetry] fetchTopScores error:', err);
    }
  }

  return readLocalLeaderboard()
    .slice()
    .sort((a, b) => b.survivalTimeMs - a.survivalTimeMs)
    .slice(0, limit);
}

export async function submitLeaderboardEntry(
  name: string,
  survivalTimeMs: number
): Promise<LeaderboardEntry[]> {
  const ms = Math.max(0, Math.round(survivalTimeMs));

  if (LEADERBOARD_ENDPOINT) {
    try {
      const res = await fetch(LEADERBOARD_ENDPOINT, {
        method: 'POST',
        headers: supabaseHeaders({
          // ignore-duplicates turns a second identical POST into a silent no-op
          // instead of a 409 error. Requires the unique constraint on
          // (player_name, survival_time_ms) — see SQL.
          Prefer: 'return=representation,resolution=ignore-duplicates',
        }),
        body: JSON.stringify({ player_name: name, survival_time_ms: ms }),
      });
      await assertOk(res, 'leaderboard INSERT');

      const inserted = (await res.json()) as Array<{ id: number }>;
      // With ignore-duplicates, `inserted` is an empty array on a duplicate
      // submission — that's expected and NOT an error.
      if (!Array.isArray(inserted)) {
        throw new Error(
          '[telemetry] leaderboard INSERT returned an unexpected response shape.'
        );
      }
      if (inserted.length > 0) {
        console.info('[telemetry] leaderboard INSERT ok, id =', inserted[0]?.id);
      } else {
        console.info('[telemetry] leaderboard INSERT skipped (duplicate ignored)');
      }

      return await fetchTopScores();
    } catch (err) {
      console.error('[telemetry] submitLeaderboardEntry error:', err);
    }
  }

  const entries = readLocalLeaderboard();
  entries.push({ name, survivalTimeMs: ms });
  entries.sort((a, b) => b.survivalTimeMs - a.survivalTimeMs);
  writeLocalLeaderboard(entries.slice(0, 100));
  return entries.slice(0, LEADERBOARD_LIMIT);
}