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

### ⏳ M7 – POS (Online Only)
**Status:** NOT STARTED

---

### ⏳ M8 – PWA Shell (Offline Page Load)
**Status:** NOT STARTED

---

### ⏳ M9 – Local DB (IndexedDB) & Product Cache
**Status:** NOT STARTED

---

### ⏳ M10 – Local Sales Store & Sales Sync (Core Offline)
**Status:** NOT STARTED

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

**Completed Milestones:** 7/17 (M0, M1, M2, M3, M4, M5, M6)  
**In Progress:** None  
**Next Milestone:** M7 – POS (Online Only)

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

