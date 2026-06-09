# CLAUDE.md — CartPOS working rules

POS for Pakistani shops. Next.js 14 App Router · Prisma · Supabase (Mumbai `ap-south-1`) · Vercel Hobby (region pinned `bom1`). `main` auto-deploys to live.

## Token discipline (always)
- **Read docs first, not the whole app.** Resume context from `docs/` before exploring code. Don't re-read files already covered in this session or in the docs.
- Search with Grep/Glob targeting; read only the slices you need. Avoid broad `find`/`cat`/full-file reads.
- Make independent tool calls in parallel. Don't re-derive facts already established.
- Keep answers short. No long recaps.

## Documentation rule (always — this is mandatory, not optional)
Every session that changes behaviour MUST update the relevant doc **in the same session**, before finishing. Not just testing — flow docs too. Today many changes went untracked and wasted tokens re-discovering them; never repeat that.
- Keep entries **brief highlights**, scannable (bullets/tables, dates). No essays.
- Docs to keep current:
  - `docs/TESTING_LOG.md` — QA findings, what shipped, feature done/remaining status.
  - `docs/USER_JOURNEYS.md`, `docs/STORE_MANAGER_FLOW.md` — flows when they change.
  - `docs/PRD.md`, `docs/SECURITY_AUDIT.md`, `docs/UI_UX_AUDIT.md` — when scope/security/UI changes.
- One source of truth per fact. Update the existing line; don't duplicate.

## Project guardrails
- **Testing isolation:** only in QA org "QA Test Mart" (ids in TESTING_LOG). NEVER run destructive scripts or touch live data.
- **Commits:** professional, concise. NEVER add co-author trailers. User merges per-journey branches; I don't push to `main`.
- Ask before assuming a bug. Forced UPPERCASE product names are intentional.
- Deferred (don't build unless asked): barcode-sticker printing, multi-country/currency/full Urdu i18n, trial/billing.
- UI: modern + compact. Dense table row actions = ghost `IconButton`, not text.
