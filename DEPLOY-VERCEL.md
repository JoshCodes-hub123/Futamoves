# Deploying FUTAMOVE to Vercel

FUTAMOVE is a TanStack Start app (server-rendered, not a plain SPA). Vercel is detected automatically at build time, and `vite.config.ts` pins the `vercel` output when `VERCEL=1`. No `vercel.json` rewrites are needed — all routes, including protected ones, are served by the app itself, so refreshing works.

## Vercel project settings
- Framework preset: **Other**
- Install command: `bun install` (or `npm install`)
- Build command: `bun run build` (or `npm run build`)
- Output directory: leave empty (the build writes `.vercel/output`)
- Node.js: 20 or newer

## Environment variables
Add the six variables listed in `.env.example`, with the values from the existing backend. Only publishable keys are used — no secret key is needed. Do not create a new database.

## Backend sign-in settings
In the backend authentication URL settings add:
- Site URL: `https://<your-vercel-domain>`
- Redirect URLs: `https://<your-vercel-domain>/**` (covers password reset `/reset-password` and any sign-in return path)

## Unaffected by the move
The 20-second automatic rider search runs inside the database, so it keeps working regardless of where the website is hosted.
