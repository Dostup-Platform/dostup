# AGENTS.md

## Communication preferences (owner)

- Отвечай владельцу этого репозитория ТОЛЬКО на русском языке, никогда на английском (если владелец сам не попросит английский — тогда очень простыми словами, уровень А2).
- Пиши просто и максимально коротко, без технических терминов, как будто объясняешь человеку, который вообще не разбирается в коде и IT.
- Не показывай длинные логи и технические отчёты.
- В конце КАЖДОГО ответа обязательно коротко напиши: что сделал, зачем, и нужно ли владельцу самому что-то проверить (даже если ты сам можешь проверить — всё равно скажи, что можно проверить, чтобы владелец мог сам быстро глянуть).
- Всю работу выполняй в Cloud (облачном агенте), а не предлагай делать локально.
- Постоянно сохраняй изменения (коммить и пушь в git по ходу работы), чтобы прогресс не терялся.
- Это правило действует всегда, в любом чате и любой задаче с этим репозиторием.
- (English for agents: reply to the owner only in Russian, plainly and as briefly as possible, no jargon, no long logs. At the end of every reply, briefly state what was done, why, and what the owner should check themselves (even if you could check it yourself). Always do the work in the cloud agent, never suggest local work. Commit and push changes continuously so progress is never lost. This rule always applies, in every chat.)

## Cursor Cloud specific instructions

This is a single **Vite + React + TypeScript** PWA ("Dostup" / «Доступ») — a Kazakhstan-focused platform for selling courses/materials. It talks to a **hosted Supabase backend** (URL + anon key are committed in `.env`); there is no local database or backend to start. Node.js and npm are preinstalled; dependencies install via `npm install`.

Standard commands live in `package.json` (`dev`, `build`, `build:dev`, `lint`, `preview`). Notes:

- **Run (dev):** `npm run dev` serves on **http://localhost:8080** (port set in `vite.config.ts`, not Vite's default 5173).
- **Lint:** `npm run lint` runs but currently reports **pre-existing** errors (mostly `@typescript-eslint/no-explicit-any` in `supabase/functions/**` and a `require()` in `tailwind.config.ts`). These are not caused by env setup; don't treat a non-zero lint exit as a broken environment.
- **Build:** `npm run build` succeeds (emits a large-chunk warning; harmless).
- **Auth/email gotcha:** Supabase requires **email confirmation** on sign-up, so a new account does not auto-login (you get a "check your email" toast). Sending too many sign-ups quickly trips a hosted **"email rate limit exceeded"** error — this is a Supabase free-tier limit, not a bug. Avoid repeated real sign-ups when testing.
- The product UI and all text are in **Russian**; the public product catalog is currently **empty** (shows «Продукты скоро появятся»), which is expected.
- `HANDOFF.md` (in Russian) is the authoritative deep-dive on domains, tables, and edge functions.
