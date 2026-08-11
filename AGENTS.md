# AGENTS.md

## Communication preferences (owner)

- Отвечай владельцу этого репозитория на русском языке.
- Пиши просто и коротко, без технических терминов, как будто человек совсем не разбирается в коде.
- Не показывай длинные логи и технические отчёты. В конце просто скажи в 2-3 предложениях: что сделал, работает ли, и что важно знать.
- (English for agents: reply to the owner in Russian, plainly and briefly, no jargon, no long logs — just 2-3 sentences: what was done, whether it works, what to know.)

## Cursor Cloud specific instructions

This is a single **Vite + React + TypeScript** PWA ("Dostup" / «Доступ») — a Kazakhstan-focused platform for selling courses/materials. It talks to a **hosted Supabase backend**; there is no local database or backend to start. Node.js and npm are preinstalled; dependencies install via `npm install`.

**Important — the auth model changed:** the project was rolled back from Supabase Auth (`auth.users` / `profiles` / `user_roles`) to an older **"simple auth"** system:
- Students log in by name (`simple_users`).
- Creators/authors log in with a login + password (`creator_accounts`, sessions in `creator_sessions`).
- There is no Google/Apple OAuth in this version — do not reintroduce it, it conflicts with simple auth.
- See [CONNECTIONS_AUDIT.md](./CONNECTIONS_AUDIT.md) for the full comparison between the old and new (reverted-from) versions.

Standard commands live in `package.json` (`dev`, `build`, `build:dev`, `lint`, `preview`):

- **Run (dev):** `npm run dev` serves on **http://localhost:8080** (port set in `vite.config.ts`, not Vite's default 5173).
- **Env:** copy `.env.example` to `.env` and fill in `VITE_SUPABASE_PROJECT_ID` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (current Supabase project ref: `mebomnqdtuqmjjefvgkx`, see `supabase/config.toml`).
- **Lint:** `npm run lint` currently reports many **pre-existing** errors (mostly `@typescript-eslint/no-explicit-any` in `supabase/functions/**` and a `require()` in `tailwind.config.ts`). These are not caused by env setup; don't treat a non-zero lint exit as a broken environment.
- **Build:** `npm run build` should succeed (emits a large-chunk warning; harmless).
- Package manager is **npm only** — do not add `bun`/`yarn` lockfiles back.
- The product UI and all text are in **Russian**.

## Project docs

- [MIGRATE.md](./MIGRATE.md) — how to connect/deploy this version against its Supabase project (`scripts/deploy-connections.sh`, `scripts/verify-connections.sh`, edge function secrets, cron).
- [CONNECTIONS_AUDIT.md](./CONNECTIONS_AUDIT.md) — what differs between the simple-auth version (current) and the Supabase-Auth version it was reverted from.
- [VERCEL_SETUP.md](./VERCEL_SETUP.md) — deploying the frontend to Vercel.

There is no HANDOFF.md anymore (removed when the project reverted to the simple-auth version) — the docs above are the current source of truth. If you need deep DB-schema context, read the migrations in `supabase/migrations/` directly, starting from `20260806115425_*` (creates the simple-auth tables).
