# CartPOS Roadmap (committed plan, as of 2026-06-11)

This is the **committed plan**, not a feature menu. We work it top to bottom. The point of this file is to stop us from circling: pulling a new idea every session and abandoning the last one.

## Operating rules (non-negotiable)
1. **One thing in flight.** We do not start the next item until the current one is **built + documented + tested live by the user**. New ideas that surface mid-task go to "Parking lot" silently. They are NOT pitched mid-stream.
2. **Milestones are defined by a real user going fully live**, not by feature count. A milestone is done when the named shop can do the named job without reaching for another tool or a paper notebook.
3. **Anchored to the two real users below.** If a proposed feature does not serve Rose Mart or Mughal Corp's stated scope, it does not get built now.

## The two real users
| User | Business | Status | "Done" condition |
|------|----------|--------|------------------|
| **Rose Mart** | Kiryana / general retail | LIVE | Runs + closes a full day with no other tool |
| **Mughal Corp** | Hardware + sanitary counter, plus B2B (bulk orders, quotations, credit customers) | Onboarding | Sells at counter AND quotes/invoices a large trade order end to end |

> Mughal also does machinery manufacturing for cattle farms. That is **out of scope** (manufacturing/BOM/job-costing is not a POS). Parked deliberately.

---

## ✅ Done (high level)
- **Core retail:** POS, sales, customers (udhaar), suppliers (payables ledger), purchases, expenses, products + stock tracking.
- **Returns/refunds/exchange:** restock + ledger settlement, reports + cash book netting (2026-06-11).
- **Money/reporting:** daily & range reports with profit/COGS, Cash Book, customer + supplier statements (printable).
- **Receipts:** thermal print + WhatsApp share + public `/r/<token>` link (shared `ReceiptDocument`, udhaar balance line).
- **Dashboards:** role-aware store dashboard + org dashboard, vibrant visuals, store/org switcher with loader.
- **Auth/comms:** JWT sessions, 2FA, password reset, strong password policy; emails (welcome/SOPs, new-staff, broadcast); in-app notifications.
- **Platform:** offline-first sync (idempotent), region-pinned perf, PWA, demo/test org with destructive-action lockdown, branded loaders.

---

## ▶ Milestone 1 — Daily-ops close (CURRENT, helps BOTH shops)
The things a live shop touches every single day that we still lack. Smallest effort, universal value.
- [x] **End-of-day Z-report** — DONE 2026-06-11 (tested + committed). Sales-by-method + cash drawer + receivables + profit + returns, printable + WhatsApp share. `lib/domain/zreport.ts`, `records/zreport` page.
- [x] **WhatsApp udhaar reminders** — BUILT 2026-06-11 (pending user live-test). Reminder action on customers list (rows with balance) + customer detail header; opens `wa.me` with a polite Roman-Urdu balance reminder. Shared `lib/utils/whatsapp.ts`.

**M1 done when:** Rose Mart's owner can close the till each night from one screen and send an udhaar reminder in one tap. ← both pieces built; awaiting live-test.

## Milestone 2 — Mughal counter go-live (hardware retail fit)
What a hardware/sanitary shop needs that a kiryana doesn't.
- [x] **Sell by unit** (already worked: free-text unit + decimal qty) + **trade/retail pricing** — BUILT 2026-06-11 (pending live-test). Optional `Product.tradePrice`; POS Retail/Trade toggle applies trade rate (falls back to retail). Carton pricing unchanged.
- [x] **Large-catalog handling** — BUILT 2026-06-11 (pending live-test). Fast search already existed (debounced server-side paginated list + POS indexed search). New: **bulk CSV import** (`product-import.ts`, `/api/products/import`, `ImportProductsModal`) with template, preview, dedup by barcode, batched createMany (catalog only, no stock). Demo-locked.

**M2 done when:** Mughal can ring up a hardware counter sale with correct unit + trade pricing, and their catalog was imported, not hand-typed. ← DONE + live-tested 2026-06-11.

## Milestone 3 — Mughal B2B layer
- [x] **Quotation / estimate → convert to sale** — BUILT 2026-06-11 (pending live-test). `Quotation`/`QuotationLine` (no stock/money until converted), builder + list + printable/shareable view, Convert dialog (Cash/Card/Udhaar) routes through `createSale` so stock + ledger + reports flow. `lib/domain/quotations.ts`, `/api/quotations/*`, `quotations` pages.

**M3 done when:** Mughal can issue a quote for a large order and convert it to an invoice + udhaar entry. ← built; awaiting live-test.

---

## After the milestones (do NOT pull forward)
**Security hardening gate — clear before charging money** (SECURITY_AUDIT: "must be fixed before selling"). In value order:
- [x] Rate-limit on shared store (Upstash) — BUILT 2026-06-11. `rate-limit.ts` uses Upstash REST when env set, else in-memory fallback. **Action: add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to .env + Vercel to activate in prod.**
- [ ] Session revoke on password reset/change (`tokenVersion`). ← NEXT
- [ ] Reset-token email-binding.
- [ ] `Number()` → `Decimal` consistency; oversell race (row-lock in tx).
- ~~verify `assign-store` tenant check~~ ✅ already enforced (org-scoped checks present). ~~Admin org actions → ActivityLog~~ ✅ `logActivity` already wired.

**Then:** CSV export/backup, route-tree consolidation (tech debt), FBR tax (evaluate), billing/trial (when commercializing).

## Parking lot
All explored-but-not-now ideas live in **`docs/BACKLOG.md`** with rationale + effort, grouped (POS completeness, returns fast-follows, hardware vertical, security gate, commercialization, tech debt, etc). We discuss + promote from there after M1-M3. Nothing is discarded.

## Deferred (explicitly parked by user)
- Barcode-sticker printing; multi-country/currency/full Urdu i18n; machinery manufacturing/BOM.
