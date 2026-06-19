# Multi-Vertical POS — Step-by-Step Plan

Goal: evolve CartPOS (live for retail) into a configurable POS that can be marketed to other
business types, **one vertical at a time**, with a lean, extensible DB. No assumptions — every
vertical's behaviour is confirmed against verified research before we build it.

Companion docs: `MULTI_VERTICAL_POS_RESEARCH.md` (findings), `TESTING_LOG.md` (QA status).

## Design rules (apply to every phase)
- **Hybrid config:** common/queried feature flags stay as typed `ShopSettings` columns
  (what we have). Rare / vertical-specific extras go in ONE extensible `featureConfig` JSON on
  `ShopSettings` — no new column per future toggle.
- **Generic reusable tables, not per-feature columns:**
  - **StockLot** (one table) carries batch no. + expiry today; same table carries serial/IMEI for
    electronics later. One concept, many verticals.
  - **PackagingLevel** (one table): a product has N nested units with conversion factors
    (carton→box→strip→tablet, hardware bundles, grocery case-packs). Replaces ad-hoc
    `cartonSize`/`cartonPrice` growth.
- **One change, many angles.** Before adding any column/table, ask: can an existing generic
  structure carry this? Prefer extending the generic model.
- Branch-only until QA passes; `main` auto-deploys, so nothing merges untested.

## Phase 0 — Real-world QA of current branch (DO FIRST)
Status: **pending.** Build so far on `feat/business-type-customization`: per-shop feature flags +
presets, service/delivery charges (order-type toggle), quotations gating, Business Features
settings card.
- Run the app locally on the branch (not deployed) against the QA org "QA Test Mart" only.
- Walk each flow: sign up each business type → verify preset flags; restaurant dine-in/delivery +
  service/delivery charge math + receipt lines; card-fee-on-top order; kiryana sees no quotations;
  settings toggle round-trip; offline sync carries charges.
- **Log findings in `TESTING_LOG.md`** (what works / breaks / status), honestly. Fix blockers.
- Exit criteria: current vertical work verified in real use, logged.

## Phase 1 — Lock the research (cheap)
- Re-run ONLY the unfinished verification from the deep-research sweep (the [S] claims), in a
  SMALL, low-token pass (few claims, fewer votes) — not a full re-fan-out. Promote [S] → [V] or
  drop. Priority: pharmacy packaging/batch claims; FBR e-invoicing dates.
- Update `MULTI_VERTICAL_POS_RESEARCH.md` confidence tags. Exit: no assumptions remain for the
  vertical we build next.

## Phase 2 — Extensibility foundation (small, enables everything after)
- Add `featureConfig Json?` to `ShopSettings` (hybrid bucket for future vertical toggles). Keep
  existing typed flags as-is.
- Introduce the two generic models as empty scaffolding used by later phases:
  - `StockLot` (productId, shopId, lotNo?, expiry?, serial?, qty, ...).
  - `PackagingLevel` (productId, name, factorToBase, price?, barcode?, level).
- API: a single settings read/write path already exists; extend it to pass `featureConfig`.
- No behaviour change yet — pure foundation. Verify migrations + typecheck.

## Phase 3 — Vertical builds, one at a time (order set AFTER Phase 0/1)
Each vertical = its own branch slice: preset flags → UI surfaces (only relevant features) →
generic-table usage → QA in QA org → log → review. Candidate order by real-world demand
(to confirm after QA/research):
1. **Pharmacy** — PackagingLevel (carton→box→tablet, loose price = box ÷ count) + StockLot
   (batch + expiry + FEFO + alerts). Highest verified PK demand.
2. **Grocery/kiryana** — weighed goods (per-kg) + price-embedded scale barcodes; stock stays optional.
3. **Restaurant** — tables/floor + KOT to kitchen printer (charges already done).
4. **Electronics** — StockLot reused for serial/IMEI + warranty lookup.
5. **Supermarket / FBR e-invoicing** — heavy/regulatory; only if demand + verified specifics.

## Phase 3a — Pharmacy vertical (COMPLETE — P1-P5 built + QA'd 2026-06-19)
Decisions: **3-level packaging** (carton/box/tablet) via `PackagingLevel`; **batch+expiry** as an
**optional toggle**, captured at stock-in, FEFO at sale, with expiry alerts.
Builds on generic `PackagingLevel` + `StockLot` (Phase 2). Backward-compatible: shops not using
packaging levels keep the existing `cartonSize`/piece behaviour untouched.

Slices (each: build → typecheck → commit → QA later):
- **P1 — toggles + preset.** `enableUnitSplitting` already exists = "sell at multiple packaging
  levels". Add `batchExpiry` flag in `featureConfig` (hybrid). Pharmacy preset: unitSplitting ON +
  featureConfig.batchExpiry ON. Surface both in the Business Features settings card.
- **P2 — product packaging levels.** Products API create/update accepts `packagingLevels[]`
  (name, factorToBase, price?, barcode?, level). Editor in `backoffice/products/page.tsx` form.
  Loose price derived = box price ÷ factor when level price omitted.
- **P3 — POS multi-level selling.** When a product has packaging levels, the add-to-cart unit
  picker offers each level (else fall back to existing carton/piece). Price per chosen level.
- **P4 — batch/expiry at stock-in + FEFO.** Purchases capture batch no. + expiry → `StockLot`;
  sale deducts earliest-expiry first; lot recorded. Only when `featureConfig.batchExpiry` on.
- **P5 — expiry alerts.** Near-expiry + expired lot list (dashboard/report); warn/block selling expired.

## Phase 4 — Per-vertical go-to-market readiness
- For each shipped vertical: a clean preset, a short "is this for you" feature list, demo data.
- **DONE (2026-06-19) — demo data:** rich 22-shop demo org (one per business type, ~90-day
  activity) via `VERTICALS[]` in `scripts/seed-demo-org.ts`. See TESTING_LOG "PERMANENT DEMO / TEST ORG".
- **DONE (2026-06-19) — per-shop units:** each shop has an editable unit list seeded by business
  type (`UNIT_PRESETS` in `lib/domain/business-presets.ts`), managed in Settings → "Product units",
  stored in `featureConfig.units`. Product Unit dropdown now uses it. Spec:
  `docs/superpowers/specs/2026-06-19-shop-units-design.md`.

## Open decisions (ask before the relevant phase)
- Phase 3 vertical ORDER (confirm against QA + verified research, real demand).
- Whether to migrate any current typed flags into `featureConfig` (default: no, keep typed).
