# AGENTS.md

## Communication preferences (owner)

- Отвечай владельцу этого репозитория на русском языке.
- Пиши просто и коротко, без технических терминов, как будто человек совсем не разбирается в коде.
- Не показывай длинные логи и технические отчёты. В конце просто скажи в 2-3 предложениях: что сделал, работает ли, и что важно знать.
- (English for agents: reply to the owner in Russian, plainly and briefly, no jargon, no long logs — just 2-3 sentences: what was done, whether it works, what to know.)

## Cursor Cloud specific instructions

This is a single **Vite + React + TypeScript** PWA ("Dostup" / «Доступ») — a Kazakhstan-focused platform for selling courses/materials. It talks to a **hosted Supabase backend** (URL + anon key are committed in `.env`); there is no local database or backend to start. Node.js and npm are preinstalled; dependencies install via `npm install`.

Standard commands live in `package.json` (`dev`, `build`, `build:dev`, `lint`, `preview`). Notes:

- **Run (dev):** `npm run dev` serves on **http://localhost:8080** (port set in `vite.config.ts`, not Vite's default 5173).
- **Lint:** `npm run lint` runs but currently reports **pre-existing** errors (mostly `@typescript-eslint/no-explicit-any` in `supabase/functions/**` and a `require()` in `tailwind.config.ts`). These are not caused by env setup; don't treat a non-zero lint exit as a broken environment.
- **Build:** `npm run build` succeeds (emits a large-chunk warning; harmless).
- **Auth/email gotcha:** Supabase requires **email confirmation** on sign-up, so a new account does not auto-login (you get a "check your email" toast). Sending too many sign-ups quickly trips a hosted **"email rate limit exceeded"** error — this is a Supabase free-tier limit, not a bug. Avoid repeated real sign-ups when testing.
- The product UI and all text are in **Russian**; the public product catalog is currently **empty** (shows «Продукты скоро появятся»), which is expected.
- `HANDOFF.md` (in Russian) is the authoritative deep-dive on domains, tables, and edge functions.
