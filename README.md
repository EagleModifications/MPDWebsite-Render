# Metro Police Department Auth System

## Flow

Discord OAuth -> Discord ID -> Google Sheet Roster Import -> column G lookup -> column D rank -> column H active check -> rank_permissions.json -> secure HTTP-only session.

## Local setup

1. Copy `.env.example` to `.env`.
2. Put your real secrets into `.env`.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.
5. Set Discord OAuth redirect URI to:
   `http://localhost:5173/api/auth/callback`

The Vite dev server proxies `/api` to the local Express server on port 3001.

## Vercel

Set the same environment variables in Vercel.

Change:

`DISCORD_REDIRECT_URI`

to:

`https://YOUR-DOMAIN/api/auth/callback`

and:

`APP_ORIGIN`

to:

`https://YOUR-DOMAIN`

The Discord application must have the exact callback URL registered.

## Google Sheet

The roster sheet is:

`GOOGLE_SHEET_ROSTER_IMPORT`

The code expects:

A = Callsign
B = Badge Number
C = Name
D = Rank
E = Time in Dept
F = Time in Rank
G = Discord ID
H = Status

A user must exist in column G and have `Active` in column H.

## Permissions

`config/rank_permissions.json` maps rank -> permissions.

`config/permissions.json` maps permissions -> URLs/files.

Do not put these server-side permission configuration files in `public/`.

## Security

Never commit `.env`.

If credentials have ever been exposed publicly, rotate them before production use.
