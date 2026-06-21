import { prisma } from '@/lib/db/prisma'

export interface ActivityLogInput {
  userId: string
  orgId: string
  shopId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  details?: Record<string, any> | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Log an activity to the audit trail
 * All timestamps are stored in UTC/GMT to avoid timezone issues.
 * 
 * JavaScript Date objects are internally stored as UTC milliseconds since epoch.
 * PostgreSQL's Timestamptz type stores timestamps with timezone information (UTC).
 * This ensures consistent time storage regardless of server timezone settings.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    // JavaScript Date objects are already in UTC internally
    // When passed to PostgreSQL with @db.Timestamptz, it's stored as UTC/GMT
    const utcNow = new Date()
    
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        orgId: input.orgId,
        shopId: input.shopId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        details: input.details || undefined,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        createdAt: utcNow, // Stored as UTC/GMT in database
      },
    })
  } catch (error) {
    // Log error but don't throw - activity logging should not break the main flow
    console.error('Failed to log activity:', error)
  }
}

/**
 * Activity action constants
 */
export const ActivityActions = {
  // Store actions
  CREATE_STORE: 'CREATE_STORE',
  UPDATE_STORE: 'UPDATE_STORE',
  DELETE_STORE: 'DELETE_STORE',
  UPDATE_STORE_SETTINGS: 'UPDATE_STORE_SETTINGS',
  
  // User actions
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  REMOVE_USER: 'REMOVE_USER',
  ASSIGN_STORE: 'ASSIGN_STORE',
  REMOVE_FROM_STORE: 'REMOVE_FROM_STORE',
  RESET_PASSWORD: 'RESET_PASSWORD',
  
  // Profile actions
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  
  // Organization actions
  UPDATE_ORG_SETTINGS: 'UPDATE_ORG_SETTINGS',
  APPROVE_ORG: 'APPROVE_ORG',
  SUSPEND_ORG: 'SUSPEND_ORG',
  REJECT_ORG: 'REJECT_ORG',
  REACTIVATE_ORG: 'REACTIVATE_ORG',
  SCHEDULE_ORG_DELETION: 'SCHEDULE_ORG_DELETION',
  CANCEL_ORG_DELETION: 'CANCEL_ORG_DELETION',
  DELETE_ORG: 'DELETE_ORG',
  
  // Product actions
  CREATE_PRODUCT: 'CREATE_PRODUCT',
  UPDATE_PRODUCT: 'UPDATE_PRODUCT',
  ARCHIVE_PRODUCT: 'ARCHIVE_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  
  // Customer actions
  CREATE_CUSTOMER: 'CREATE_CUSTOMER',
  UPDATE_CUSTOMER: 'UPDATE_CUSTOMER',

  // Supplier actions
  RECORD_SUPPLIER_PAYMENT: 'RECORD_SUPPLIER_PAYMENT',
  RECORD_SUPPLIER_CREDIT: 'RECORD_SUPPLIER_CREDIT',

  // Purchase actions
  CREATE_PURCHASE: 'CREATE_PURCHASE',
  
  // Sale actions
  CREATE_SALE: 'CREATE_SALE',
  UPDATE_SALE: 'UPDATE_SALE',
  VOID_SALE: 'VOID_SALE',

  // Cash drawer / shift actions
  OPEN_SHIFT: 'OPEN_SHIFT',
  CLOSE_SHIFT: 'CLOSE_SHIFT',
  CASH_MOVEMENT: 'CASH_MOVEMENT',
} as const

/**
 * Entity type constants
 */
export const EntityTypes = {
  STORE: 'STORE',
  USER: 'USER',
  PRODUCT: 'PRODUCT',
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  SALE: 'SALE',
  PURCHASE: 'PURCHASE',
  ORGANIZATION: 'ORGANIZATION',
  PROFILE: 'PROFILE',
  SHIFT: 'SHIFT',
} as const

