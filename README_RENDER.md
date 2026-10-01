# MPD Dashboard — Render deployment

This version is configured as a single Render Node Web Service. Express serves both the `/api/*` API and the built Vite/React application from the same origin.

## Render settings

- Runtime: Node
- Plan: Free
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/`
- Node: 22

A `render.yaml` Blueprint is included with the repository.

## Required production environment variables

Set these in Render → your service → Environment:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
- all `GOOGLE_SHEET_*` names from `render.yaml`
- `SESSION_SECRET` (Render can generate this)
- `APP_ORIGIN=https://mpd.opslinksystems.com`

Do not commit `.env`. Use `.env.example` only as the local template.

## Discord OAuth

Set the Discord OAuth redirect URI to:

`https://mpd.opslinksystems.com/api/auth/callback`

The value must exactly match `DISCORD_REDIRECT_URI` in Render.

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in the secrets.
3. Run `npm install`.
4. Run `npm run dev`.

The Vite dev server continues to proxy `/api` to `http://localhost:3001`.

## Important

The original project archive contained production credentials in `.env`. Those credentials should be rotated before production deployment. Do not upload the old `.env` again.
