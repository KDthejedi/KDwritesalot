# Deploying Marquee

Three pieces: the **app** on Vercel, the **database** on Supabase, and the
**real-time server** on Fly.io (Vercel can't host a persistent WebSocket). Do
them in this order — later steps need URLs from earlier ones.

Prerequisites: a Vercel account, a Supabase account, a Fly.io account, and the
Fly CLI (`flyctl`) installed locally.

---

## 1. Database — Supabase

1. Create a new project at https://supabase.com (pick a strong DB password).
2. **Project Settings → Database → Connection string**. Copy two forms:
   - **Pooled** (Transaction mode, port 6543) → this is `DATABASE_URL`; append
     `?pgbouncer=true`.
   - **Direct** (Session mode, port 5432) → this is `DIRECT_URL`.
3. Create the tables. From a local clone of the repo:
   ```bash
   npm install
   DATABASE_URL="<pooled-url>" DIRECT_URL="<direct-url>" npm run db:push
   ```
   (Or put those in `.env` and run `npm run db:push`.)

## 2. Real-time server — Fly.io

From the repo root:
```bash
fly launch --no-deploy --copy-config --dockerfile collab-server/Dockerfile
# accept the app name (or edit `app` in collab-server/fly.toml to match)
fly secrets set \
  DATABASE_URL="<supabase-pooled-url>" \
  AUTH_SECRET="<generate: openssl rand -base64 32 — SAVE THIS, the app reuses it>"
fly deploy --dockerfile collab-server/Dockerfile
```
Note the public URL, e.g. `https://marquee-collab.fly.dev`. Your collab
WebSocket URL is the same host with `wss://` → `wss://marquee-collab.fly.dev`.

## 3. Google sign-in

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client
   ID → Web application**.
2. You'll add the redirect URI in step 4 once you know the Vercel domain. For
   now, copy the **Client ID** and **Client secret**.

## 4. App — Vercel

1. **Import** the GitHub repo at https://vercel.com/new (framework auto-detects
   Next.js; no build settings to change — `prisma generate` runs via
   `postinstall`).
2. Add **Environment Variables** (Production):
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Supabase **pooled** URL (`?pgbouncer=true`) |
   | `DIRECT_URL` | Supabase **direct** URL |
   | `AUTH_SECRET` | the **same** value you set on Fly |
   | `AUTH_GOOGLE_ID` | Google OAuth client ID |
   | `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
   | `NEXT_PUBLIC_COLLAB_URL` | `wss://marquee-collab.fly.dev` |
   Do **not** set `ENABLE_DEV_LOGIN` in production.
3. **Deploy.** Note your domain, e.g. `https://marquee-xxxx.vercel.app`.
4. Back in Google Cloud, add the **Authorized redirect URI**:
   `https://<your-vercel-domain>/api/auth/callback/google` and save.
5. In Vercel, **redeploy** (so the app picks up everything) — or it's already
   live; just retry sign-in.

## Verify

- Visit the Vercel URL → **Sign in with Google** → you land on `/dashboard`.
- Create a screenplay, type a scene, export a PDF.
- Open it in a second browser/account, share as **Editor**, and confirm live
  co-editing (that exercises the Fly collab server) and comments.

## Notes

- The `AUTH_SECRET` **must match** between Vercel and Fly — the app signs the
  collaboration token and the Fly server verifies it with that secret.
- Cost: all three have free tiers that comfortably cover trying this out. The
  Fly machine is set to suspend when idle and wake on connect.
- Schema changes later: re-run `npm run db:push` against the Supabase URLs.
