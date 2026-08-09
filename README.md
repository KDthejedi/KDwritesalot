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
cp .env.example .env.local   # fill in as you enable each phase
npm run dev                  # http://localhost:3000
```

The landing page and screenplay **engine** (Fountain, FDX, PDF, provenance) run
with no external services. Database, auth, and real-time collaboration require
the environment variables described in `.env.example`.

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
- **Phase 1** — Cloud data model (Prisma schema ✅); Auth.js + API-backed
  store are the next step (needs a database + OAuth credentials).
- **Phase 5** — Real-time collaboration, sharing, comments (needs Liveblocks).
- **Phase 6** — Hardening (security review, a11y, broader tests).

### What works today (no external services)

`npm run dev`, open `/dashboard`, create a screenplay, and write with
Final Draft-style formatting. Save timestamped/hashed versions, and export
PDF, Final Draft `.fdx`, Fountain, and a JSON provenance record. Screenplays
are stored in your browser (localStorage).

### Enabling the cloud phase

1. Provision Postgres and set `DATABASE_URL` (see `.env.example`).
2. `npm run db:push` to create the tables from `prisma/schema.prisma`.
3. Add Auth.js providers (`AUTH_SECRET`, OAuth id/secret) and swap
   `lib/store/local.ts` for API routes backed by Prisma — the stored shapes
   already match the schema.
4. For real-time co-writing, add Liveblocks keys and layer Yjs onto the editor.
