# CartPOS Roadmap (as of 2026-06-11)

Single source of truth for remaining work. Most of v1 and the "elevate early" backlog is **done** (details in `TESTING_LOG.md`). Work from here is categorized by **benefit**, and executed in that order: day-to-day UX first, then commercial-readiness, then nice-to-haves.

> The Session-2 status table in `TESTING_LOG.md` is historical and stale (it lists supplier payables / financial records / email as "not started" — all shipped since). This file supersedes it for planning.

---

## ✅ Done (high level)
- **Core retail:** POS, sales, customers (udhaar), suppliers (payables ledger), purchases, expenses, products + stock tracking.
- **Money/reporting:** daily & range reports with profit/COGS, Cash Book, customer + supplier statements (printable).
- **Receipts:** thermal print + WhatsApp share + public `/r/<token>` link (shared `ReceiptDocument`, udhaar balance line).
- **Dashboards:** role-aware store dashboard (manager/owner vs cashier) + org dashboard, vibrant visuals, store/org switcher with loader.
- **Auth/comms:** JWT sessions, 2FA, password reset, strong password policy; emails (welcome/SOPs, new-staff, broadcast); in-app notifications.
- **Platform:** offline-first sync (idempotent), region-pinned perf, PWA, demo/test org with destructive-action lockdown, branded loaders.

---

## Tier 1 — Elevate day-to-day UX (DO FIRST)
What shop staff touch every day. Drives delight + retention.

| # | Task | Why it matters | Effort |
|---|------|----------------|--------|
| 1 | ~~**Returns / refunds / exchange**~~ ✅ BUILT 2026-06-11 (see TESTING_LOG) | Shops handle returns *daily*; today we only have void. Real, recurring gap. | Med-High |
| 2 | **WhatsApp udhaar reminders** | Chase receivables — the #1 cash-flow pain for PK shops. Reuses receivables + `wa.me` already built. | Low |
| 3 | **End-of-day Z-report** | Shopkeepers close the till every night; printable/shareable daily summary. Reuses `getDailySummary`. | Low |
| 4 | **POS: split payment + item-level discount** | Common real checkout cases (part cash/part card, discount one line). Removes daily friction. | Med |
| 5 | **UX polish: products + customers screens** | Daily screens should match the new dashboard quality. | Med |

## Tier 2 — Commercial-readiness (so you can pitch to businesses)
Needed before selling to / onboarding paying businesses at scale.

**2A. Security hardening gate — MUST clear before paid launch** (SECURITY_AUDIT: "must be fixed before selling")
- Rate-limit on shared store (Upstash) — login/forgot/signup brute-force (currently in-memory, ineffective on Vercel).
- Session revoke on password reset/change (`tokenVersion` on User).
- Reset-token email-binding; verify `assign-store` tenant check.
- Admin org actions (approve/suspend) → ActivityLog (audit trail).
- Cashier financial-mutation authz policy (opening-balance / udhaar-payment role gate) — **decision needed**.
- `Number()` → `Decimal` consistency; oversell TOCTOU race (row-lock in tx).

**2B. Business features**
- **CSV export / backup** (products, sales, customers) — data ownership = trust; businesses expect it. *(Low effort, high trust.)*
- **/org/users staff management** — verify owners can add/manage shop staff (managers/cashiers) at scale, not just view.
- **Trial / billing** — the monetization gate; build when you're ready to charge.
- **FBR tax compliance (PK)** — strong selling point for tax-registered shops; evaluate scope before committing. *(Heavy.)*
- Manual invoice-level udhaar payment allocation UI.

## Tier 3 — Nice-to-have (low value-to-effort right now)
- Records hub page (glue; statements/cash book already reachable).
- Advanced reports/analytics; advanced costing (FIFO / average cost).
- Real-time multi-device sync / better conflict resolution.
- Defense-in-depth: zod validation layer, strict CSP, CSRF tokens, logo magic-byte check.

## Cross-cutting — Tech debt / maintainability
- **Route-tree consolidation** — `backoffice` / `store` / `org` duplicate route trees + re-exports; consolidate before piling on features.
- zod as the shared validation layer (also a Tier-3 security item).

## Deferred (explicitly parked by user)
- Barcode-sticker printing (no client printer yet).
- Multi-country / currency / full Urdu bilingual i18n.
- (Billing/trial parked until going commercial — see 2B.)

---

## Recommended execution order
1. **Returns/refunds** (T1) — biggest daily gap.
2. **WhatsApp udhaar reminders** (T1) — high value, low effort.
3. **Z-report** (T1) — quick daily-close win.
4. **POS split payment + item discount** (T1) — checkout completeness.
5. **UX polish products + customers** (T1).
6. **Security hardening gate** (T2A) — clear before any paid pitch.
7. **CSV export/backup** + **/org/users staff mgmt** (T2B) — trust + scale.
8. **Route-tree consolidation** (tech debt) — before more features.
9. Then evaluate **FBR**, **billing/trial** when ready to commercialize.
10. Tier 3 items as time allows.
