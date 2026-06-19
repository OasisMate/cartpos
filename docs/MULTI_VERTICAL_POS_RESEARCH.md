# Multi-Vertical POS — Research & Feature Framework

Purpose: turn CartPOS into a configurable POS where each business type sees only what it needs,
and any client (relaxed shopkeeper or by-the-book business) feels at home. Findings below come
from a deep-research sweep (26 sources, 6 angles). Verification was cut short by a session limit,
so confidence is tagged: **[V]** = adversarially confirmed 3-0, **[S]** = sourced but unverified.

## 1. The core architectural lesson
- **Vertical specialization beats one generic screen.** Lightspeed ships two separate products —
  Retail and Restaurant — each exposing a different feature set. **[V]** (lightspeedhq.com/pos)
- **But one configurable engine can span verticals.** Odoo runs retail + restaurant from one POS
  module via config/presets. **[S]** (apps.odoo.com pos_retail)
- Takeaway for CartPOS: keep ONE engine, drive differences with **per-business-type feature flags +
  presets** (the model we're already building). Each vertical = a preset, not a fork.

## 2. Per-vertical feature map

| Vertical | Units / packaging | Pricing | Extra charges | Stock rigor (optional) | Signature workflow |
|---|---|---|---|---|---|
| **Pharmacy** | Multi-level: carton → box → strip/leaf → tablet. Define a **purchase unit** (case of 100) and a **sale unit** (strip of 10); loose tablet price = box price ÷ tablet count **[S]** | Per sale-unit; loose price derived | — | **Batch # + expiry** tracking, FEFO, expiry alerts **[S]** | Scan/search → pick unit level → batch auto-picked by expiry |
| **Kiryana / grocery** | Each + **weight (per kg)**; loose goods | Unit price; weighed = price×kg | — | Often **stock OFF** (relaxed); fast scan | Barcode-first; price-embedded scale barcodes (EAN-13/PLU) **[S]** |
| **Restaurant / hotel** | Each (dishes), modifiers | Per item | **Service charge, delivery, tips**; different tax by service mode **[V]** | Recipe/ingredient optional | **Dine-in / takeaway / delivery** modes **[V]**; **tables/floor [V]**; **KOT to kitchen printer [V]** |
| **Hardware / sanitary** | Pieces, length, bundles | **Trade vs retail** | — | Moderate | **Quotations/estimates**, credit customers |
| **Electronics / mobile** | Each, high-value | Per item | — | **Serial / IMEI** capture at intake + sale; warranty history **[S]** | Scan/enter IMEI → warranty/returns lookup |
| **Supermarket / large** | Each + weighed | Per item + **promotions** | — | Strict, high SKU counts (tens of thousands) **[S]** | **Multiple tills**, self-checkout, scale integration, loyalty **[S]** |

## 3. What should be an OPTIONAL toggle (so both relaxed & strict shops fit)
Confirmed pattern across systems: rigor is configurable, not forced. Candidates:
- Stock tracking on/off (already in CartPOS per product) and **negative stock** allowed (already a setting).
- Batch/expiry tracking (pharmacy strict; others off).
- Serial/IMEI capture (electronics strict; others off).
- Cost-price required, barcode required (already CartPOS settings).
- Service charge, delivery charge, quotations (already built this session).
- Tax/FBR e-invoicing (off for unregistered shops).

## 4. Pakistan-specific notes
- **FBR e-invoicing** is rolling out, phased by turnover; integration via licensed integrators
  (incl. PRAL), per-invoice charge capped ~Rs10. Tiers/deadlines were announced for 2025. **[S]**
  (profit.pakistantoday.com.pk, edicomgroup.com) — *dates need re-verification before we rely on them.*
- PK pharmacy POS vendors (oneclickpos.pk, moneypex, cloudpos.pk) all center on **batch + expiry**
  as the headline pharmacy feature. **[S]**
- Many small PK shops run **relaxed** (no strict stock) — confirms the optional-rigor philosophy.

## 5. Gap analysis vs current CartPOS
Already have: per-shop feature flags + presets, service/delivery charges, quotations gating,
2-level carton/piece (box↔piece), trade/retail pricing, optional stock + negative stock, card fee.

Gaps surfaced by research (not yet built):
1. **Pharmacy 3-level packaging** (carton→box→tablet) + **batch/expiry** — current carton/piece is only 2-level.
2. **Weighed goods (per kg)** for kiryana/grocery + price-embedded scale barcodes.
3. **Restaurant**: tables/floor, KOT printing, modifiers (we have dine-in/delivery + charges only).
4. **Electronics**: serial/IMEI + warranty.
5. **Supermarket**: promotions engine, loyalty, multi-till (largely out of current scope).
6. **FBR e-invoicing** (tax compliance) — large, separate track.

## 6. Recommended priority (to discuss)
Tier 1 (high value, fits existing model): pharmacy batch/expiry + 3-level packaging; weighed goods.
Tier 2: restaurant tables + KOT; electronics serial/IMEI + warranty.
Tier 3 (heavy/regulatory): promotions/loyalty; FBR e-invoicing.

## Sources (selected)
- Odoo POS Restaurant docs (primary) — tables, KOT, service-mode taxes **[V]**
- Lightspeed POS (primary) — retail/restaurant vertical split **[V]**
- oneclickpos.pk, eloerp.net, moneypex, cloudpos.pk — pharmacy batch/expiry, packaging hierarchy **[S]**
- gofrugal.com, marktpos.com, pointofsalepos.com — weighed goods, price-embedded barcodes **[S]**
- appintent.com — electronics serial/IMEI **[S]**
- ecrs.com — supermarket scale/self-checkout/SKU scale **[S]**
- FBR.gov.pk, profit.pakistantoday.com.pk, edicomgroup.com — FBR e-invoicing **[S]**

> Verification of [S] claims was interrupted by a session limit (resets 5:40am). Re-run the
> deep-research verify pass to promote [S] → [V] before committing to regulatory specifics.
