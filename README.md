<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2561bc1e-49d0-4576-806a-4df3af920cad

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Global Telemetry (optional)

The game logs each run to a lightweight serverless backend (Supabase) to power the
"Total Global Runs" counter and the "You survived longer than X% of players worldwide!"
message on Game Over. If unconfigured, it silently falls back to a local per-browser
simulation so the game keeps working with zero setup.

To enable real global stats:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run:
   ```sql
   create table public.game_runs (
     id bigint generated always as identity primary key,
     survival_time_ms integer not null default 0,
     created_at timestamptz not null default now()
   );
   alter table public.game_runs enable row level security;
   create policy "Public insert" on public.game_runs for insert to anon with check (true);
   create policy "Public update" on public.game_runs for update to anon using (true);
   create policy "Public read" on public.game_runs for select to anon using (true);

   create table public.leaderboard (
     id bigint generated always as identity primary key,
     player_name text not null,
     survival_time_ms integer not null,
     created_at timestamptz not null default now()
   );
   alter table public.leaderboard enable row level security;
   create policy "Public insert" on public.leaderboard for insert to anon with check (true);
   create policy "Public read" on public.leaderboard for select to anon using (true);
   ```
3. Copy your Project URL and `anon` public API key into `.env.local` as
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [.env.example](.env.example)).

