# CartPOS Changelog

## v1.1.0 - Role-Based Access Control & Multi-Tenant Architecture (2024-11-18)

### 🎯 Major Features

#### Multi-Tenant Organization Structure
- **Organizations**: Top-level entities that can have multiple stores
- **Stores**: Individual outlets/branches within an organization
- **Platform Admin**: Can manage all organizations and stores
- **Org Admin**: Manages their organization and its stores
- **Store Manager**: Full access to store operations (renamed from "Shop Owner")
- **Cashier**: Limited access (POS + personal dashboard only)

#### Context-Aware Navigation
- Dynamic sidebar that adapts based on user role and current context
- Platform Admins see org-specific and store-specific navigation when drilling down
- Breadcrumb navigation showing hierarchy (Organization › Store)
- Clean URL structure with explicit IDs for Platform Admins

#### Offline-First Architecture (Enhanced)
- IndexedDB caching for products, customers, suppliers, sales, and purchases
- Background sync orchestrator (30-60s intervals)
- Scoped offline data (only relevant store data cached)
- Platform Admins skip offline operations (always online)

#### Comprehensive Permission System
- Role-based permission checks at API level
- Permission helper functions following RBAC best practices
- Fine-grained access control (canManageProducts, canMakeSales, etc.)
- Audit logging for all user actions

### 🔄 Breaking Changes

#### Schema Changes
- **Renamed**: `ShopRole.SHOP_OWNER` → `ShopRole.STORE_MANAGER`
  - Migration: `20251118000000_rename_shop_owner_to_store_manager`
  - Reflects actual role: managers who run the store day-to-day

### 📝 URL Structure

#### Platform Admin Routes (with explicit IDs)
```
/admin                                          → Platform Admin dashboard
/org/[orgId]                                    → Organization dashboard
/org/[orgId]/stores                             → List stores in org
/org/[orgId]/stores/[storeId]                   → Store dashboard
/org/[orgId]/stores/[storeId]/pos               → Store POS
/org/[orgId]/stores/[storeId]/products          → Store products
/org/[orgId]/stores/[storeId]/purchases         → Store purchases
/org/[orgId]/stores/[storeId]/sales             → Store sales
/org/[orgId]/stores/[storeId]/customers         → Store customers
/org/[orgId]/stores/[storeId]/suppliers         → Store suppliers
/org/[orgId]/stores/[storeId]/reports           → Store reports
/org/[orgId]/users                              → Organization users
```

#### Org Admin Routes (implicit currentOrgId)
```
/org                                            → My organization dashboard
/org/stores                                     → My stores list
/org/stores/[id]                                → Store dashboard
/org/users                                      → Organization users management
```

#### Store Manager Routes (implicit currentShopId)
```
/store                                          → My store dashboard
/store/pos                                      → Point of Sale
/store/products                                 → Manage products
/store/purchases                                → Record purchases
/store/sales                                    → View sales history
/store/customers                                → Manage customers
/store/suppliers                                → Manage suppliers
/store/udhaar                                   → Udhaar (credit) management
/store/reports                                  → Store reports
```

#### Cashier Routes
```
/cashier/dashboard                              → Personal statistics
/pos                                            → Point of Sale (main screen)
```

### 🚀 Performance Improvements

#### POS Optimization
- Removed duplicate product fetching on every mount
- Removed per-page sync logic
- Cache-first data loading (products and customers from IndexedDB)
- Single load on mount for better responsiveness

#### Background Sync
- Global orchestrator manages all sync operations
- Batch syncing to reduce API calls
- 30-60 second intervals when idle
- Only syncs pending records (status = 'PENDING')

#### Platform Admin Optimization
- Skips all IndexedDB operations (no offline caching)
- Always uses live API data
- Prevents unnecessary IndexedDB errors

### 🛡️ Security Enhancements

#### Permission System (`src/lib/permissions.ts`)
- `isPlatformAdmin()` - Check if user is Platform Admin
- `isOrgAdmin(orgId)` - Check if user is Org Admin for specific org
- `isStoreManager(shopId)` - Check if user is Store Manager for specific store
- `hasShopAccess(shopId)` - Check if user has any role in store
- `canManageOrgUsers(orgId)` - Permission to manage org users
- `canManageStores(orgId)` - Permission to manage stores
- `canManageProducts(shopId)` - Permission to manage products
- `canRecordPurchases(shopId)` - Permission to record purchases
- `canMakeSales(shopId)` - Permission to make sales
- `canViewReports(shopId)` - Permission to view reports
- `canManageCustomers(shopId)` - Permission to manage customers
- `canManageSuppliers(shopId)` - Permission to manage suppliers

#### API Route Protection
- All API routes now have permission checks
- Standard error responses (401, 403, 404)
- Type-safe permission validation

### 🗂️ File Structure Changes

#### New Files
- `src/lib/permissions.ts` - Permission system
- `src/components/layout/Breadcrumb.tsx` - Breadcrumb navigation
- `src/app/cashier/dashboard/page.tsx` - Cashier personal dashboard
- `src/app/org/[orgId]/**` - Platform Admin org views
- `src/app/org/[orgId]/stores/[storeId]/**` - Platform Admin store views
- `src/app/store/**` - Store Manager routes (moved from /backoffice)

#### Removed Files
- `src/components/layout/Sidebar.tsx` - Consolidated into AppShell

#### Modified Files
- `src/components/layout/AppShell.tsx` - Complete refactor with context-aware navigation
- `src/app/page.tsx` - Updated redirect logic for all roles
- `src/app/pos/page.tsx` - Performance optimization, cache-first loading
- `src/lib/offline/indexedDb.ts` - Added Platform Admin guards
- `src/app/api/products/route.ts` - Added permission checks
- `src/app/api/sales/route.ts` - Added permission checks
- `src/app/api/org/users/route.ts` - Refactored to use permission system

### 📚 Documentation Updates
- Updated PRD.md with multi-tenant architecture
- Added user roles and personas
- Documented URL structure
- Added implementation notes

### 🔧 Technical Details

#### Database Schema
```prisma
enum ShopRole {
  STORE_MANAGER  // Renamed from SHOP_OWNER
  CASHIER
}
```

#### Redirect Logic
```typescript
PLATFORM_ADMIN → /admin
ORG_ADMIN → /org (checks org status)
STORE_MANAGER → /store
CASHIER → /pos
```

#### IndexedDB Guards
All IndexedDB functions now check for shopId and skip operations for Platform Admins:
```typescript
if (!shopId) return // Platform Admin case
```

### 🐛 Bug Fixes
- Fixed client/server component separation (removed incorrect 'use client' directives)
- Fixed TypeScript type errors with ShopRole enum
- Fixed React hook dependencies in POS page
- Fixed audit log type safety

### ⚙️ Build & Development
- Successfully builds with Next.js 14.2.33
- All TypeScript errors resolved
- No linter warnings
- Prisma client properly regenerated

### 📋 Migration Notes

#### For Existing Installations
1. Run database migration:
   ```bash
   npx prisma migrate deploy
   ```

2. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Update any custom code referencing `SHOP_OWNER` to `STORE_MANAGER`

#### For New Installations
- Schema is up to date, no additional steps needed

---

## v1.0.0 - Initial Release

Initial CartPOS release with core features:
- POS billing (cash and udhaar)
- Product management
- Customer management
- Purchase recording
- Basic reports
- Offline-first architecture
- Organization approval workflow

