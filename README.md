<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MADE Framework Planner (Vite + React)

This app now supports **Supabase sync (no login)** so your tasks/config survive browser cache clears (via a bookmarkable sync link).

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` and set Supabase env vars (copy from `supabase.env.example`)
3. In Supabase, create the RPC/table by running `supabase/public_sync_first_run.sql` in SQL Editor (first install)
4. Run the app:
   `npm run dev`

## Supabase setup

- **Env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **DB schema**:
  - First install (no destructive warning): `supabase/public_sync_first_run.sql`
  - Re-runnable/updates (may show warning due to DROP): `supabase/public_sync.sql`
