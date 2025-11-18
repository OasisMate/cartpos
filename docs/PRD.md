# 📄 CartPOS – v1 Product Requirements Document

## 1. Product Overview

**Working name:** CartPOS

**Target users (v1):**
- Small, single-outlet kiryana and retail shops in Pakistan are using a Windows PC + browser. Many will have a thermal printer and barcode scanner, but the system must remain fully usable without them.

**Core problem:**
- These shops rely on notebooks and calculators. They struggle to:
  - See daily sales and basic profit.
  - Track udhaar (credit) properly.
  - Control stock (which items are available/low / out).
- The Internet and power can go out for short periods, so purely online tools are unreliable at the counter.

**Core solution (v1):**
- A browser-based POS (PWA) optimized for low-end PCs that:
  - Keeps billing usable for a few hours without internet by storing data locally and syncing later.
  - Allows fast item entry via barcode scanner or manual search.
  - It is simple enough that a basic-education cashier can learn the main billing flow in under an hour.

**Hardware assumptions (v1):**
- ✅ Fully functional with: PC + browser only (no printer, no scanner).
- ✅ Optimized for: PC + browser + USB thermal printer + USB barcode scanner.
- Scanner behaves as a keyboard input; no special drivers required.

**Barcodes (v1):**
- Each product may have a barcode (optional).
- Barcode can be:
  - Manufacturer barcode, or
  - Auto-generated internal code, unique per shop.
- No label/sticker printing in v1; planned for v2+.

**Deployment & hosting (v1):**
- Application: Next.js full-stack app (App Router + Route Handlers).
- Hosting: Vercel (or similar).
- Database: Postgres (e.g., Supabase).
- Authentication: 
  - Login supports multiple identifiers: email, phone number (E.164 format), or CNIC (13 digits).
  - Password-based authentication with session management.
  - Organization-based multi-tenant structure with approval workflow.

## 2. Goals & Non-Goals (v1)

### 2.1 Primary goals

**Fast billing**
- A typical small cash sale (3–5 items) can be completed in under 15 seconds using keyboard + scanner or keyboard only.

**Offline-safe billing (a few hours)**
- If the internet goes down, the cashier can continue creating sales for at least a few hours.
- All offline sales are stored locally and automatically synced when the connection returns.

**Basic stock & udhaar control**
- The owner can see current stock levels and simple low-stock alerts.
- The owner can record udhaar and payments and see who owes how much.

**Daily summary for the owner**
- End-of-day view with:
  - Total sales.
  - Basic profit estimate (where cost data exists).
  - Breakdown by payment method (cash/card/other).
  - Total udhaar created.

### 2.2 Explicit non-goals (v1)

- No FBR integration.
- No Android / mobile app (PC browser only).
- No advanced analytics or custom reporting (only simple summaries and lists).
- No split payments (only one payment method per sale).
- No item-level discounts (only bill-level discount).
- No manual invoice-level allocation UI for Udhaar payments (system auto-allocates).
- No label/sticker design and printing.
- No top bar/header in authenticated layout (sidebar-only design for cleaner UI).

### 2.3 Implemented features (v1.1)

**Multi-tenant organization structure:**
- Organizations can have multiple stores/outlets.
- Platform Admins can manage all organizations and stores.
- Org Admins can manage their organization's stores and users.
- Store Managers have full access to their store's operations.
- Cashiers have limited access (POS only).

**Role-based access control (RBAC):**
- Four user roles: Platform Admin, Org Admin, Store Manager, Cashier.
- Context-aware navigation based on role and current view.
- Comprehensive permission system at API and UI levels.

**Offline-first architecture:**
- IndexedDB caching for products, customers, suppliers, and sales.
- Background sync orchestrator for automatic data synchronization.
- Scoped offline data (only relevant store data cached).
- Platform Admins always operate online (no offline caching).

## 3. User Roles & Personas

### 3.1 Platform Admin (System Administrator)

- Manages the entire CartPOS platform.
- Can access all organizations and stores.
- Context-aware navigation: sees org/store-specific controls when drilling down.
- Always operates online (no offline caching).

**Responsibilities:**
- Review and approve organization registration requests.
- Approve, reject, suspend, or reactivate organizations.
- Create and manage store accounts (tenants).
- Monitor which organizations and stores are active.
- Manage user accounts and roles across the system.
- View activity logs and audit trails.
- Access any organization or store for support/debugging.

### 3.2 Org Admin (Organization Owner)

- Manages a single organization and its stores.
- Can create and manage stores within their organization.
- Can create Store Managers and Cashiers.
- Assigns users to specific stores with appropriate roles.
- Full visibility of all stores in their organization.

### 3.3 Store Manager (formerly Shop Owner) – Imran

- Manages a single store's operations.
- Full access to POS, inventory, purchases, sales, customers, suppliers, and reports.
- Can work the floor when needed (runs POS).
- Tech: uses WhatsApp/YouTube; basic PC comfort.
- Cares about:
  - Daily sales totals.
  - Approximate profit.
  - Udhaar balances (who owes what).
  - Stock availability and "out of stock" issues.
- Fears:
  - Complicated, English-heavy systems.
  - System breaking or being slow during rush hours.

### 3.4 Cashier – Bilal

- Full-time at the counter.
- Limited access: POS and personal dashboard only.
- Can view low stock alerts (informational).
- Optional: Can record purchases if enabled by Store Manager (future).
- Tech: comfortable with Android; OK with mouse/keyboard but types slowly.
- Cares about:
  - Fast billing.
  - Minimal clicks.
  - Clear, simple screen with no confusing options.
- Lives on the POS sale screen.

## 4. v1 Scope – Feature Summary

### 4.1 Included in v1

- POS billing (cash & udhaar) with:
  - Bill-level discount.
  - Single payment method (cash/card/other).
  - Hold / park sale and resume later.
- Product management (with optional barcodes, cost, etc.).
- Supplier management (minimal).
- Purchase / stock-in flow (with cost update and stock ledger).
- Customer management.
- Udhaar sales and payments.
- View per-customer balances and basic udhaar overview.
- Void / edit sale via void + recreate pattern.
- Daily summary view.
- Platform admin panel for Hamza.
- Offline operation for a few hours with local DB + sync.

### 4.2 Excluded in v1 (planned later)

- FBR integration.
- Multi-branch / chain features.
- Mobile apps (Android/iOS).
- Sticker/label printing with barcodes.
- Split payments.
- Item-level discounts.
- Manual invoice-level selection for udhaar payment allocation.
- Complex analytic dashboards, exports, multi-dimensional reports.
- Advanced costing (average cost, FIFO, etc.).

## 5. Functional Requirements

### 5.1 POS Sale – Cash (v1)

**Actors:** Cashier (Bilal)

**Preconditions:**
- Cashier is logged in and a shop is selected.
- POS screen is loaded.
- Product list is available locally (synced previously).
- App may be online or offline.

**Happy path:**
1. Cashier opens POS screen.
2. Focus is on the "Scan or Search Item" input.
3. Cashier adds items:
   - **With scanner:**
     - Scans barcode → matching product auto-added to bill with quantity = 1.
   - **Without scanner:**
     - Types part of name/code → dropdown shows matches → selects to add item.
4. Cashier adjusts quantities as needed (via +/− buttons or direct entry).
5. System shows:
   - Line items (name, qty, unit price, line total).
   - Subtotal.
   - Bill Discount (amount or percentage).
   - Grand Total.
6. Cashier optionally enters a bill-level discount:
   - Either a fixed amount or percentage.
7. Cashier selects Payment Method:
   - Cash, Card, or Other.
   - Default is Cash.
8. Cashier enters Amount Received:
   - Can auto-fill with Grand Total.
   - System computes Change.
9. Cashier clicks Complete Sale.

**Data handling:**
- POS always writes the sale to local IndexedDB sales store:
  - With a client-generated id.
  - With syncStatus = "PENDING".
- If online:
  - POS also calls `/api/sales` or `/api/sales/sync-batch`.
  - On success, local record marked SYNCED.

**Server behaviour:**
- Creates Invoice and InvoiceLine entries.
- Inserts StockLedger entries for each line:
  - type = SALE
  - changeQty = −quantity.
- Creates Payment row:
  - amount = total,
  - method = chosen payment method.
- Sets paymentStatus = PAID.

**Receipts:**
- If printer is configured:
  - System prints a small receipt (58/80mm).
- If no printer:
  - Sale is still completed; no print.

**Postconditions:**
- Sale is stored locally and on server (when online or after sync).
- Stock is reduced according to sold quantities.
- Sale is included in daily summary (excluding any later VOID status).

**Constraints:**
- v1: One payment method per sale (no split).
- v1: Only bill-level discount; no item-level discount.

### 5.2 Hold / Park Sale (v1)

**Goal:** Allow cashier to temporarily park an in-progress bill and start a new one.

**Behaviour:**
- **Hold current sale:**
  - Cashier clicks Hold on POS.
  - System saves current bill as a "held sale" in local IndexedDB (e.g. heldSales store).
  - No invoice is created on the server.
  - No stock changes occur.
  - POS screen resets to a fresh empty sale.
- **View and resume held sales:**
  - Cashier opens Held Sales view.
  - List shows:
    - Short ID / label.
    - Time held.
    - Approximate total.
  - Selecting a held sale loads it back into the POS screen.
- **Complete a held sale:**
  - Once resumed, cashier processes payment as a normal sale.
  - At completion:
    - It is treated identically to a POS sale (cash/udhaar).
    - An invoice is created, stock updated, etc.

**v1 limits:**
- Entire bill is held; no partial-line hold.
- No merging or batch editing of multiple held bills.
- Held sales are local-only in v1 (not synced to server until completed).

### 5.3 Receipt Printing (v1)

If a thermal printer is available:

**Receipt contents (simple, fixed format):**
- Shop name (centered).
- Shop address / phone (optional line).
- Date & time.
- Invoice number (human-readable).
- Line items:
  - Product name.
  - Qty and unit price.
  - Line total.
- Subtotal.
- Discount (if applied).
- Grand Total.
- Payment method (Cash / Card / Other / Udhaar).
- Footer: "Shukriya / Thank you".

**Constraints:**
- No logo/image in v1.
- No QR code.
- No layout customization per shop in v1.

### 5.4 Products – Add & Manage (v1)

**Actors:** Shop Owner / trusted staff.

**Required fields:**
- Name.
- Selling price (> 0).
- Unit:
  - From predefined list (e.g. pc, kg, ltr, dozen), or
  - Custom text.
- Track stock? (Boolean, default: true).

**Optional fields:**
- Barcode:
  - Manually input or scanned.
  - Or auto-generated internal code.
  - Must be unique per shop if present.
- Internal code / SKU.
- Cost price (≥ 0 if entered).
- Category (simple string).
- Reorder level (if trackStock = true).

**Flow:**
1. Owner opens Products → Add Product.
2. Fills required fields (name, price, unit).
3. If manufacturer barcode exists:
   - Scans / types into Barcode field.
4. If no barcode and desired:
   - Clicks Generate Code to create internal unique barcode.
5. Optionally sets cost price, category, reorder level.
6. Clicks Save.

**Product:**
- Is saved on server when online.
- Is also cached in local IndexedDB for POS.
- If offline:
  - Is stored locally with syncStatus = PENDING and available in POS immediately.

**Validation:**
- Name: required.
- Price: required, > 0.
- Unit: required.
- Barcode: if present, unique per shop.
- Cost price: optional, ≥ 0 if present.

**Future (v2+):**
- Per-shop configuration rules (via ShopSettings), e.g.:
  - Cost price required for stock-tracked items.
  - Barcode required for new products.
- Additional fields (brand, tax rate, expiry, batch info, etc.).

### 5.5 Suppliers – Minimal (v1)

**Actors:** Shop Owner.

**Fields:**
- Name (required).
- Phone (optional).
- Notes (optional).

**Flow:**
1. Owner opens Suppliers → Add Supplier.
2. Enters name; optionally phone and notes.
3. Clicks Save.

**Supplier is added and available in Purchase screen.**

**Offline:**
- New suppliers are saved locally with syncStatus = PENDING.
- They can be used for purchases while offline.
- Synced to server when internet returns.

### 5.6 Purchases / Stock-In (v1)

**Actors:** Shop Owner / trusted staff.

**Goal:** Record stock coming into the shop and update cost & quantity.

**Header fields:**
- Supplier (optional; from Suppliers list).
- Purchase date (default: today).
- Reference/Invoice No. (optional).
- Notes (optional).

**Line fields:**
- Product (required).
- Quantity received (> 0).
- Unit cost (optional, ≥ 0).
- Line total (auto = qty × unit cost when cost is provided).

**Flow:**
1. Open Purchases / Stock In → New Purchase.
2. (Optional) choose supplier, confirm date, enter reference.
3. Add one or more lines:
   - Choose product.
   - Enter quantity.
   - Enter unit cost (if known).
4. Review purchase total.
5. Click Save Purchase.

**System:**
- Creates Purchase header and PurchaseLines.
- For each line, writes a StockLedger entry:
  - type = PURCHASE,
  - changeQty = +quantity,
  - refType/refId = points to PurchaseLine.
- If unit cost present, updates product.costPrice to this latest cost.

**Offline:**
- Purchase + lines + stock ledger entries are stored locally with syncStatus = PENDING.
- Local stock view is updated immediately (estimated).
- When online:
  - Sync worker sends them to `/api/purchases/sync-batch`.
  - Server creates official records and stock ledger entries.

**Future (not v1):**
- Supplier balances / payables.
- Purchase returns.
- Purchase-level tax, freight, discounts.
- Stock adjustments (wastage/shrinkage) via separate Adjustment flow.

### 5.7 Customers & Udhaar (v1)

#### 5.7.1 Customers

**Fields:**
- Name (required).
- Phone:
  - Required when created via POS quick-add.
  - Recommended from back-office.
- Notes (optional).

**Quick-add from POS (Udhaar):**
- While saving an udhaar sale:
  - If customer doesn't exist:
    - Quick-add modal appears:
      - Required: Name + Phone.
      - Optional: Notes.
    - Saved locally (and later on server) and immediately selectable.

#### 5.7.2 Udhaar Sale (Sale on Credit)

**Actors:** Cashier.

**Flow:**
1. Cashier builds the bill on POS (items, qty, discount).
2. At payment step, selects "Udhaar" as payment mode.
3. Select Customer dialog opens:
   - Search existing customers by name or phone.
   - Or click Add New to quick-add (Name + Phone).
4. Once a customer is selected:
   - Cashier confirms "Save as Udhaar".

**System:**
- Writes sale to local sales store with:
  - paymentStatus = "UDHAAR".
  - paymentMethod = null.
  - customerId set.
- If online, also sends to `/api/sales`.

**Server:**
- Creates Invoice with:
  - paymentStatus = UDHAAR,
  - paymentMethod = null,
  - customerId.
- Creates CustomerLedger entry:
  - type = SALE_UDHAAR,
  - direction = DEBIT,
  - amount = invoice total.

**If printer is available:**
- Print receipt labelled clearly as "Udhaar / Credit".

**POS resets to a new empty sale.**

**Offline:**
- Invoice data, customer data (if newly created), and ledger info are stored locally with syncStatus = PENDING.
- Synced when back online.

#### 5.7.3 Receive Payment Against Udhaar

**Actors:** Shop Owner / trusted staff (or cashier if allowed).

**Flow:**
1. Open Customers.
2. Customers list shows:
   - Name.
   - Phone.
   - Outstanding balance.
   - Filter to "Customers with balance > 0" if desired.
3. Select a customer.
4. Customer detail view shows:
   - Current outstanding balance.
   - Recent udhaar invoices.
   - Recent payments.
5. Click "Receive Payment".
6. Enter:
   - Payment amount.
   - Payment method (Cash/Card/Other).
   - Optional note (e.g., "Paid half only").
7. Click Save.

**System:**
- Stores a local udhaarPayments record with syncStatus = PENDING.
- If online, calls `/api/customers/:id/udhaar-payment`.

**Server:**
- Creates CustomerLedger entry:
  - type = PAYMENT_RECEIVED,
  - direction = CREDIT,
  - amount = payment.
- Creates Payment row linked to customer.
- Internally allocates payment to oldest open udhaar invoices (FIFO).
- Updated balance is shown immediately based on ledger entries.

**Optional:** print a Payment Receipt.

**v1 UI simplification:**
- Payment is captured at customer level.
- No manual invoice-level allocation in the UI; server handles allocation automatically.

### 5.8 View Udhaar / Customer Balances (v1)

**Actors:** Shop Owner.

**Capabilities:**
- **Customers list:**
  - Name, phone, outstanding balance.
  - Filters:
    - Show only customers with non-zero balance.
- **Customer detail view:**
  - Current balance (computed from CustomerLedger).
  - List of recent udhaar invoices (date, total, status).
  - List of recent payments (amount, date, method, notes).
  - Action:
    - Receive Payment button linking to payment flow.

### 5.9 Sales – Void & Edit (v1)

**Goal:** Provide "CRUD" behaviour on sales without breaking stock/accounting or offline sync.

#### 5.9.1 Void Sale

**Actors:** Shop Owner / authorized staff.

**Behaviour:**
- From sales list or invoice detail, user clicks Void Sale.

**System:**
- Sets invoice.status = VOID.
- Inserts StockLedger reversal entries:
  - For each original InvoiceLine:
    - type = ADJUSTMENT,
    - changeQty = +original quantity (restore stock).
- If sale was udhaar:
  - Inserts CustomerLedger entry:
    - type = ADJUSTMENT,
    - direction = CREDIT,
    - amount = original udhaar amount.
- If sale was fully paid (cash/card):
  - v1 does not automatically create refund; refunds (if any) handled manually / future feature.

**Voided invoices:**
- Are excluded from normal daily totals and profit calculations (or treated carefully).
- Remain visible in history, marked as VOID.

**Offline:**
- Void operations are also stored locally and synced (as updates plus ledger adjustments).

#### 5.9.2 Edit Sale

**Actors:** Shop Owner / authorized staff.

**Behaviour:**
1. User opens a completed invoice and clicks Edit.
2. System:
   - Loads original invoice data into an editable POS-like screen.
3. User modifies:
   - Items, quantities, prices (if allowed), discount, etc.
4. On saving the edited sale:

**System:**
- Performs Void Sale on the original invoice (see above).
- Creates a new invoice with the updated data:
  - New Invoice & InvoiceLines.
  - StockLedger entries for the new sale.
  - Payment / CustomerLedger entries as appropriate (cash/udhaar).

**User experiences an "Edit" UX; system maintains append-only + reversal integrity.**

### 5.10 Daily Summary (v1)

**Actors:** Shop Owner.

For a given date (default: today), show:

- Total number of completed non-VOID invoices.
- Total gross sales (sum of invoice totals).
- Total discount amount.
- Payment method breakdown:
  - Cash, Card, Other.
- Total udhaar created.
- Basic profit estimate:
  - Uses costPrice where available: sum(lineTotal − costPrice×quantity).

**UI:**
- Simple table or cards with key numbers.
- Basic filters: date selector; possibly "Today / Yesterday / Custom date".

### 5.11 Platform Admin – Hamza

**Actors:** Platform Admin.

**Capabilities:**
- **Create Shop (Tenant):**
  - Shop name.
  - City.
  - Owner name.
  - Owner email/phone.
  - Initial plan (e.g. Trial/Basic).
- **List shops:**
  - Name, city, plan, created date, last active date, status (active/inactive).
- **Change shop status:**
  - Activate / deactivate (e.g. unpaid, banned).
- **Reset owner login:**
  - Set new password or trigger password reset.
- **Impersonate shop:**
  - Log in as a shop owner for debugging/support (implementation detail; must be admin-only).

## 6. Non-Functional Requirements (v1)

### 6.1 Performance

- POS actions must feel instant on low-end PCs.
- A simple 3–5 item sale (with discount and cash payment) should be comfortably done within ~15 seconds by a trained cashier.

### 6.2 Offline Behaviour

**App runs as a PWA:**
- Service worker caches the app shell (JS/CSS/HTML).
- After a device has loaded the app once online, it can open the POS screen again even without internet.
- Offline mode is designed for temporary outages (hours), not for machines that have never gone online.

**Critical operations that must work offline:**
- Sales.
- Purchases.
- Basic product/customer creation.
- Udhaar payments.

**Local storage (IndexedDB) is used as the source of truth while offline.**

**Sync engine pushes local changes to the server when internet returns.**

**Sync is idempotent using client-generated IDs to avoid duplicates.**

### 6.3 Usability / Language

**v1 UI:**
- Mostly English.
- Some Roman Urdu where natural (e.g. label "Udhaar").

**v2 goal:**
- Proper bilingual Urdu + English.

**Main billing flow:**
- Should be teachable to a cashier in ~1 hour of guided training.

### 6.4 Security

**Multi-tenant isolation:**
- All server-side queries are scoped by organizationId and shopId.
- Organizations must be approved by platform admin before becoming active.

**Roles:**
- Platform: PLATFORM_ADMIN, NORMAL.
- Organization: ORG_ADMIN (manages organization and its shops).
- Shop: STORE_MANAGER, CASHIER.

**Organization Registration & Approval:**
- New organizations register via signup form with required business type.
- Organizations start in PENDING status awaiting admin approval.
- Platform admin can approve, reject (with reason), suspend (with reason), or reactivate organizations.
- Only ACTIVE organizations can access the system.

**Cashiers:**
- Limited to POS and basic screens; cannot access platform admin or organization admin features.

### 6.5 Reliability

- Local data persists even if browser/tab is closed (IndexedDB, not just memory).
- Sync can recover from intermittent network failures.
- There should be no silent data loss when internet drops mid-session.

## 7. Data Model – High-Level Entities (Conceptual)

**Organization**
- id, name, legalName, type (OrganizationType enum), phone, city, addressLine1, addressLine2, ntn, strn, status (PENDING/ACTIVE/SUSPENDED/INACTIVE), requestedBy, approvedBy, approvedAt, rejectionReason, suspensionReason, timestamps.
- Organization types: RETAIL_STORE, WHOLESALE, SUPERMARKET, GENERAL_STORE, CONVENIENCE_STORE, PHARMACY, ELECTRONICS_STORE, CLOTHING_STORE, OTHER.

**Shop**
- id, orgId, name, city, phone, addressLine1, addressLine2, createdAt, updatedAt.

**ShopSettings**
- shopId, requireCostPriceForStockItems (bool), requireBarcodeForProducts (bool), allowCustomUnits (bool), languageMode.

**User**
- id, name, email (unique), phone (unique, E.164 format), cnic (unique, 13 digits), isWhatsApp (bool), hashed password, role (PLATFORM_ADMIN/NORMAL), timestamps.

**OrganizationUser**
- userId, orgId, orgRole (ORG_ADMIN).

**UserShop**
- userId, shopId, shopRole (STORE_MANAGER/CASHIER).

**Product**
- id, shopId, name, sku, barcode, unit, price, costPrice, category, trackStock, reorderLevel, timestamps.

**StockLedger**
- id, shopId, productId, changeQty, type (PURCHASE/SALE/ADJUSTMENT), refType, refId, createdAt.

**Supplier**
- id, shopId, name, phone, notes, createdAt.

**Purchase**
- id, shopId, supplierId?, date, reference, notes, createdByUserId, createdAt.

**PurchaseLine**
- id, purchaseId, productId, quantity, unitCost, createdAt.

**Customer**
- id, shopId, name, phone, notes, createdAt.

**CustomerLedger**
- id, shopId, customerId, type (SALE_UDHAAR, PAYMENT_RECEIVED, ADJUSTMENT), direction (DEBIT/CREDIT), amount, refType, refId, createdAt.

**Invoice**
- id, shopId, customerId?, number?, status (COMPLETED/VOID), paymentStatus (PAID/UDHAAR/PARTIAL future), paymentMethod? (CASH/CARD/OTHER or null for udhaar), subtotal, discount, total, createdByUserId, createdAt.

**InvoiceLine**
- id, invoiceId, productId, quantity, unitPrice, lineTotal, createdAt.

**Payment**
- id, shopId, invoiceId?, customerId?, amount, method (CASH/CARD/OTHER), note, createdAt.

## 8. Architecture & Deployment (v1)

### 8.1 Architecture

**Frontend + Backend:** Single Next.js app:
- App Router for UI.
- Route Handlers in `/app/api/...` for backend endpoints.

**Layers:**
- `/lib/domain/...`
  - Pure business logic (TypeScript functions).
- `/lib/db/...`
  - Prisma client and repository functions.
- `/lib/offline/...`
  - IndexedDB access + sync logic.
- `/lib/validation/...`
  - Phone number and CNIC validation/normalization utilities.
- `/components/layout/...`
  - AppShell with sidebar-only layout (no top bar).
  - ConditionalLayout for auth pages vs authenticated pages.
- `/app/(pos)`
  - POS UI.
- `/app/(backoffice)`
  - Owner views (products, purchases, customers, udhaar, summary).
- `/app/(admin)`
  - Platform admin (organizations, shops, users).
- `/app/(org)`
  - Organization admin views (shops, users within organization).

**Database:** Postgres (Supabase) accessed via Prisma.

**Hosting:** Vercel for Next.js app.

**Assumption:** v1 primarily supports one main POS device per shop; multi-device conflict handling is minimal (last write wins), improved in later versions.

### 8.2 Deployment & Offline Assumptions

- Each client device must load the app at least once online to cache PWA assets.
- After that:
  - POS can load without internet from cache.
  - Business operations use local DB when offline.
- Offline is targeted at hours, not multi-day total isolation on never-online machines.

## 9. Offline & Sync Design (v1)

**Goal:** Keep POS functional when internet is out, and reliably sync to server later.

### 9.1 Local storage (IndexedDB)

Single IndexedDB per browser origin, e.g. `kiryana_pos_db`.

**Local stores (object stores):**
- **meta** – key-value pairs:
  - e.g. currentShopId, lastSyncTime.
- **products** – cached products for POS.
- **customers** – cached customers.
- **suppliers** – cached suppliers.
- **sales** – completed sales (cash or udhaar).
- **heldSales** – in-progress but parked bills.
- **purchases** – recorded purchases waiting for sync.
- **udhaarPayments** – recorded udhaar payments waiting for sync.

**Each record includes:**
- id – client-generated ID (UUID/ULID).
- shopId.
- syncStatus: PENDING, SYNCED, FAILED (for records that must sync).
- Optional lastSyncError for debugging.

### 9.2 Online vs offline behaviour

**Online:**
- All writes go to local DB first.
- Sync worker sends them to server immediately or shortly after.
- On success, mark as SYNCED.

**Offline:**
- No API calls (or calls fail fast and are ignored).
- Writes only hit local DB with syncStatus = PENDING.
- POS shows an "Offline mode – will sync later" banner.

### 9.3 Sync process

**Triggered:**
- On app load.
- On network change (offline → online).
- On timer while online (e.g. every 30–60 seconds).

**For each store with PENDING records (sales, purchases, customers, udhaarPayments):**
1. Fetch a batch of syncStatus = PENDING entries.
2. Call the corresponding sync API:
   - `POST /api/sales/sync-batch`
   - `POST /api/purchases/sync-batch`
   - `POST /api/customers/sync-batch`
   - `POST /api/udhaar-payments/sync-batch`

**Server:**
- Uses id as the invoice/purchase/payment/customer ID.
- If a record with that id already exists → skip (idempotent).
- Else → create and return success.

**Client:**
- Mark items as SYNCED on success.
- Mark as FAILED with error info on error.

### 9.4 Conflicts & limitations (v1)

- **Sales and purchases:**
  - Treat as append-only; corrections are done via VOID + new sale/purchase.
- **Products/customers:**
  - Simple last-write-wins conflict resolution.
- **Multi-device per shop:**
  - Basic support only; heavy concurrency scenarios are not optimized in v1.
- **Offline window:**
  - Designed for hours, not indefinite offline usage on fresh uninitialized machines.

## 10. Local DB Schema – Stores Summary

**meta**
- { key: string; value: any; }
- Example keys: currentShopId, lastSyncAt.

**products**
- { id, shopId, name, unit, price, costPrice?, barcode?, trackStock, category?, reorderLevel?, stockEstimate?, updatedAt, deleted? }

**customers**
- { id, shopId, name, phone, notes?, isLocalOnly, syncStatus, lastSyncError? }

**suppliers**
- { id, shopId, name, phone?, notes?, isLocalOnly, syncStatus, lastSyncError? }

**sales**
- Completed sales (cash/udhaar):
- { id, shopId, items[], subtotal, discount, total, paymentStatus, paymentMethod?, customerId?, createdAt, syncStatus, lastSyncError? }

**heldSales**
- Parked bills, local-only:
- Similar shape to sales, but never synced until completed.

**purchases**
- { id, shopId, supplierId?, date, reference?, notes?, lines[], syncStatus, lastSyncError? }

**udhaarPayments**
- { id, shopId, customerId, amount, method, note?, createdAt, syncStatus, lastSyncError? }

## 11. API Design – High Level

(Actual URL paths/methods can vary; this is the logical contract.)

### 11.1 Auth & Organizations

- `POST /api/auth/login`
  - Input: identifier (email, phone, or CNIC), password.
  - Output: session + user + organizations + shops.
  - Supports login via email, phone number (E.164), or CNIC (13 digits).
- `POST /api/signup`
  - Input: firstName, lastName, email, phone, cnic, isWhatsApp, password, organizationName, organizationType (required), legalName, city, addressLine1, addressLine2, ntn, strn, orgPhone.
  - Creates user, organization (PENDING status), default shop, and links user as ORG_ADMIN.
  - Returns success; user redirected to waiting-approval page.
- `GET /api/me`
  - Returns current user + current organization + current shop context.
- `GET /api/org/status`
  - Returns organization status (PENDING/ACTIVE/SUSPENDED/INACTIVE) and rejection/suspension reasons.
- `POST /api/org/select`
  - Select current organization context.
- `POST /api/shop/select`
  - Select current shop context.

### 11.1.1 Organization Management (Platform Admin)

- `GET /api/admin/organizations`
  - List all organizations with status, contact person details, counts.
- `POST /api/admin/organizations/:id/approve`
  - Approve organization (set status to ACTIVE).
- `POST /api/admin/organizations/:id/reject`
  - Reject organization (set status to INACTIVE) with optional reason.
- `POST /api/admin/organizations/:id/suspend`
  - Suspend organization (set status to SUSPENDED) with optional reason.
- `POST /api/admin/organizations/:id/reactivate`
  - Reactivate suspended organization (set status to ACTIVE).

### 11.1.2 Shop Management

- `POST /api/admin/shops` (admin only)
  - Create new shop + owner (requires orgId).
- `GET /api/admin/shops` (admin only)
  - List shops with organization, status, counts.
- `PATCH /api/admin/shops/:id` (admin only)
  - Activate/deactivate shop, change plan (future).
- (Admin) Impersonation endpoint or mechanism (implementation detail).

### 11.2 Products

- `GET /api/products`
  - List products for current shop (for back-office).
- `GET /api/products/pos`
  - Lightweight product list for POS caching.
- `POST /api/products`
  - Create product.
- `PUT /api/products/:id`
  - Update product.

### 11.3 Suppliers & Purchases

- `GET /api/suppliers`
  - List suppliers.
- `POST /api/suppliers`
  - Create supplier.
- `GET /api/purchases`
  - List purchases (simple filters).
- `POST /api/purchases`
  - Create purchase (online).
- `POST /api/purchases/sync-batch`
  - Batch purchase sync from offline clients.

### 11.4 Sales & POS

- `POST /api/sales`
  - Create sale (cash or udhaar) when online.
- `POST /api/sales/sync-batch`
  - Batch sync of offline sales.
- `GET /api/sales/daily-summary?date=YYYY-MM-DD`
  - Daily summary for owner.
- `POST /api/sales/:id/void`
  - Void a sale:
    - Set invoice.status = VOID.
    - Insert reversal StockLedger entries.
    - CustomerLedger adjustment as needed.
- (Edit sale is logically handled by: fetch invoice → client edits → POST new sale + void original.)

### 11.5 Customers & Udhaar

- `GET /api/customers`
  - List customers (with or without balance summary).
- `POST /api/customers`
  - Create customer.
- `POST /api/customers/sync-batch`
  - Offline customer sync.
- `GET /api/customers/:id`
  - Customer details:
    - Basic info.
    - Balance.
    - Recent invoices and payments.
- `POST /api/customers/:id/udhaar-payment`
  - Record udhaar payment.
- `POST /api/udhaar-payments/sync-batch`
  - Batch sync of offline udhaar payments.

## 12. Development Roadmap – Milestone Plan

This roadmap breaks down v1 development into 16+ milestones (M0–M16) with clear goals, tasks, and completion criteria.

### 🔹 M0 – Repo & Project Bootstrap

**Goal:** Have a clean Next.js project + PRD + schema in GitHub, building successfully.

**Tasks:**
- **GitHub (web):**
  - Create cartpos repo with README + Node .gitignore.
- **Local:**
  - Clone repo.
  - Run `npx create-next-app@latest . --typescript --eslint --src-dir --app --tailwind`.
  - Install deps: `npm install`.
- **Docs:**
  - Create `docs/PRD.md` and paste full PRD.
- **Prisma:**
  - `npm install prisma @prisma/client`.
  - `npx prisma init`.
  - Replace `prisma/schema.prisma` with the schema we wrote.
  - Set `DATABASE_URL` in `.env` (Supabase).
  - Run:
    - `npx prisma migrate dev --name init_schema`
    - `npx prisma generate`
- **DB client:**
  - Create `lib/db/prisma.ts` with Prisma singleton.

**Done when:**
- `npm run dev` starts without errors.
- `npx prisma studio` opens and shows all tables.
- Code is committed & pushed to main.

### 🔹 M1 – Base Project Structure & Layout

**Goal:** Set up the skeleton folders + a basic layout UI with placeholder pages.

**Tasks:**
- **Structure:**
  - Create:
    - `lib/domain/` (empty index files for auth, shops, products, sales, etc.).
    - `lib/offline/` (empty for now).
  - Under `app/`:
    - `(pos)/` – POS UI shell.
    - `(backoffice)/` – owner back-office shell.
    - `(admin)/` – platform admin shell.
- **Layout:**
  - Implement AppShell with sidebar-only layout (no top bar):
    - Animated sidebar (framer-motion) with collapsible behavior.
    - Logo at top of sidebar.
    - Role-based navigation links:
      - Dashboard (all authenticated users)
      - Organizations (PLATFORM_ADMIN only)
      - Users (PLATFORM_ADMIN only)
      - Shops (PLATFORM_ADMIN only)
      - Settings (all authenticated users)
    - User profile section at bottom with:
      - User avatar, name, email
      - Organization/Shop selectors (if multiple)
      - Logout button
    - Main content area (full-height, no header spacing).
  - ConditionalLayout component:
    - Auth pages (login, signup, waiting-approval) render without AppShell.
    - Authenticated pages wrap with AppShell.
- **Routing:**
  - `/pos` → "POS coming soon" screen.
  - `/backoffice` → "Backoffice coming soon".
  - `/admin` → "Admin coming soon".
  - `/signup` → Organization registration form.
  - `/waiting-approval` → Status page for pending organizations.

**Done when:**
- You can navigate between POS / Backoffice / Admin placeholder pages.
- Sidebar-only layout is consistent and responsive.
- Auth pages render without sidebar.

### 🔹 M2 – Auth & User Sessions (Basic)

**Goal:** Log in with email/password and set up basic session handling.

(You can use NextAuth or custom JWT; plan assumes simple custom auth.)

**Tasks:**
- **Backend:**
  - Add User seed manually (admin) via Prisma Studio: email + phone + CNIC + hashed password.
  - Implement `/app/api/auth/login`:
    - Accept identifier (email, phone, or CNIC) + password.
    - Normalize phone to E.164 format, CNIC to 13 digits.
    - Find user by email (lowercase), phone (E.164), or CNIC (digits).
    - Compare with hashed password (bcrypt).
    - Set HTTP-only session cookie or JWT.
  - Implement `/app/api/auth/logout`.
  - Implement `/app/api/me`:
    - Returns: user info, roles, accessible organizations, accessible shops, currentOrgId, currentShopId.
- **Frontend:**
  - Create `/login` page:
    - Identifier (email/phone/CNIC) + password form.
    - Call `/api/auth/login`.
    - Redirect based on user role and organization status.
  - Create `/signup` page:
    - Contact Information: firstName, lastName, email, phone, CNIC, isWhatsApp.
    - Organization Information: organizationName, organizationType (required dropdown), legalName, city, addressLine1, addressLine2, ntn, strn, orgPhone.
    - Account Security: password, confirmPassword.
    - Call `/api/signup`, redirect to `/waiting-approval`.
  - Create `/waiting-approval` page:
    - Shows organization status (PENDING/ACTIVE/SUSPENDED/INACTIVE).
    - Polls `/api/org/status` every 30 seconds.
    - Redirects to dashboard when ACTIVE.
  - Add auth hook / context:
    - Fetch `/api/me` to know who is logged in.
    - Handle organization/shop selection.
  - Protect routes:
    - If not logged in → redirect to `/login`.
    - If organization PENDING/SUSPENDED/INACTIVE → redirect to `/waiting-approval`.

**Done when:**
- You can:
  - Create a user in Prisma Studio.
  - Log in via `/login` using email, phone, or CNIC.
  - Register new organization via `/signup` with business type.
  - See waiting-approval page for pending organizations.
  - See basic dashboard instead of login once authenticated and approved.
  - Unauthenticated access to protected routes redirects to `/login`.

### 🔹 M3 – Organizations & Multi-Tenant Structure

**Goal:** Organization-based multi-tenant structure ready: organizations, shops, user-to-organization and user-to-shop links, roles.

**Tasks:**
- **Backend:**
  - Implement organization registration workflow:
    - `/app/api/signup`: Creates user + organization (PENDING status) + default shop + links user as ORG_ADMIN.
    - `/app/api/org/status`: Returns organization status for waiting-approval page.
  - Implement organization management (platform admin):
    - `/app/api/admin/organizations`: List organizations with contact person details.
    - `/app/api/admin/organizations/:id/approve`: Approve organization.
    - `/app/api/admin/organizations/:id/reject`: Reject with reason.
    - `/app/api/admin/organizations/:id/suspend`: Suspend with reason.
    - `/app/api/admin/organizations/:id/reactivate`: Reactivate suspended org.
  - Implement `/app/api/admin/shops`:
    - POST: create new shop + owner (requires orgId).
    - GET: list shops (admin only) with organization info.
  - Implement OrganizationUser logic:
    - A user can belong to one or more organizations with orgRole (ORG_ADMIN).
  - Implement UserShop logic:
    - A user can belong to one or more shops with shopRole (STORE_MANAGER/CASHIER).
  - Update `/api/me` to return:
    - user
    - list of organizations (with status)
    - list of shops
    - currentOrgId, currentShopId.
- **Frontend:**
  - `/admin/organizations`:
    - List all organizations with status, type, contact person details, counts.
    - Filter by status (ALL/PENDING/ACTIVE/SUSPENDED/INACTIVE).
    - Actions: Approve, Reject (with reason modal), Suspend (with reason modal), Reactivate.
    - Display organization type, legal name, address, NTN, STRN.
  - `/admin/shops`:
    - List all shops with organization, name, city, createdAt, status.
    - Form to create shop + owner user (requires orgId selection).
  - Organization/Shop selectors:
    - In sidebar user section (when expanded).
    - If user has multiple organizations, show organization selector.
    - If user has multiple shops, show shop selector.
    - When selected, call `/api/org/select` or `/api/shop/select`.

**Done when:**
- New users can register organizations via signup with business type.
- Platform admin can review and approve/reject/suspend organizations.
- As admin, you can create shops within organizations.
- As org admin, you can log in and see you're attached to organization and shops.
- POS & backoffice screens know currentOrgId and currentShopId.
- Organization status checks prevent access until approved.

### 🔹 M4 – Products Module

**Goal:** Full product CRUD for a shop.

**Tasks:**
- **Backend domain** (`lib/domain/products.ts`):
  - `createProduct(data, user)`:
    - Validate shop permission.
    - Validate fields (name, price, unit, barcode uniqueness per shop).
    - Use Prisma to create.
  - `updateProduct(id, data, user)`:
    - Same checks, update.
  - `listProducts(shopId, filters)`:
    - Return paginated list.
- **API:**
  - `GET /api/products` → uses listProducts.
  - `POST /api/products` → uses createProduct.
  - `PUT /api/products/:id` → uses updateProduct.
- **POS helper:**
  - `GET /api/products/pos` → lightweight: id, name, barcode, unit, price, trackStock.
- **Frontend (Backoffice):**
  - `/backoffice/products`:
    - Table of products.
    - Add button → `/backoffice/products/new`.
  - Add/Edit forms:
    - Name, price, unit, barcode, costPrice (optional), category, trackStock, reorderLevel.
- **Testing:**
  - Manually:
    - Create several products with/without barcode.
    - Ensure duplicate barcode in same shop is rejected.
    - Verify that products appear via `/api/products/pos`.

**Done when:**
- Owner can create/edit products from UI.
- These products appear in POS product list API.

### 🔹 M5 – Suppliers Module

**Goal:** Minimal supplier management for purchases.

**Tasks:**
- **Domain:**
  - `createSupplier`, `listSuppliers`.
- **API:**
  - `GET /api/suppliers`.
  - `POST /api/suppliers`.
- **Frontend:**
  - `/backoffice/suppliers` list.
  - Simple "Add Supplier" form.

**Done when:**
- Owner can add suppliers and see them listed.
- They show up in purchase screen (next milestone).

### 🔹 M6 – Purchases & Stock Ledger

**Goal:** Recording stock-in operations and keeping stock ledger consistent.

**Tasks:**
- **Domain:**
  - In `lib/domain/purchases.ts`:
    - `createPurchase({ header, lines }, user)`:
      - Validate shop access.
      - Validate each line (product exists, quantity > 0).
      - Create Purchase + PurchaseLines.
      - For each line, create StockLedger with type PURCHASE, changeQty = +quantity.
      - If unitCost provided, update Product.costPrice.
    - Utility: `getProductStock(shopId, productId)` by summing StockLedger.changeQty.
- **API:**
  - `POST /api/purchases` → uses createPurchase.
  - `GET /api/purchases` → list purchases.
  - `GET /api/stock` (optional) → naive stock per product.
- **Frontend:**
  - `/backoffice/purchases`:
    - List purchases (date, supplier, total items).
    - "New Purchase" page:
      - Header fields + dynamic lines table.
- **Testing:**
  - Create product, create purchase, confirm:
    - StockLedger rows exist.
    - Stock for that product increases correctly.
    - Check costPrice is updated.

**Done when:**
- You can fully record a purchase and see its effect on stock.

### 🔹 M7 – POS (Online Only)

**Goal:** POS can complete online sales with invoices + payments.

**Tasks:**
- **Domain** (`lib/domain/sales.ts`):
  - `createSale(payload, user)`:
    - Payload: items, subtotal, discount, total, paymentStatus, paymentMethod?, customerId? (for udhaar).
    - Validate totals & payment logic.
    - Create Invoice + InvoiceLines.
    - Create StockLedger entries of type SALE (−quantity).
    - For paid:
      - Create Payment row.
      - paymentStatus = PAID.
    - For udhaar:
      - paymentStatus = UDHAAR, paymentMethod = null.
      - Create CustomerLedger DEBIT (sale_udhaar).
- **API:**
  - `POST /api/sales` → uses createSale.
- **Frontend (POS):**
  - `/pos`:
    - Load products via `/api/products/pos` on mount.
    - Add item by:
      - barcode input (enter/scanner),
      - search dropdown.
    - Show subtotal/discount/total.
    - Payment UI:
      - Payment method select.
      - Amount received & change.
    - On complete:
      - Call `/api/sales`.
      - Reset cart.
- **Testing:**
  - Online only:
    - Make cash sale:
      - Invoice & InvoiceLines created.
      - StockLedger SALE entries created.
      - Payment row created.
    - Make udhaar sale (with test customer id for now):
      - Invoice with UDHAAR status.
      - CustomerLedger DEBIT entry.

**Done when:**
- You can run through a whole day of online sales and all DB records behave correctly.

### 🔹 M8 – PWA Shell (Offline Page Load)

**Goal:** App shell can load when offline (after first online visit).

**Tasks:**
- Add `manifest.json`:
  - Name: CartPOS.
  - Icons (simple placeholder).
  - Start URL `/pos`.
- Add basic service worker:
  - Can use Next PWA plugin or manual next-pwa setup.
  - Cache core JS/CSS, `/pos` route, fonts, etc.
- Add "Add to desktop" prompt (optional v1).
- Add offline banner:
  - Simple hook to listen to `window.navigator.onLine` and show status in POS.
- **Testing:**
  - Load `/pos` online.
  - Turn off network in devtools.
  - Refresh:
    - POS shell should still load (even if API calls fail).

**Done when:**
- After one online visit, `/pos` opens offline with UI visible.

### 🔹 M9 – Local DB (IndexedDB) & Product Cache

**Goal:** Introduce IndexedDB and start caching master data locally.

**Tasks:**
- **Offline library** (`lib/offline/indexedDb.ts`):
  - Implement IndexedDB wrapper (Dexie or plain).
  - Create stores:
    - `meta`
    - `products`
    - `customers`
    - `suppliers`
- **Product caching:**
  - On app load (POS and backoffice):
    - Fetch `/api/products/pos`.
    - Save products to products store.
  - POS should:
    - Read products from local DB first.
    - Only call API to refresh when online, not for every search.
  - Basic sync flags (for master data):
    - `updatedAt` field stored to avoid unnecessary reloads (optional v1).
- **Testing:**
  - Load POS online.
  - Close tab, go offline, reopen:
    - Product list should still be available from IndexedDB.

**Done when:**
- POS product search works even with network off (after initial sync).

### 🔹 M10 – Local Sales Store & Sales Sync (Core Offline)

**Goal:** Sales work fully offline; syncing to backend later.

**Tasks:**
- **Local sales store:**
  - Add `sales` store in IndexedDB:
    - `{ id, shopId, items[], subtotal, discount, total, paymentStatus, paymentMethod?, customerId?, createdAt, syncStatus }`.
- **POS changes:**
  - On sale completion:
    - Always write to sales store with syncStatus = "PENDING".
    - If online:
      - Call `/api/sales`.
      - On success, set syncStatus = "SYNCED".
- **Sync worker** (`lib/offline/sync.ts`):
  - Listen to online event and/or timer.
  - When online:
    - Read all sales with syncStatus = "PENDING".
    - Batch POST to `/api/sales/sync-batch`:
      - Include id (client invoice id).
    - On success, mark each as SYNCED.
- **Backend:**
  - Implement `POST /api/sales/sync-batch`:
    - For each sale:
      - If Invoice with this id exists → skip.
      - Else → call createSale with id overridden.
- **Testing:**
  - Scenario:
    - Go online → open POS → products sync.
    - Turn off internet.
    - Create 3 sales.
    - Confirm they exist only in IndexedDB.
    - Turn internet back on.
    - Sync runs → check DB: 3 invoices created, no duplicates.
    - Reload POS → nothing pending.

**Done when:**
- You can run the POS offline for several sales and see them appear correctly in DB after reconnection.

### 🔹 M11 – Offline for Purchases, Customers, Udhaar Payments

**Goal:** Extend offline-first behaviour beyond sales.

**Tasks:**
- **Purchases:**
  - Add `purchases` store in IndexedDB:
    - `{ id, shopId, supplierId?, date, reference?, notes?, lines[], syncStatus }`.
  - When creating a purchase:
    - Write to local store as PENDING.
    - If online:
      - Send to `/api/purchases` or `/api/purchases/sync-batch`.
  - `POST /api/purchases/sync-batch`:
    - Same idempotent logic as sales.
- **Customers:**
  - Add `customers` store with `isLocalOnly`, `syncStatus`.
  - New customers from POS:
    - Create local record with client ID.
    - Sync to `/api/customers/sync-batch` when online.
- **Udhaar payments:**
  - Add `udhaarPayments` store:
    - `{ id, shopId, customerId, amount, method, note?, createdAt, syncStatus }`.
  - When recording payment:
    - Save locally with PENDING.
    - If online, send to `/api/customers/:id/udhaar-payment` or `/api/udhaar-payments/sync-batch`.
- **Sync worker updates:**
  - Now also sync purchases, customers, udhaarPayments via their batch APIs.
- **Testing:**
  - Run offline test:
    - Create new customer, udhaar sale, and udhaar payment all offline.
    - Reconnect and confirm:
      - Customer exists on server with same ID.
      - Invoice created with UDHAAR.
      - CustomerLedger debits and credits correct.
      - Final balance matches local expectation.

**Done when:**
- Sales, purchases, customers, udhaar payments can be created offline and appear correctly on server after reconnection.

### 🔹 M12 – Customers & Udhaar UI (Online+Offline Integrated)

**Goal:** Smooth user experience around customers + udhaar.

**Tasks:**
- **Frontend:**
  - `/backoffice/customers`:
    - Table: name, phone, balance (from API).
    - Filter by "balance > 0".
  - Customer detail page:
    - Header: name, phone, notes, balance.
    - Tabs or sections:
      - Udhaar invoices list.
      - Payments list.
    - "Receive Payment" button → payment form.
  - **POS:**
    - During udhaar sale:
      - Customer search (using local DB first).
      - Quick-add with Name + Phone.
- **Backend:**
  - `/api/customers`:
    - GET → list with balances (or allow client to compute).
    - POST → create customer.
  - `/api/customers/:id`:
    - GET → detail (basic info + last N invoices/payments).
  - `/api/customers/:id/udhaar-payment`:
    - Already there from earlier step.
- **Testing:**
  - Realistic flows:
    - Customer buys on udhaar multiple times.
    - Partial payments on different days.
    - Balance in UI matches ledger math.

**Done when:**
- Owner can manage customers & udhaar fully from UI (with offline support already wired under the hood).

### 🔹 M13 – Void & Edit Sales

**Goal:** Let owner fix mistakes without corrupting data or sync.

**Tasks:**
- **Backend:**
  - Add VOID to InvoiceStatus.
  - Domain function `voidInvoice(id, user)`:
    - Check permissions.
    - Set status to VOID.
    - Insert StockLedger reversal entries.
    - CustomerLedger adjustment if udhaar.
  - API: `POST /api/sales/:id/void`.
  - **Edit sale:**
    - Domain `editSale(oldInvoiceId, newPayload, user)`:
      - `voidInvoice(oldInvoiceId, user)`.
      - `createSale(newPayload, user)` with new ID.
    - API: `POST /api/sales/:id/edit`.
- **Frontend:**
  - Sales list:
    - Show status badge (COMPLETED / VOID).
    - Buttons:
      - Void (confirm dialog).
      - Edit → open POS-like edit screen.
  - **Offline:**
    - For v1, you can make void/edit online only if complexity is too high.
    - Or store void/edit actions in local DB and sync similar to sales.
- **Testing:**
  - Void:
    - Create sale, then void.
    - Check:
      - Invoice status = VOID.
      - Stock restored.
      - CustomerLedger adjusted for udhaar.
  - Edit:
    - Create sale, edit it.
    - Old invoice VOID, new invoice present with updated values.
    - Stock+ledger reflect only final state.

**Done when:**
- Owner can void and "edit" any recent sale safely.

### 🔹 M14 – Daily Summary

**Goal:** Give owners a simple daily snapshot.

**Tasks:**
- **Domain** (`lib/domain/reports.ts`):
  - `getDailySummary(shopId, date)`:
    - Query invoices for that day (exclude VOID).
    - Aggregate:
      - count of invoices.
      - total sales.
      - total discount.
      - split by paymentMethod.
      - total udhaar.
      - basic profit = Σ(lineTotal − costPrice×qty where costPrice exists).
- **API:**
  - `GET /api/reports/daily-summary?date=YYYY-MM-DD`.
- **Frontend:**
  - `/backoffice/reports/daily`:
    - Date picker.
    - Cards with key numbers.
    - Optional small table of totals.
- **Testing:**
  - Create test data:
    - Mix of cash sales, card sales, udhaar, voids.
    - Verify daily summary manually matches DB calculations.

**Done when:**
- Owner can see daily summary for any date and trust the numbers (for v1 level).

### 🔹 M15 – Platform Admin Polish

**Goal:** Make admin tools actually useful to you as the platform owner.

**Tasks:**
- Enhance `/admin/organizations`:
  - Display full organization details: type, legal name, address, NTN, STRN, contact person (name, email, phone, CNIC, WhatsApp status).
  - Status filter dropdown (ALL/PENDING/ACTIVE/SUSPENDED/INACTIVE).
  - Approve/Reject/Suspend/Reactivate actions with reason capture (modals).
  - Show organization creation date, approval date, shop/user counts.
- Enhance `/admin/shops`:
  - Show `lastActiveAt` (from a Shop field updated on activity).
  - Show organization name for each shop.
  - Filters: active/inactive, by organization.
  - Add actions:
    - Activate/Deactivate shop (affects login).
    - Reset owner password (manual field for now).
- Enhance `/admin/users`:
  - List all users with platform role, organization roles, shop roles.
  - Display contact info: email, phone, CNIC, WhatsApp status.
  - Show associations: which organizations and shops user belongs to.
  - Search by name, email, phone, CNIC.
- Implement impersonation (future):
  - Simple approach:
    - As admin, click "Login as owner".
    - Backend sets a special admin-impersonation session for that user.

**Done when:**
- You can manage organizations, shops, and users completely from UI (no more manual Prisma Studio for basic ops).
- Organization approval workflow is fully functional with reason tracking.

### 🔹 M16 – Receipt Printing (Thermal Printer)

**Goal:** Print receipts on thermal printers (58mm/80mm) when available.

**Tasks:**
- **Library choice:**
  - Use `react-thermal-printer` or `node-thermal-printer` (browser-compatible).
  - Or WebUSB API for direct printer communication (if supported).
- **Receipt format:**
  - Simple fixed layout per PRD Section 5.3.
  - Shop name, date/time, invoice number.
  - Line items (name, qty, price, line total).
  - Subtotal, discount, grand total.
  - Payment method.
  - Footer: "Shukriya / Thank you".
- **POS integration:**
  - After sale completion:
    - If printer detected/configured → print automatically.
    - Optional "Print Receipt" button for reprints.
  - Printer detection:
    - Check for configured printer in shop settings (optional v1).
    - Or auto-detect via WebUSB (if browser supports).
- **Testing:**
  - Test with common thermal printer models.
  - Verify receipt format matches PRD spec.

**Done when:**
- Receipts print correctly on thermal printers when available.
- System gracefully handles no-printer scenario (sale still completes).

### 🔹 M17 – Polish, QA & Deployment Prep

**Goal:** Clean enough to onboard 1–3 real shops.

**Tasks:**
- **Validation & UX:**
  - Clear error messages for required fields.
  - Loading states, disabled buttons for in-flight actions.
  - Confirmations for destructive actions (void, etc.).
- **Security:**
  - Check every API route enforces:
    - Auth.
    - Shop scoping (user must belong to that shop).
    - Role checks (cashier vs owner vs admin).
- **Logging & Monitoring:**
  - Basic server logging for errors.
  - Simple error boundary on frontend.
- **Vercel:**
  - Connect repo to Vercel.
  - Add env vars (DATABASE_URL, secrets).
  - Deploy main to production domain (e.g. app.cartpos.shop or similar).
- **Manual QA:**
  - Run through realistic full-day scenarios:
    - Morning: purchases + stock in.
    - Day: mix of cash and udhaar sales.
    - Net down for 1–2 hours: offline sales.
    - Net back: sync.
    - Evening: udhaar payments + daily summary.

**Done when:**
- You're comfortable giving this to a real friendly shop owner to use as "beta".

---

### 📝 Notes on Roadmap

**UI Library Choice:**
- **Tailwind CSS** is recommended for performance:
  - Smaller bundle size (only used classes included).
  - No runtime CSS-in-JS overhead.
  - Better tree-shaking and PWA caching.
  - More flexible for custom POS UI.
- Consider **Headless UI** or **Radix UI** for accessible components (modals, dropdowns, etc.).

**IndexedDB Library:**
- Consider **Dexie.js** for IndexedDB wrapper (simpler API than raw IndexedDB).
- Alternative: Plain IndexedDB if bundle size is critical.

**Offline Sync Strategy:**
- Client-generated IDs (UUID/ULID) ensure idempotent sync.
- Batch sync APIs handle multiple records efficiently.
- Sync worker runs on app load, network change, and periodic timer.

**Testing Approach:**
- Manual testing per milestone is acceptable for v1.
- Consider adding unit tests for domain logic (lib/domain) in later iterations.

## 13. v2+ Roadmap (Already Identified)

- Proper Urdu/English bilingual UI, including full Urdu labels and formatting.
- Sticker/label printing with barcodes.
- Split payments (cash + card, etc., in one sale).
- Item-level discounts.
- Manual invoice-level udhaar payment allocation UI.
- FBR integration for tax-compliant shops.
- Multi-branch / chain management.
- More advanced reports and analytics (possibly separate OLAP/analytics schema).
- Advanced costing methods (average cost, FIFO, better margin analytics).
- Better multi-device per shop conflict resolution and real-time syncing.

