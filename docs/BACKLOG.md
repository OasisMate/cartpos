# CartPOS Backlog (parked ideas, preserved for later discussion)

These are ideas we explored and judged worth keeping, but deliberately did NOT pull into the current milestone plan (`ROADMAP.md`). Nothing here is discarded. We discuss and promote items from here **after** Milestones 1-3 are done, or sooner if a real user need forces it.

Each item: what it is + why it matters + rough effort, so we can decide fast later.

---

## A. POS / checkout completeness
- **Split payment** (part cash / part card / part udhaar on one sale). *Common real checkout; removes daily friction.* Effort: Med.
- **Item-level discount** (discount one line, not just whole bill). *Bargaining is normal in PK shops.* Effort: Med.
- **Spend store credit at POS** (returns fast-follow). Customer with negative balance (store credit) can pay with it at checkout. *Closes the returns loop.* Effort: Low-Med.

## B. Returns fast-follows
- **Returns-history page** — list/search past returns, view a return like an invoice. *Currently returns exist but aren't browsable.* Effort: Low-Med.

## C. Products / customers UX polish
- **Products + customers screens** brought up to the new dashboard quality (filters, density, quick actions). *Daily screens should match the polish we already shipped elsewhere.* Effort: Med.

## D. Hardware / accessories vertical gaps (Mughal-adjacent, beyond M2/M3 scope)
- **Serial / warranty tracking** — record serial numbers, warranty period per unit (electronics, machinery). *Real for hardware/accessories; not needed for counter go-live.* Effort: Med-High.
- **Product variants** — one product, many sizes/colors (e.g. pipe diameters, fitting sizes). *Cleaner catalog than one SKU per size.* Effort: Med.
- **Barcode-sticker printing** — (also in Deferred) print shelf/product labels. *Parked until a client has a label printer.* Effort: Med.

## E. Org / staff management
- **/org/users staff management** — verify owners can actually add/manage shop staff (managers/cashiers) at scale, not just view. *Trust + scale for multi-shop owners.* Effort: Low-Med (mostly verification + gaps).
- **Manual invoice-level udhaar payment allocation UI** — apply a payment against specific invoices, not just the running balance. *Matters for businesses that reconcile per-invoice.* Effort: Med.

## F. Data ownership / trust
- **CSV export / backup** (products, sales, customers). *Businesses expect to own their data; high trust, low effort.* Effort: Low.

## G. Security hardening gate (MUST clear before charging money)
> Kept here for completeness; also referenced in ROADMAP "After the milestones". From SECURITY_AUDIT: "must be fixed before selling."
- Rate-limit on a shared store (Upstash) for login/forgot/signup. *In-memory limiter is ineffective on Vercel serverless.* Effort: Low-Med.
- Session revoke on password reset/change (`tokenVersion` on User). Effort: Low.
- Reset-token email-binding; verify `assign-store` tenant check. Effort: Low.
- Admin org actions (approve/suspend) -> ActivityLog (audit trail). Effort: Low-Med.
- Cashier financial-mutation authz policy (opening-balance / udhaar-payment role gate) — **decision needed**. Effort: Low (decision-bound).
- `Number()` -> `Decimal` consistency; oversell TOCTOU race (row-lock in tx). Effort: Med.

## H. Commercialization (only when ready to charge)
- **Trial / billing** — the monetization gate. Effort: High.
- **FBR tax compliance (PK)** — strong selling point for tax-registered shops; evaluate scope before committing. Effort: Heavy.

## I. Tech debt / maintainability
- **Route-tree consolidation** — `backoffice` / `store` / `org` duplicate route trees + re-exports; consolidate before piling on features. Effort: Med.
- **zod shared validation layer** — consistent input validation (also a security item). Effort: Med.

## J. Tier-3 nice-to-have
- Records hub page (glue; statements/cash book already reachable).
- Advanced reports / analytics.
- Advanced costing (FIFO / average cost).
- Real-time multi-device sync / better conflict resolution.
- Defense-in-depth: strict CSP, CSRF tokens, logo magic-byte check.

## Deferred (explicitly parked by user, separate from backlog)
- Multi-country / currency / full Urdu bilingual i18n.
- Machinery manufacturing / BOM / job-costing (Mughal's manufacturing arm — out of scope).
