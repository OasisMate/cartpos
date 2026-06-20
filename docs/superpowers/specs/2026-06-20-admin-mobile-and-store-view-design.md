# Platform-admin mobile fixes + direct store view

Date: 2026-06-20
Branch: `feat/admin-mobile-and-store-view` (local only; user merges to `main`)

## Problem
Platform-admin pages are not mobile-friendly (especially `/admin/organizations`: cramped header, overflowing action-button clusters, wide tables that scroll sideways). And to view a single store's content a platform admin must drill org -> shops -> view, which is slow.

## Scope
Admin pages: `/admin`, `/admin/organizations`, `/admin/shops`, `/admin/users`, `/admin/broadcast`.

### 1. Direct "View store"
- On `/admin/shops` add a per-row **View** action (ghost `IconButton`, Eye icon) linking to `/org/{org.id}/stores/{shop.id}`.
- Works because the store layout (`src/app/org/[orgId]/stores/[storeId]/layout.tsx`) already grants `PLATFORM_ADMIN` access via URL params (no org-select cookie needed) and renders the full store nav.
- Disabled when a shop has no organization.

### 2. Mobile fixes
- **Organizations:** header stacks (`flex-col` -> `sm:flex-row`); status filter + Create button full-width/grouped on mobile; per-org action cluster `flex-wrap`; footer stats `flex-wrap`; heading `text-2xl sm:text-3xl`.
- **Stores + Users tables:** stacked card layout below `sm` (label: value); desktop table preserved. No horizontal scroll.
- **Stores create form:** `grid-cols-2` -> `grid-cols-1 sm:grid-cols-2`.
- Audit `/admin` dashboard and `/admin/broadcast`; fix cramped headers/cards found.

### 3. QA
- Create throwaway `PLATFORM_ADMIN` (`qa-admin@cartpos.test`) via `create-admin` script; delete at end.
- Playwright on dev server, desktop (~1280px) + mobile (~390px).
- Walk every admin page, all filters, the new View-store flow, platform-admin store drill-down nav.
- **Non-destructive only** (no approve/suspend/delete/create runs). Never touch Rose Mart / Mughal Corp.

## Out of scope
Destructive-action testing, billing, non-admin roles, barcode printing, i18n.

## Done criteria
- View-store button works from `/admin/shops` on desktop + mobile.
- No horizontal scroll / overflow on any admin page at 390px.
- All admin pages walked at both viewports with screenshots; no layout breakage.
- QA admin account removed; docs updated (`TESTING_LOG.md`).
