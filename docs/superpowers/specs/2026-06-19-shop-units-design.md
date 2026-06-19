# Per-shop editable units with business-type presets — design

Date: 2026-06-19
Branch: feat/business-type-customization
Status: approved (user confirmed design)

## Problem
The Add Product form's Unit field is a hardcoded dropdown of 8 units
(`pcs, kg, g, L, mL, pack, box, dozen`) in `backoffice/products/page.tsx`. A pharmacy
can't pick `tablet`/`capsule`/`pen`, a restaurant can't pick `plate`, etc. A
`ShopSettings.allowCustomUnits` flag exists (default true) but the product form ignores it.

## Goal
Each shop has its own editable unit list, pre-seeded with sensible units for its business
type. The owner/manager manages the list in **Settings** (add / remove). The product form
simply uses whatever units are set. No inline unit creation in the product form.

## Decisions (locked with user)
- **Storage:** ordered string array in `ShopSettings.featureConfig.units` (existing `Json?`
  column, so no DB migration). Sits next to `featureConfig.batchExpiry`.
- **Presets by type:** a `UNIT_PRESETS` map in `business-presets.ts`, with a default fallback
  (today's 8 units). Seeded into `featureConfig.units` at shop creation via
  `presetShopSettingsData(type)`.
- **Management:** Settings page only (chips with remove + input to add). The lone
  `allowCustomUnits` checkbox is superseded by this Units section in the UI (DB column stays).
- **Product form:** plain dropdown of the shop's units, plus the product's own current unit
  (so editing a legacy product never loses its unit). No inline add.
- **No data migration:** a read-helper falls back to the type preset for legacy shops; the
  product dropdown unions in the product's existing unit.

## Changes

### 1. `src/lib/domain/business-presets.ts`
- Extend `FeatureConfig`: add `units?: string[]`.
- Add `DEFAULT_UNITS = ['pcs','kg','g','L','mL','pack','box','dozen']` and
  `UNIT_PRESETS: Partial<Record<OrganizationType, string[]>>` (pharmacy, restaurant,
  hardware/sanitary, jewelry, bakery, footwear/clothing, electronics/mobile, etc.).
- `getShopUnits(featureConfig, type)` → `featureConfig.units` if present and non-empty, else
  `UNIT_PRESETS[type]`, else `DEFAULT_UNITS`. Returns a de-duped, trimmed list.
- `normalizeUnits(list)` → trim, drop empties, de-dupe (case-insensitive keep-first), cap
  length (e.g. 24 chars) and count (e.g. 40).
- `presetShopSettingsData(type)` includes `units` in the returned `featureConfig`.

### 2. `src/lib/auth.ts` (getCurrentUser `features`)
- Select already includes `featureConfig`. Add `units: getShopUnits(currentSettings?.featureConfig, type)`
  to the `features` object so every role (incl. cashier on POS) gets the list.

### 3. `src/app/settings/page.tsx`
- Add `units: string[]` (and a `newUnit` input) to `shopSettings` state.
- `loadShopSettings`: `units: getShopUnits(data.settings?.featureConfig, businessType)`.
- `handleSaveSettings`: send `featureConfig: { batchExpiry, units: normalizeUnits(units) }`
  (must include both keys so neither is clobbered — featureConfig is replaced wholesale).
- UI: a "Units" section (replaces the standalone allowCustomUnits checkbox area) — current
  units as removable chips + an input and Add button. Store-manager only (page already gates).

### 4. `src/app/backoffice/products/page.tsx`
- Replace `COMMON_UNITS` constant usage with `user?.features?.units` (fallback to
  `DEFAULT_UNITS`). The `<select>` options = `unique([...shopUnits, formData.unit])` so the
  current value always appears. No inline add.

### 5. Demo seed
- `presetShopSettingsData` change auto-seeds `featureConfig.units` for new/demo shops. The
  already-seeded demo org is covered by the read-helper fallback; optional reseed later.

## Out of scope
- Unit conversion math (separate packaging-levels feature).
- Renaming a unit across existing products (remove + add is enough; existing products keep
  their stored unit string).
- The org-level store settings page (`org/stores/[id]/settings`) — manager Settings is the
  home for this.

## Verification
- `npx tsc --noEmit` clean.
- Playwright: Pharmacy Settings shows pharmacy units; add `vial`, remove one, save; Add Product
  dropdown reflects the change; a lean shop (Kiryana) shows the default set. Editing a product
  whose unit was removed still shows its unit selected.
