import type { OrganizationType, Prisma, ShopRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  normalizeUnits,
  presetForType,
  presetShopSettingsData,
  readFeatureConfig,
  unitsForType,
} from '@/lib/domain/business-presets'
import { hashPassword } from '@/lib/auth'
import { normalizePhone, normalizeCNIC, validatePhone, validateCNIC } from '@/lib/validation'
import { sendEmail, generateWelcomeEmail, generateSuspensionWarningEmail } from '@/lib/email'
import { passwordPolicyError } from '@/lib/validation/password'

export interface CreateOrgByAdminInput {
  organizationName: string
  organizationType: string
  city: string
  legalName?: string
  orgPhone?: string
  addressLine1?: string
  addressLine2?: string
  ntn?: string
  strn?: string
  // Owner (org admin) account
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  ownerPhone?: string
  ownerCnic?: string
}

/**
 * Admin-initiated onboarding: create a new organization that is ACTIVE immediately
 * (already vetted by the platform admin who created it), with its owner (ORG_ADMIN)
 * and a first shop. This is the second onboarding path alongside gated public signup.
 */
export async function createOrganizationWithOwner(
  input: CreateOrgByAdminInput,
  adminUserId: string
) {
  const {
    organizationName,
    organizationType,
    city,
    legalName,
    orgPhone,
    addressLine1,
    addressLine2,
    ntn,
    strn,
    ownerName,
    ownerEmail,
    ownerPassword,
    ownerPhone,
    ownerCnic,
  } = input

  if (!organizationName || !organizationType || !city || !ownerName || !ownerEmail || !ownerPassword) {
    throw new Error('Missing required fields: organization name, type, city, owner name, email, password')
  }
  const ownerPwError = passwordPolicyError(ownerPassword)
  if (ownerPwError) {
    throw new Error(ownerPwError)
  }

  // Optional phone/cnic - validate only if provided
  let normalizedPhone: string | null = null
  if (ownerPhone) {
    normalizedPhone = normalizePhone(ownerPhone, 'PK')
    if (!normalizedPhone || !validatePhone(ownerPhone, 'PK')) {
      throw new Error('Invalid owner phone number format')
    }
  }
  let normalizedCnic: string | null = null
  if (ownerCnic) {
    normalizedCnic = normalizeCNIC(ownerCnic)
    if (!normalizedCnic || !validateCNIC(ownerCnic)) {
      throw new Error('Invalid owner CNIC format. CNIC must be 13 digits.')
    }
  }

  const emailLower = ownerEmail.toLowerCase()
  const [existingEmail, existingPhone, existingCnic] = await Promise.all([
    prisma.user.findUnique({ where: { email: emailLower } }),
    normalizedPhone ? prisma.user.findUnique({ where: { phone: normalizedPhone } }) : Promise.resolve(null),
    normalizedCnic ? prisma.user.findUnique({ where: { cnic: normalizedCnic } }) : Promise.resolve(null),
  ])
  if (existingEmail) throw new Error('A user with this email already exists')
  if (existingPhone) throw new Error('A user with this phone number already exists')
  if (existingCnic) throw new Error('A user with this CNIC already exists')

  const hashed = await hashPassword(ownerPassword)
  const normalizedOrgPhone = orgPhone ? normalizePhone(orgPhone, 'PK') : normalizedPhone

  return prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        name: ownerName.trim(),
        email: emailLower,
        phone: normalizedPhone,
        cnic: normalizedCnic,
        password: hashed,
        role: 'NORMAL',
        emailVerified: true, // admin-created accounts are already vetted
      },
    })

    const org = await tx.organization.create({
      data: {
        name: organizationName,
        legalName: legalName || organizationName,
        type: organizationType as any,
        phone: normalizedOrgPhone,
        city,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        ntn: ntn || null,
        strn: strn || null,
        // Admin-created orgs are ACTIVE immediately and recorded as approved by the admin.
        status: 'ACTIVE',
        requestedBy: adminUserId,
        approvedBy: adminUserId,
        approvedAt: new Date(),
      },
    })

    await tx.organizationUser.create({
      data: { userId: owner.id, orgId: org.id, orgRole: 'ORG_ADMIN' },
    })

    const shop = await tx.shop.create({
      data: {
        orgId: org.id,
        name: organizationName,
        city,
        phone: normalizedOrgPhone,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
      },
    })

    await tx.userShop.create({
      data: { userId: owner.id, shopId: shop.id, shopRole: 'STORE_MANAGER' as ShopRole },
    })

    return { orgId: org.id, ownerId: owner.id, shopId: shop.id }
  })
}

export async function listOrganizations() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { shops: true, users: true },
      },
    },
  })
  
  // Fetch requestedBy user details for each org
  const orgsWithUsers = await Promise.all(
    orgs.map(async (org) => {
      let requestedByUser = null
      if (org.requestedBy) {
        requestedByUser = await prisma.user.findUnique({
          where: { id: org.requestedBy },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cnic: true,
            isWhatsApp: true,
            emailVerified: true,
            createdAt: true,
          },
        })
      }
      return {
        ...org,
        requestedByUser,
      }
    })
  )
  
  return orgsWithUsers
}

/**
 * Change an organization's business type, optionally re-seeding each shop's
 * feature flags from the new type's preset (see `business-presets.ts`).
 *
 * Presets normally only run at signup, so a shop that picked the wrong type
 * keeps the wrong features forever. Re-applying overwrites the preset-owned
 * flags but keeps a hand-edited unit list: units are only refreshed when the
 * shop is still on the old type's defaults.
 */
export async function changeOrganizationType(
  orgId: string,
  newType: OrganizationType,
  opts: { reapplyPresets?: boolean } = {}
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { type: true, shops: { select: { id: true } } },
  })
  if (!org) throw new Error('Organization not found')

  const oldType = org.type
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: { type: newType },
    select: { id: true, name: true, type: true },
  })

  let shopsUpdated = 0
  if (opts.reapplyPresets && org.shops.length) {
    const preset = presetShopSettingsData(newType)
    const oldDefaults = unitsForType(oldType)
    const newDefaults = unitsForType(newType)

    for (const shop of org.shops) {
      const existing = await prisma.shopSettings.findUnique({
        where: { shopId: shop.id },
        select: { featureConfig: true },
      })
      const cfg = readFeatureConfig(existing?.featureConfig)
      const currentUnits = normalizeUnits(cfg.units)
      // Only replace units the owner never touched.
      const untouched =
        currentUnits.length === 0 ||
        (currentUnits.length === oldDefaults.length &&
          currentUnits.every((u, i) => u === oldDefaults[i]))

      const { featureConfig: presetConfig, ...columns } = preset
      const featureConfig = {
        ...cfg,
        batchExpiry: presetForType(newType).batchExpiry,
        units: untouched ? newDefaults : currentUnits,
      } as Prisma.InputJsonObject

      await prisma.shopSettings.upsert({
        where: { shopId: shop.id },
        create: { shopId: shop.id, ...columns, featureConfig },
        update: { ...columns, featureConfig },
      })
      shopsUpdated++
    }
  }

  return { organization: updated, previousType: oldType, shopsUpdated }
}

export async function approveOrganization(orgId: string, adminUserId: string) {
  // Simple approval: set ACTIVE and approvedBy/approvedAt
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'ACTIVE',
      approvedBy: adminUserId,
      approvedAt: new Date(),
      rejectionReason: null, // Clear any rejection reason
      suspensionReason: null, // Clear any suspension reason
    },
  })
  return updated
}

/**
 * Email the org's admins a welcome + getting-started guide after approval.
 * Best-effort: never throws into the approval flow.
 */
export async function sendOrgApprovedEmail(orgId: string, origin?: string): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    })
    if (!org) return

    const admins = await prisma.organizationUser.findMany({
      where: { orgId, orgRole: 'ORG_ADMIN' },
      select: { user: { select: { email: true, name: true } } },
    })
    if (admins.length === 0) return

    const base = process.env.NEXT_PUBLIC_APP_URL || origin || 'http://localhost:3000'
    const loginLink = `${base}/login`

    await Promise.all(
      admins.map((a) =>
        sendEmail({
          to: a.user.email,
          subject: `Welcome to Cart POS - ${org.name} is approved`,
          html: generateWelcomeEmail({ orgName: org.name, ownerName: a.user.name, loginLink }),
        })
      )
    )
  } catch (error) {
    console.error('Failed to send approval welcome email:', error)
  }
}

export async function rejectOrganization(orgId: string, adminUserId: string, reason?: string) {
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'INACTIVE',
      rejectionReason: reason || null,
      suspensionReason: null, // Clear suspension reason if any
    },
  })
  return updated
}

export async function suspendOrganization(orgId: string, adminUserId: string, reason?: string) {
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'SUSPENDED',
      suspensionReason: reason || null,
    },
  })
  return updated
}

/**
 * Warn the org's admins that they must make contact or lose the account.
 *
 * Also stamps deletionScheduledAt/By, which is now purely the record of when
 * the warning went out. Best-effort: a failed send must never block a
 * suspension, so this never throws.
 */
export async function sendOrgSuspendedWarningEmail(
  orgId: string,
  adminUserId: string,
  reason?: string | null
): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    })
    if (!org) return

    const admins = await prisma.organizationUser.findMany({
      where: { orgId, orgRole: 'ORG_ADMIN' },
      select: { user: { select: { email: true, name: true } } },
    })
    if (admins.length === 0) return

    const supportEmail = process.env.BREVO_SENDER_EMAIL || 'hamzamakhdoom786@gmail.com'

    const results = await Promise.all(
      admins.map((a) =>
        sendEmail({
          to: a.user.email,
          subject: `Action needed - ${org.name} has been suspended`,
          html: generateSuspensionWarningEmail({
            orgName: org.name,
            ownerName: a.user.name,
            reason: reason || null,
            supportEmail,
          }),
        })
      )
    )

    // Only stamp the audit trail if at least one warning actually left.
    if (results.some((r) => r.success)) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { deletionScheduledAt: new Date(), deletionScheduledBy: adminUserId },
      })
    }
  } catch (error) {
    console.error('Failed to send suspension warning email:', error)
  }
}

export async function reactivateOrganization(orgId: string, adminUserId: string) {
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      status: 'ACTIVE',
      suspensionReason: null, // Clear suspension reason
      // Reactivating cancels any scheduled deletion.
      deletionScheduledAt: null,
      deletionScheduledBy: null,
    },
  })
  return updated
}

/**
 * Wipe every row belonging to an org, children before parents.
 *
 * Order matters: most foreign keys are ON DELETE RESTRICT, so a single missed
 * table aborts the whole transaction and nothing is deleted. Anything added to
 * the schema that hangs off Shop, Product, Invoice, Customer or Supplier must
 * be added here too.
 */
async function deleteOrgData(
  tx: Prisma.TransactionClient,
  orgId: string,
  shopIds: string[]
): Promise<void> {
  if (shopIds.length) {
    const byShop = { shopId: { in: shopIds } }

    // Leaves that point at products, invoices, quotations and returns.
    await tx.saleReturnLine.deleteMany({ where: { saleReturn: byShop } })
    await tx.saleReturn.deleteMany({ where: byShop })
    await tx.quotationLine.deleteMany({ where: { quotation: byShop } })
    await tx.quotation.deleteMany({ where: byShop })
    await tx.invoiceLine.deleteMany({ where: { invoice: byShop } })
    await tx.purchaseListLine.deleteMany({ where: { purchaseList: byShop } })
    await tx.purchaseList.deleteMany({ where: byShop })
    await tx.purchaseAttachment.deleteMany({ where: { purchase: byShop } })
    await tx.purchaseLine.deleteMany({ where: { purchase: byShop } })
    await tx.packagingLevel.deleteMany({ where: { product: byShop } })

    // Money, stock and shift history.
    await tx.cashMovement.deleteMany({ where: byShop })
    await tx.shift.deleteMany({ where: byShop })
    await tx.payment.deleteMany({ where: byShop })
    await tx.customerLedger.deleteMany({ where: byShop })
    await tx.supplierLedger.deleteMany({ where: byShop })
    await tx.stockLedger.deleteMany({ where: byShop })
    await tx.stockLot.deleteMany({ where: byShop })

    // Documents, then the records they reference.
    await tx.invoice.deleteMany({ where: byShop })
    await tx.purchase.deleteMany({ where: byShop })
    await tx.product.deleteMany({ where: byShop })
    await tx.customer.deleteMany({ where: byShop })
    await tx.supplier.deleteMany({ where: byShop })
    await tx.expense.deleteMany({ where: byShop })

    // Loose per-shop rows. No FK on these, but they would leak otherwise.
    await tx.notification.deleteMany({ where: byShop })
    await tx.catalogSighting.deleteMany({ where: byShop })
    await tx.syncErrorReport.deleteMany({ where: byShop })
    await tx.shopSettings.deleteMany({ where: byShop })
    await tx.userShop.deleteMany({ where: byShop })
  }

  // Org level. Subscription, SubscriptionPayment and PaymentClaim cascade off
  // Organization, so the final delete clears them.
  await tx.activityLog.deleteMany({ where: { orgId } })
  await tx.organizationUser.deleteMany({ where: { orgId } })
  await tx.shop.deleteMany({ where: { orgId } })
  await tx.organization.delete({ where: { id: orgId } })
}

// --- Organization deletion (suspend -> warn the owner -> manual purge) ---
//
// There is no waiting period. Suspending an org emails the owner that they must
// contact the admin or lose the account permanently, and from that point the
// admin can purge whenever they choose. deletionScheduledAt/By are kept purely
// as the audit trail of when that warning went out and who triggered it.

/** Counts shown to the admin before purging, plus eligibility. */
export async function getOrgDeletionPreview(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true, status: true, requestedBy: true, deletionScheduledAt: true,
      shops: { select: { id: true } },
    },
  })
  if (!org) throw new Error('Organization not found')
  const shopIds = org.shops.map((s) => s.id)

  const [products, invoices, customers, suppliers, purchases, shopUsers, orgUsers, owner] = await Promise.all([
    prisma.product.count({ where: { shopId: { in: shopIds } } }),
    prisma.invoice.count({ where: { shopId: { in: shopIds } } }),
    prisma.customer.count({ where: { shopId: { in: shopIds } } }),
    prisma.supplier.count({ where: { shopId: { in: shopIds } } }),
    prisma.purchase.count({ where: { shopId: { in: shopIds } } }),
    prisma.userShop.findMany({ where: { shopId: { in: shopIds } }, select: { userId: true } }),
    prisma.organizationUser.findMany({ where: { orgId }, select: { userId: true } }),
    org.requestedBy
      ? prisma.user.findUnique({ where: { id: org.requestedBy }, select: { id: true, name: true, email: true } })
      : Promise.resolve(null),
  ])

  const staff = new Set([...shopUsers.map((u) => u.userId), ...orgUsers.map((u) => u.userId)])
  if (org.requestedBy) staff.delete(org.requestedBy)

  return {
    name: org.name,
    status: org.status,
    shops: shopIds.length,
    products,
    invoices,
    customers,
    suppliers,
    purchases,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
    staffCount: staff.size,
    // When the owner was warned. Null means suspension predates the warning
    // email, not that deletion is blocked.
    ownerWarnedAt: org.deletionScheduledAt,
    canPurgeNow: org.status !== 'ACTIVE',
  }
}

/**
 * Permanently delete an org and all its data. Guarded: never ACTIVE, must be
 * scheduled, and the buffer must have elapsed. Optionally removes the owner's
 * and/or staff login accounts (only when they have no other memberships).
 */
export async function purgeOrganization(
  orgId: string,
  adminUserId: string,
  opts: { deleteOwner?: boolean; deleteStaff?: boolean } = {}
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, status: true, requestedBy: true, deletionScheduledAt: true, shops: { select: { id: true } } },
  })
  if (!org) throw new Error('Organization not found')
  // The only guard left. Suspending first is what warns the owner.
  if (org.status === 'ACTIVE') throw new Error('Active organizations cannot be deleted. Suspend it first.')

  const shopIds = org.shops.map((s) => s.id)
  const ownerId = org.requestedBy || null

  let staffIds: string[] = []
  if (opts.deleteStaff) {
    const [shopUsers, orgUsers] = await Promise.all([
      prisma.userShop.findMany({ where: { shopId: { in: shopIds } }, select: { userId: true } }),
      prisma.organizationUser.findMany({ where: { orgId }, select: { userId: true } }),
    ])
    const ids = new Set([...shopUsers.map((u) => u.userId), ...orgUsers.map((u) => u.userId)])
    if (ownerId) ids.delete(ownerId)
    staffIds = [...ids]
  }

  await prisma.$transaction(async (tx) => {
    await deleteOrgData(tx, orgId, shopIds)

    // Remove orphaned user accounts the admin opted to delete.
    const candidates = [...(opts.deleteOwner && ownerId ? [ownerId] : []), ...staffIds]
    for (const uid of candidates) {
      const [shopCount, orgCount, u] = await Promise.all([
        tx.userShop.count({ where: { userId: uid } }),
        tx.organizationUser.count({ where: { userId: uid } }),
        tx.user.findUnique({ where: { id: uid }, select: { role: true } }),
      ])
      if (u && u.role !== 'PLATFORM_ADMIN' && shopCount === 0 && orgCount === 0) {
        await tx.notification.deleteMany({ where: { userId: uid } })
        await tx.activityLog.deleteMany({ where: { userId: uid } })
        await tx.user.delete({ where: { id: uid } })
      }
    }
  }, { timeout: 30000 })

  return { name: org.name }
}

/**
 * Delete an organization whose requesting owner never verified their email.
 * Safety: refuses if the owner IS verified or the org is ACTIVE - this path is
 * only for clearing unverified signup junk. Removes the org, its data, the owner
 * and any staff (mirrors purgeOrganization's FK-ordered deletes).
 */
export async function purgeUnverifiedOrganization(orgId: string, adminUserId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, status: true, requestedBy: true, shops: { select: { id: true } } },
  })
  if (!org) throw new Error('Organization not found')
  if (org.status === 'ACTIVE') throw new Error('Active organizations cannot be deleted here')

  const ownerId = org.requestedBy
  if (!ownerId) throw new Error('Organization has no requesting user')
  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { emailVerified: true } })
  if (!owner) throw new Error('Requesting user not found')
  if (owner.emailVerified) throw new Error('This account is verified - it cannot be removed as unverified junk')

  const shopIds = org.shops.map((s) => s.id)

  // Staff = everyone linked to the org's shops/org, minus the owner (handled below).
  const [shopUsers, orgUsers] = await Promise.all([
    prisma.userShop.findMany({ where: { shopId: { in: shopIds } }, select: { userId: true } }),
    prisma.organizationUser.findMany({ where: { orgId }, select: { userId: true } }),
  ])
  const ids = new Set([...shopUsers.map((u) => u.userId), ...orgUsers.map((u) => u.userId)])
  ids.delete(ownerId)
  const staffIds = [...ids]

  await prisma.$transaction(async (tx) => {
    await deleteOrgData(tx, orgId, shopIds)

    // Delete now-orphaned accounts (owner + staff), never a platform admin.
    for (const uid of [ownerId, ...staffIds]) {
      const [shopCount, orgCount, u] = await Promise.all([
        tx.userShop.count({ where: { userId: uid } }),
        tx.organizationUser.count({ where: { userId: uid } }),
        tx.user.findUnique({ where: { id: uid }, select: { role: true } }),
      ])
      if (u && u.role !== 'PLATFORM_ADMIN' && shopCount === 0 && orgCount === 0) {
        await tx.notification.deleteMany({ where: { userId: uid } })
        await tx.activityLog.deleteMany({ where: { userId: uid } })
        await tx.user.delete({ where: { id: uid } })
      }
    }
  }, { timeout: 30000 })

  console.warn(`[PURGE_UNVERIFIED] admin=${adminUserId} org=${orgId} name="${org.name}"`)
  return { name: org.name }
}


