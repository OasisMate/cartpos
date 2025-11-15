# CartPOS Development Progress

This file tracks the completion status of all milestones and development progress.

## Milestone Status

### ✅ M0 – Repo & Project Bootstrap
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Next.js project structure set up (TypeScript, Tailwind CSS, App Router)
- ✅ Prisma configured and connected to Supabase PostgreSQL
- ✅ Database schema created (all models: Shop, User, Product, Invoice, etc.)
- ✅ Initial migration applied (`init_schema`)
- ✅ Prisma Client generated
- ✅ Environment configuration set up (.env, .gitignore)
- ✅ Project dependencies installed
- ✅ Documentation structure created (PRD.md, SETUP.md)

**Commit:** Initial project setup

---

### ✅ M1 – Base Project Structure & Layout
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Folder structure created (lib/domain, lib/offline, route groups)
- ✅ Domain logic placeholders created (auth, shops, products, sales, purchases, customers, reports)
- ✅ Shared layout implemented with Navbar and Sidebar
- ✅ Placeholder pages created for POS, Backoffice, and Admin sections
- ✅ Navigation routes set up (pos, backoffice, admin, products, purchases, customers, udhaar, reports)
- ✅ Responsive layout (sidebar hidden on mobile, visible on desktop)
- ✅ Route groups created for future layout customization
- ✅ Navigation tested and working

**Files Created:**
- `src/lib/domain/*.ts` - Domain logic placeholders
- `src/app/pos/page.tsx` - POS placeholder
- `src/app/backoffice/page.tsx` - Backoffice placeholder
- `src/app/admin/page.tsx` - Admin placeholder
- `src/app/backoffice/products/page.tsx` - Products placeholder
- `src/app/backoffice/purchases/page.tsx` - Purchases placeholder
- `src/app/backoffice/customers/page.tsx` - Customers placeholder
- `src/app/backoffice/udhaar/page.tsx` - Udhaar placeholder
- `src/app/backoffice/reports/page.tsx` - Reports placeholder
- `src/components/layout/Navbar.tsx` - Top navigation bar
- `src/components/layout/Sidebar.tsx` - Side navigation bar

**Commit:** M1 - Base Project Structure & Layout

---

### ✅ M2 – Auth & User Sessions (Basic)
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Authentication library implemented (`src/lib/auth.ts`)
  - Password hashing with bcryptjs
  - JWT-based session management (using jose library)
  - Session creation, deletion, and retrieval functions
  - Current user helper function
- ✅ API routes implemented:
  - `POST /api/auth/login` - Login with email/password
  - `POST /api/auth/logout` - Logout (deletes session)
  - `GET /api/me` - Get current user info with shops
- ✅ Frontend authentication:
  - `/login` page with email/password form
  - `AuthContext` and `useAuth` hook for session management
  - AuthProvider wrapped around app
- ✅ Route protection:
  - Middleware redirects unauthenticated users to `/login`
  - Protected routes require authentication
  - Authenticated users redirected from `/login` to home
- ✅ UI updates:
  - Navbar shows user name and logout button
  - Navbar/sidebar hidden on login page
  - User avatar shows first letter of name
- ✅ Admin user creation:
  - Script: `scripts/create-admin-user.ts`
  - NPM command: `npm run create-admin`
  - Creates default admin user (admin@cartpos.com / admin123)
- ✅ Environment configuration:
  - JWT_SECRET added to `.env`
  - Updated SETUP.md with auth setup instructions

**Files Created:**
- `src/lib/auth.ts` - Authentication utilities
- `src/app/api/auth/login/route.ts` - Login API
- `src/app/api/auth/logout/route.ts` - Logout API
- `src/app/api/me/route.ts` - Current user API
- `src/app/login/page.tsx` - Login page
- `src/contexts/AuthContext.tsx` - Auth context provider
- `src/middleware.ts` - Route protection middleware
- `scripts/create-admin-user.ts` - Admin user creation script

**Dependencies Added:**
- `bcryptjs` - Password hashing
- `jose` - JWT handling
- `@types/bcryptjs` - TypeScript types
- `tsx` - TypeScript execution (for scripts)

**Commit:** M2 - Auth & User Sessions (Basic)

---

### ✅ M3 – Shops & User–Shop Roles
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Shop domain logic implemented (`src/lib/domain/shops.ts`)
  - `createShopWithOwner()` - Creates shop, owner user, UserShop link, and default settings
  - `listShops()` - Lists shops with owners and stats (admin only)
  - `getUserShops()` - Gets shops for a user
- ✅ API routes implemented:
  - `GET /api/admin/shops` - List shops (admin only)
  - `POST /api/admin/shops` - Create shop + owner user (admin only)
  - `POST /api/shop/select` - Select current shop (sets cookie)
  - Updated `GET /api/me` - Returns user, shops list, and currentShopId
- ✅ Frontend:
  - `/admin/shops` page - Shop management UI:
    - List shops with details (name, city, owner, stats)
    - Create shop form (shop name, city, owner details)
  - Shop selector in navbar:
    - Shows dropdown if user has multiple shops
    - Shows shop name if single shop
    - Updates currentShopId on selection
- ✅ Auth context updates:
  - Added `currentShopId` to user object
  - Added `selectShop()` function
  - Shop data loaded with user info
- ✅ Role-based navigation:
  - Navbar shows links based on user role
  - Sidebar filters navigation based on user role and shop roles
  - ADMIN sees all links
  - OWNER sees POS + backoffice links
  - CASHIER sees only POS link
- ✅ Route fixes:
  - Moved pages from route groups to actual routes (fixed 404 errors)
  - All backoffice pages now accessible: products, purchases, customers, udhaar, reports
- ✅ Performance optimizations:
  - Added ref guard to prevent double-fetching in React Strict Mode
  - Optimized shop selection to update state directly instead of full refresh

**Files Created:**
- `src/lib/domain/shops.ts` - Shop domain logic
- `src/app/api/admin/shops/route.ts` - Shop management API
- `src/app/api/shop/select/route.ts` - Shop selection API
- `src/app/admin/shops/page.tsx` - Shop management page
- `src/app/backoffice/products/page.tsx` - Products page (moved from route group)
- `src/app/backoffice/customers/page.tsx` - Customers page (moved from route group)
- `src/app/backoffice/purchases/page.tsx` - Purchases page (moved from route group)
- `src/app/backoffice/udhaar/page.tsx` - Udhaar page (moved from route group)
- `src/app/backoffice/reports/page.tsx` - Reports page (moved from route group)

**Files Modified:**
- `src/lib/auth.ts` - Added currentShopId to getCurrentUser()
- `src/app/api/me/route.ts` - Returns shops and currentShopId
- `src/contexts/AuthContext.tsx` - Added selectShop, currentShopId, performance optimization
- `src/components/layout/Navbar.tsx` - Added shop selector, role-based navigation
- `src/components/layout/Sidebar.tsx` - Added role-based navigation filtering
- `src/app/admin/page.tsx` - Added shops management link

**Commit:** M3 - Shops & User-Shop Roles

---

### ✅ M4 – Products Module
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Product domain logic implemented (`src/lib/domain/products.ts`)
  - `createProduct()` - Creates product with validation (name, price, unit, barcode uniqueness per shop)
  - `updateProduct()` - Updates product with same validation
  - `listProducts()` - Returns paginated list with search, category, trackStock filters
  - `getProduct()` - Gets single product
  - `getProductsForPOS()` - Lightweight product list for POS (id, name, barcode, unit, price, trackStock)
  - `checkProductPermission()` - Validates user has permission (ADMIN or OWNER) to manage products
- ✅ API routes implemented:
  - `GET /api/products` - List products with pagination and filters (search, category, trackStock)
  - `POST /api/products` - Create product
  - `GET /api/products/:id` - Get single product
  - `PUT /api/products/:id` - Update product
  - `GET /api/products/pos` - Get lightweight products for POS
- ✅ Frontend (`/backoffice/products` page):
  - Product list table with pagination
  - Search functionality (name, SKU, barcode)
  - Create/Edit product form (modal):
    - Fields: name*, sku, barcode, unit* (common units dropdown + custom), price*, costPrice, category, trackStock checkbox, reorderLevel
    - Validation: required fields (name, unit, price), barcode uniqueness per shop
  - Edit button for each product
  - Pagination controls
- ✅ Product validation:
  - Required fields: name, unit, price
  - Barcode uniqueness per shop (validated on create and update)
  - Permission check: Only ADMIN or OWNER can create/update products
  - Shop context: Products are scoped to current shop

**Files Created:**
- `src/lib/domain/products.ts` - Product domain logic
- `src/app/api/products/route.ts` - Product list/create API
- `src/app/api/products/[id]/route.ts` - Product get/update API
- `src/app/api/products/pos/route.ts` - POS products API

**Files Modified:**
- `src/app/backoffice/products/page.tsx` - Complete products CRUD UI

**Commit:** M4 - Products Module

---

### ✅ M5 – Suppliers Module
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Supplier domain logic implemented (`src/lib/domain/suppliers.ts`)
  - `createSupplier()` - Creates supplier with validation (name required)
  - `updateSupplier()` - Updates supplier with same validation
  - `listSuppliers()` - Returns paginated list with search filter (name, phone)
  - `getSupplier()` - Gets single supplier with purchase count
  - `checkSupplierPermission()` - Validates user has permission (ADMIN or OWNER) to manage suppliers
- ✅ API routes implemented:
  - `GET /api/suppliers` - List suppliers with pagination and search filter
  - `POST /api/suppliers` - Create supplier
  - `GET /api/suppliers/:id` - Get single supplier
  - `PUT /api/suppliers/:id` - Update supplier
- ✅ Frontend (`/backoffice/suppliers` page):
  - Supplier list table with pagination
  - Search functionality (name, phone)
  - Create/Edit supplier form (modal):
    - Fields: name* (required), phone, notes
    - Validation: name required, trimmed inputs
  - Edit button for each supplier
  - Purchase count displayed for each supplier
  - Pagination controls
- ✅ Supplier validation:
  - Required fields: name
  - Permission check: Only ADMIN or OWNER can create/update suppliers
  - Shop context: Suppliers are scoped to current shop

**Files Created:**
- `src/lib/domain/suppliers.ts` - Supplier domain logic
- `src/app/api/suppliers/route.ts` - Supplier list/create API
- `src/app/api/suppliers/[id]/route.ts` - Supplier get/update API
- `src/app/backoffice/suppliers/page.tsx` - Complete suppliers CRUD UI

**Files Modified:**
- None (new module)

**Commit:** M5 - Suppliers Module

---

### ✅ M6 – Purchases & Stock Ledger
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Purchase domain logic implemented (`src/lib/domain/purchases.ts`)
  - `createPurchase()` - Creates purchase with validation (shop access, product exists, quantity > 0)
  - `listPurchases()` - Returns paginated list with filters (supplier, date range)
  - `getPurchase()` - Gets single purchase with lines, supplier, createdBy
  - `getProductStock()` - Utility function to calculate stock by summing StockLedger.changeQty
  - `getShopStock()` - Gets stock for all products in a shop
  - `checkPurchasePermission()` - Validates user has permission (ADMIN or OWNER) to manage purchases
  - **Stock Ledger Integration:**
    - Creates StockLedger entry for each purchase line (type PURCHASE, positive changeQty)
    - Updates Product.costPrice when unitCost provided
    - All operations in a transaction for data consistency
- ✅ API routes implemented:
  - `GET /api/purchases` - List purchases with pagination and filters (supplier, date range)
  - `POST /api/purchases` - Create purchase with lines
  - `GET /api/purchases/:id` - Get single purchase
  - `GET /api/stock` - Get stock for products (single product or all products in shop)
- ✅ Frontend (`/backoffice/purchases` page):
  - Purchase list table with pagination
  - Create purchase form (modal):
    - Header fields: supplier (optional), date, reference (optional), notes (optional)
    - Dynamic lines table: product dropdown, quantity, unit cost (optional)
    - Add/Remove line items dynamically
    - Validation: at least one line with product and quantity > 0
  - Purchase details display: date, supplier, reference, item count, created by, notes
  - Pagination controls
- ✅ Stock management:
  - Stock ledger automatically updated on purchase creation
  - Stock calculated by summing StockLedger.changeQty for each product
  - Product costPrice updated when unitCost provided in purchase
  - All operations atomic (transaction-based)

**Files Created:**
- `src/lib/domain/purchases.ts` - Purchase domain logic with stock ledger integration
- `src/app/api/purchases/route.ts` - Purchase list/create API
- `src/app/api/purchases/[id]/route.ts` - Purchase get API
- `src/app/api/stock/route.ts` - Stock API (product stock or shop stock)
- `src/app/backoffice/purchases/page.tsx` - Complete purchases CRUD UI

**Files Modified:**
- None (new module)

**Commit:** M6 - Purchases & Stock Ledger

---

### ✅ M7 – POS (Online Only)
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Sales domain logic implemented (`src/lib/domain/sales.ts`)
  - `createSale()` - Creates invoice with validation and stock/customer ledger integration
  - `listSales()` - Returns paginated list with filters (customer, payment status, date range)
  - **Stock Ledger Integration:**
    - Creates StockLedger entry for each sale line (type SALE, negative changeQty)
    - Validates stock availability for products that track stock
  - **Payment Handling:**
    - For paid sales: Creates Payment row, paymentStatus = PAID
    - For udhaar sales: paymentStatus = UDHAAR, creates CustomerLedger DEBIT entry (sale_udhaar)
    - All operations in a transaction for data consistency
  - `checkSalePermission()` - Validates user has permission (ADMIN, OWNER, or CASHIER)
- ✅ API routes implemented:
  - `POST /api/sales` - Create sale (invoice) with lines, payment, and stock updates
  - `GET /api/sales` - List sales with pagination and filters
  - `GET /api/customers` - List customers (minimal for POS udhaar sales)
- ✅ Frontend (`/pos` page):
  - Product loading from `/api/products/pos` on mount
  - **Product Selection:**
    - Barcode input (scan or enter code)
    - Product search dropdown
    - Product grid with click-to-add
  - **Cart Management:**
    - Add/remove items
    - Update quantities
    - Calculate subtotal, discount, total
  - **Payment UI:**
    - Payment status selection (PAID/UDHAAR)
    - Payment method selection (CASH/CARD/OTHER)
    - Amount received input (for cash)
    - Change calculation
    - Customer selection (for udhaar)
  - **Sale Completion:**
    - Validates cart, payment, and customer (for udhaar)
    - Calls `/api/sales` to complete sale
    - Resets cart and shows success message
- ✅ Sale validation:
  - Validates items (quantity > 0, products exist)
  - Checks stock availability for products that track stock
  - Validates totals (subtotal, discount, total)
  - Validates customer for udhaar sales
  - Validates payment method for paid sales
  - Validates amount received for cash payments

**Files Created:**
- `src/lib/domain/sales.ts` - Sales domain logic with stock and customer ledger integration
- `src/app/api/sales/route.ts` - Sales list/create API
- `src/app/api/customers/route.ts` - Customers list API (minimal for POS)
- `src/app/pos/page.tsx` - Complete POS UI with product selection, cart, and payment

**Files Modified:**
- None (new module)

**Commit:** M7 - POS (Online Only)

---

### ✅ M8 – PWA Shell (Offline Page Load)
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ PWA manifest (`public/manifest.json`) created:
  - Name: CartPOS
  - Short name: CartPOS
  - Start URL: `/pos`
  - Display mode: standalone
  - Theme color: #2563eb
  - Icons: SVG placeholder (PNG icons should be added for production)
- ✅ Service worker configured:
  - Installed `next-pwa` package
  - Configured `next.config.js` with PWA settings
  - Service worker automatically generated by next-pwa
  - Caches core JS/CSS, `/pos` route, fonts, and other assets
  - Disabled in development mode (enabled in production)
  - Register and skip waiting enabled for immediate activation
- ✅ Offline status indicator:
  - Created `useOnlineStatus` hook to listen to `window.navigator.onLine`
  - Added offline banner to `/pos` page:
    - Yellow banner appears at top when offline
    - Shows warning message: "You are offline. Some features may be limited."
    - Automatically adjusts layout when offline banner is visible
  - Listens to online/offline events for real-time updates
- ✅ Metadata updates:
  - Added manifest link to `layout.tsx` metadata
  - Added theme color meta tag
  - Added Apple mobile web app meta tags
  - Added apple-touch-icon reference
- ✅ Testing:
  - Build compiles successfully
  - Service worker will be generated on production build
  - POS shell should load offline after first online visit (test in production)

**Files Created:**
- `public/manifest.json` - PWA manifest configuration
- `public/icon.svg` - Placeholder icon (PNG icons should be added for production)
- `src/hooks/useOnlineStatus.ts` - Hook for online/offline status detection

**Files Modified:**
- `next.config.js` - Added next-pwa configuration
- `src/app/layout.tsx` - Added PWA metadata (manifest, theme color, icons)
- `src/app/pos/page.tsx` - Added offline banner with online status hook

**Files Modified (Build):**
- Service worker will be auto-generated by next-pwa in `public/sw.js` and `public/workbox-*.js` on build

**Note:**
- PNG icons (192x192 and 512x512) should be created for production use
- Service worker is disabled in development mode (NODE_ENV === 'development')
- Test offline functionality in production build or with `npm run build && npm start`

**Commit:** M8 - PWA Shell (Offline Page Load)

---

### ✅ M9 – Local DB (IndexedDB) & Product Cache
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ IndexedDB wrapper implemented (`src/lib/offline/indexedDb.ts`):
  - Installed `dexie` package (IndexedDB wrapper library)
  - Created `CartPOSDatabase` class with stores:
    - `meta` - Key-value pairs (currentShopId, lastSyncTime, etc.)
    - `products` - Cached products for POS (indexed by id, shopId, barcode, updatedAt)
    - `customers` - Cached customers (indexed by id, shopId, name, phone, syncStatus, updatedAt)
    - `suppliers` - Cached suppliers (indexed by id, shopId, name, syncStatus, updatedAt)
  - Helper functions for each store (save, get, search, delete)
- ✅ Product caching implementation (`src/lib/offline/products.ts`):
  - `fetchAndCacheProducts()` - Fetches from API and caches in IndexedDB
  - `getCachedProducts()` - Gets products from cache
  - `getProductsWithCache()` - Smart function that tries API first if online, falls back to cache
  - `findProductByBarcode()` - Finds product by barcode in cache
  - `searchCachedProducts()` - Searches products in cache by name/barcode
- ✅ POS page updated to use cached products:
  - `fetchProducts()` now uses `getProductsWithCache()` for cache-aware fetching
  - `handleBarcodeSubmit()` uses `findProductByBarcode()` to search in IndexedDB
  - Product search dropdown uses `searchCachedProducts()` when offline
  - Products automatically cached when fetched from API
  - Offline search works entirely from IndexedDB
- ✅ Caching strategy:
  - On app load (POS): Fetches `/api/products/pos` when online, saves to IndexedDB
  - POS reads products from local DB first when offline
  - Only calls API to refresh when online, not for every search
  - Products cached per shop (shopId indexed)
  - Updated timestamp stored for each cached record
- ✅ Testing:
  - Build compiles successfully
  - POS product search works with network off (after initial sync)
  - Barcode search works offline from IndexedDB
  - Product list available offline after first online visit

**Files Created:**
- `src/lib/offline/indexedDb.ts` - IndexedDB wrapper with Dexie (stores: meta, products, customers, suppliers)
- `src/lib/offline/products.ts` - Product caching functions (fetch, cache, search, barcode lookup)

**Files Modified:**
- `src/app/pos/page.tsx` - Updated to use cached products (offline-first product fetching)
- `package.json` / `package-lock.json` - Added dexie dependency

**Files Removed:**
- `src/lib/offline/index.ts` - Replaced by indexedDb.ts

**Commit:** M9 - Local DB (IndexedDB) & Product Cache

---

### ✅ M10 – Local Sales Store & Sales Sync (Core Offline)
**Status:** COMPLETED  
**Date:** 2025-11-15

**Completed:**
- ✅ Sales store added to IndexedDB (`src/lib/offline/indexedDb.ts`):
  - Added `sales` store with schema: `{ id, shopId, customerId?, items[], subtotal, discount, total, paymentStatus, paymentMethod?, amountReceived?, createdAt, syncStatus, syncError? }`
  - Indexed by id, shopId, syncStatus, createdAt
  - Helper functions: `addSale()`, `getPendingSales()`, `getSales()`, `markSaleAsSynced()`, `markSaleSyncError()`, `deleteSale()`
  - Database version upgraded to v2 to include sales store
- ✅ Sales caching implementation (`src/lib/offline/sales.ts`):
  - `saveSaleLocally()` - Saves sale to IndexedDB with syncStatus = "PENDING"
  - `syncSaleToServer()` - Syncs individual sale to server (calls `/api/sales`)
  - `syncPendingSales()` - Syncs all pending sales one by one
  - `syncPendingSalesBatch()` - Batch syncs all pending sales (calls `/api/sales/sync-batch`)
  - `saveSale()` - Save sale locally and sync if online (offline-first)
- ✅ Client-side ID generation (`src/lib/utils/cuid.ts`):
  - Simple CUID generator for client-side use
  - Generates unique IDs for offline sales (e.g., `c...`)
  - Stored in localStorage for fingerprint consistency
- ✅ POS page updated to use offline-first sales:
  - `submitSale()` now generates client-side ID using `cuid()`
  - Always saves sale to IndexedDB first (offline-first)
  - Attempts to sync if online immediately after save
  - Sales stored locally even if offline
  - Added `useEffect` to sync pending sales when coming online
- ✅ Batch sync API route (`src/app/api/sales/sync-batch/route.ts`):
  - `POST /api/sales/sync-batch` - Batch syncs sales from offline clients
  - Accepts array of sales with client-generated IDs
  - For each sale:
    - Validates and creates sale using `createSale()` domain function
    - Handles duplicates gracefully (skips on duplicate errors)
  - Returns `{ synced, skipped, errors }` for each batch
  - Idempotent: Handles duplicate submissions gracefully
- ✅ Offline-first architecture:
  - Sales always saved to IndexedDB first (offline-first)
  - If online: Immediately syncs to server after local save
  - If offline: Sales saved locally with syncStatus = "PENDING"
  - On coming online: Automatically syncs all pending sales via batch API
  - Sync status tracked: PENDING → SYNCED (or error recorded)
- ✅ Testing:
  - Build compiles successfully
  - Sales can be created offline and synced later
  - Batch sync handles multiple pending sales
  - Sync status tracked per sale

**Files Created:**
- `src/lib/offline/sales.ts` - Sales caching and sync functions
- `src/lib/utils/cuid.ts` - Client-side CUID generator
- `src/app/api/sales/sync-batch/route.ts` - Batch sync API route

**Files Modified:**
- `src/lib/offline/indexedDb.ts` - Added sales store and helper functions (version 2)
- `src/app/pos/page.tsx` - Updated to use offline-first sales with local save and sync
- `package.json` / `package-lock.json` - No new dependencies (using existing Dexie)

**Commit:** M10 - Local Sales Store & Sales Sync (Core Offline)

---

### ⏳ M11 – Offline for Purchases, Customers, Udhaar Payments
**Status:** NOT STARTED

---

### ⏳ M12 – Customers & Udhaar UI (Online+Offline Integrated)
**Status:** NOT STARTED

---

### ⏳ M13 – Void & Edit Sales
**Status:** NOT STARTED

---

### ⏳ M14 – Daily Summary
**Status:** NOT STARTED

---

### ⏳ M15 – Platform Admin Polish
**Status:** NOT STARTED

---

### ⏳ M16 – Receipt Printing (Thermal Printer)
**Status:** NOT STARTED

---

### ⏳ M17 – Polish, QA & Deployment Prep
**Status:** NOT STARTED

---

## Current Status Summary

**Completed Milestones:** 11/17 (M0, M1, M2, M3, M4, M5, M6, M7, M8, M9, M10)  
**In Progress:** None  
**Next Milestone:** M11 – Offline for Purchases, Customers, Udhaar Payments

**Last Updated:** 2025-11-15

---

## Notes

- Database connection configured with Supabase Session Pooler (IPv4 compatible)
- SSL certificate configured for secure connection
- All route groups created and tested
- Authentication system fully implemented with JWT sessions
- Default admin user: admin@cartpos.com / admin123 (change after first login!)
- All routes protected - unauthenticated users redirected to /login
- Multi-tenant structure ready - shops, user-shop roles, shop selection working
- Role-based navigation implemented - users only see links relevant to their role
- Performance optimized - reduced unnecessary API calls (React Strict Mode double-render handled)
- All backoffice routes fixed - pages moved from route groups to actual routes
- Products module complete - full CRUD with validation, permissions, and POS-ready API
- Suppliers module complete - minimal supplier management ready for purchases integration
- Purchases & Stock Ledger complete - purchase creation with automatic stock updates, cost price tracking, and stock calculation
- POS (Online Only) complete - full POS interface with product selection, cart, payment processing, stock updates, and udhaar support
- PWA Shell complete - offline page load support with service worker, manifest, and offline status indicator
- Local DB (IndexedDB) & Product Cache complete - product caching for offline access, barcode search, and product search working offline
- Local Sales Store & Sales Sync complete - sales can be created offline and synced later, batch sync API, offline-first architecture with IndexedDB

