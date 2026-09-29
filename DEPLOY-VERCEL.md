# Deploying FUTAMOVE to Vercel

FUTAMOVE is a TanStack Start app with server rendering. When `VERCEL=1` (set automatically by Vercel), `vite.config.ts` switches the server output to the `vercel` preset and the build writes `.vercel/output` (Vercel Build Output API). `vercel.json` pins the install/build commands, so dashboard settings cannot drift. No rewrites needed: every path (including protected pages and refreshes) is handled by the server function.

Verified locally: a build with `VERCEL=1` outside the Lovable sandbox produced `.vercel/output` (Node 22 function + static assets), and `/`, `/login`, `/student/request` returned 200.

## Vercel project settings
- Framework preset: **Other** (vercel.json sets `framework: null`)
- Install command: `bun install` (from vercel.json)
- Build command: `bun run build` (from vercel.json)
- Output directory: leave empty / override off
- Node.js: 22.x

## Environment variables (Production + Preview)
VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID,
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_PROJECT_ID.
Use the values from the project's `.env` (publishable only). Never add a service-role key.

## Auth redirect settings (after first deploy)
- Site URL: `https://<vercel-domain>`
- Redirect URLs: `https://<vercel-domain>/**`
