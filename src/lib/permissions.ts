/**
 * Role-based permission checking for API routes
 * Following industry best practices for RBAC (Role-Based Access Control)
 */

export interface UserContext {
  id: string
  role: 'PLATFORM_ADMIN' | 'NORMAL'
  organizations?: Array<{ orgId: string; orgRole: string }>
  shops?: Array<{ shopId: string; shopRole: string }>
  currentOrgId?: string | null
  currentShopId?: string | null
}

/**
 * Check if user is a Platform Admin
 */
export function isPlatformAdmin(user: UserContext): boolean {
  return user.role === 'PLATFORM_ADMIN'
}

/**
 * Check if user is an Org Admin for a specific organization
 */
export function isOrgAdmin(user: UserContext, orgId: string): boolean {
  if (isPlatformAdmin(user)) return true
  return user.organizations?.some(
    (o) => o.orgId === orgId && o.orgRole === 'ORG_ADMIN'
  ) ?? false
}

/**
 * Check if user has any role in a specific organization
 */
export function hasOrgAccess(user: UserContext, orgId: string): boolean {
  if (isPlatformAdmin(user)) return true
  return user.organizations?.some((o) => o.orgId === orgId) ?? false
}

/**
 * Check if user is a Store Manager for a specific shop
 */
export function isStoreManager(user: UserContext, shopId: string): boolean {
  if (isPlatformAdmin(user)) return true
  return user.shops?.some(
    (s) => s.shopId === shopId && s.shopRole === 'STORE_MANAGER'
  ) ?? false
}

/**
 * Check if user has any role in a specific shop
 */
export function hasShopAccess(user: UserContext, shopId: string): boolean {
  if (isPlatformAdmin(user)) return true
  return user.shops?.some((s) => s.shopId === shopId) ?? false
}

/**
 * Check if user is a Cashier for a specific shop
 */
export function isCashier(user: UserContext, shopId: string): boolean {
  return user.shops?.some(
    (s) => s.shopId === shopId && s.shopRole === 'CASHIER'
  ) ?? false
}

/**
 * Check if user can manage users in an organization
 * Only Platform Admins and Org Admins can manage users
 */
export function canManageOrgUsers(user: UserContext, orgId: string): boolean {
  return isOrgAdmin(user, orgId)
}

/**
 * Check if user can manage stores in an organization
 * Only Platform Admins and Org Admins can manage stores
 */
export function canManageStores(user: UserContext, orgId: string): boolean {
  return isOrgAdmin(user, orgId)
}

/**
 * Check if user can view/edit products in a shop
 * Store Managers and Platform Admins viewing that shop can manage products
 */
export function canManageProducts(user: UserContext, shopId: string): boolean {
  return isStoreManager(user, shopId)
}

/**
 * Check if user can record purchases in a shop
 * Only Store Managers can record purchases by default
 * (Cashiers can be granted permission via optional flag in future)
 */
export function canRecordPurchases(user: UserContext, shopId: string): boolean {
  return isStoreManager(user, shopId)
}

/**
 * Check if user can make sales (POS access)
 * Store Managers, Cashiers, and Platform Admins can access POS
 */
export function canMakeSales(user: UserContext, shopId: string): boolean {
  return hasShopAccess(user, shopId)
}

/**
 * Check if user can view reports
 * Store Managers and above can view reports
 */
export function canViewReports(user: UserContext, shopId: string): boolean {
  return isStoreManager(user, shopId)
}

/**
 * Check if user can manage customers
 * All shop users can manage customers
 */
export function canManageCustomers(user: UserContext, shopId: string): boolean {
  return hasShopAccess(user, shopId)
}

/**
 * Check if user can manage suppliers
 * Only Store Managers can manage suppliers
 */
export function canManageSuppliers(user: UserContext, shopId: string): boolean {
  return isStoreManager(user, shopId)
}

/**
 * Standard error responses
 */
export const UnauthorizedResponse = () =>
  new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })

export const ForbiddenResponse = (message = 'Insufficient permissions') =>
  new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })

export const NotFoundResponse = (message = 'Resource not found') =>
  new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })

