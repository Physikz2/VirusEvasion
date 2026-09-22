<div align="center">

# 🦠 Virus Evasion

**A reverse-snake survival game. You're not the hunter — you're the prey.**

Dodge an ever-growing swarm of autonomous virus blocks for as long as you can.
Every 5 seconds, a new threat spawns. How long can you last?

[**▶ Play the live demo**](https://YOUR-PROJECT.vercel.app) · [Report a bug](https://github.com/Physikz2/VirusEvasion/issues) · [Request a feature](https://github.com/Physikz2/VirusEvasion/issues)

<img src="./screenshot.png" alt="Virus Evasion gameplay" width="720" />

</div>

---

## 🎮 How to Play

- **Move** — Move your mouse (desktop) or slide your finger (mobile). Your cyan core follows the cursor.
- **Goal** — Don't touch the red / purple / orange virus blocks.
- **Survive** — A new virus spawns every 5 seconds. They bounce off walls, wander, and hunt.
- **Spawn warning** — A white indicator flashes for ~0.8s before each virus materializes. Use it to reposition.
- **Score** — Survival time in milliseconds. Get on the global leaderboard.

### Virus strains

| Strain | Color | Behavior |
| --- | --- | --- |
| **Alpha** | Red | Moves in straight lines, changes direction periodically |
| **Drifter** | Purple | Sinusoidal, wavy flight path |
| **Pulsar** | Orange | Rhythmic speed bursts — speeds up and slows down in cycles |

---

## ✨ Features

- **Reverse-snake gameplay** — a fresh twist on a classic mechanic
- **Three virus AI strains** with distinct movement patterns
- **Global telemetry** via Supabase — total runs counter + percentile rank ("You survived longer than X% of players")
- **Global leaderboard** — top 10 survivors, per-name deduplication
- **Local fallback** — plays perfectly with zero backend setup; stats persist in `localStorage`
- **Mobile + desktop** — mouse, touch, and touch-slide input all supported
- **Procedural audio** — synthwave SFX and a rotating background loop
- **Zero-backend-required** — clone, install, run

---

## 🚀 Running Locally

**Prerequisites:** Node.js 18+

```bash
# 1. Install
npm install

# 2. (Optional) Configure Supabase for global stats — see below
cp .env.example .env

# 3. Run
npm run dev
```

The game runs at `http://localhost:5173` by default. **Without any `.env` setup, it works out of the box** using browser-local storage for stats and leaderboard.

---

## 🗄️ Global Telemetry Setup (Optional)

Global stats are powered by [Supabase](https://supabase.com). If unconfigured, the game transparently falls back to a local per-browser simulation — you'll still see the "Total Global Runs" counter and percentile message, but only for your own runs.

### 1. Create a Supabase project

Free tier is fine. Once created, open the **SQL Editor** and run:

```sql
-- ─── game_runs: one row per completed run, used for stats and percentiles ───
create table public.game_runs (
  id bigint generated always as identity primary key,
  survival_time_ms integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.game_runs enable row level security;
create policy "Public insert" on public.game_runs
  for insert to anon with check (true);
create policy "Public read" on public.game_runs
  for select to anon using (true);

-- ─── leaderboard: named high-score submissions ───
create table public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  survival_time_ms integer not null,
  created_at timestamptz not null default now()
);

-- Prevent duplicate submissions of the same score by the same player
alter table public.leaderboard
  add constraint leaderboard_player_time_unique
  unique (player_name, survival_time_ms);

-- Index for the top-10 query
create index leaderboard_survival_time_idx
  on public.leaderboard (survival_time_ms desc);

alter table public.leaderboard enable row level security;
create policy "Public insert" on public.leaderboard
  for insert to anon with check (true);
create policy "Public read" on public.leaderboard
  for select to anon using (true);
```

> **Note:** The `unique (player_name, survival_time_ms)` constraint lets the client send `Prefer: resolution=ignore-duplicates` on submit, so an accidental double-submit is silently ignored instead of creating a duplicate row.

### 2. Configure environment variables

Copy your project URL and the `anon` public key from Supabase → Project Settings → API into `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app checks these at startup and logs `[telemetry] Remote telemetry enabled → ...` or `... DISABLED` in the browser console so you always know which mode you're in.

---

## 🧱 Tech Stack

- **React 18** + **TypeScript**
- **Vite** for build / dev server
- **HTML5 Canvas 2D** for rendering (60–120 fps)
- **Web Audio API** for procedural SFX and music
- **Supabase** (PostgREST) for optional global telemetry
- **Tailwind CSS** for the HUD / modal UI
- **lucide-react** for icons

---

## 📁 Project Structure

```
src/
├── components/
│   ├── GameCanvas.tsx       # Main canvas + physics/game loop
│   ├── GameOverModal.tsx    # Post-game stats, leaderboard, share
│   ├── HUD.tsx              # Top-of-screen stats overlay
│   └── IntroSequence.tsx    # Pre-game cinematic
├── utils/
│   ├── canvasRenderer.ts    # Drawing helpers (grid, blocks, particles)
│   ├── audio.ts             # Procedural SFX & music
│   ├── telemetry.ts         # Supabase client + local fallback
│   └── profanityFilter.ts   # Name validation for leaderboard
├── App.tsx                  # Game state machine
├── main.tsx                 # Entry point
├── types.ts                 # Shared TypeScript types
└── index.css                # Global styles + Tailwind
```

---

## 🚢 Deployment

This project deploys cleanly to **Vercel**:

1. Fork or import this repo at [vercel.com/new](https://vercel.com/new).
2. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (only if you set up Supabase).
3. Deploy. Vercel auto-detects Vite — no config needed.

Because this is a single-page app, the repo includes a `vercel.json` with an SPA rewrite so deep links don't 404 on refresh.

---

## 🤝 Contributing

Contributions are welcome! Ideas for improvement:

- New virus strains (homing, splitting, shielded)
- Power-ups (slow-mo, shield, clear-screen)
- Difficulty progression over time
- Soundtrack / SFX polish
- Mobile UI refinements

To contribute:

```bash
git clone https://github.com/Physikz2/VirusEvasion.git
cd VirusEvasion
npm install
npm run dev
```

Then open a pull request. Keep PRs focused — one feature or fix per PR.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) if present, otherwise free to use, modify, and distribute.

---

<div align="center">

Made with ☕ and a healthy fear of rectangles.

</div>