# KDwritesalot

A collaborative screenplay studio for the web. Write in proper industry format,
co-write in real time, export **copyright-ready** PDF and Final Draft (`.fdx`)
files, and keep a **timestamped, hashed version history** that documents your
authorship over time.

> On copyright: the app produces the deliverable (a properly formatted PDF/FDX)
> and an authorship trail (timestamped, SHA-256-hashed revisions). Legal
> registration is done by you at the U.S. Copyright Office (eCO) and/or the WGA —
> neither offers a public API, so the app supports the process rather than
> filing on your behalf. The provenance record is supporting evidence, not a
> registration.

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript + Tailwind CSS   |
| Editor         | TipTap (ProseMirror) with a custom screenplay schema |
| Real-time      | Yjs (CRDT) + Liveblocks                             |
| Auth           | Auth.js (NextAuth)                                  |
| Database       | Postgres via Prisma                                |
| Export         | PDF (pdfkit), Final Draft `.fdx` (XML), Fountain   |

## Getting started

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL/DIRECT_URL + auth
npm run db:push              # create tables in your Postgres
npm run dev                  # http://localhost:3000
```

The screenplay **engine** (Fountain, FDX, PDF, provenance) runs with no external
services. Accounts and cloud storage require a Postgres database and Google
OAuth (below). Real-time collaboration (Phase B) is not built yet.

### Cloud setup (Supabase + Google)

1. **Database** — create a Supabase project; from Project Settings → Database
   copy the pooled connection string into `DATABASE_URL` (port 6543,
   `?pgbouncer=true`) and the direct string into `DIRECT_URL` (port 5432). Run
   `npm run db:push`.
2. **Google sign-in** — create an OAuth client (Web) in Google Cloud, add
   redirect URI `<app-url>/api/auth/callback/google`, and set `AUTH_GOOGLE_ID`,
   `AUTH_GOOGLE_SECRET`, and `AUTH_SECRET` (`openssl rand -base64 32`).
3. `npm run dev`, open `/dashboard`, sign in, and your screenplays now persist to
   the database. Share a screenplay from the editor (Editor / Commenter / Viewer
   roles); invitees must have signed in once so their account exists.

For local development or automated tests without Google, set
`ENABLE_DEV_LOGIN="true"` (never in production) to enable a passwordless
Credentials login on `/signin`.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build & serve
- `npm test` — run the unit tests (Vitest)
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint

## Project layout

```
app/                 Next.js routes (landing, dashboard, editor, API)
lib/screenplay/      AST types, Fountain parse/serialize, editor behaviors
lib/export/          PDF and FDX generation
lib/provenance.ts    SHA-256 hashing + provenance records
components/editor/   Editor UI, toolbar, presence, comments
prisma/schema.prisma Data model
```

## Roadmap

Built in phases.

- **Phase 0** — Scaffolding ✅
- **Phase 2a** — Screenplay engine (Fountain / FDX / PDF / provenance) ✅
- **Phase 2b** — Editor UI with industry formatting behaviors ✅
- **Phase 3** — Export (PDF + FDX + Fountain, title page from metadata) ✅
- **Phase 4** — Version history & provenance (snapshots, hash chain, export) ✅
- **Phase 1/A** — Cloud: Auth.js (Google) + Supabase Postgres, API-backed
  store, sharing with roles, read-only enforcement ✅
- **Phase B** — Real-time collaboration (Yjs), presence, comments — next.
- **Phase 6** — Hardening (security review, a11y, broader tests).

### Sharing & roles

Owners can invite collaborators by email as **Editor** (full edit),
**Commenter** (read + comment, comments land in Phase B), or **Viewer**
(read-only). Roles are enforced both in the UI and in every API route.
