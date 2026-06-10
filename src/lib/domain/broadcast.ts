import { prisma } from '@/lib/db/prisma'
import { sendEmail, generateBroadcastEmail } from '@/lib/email'

export type BroadcastAudience = 'ALL_USERS' | 'ALL_ORG_ADMINS' | 'ORGS' | 'USERS'

export interface BroadcastParams {
  audience: BroadcastAudience
  orgIds?: string[]
  userIds?: string[]
  channels: { inApp: boolean; email: boolean }
  subject: string
  message: string
  href?: string | null
}

interface Recipient {
  id: string
  email: string
  name: string | null
}

const userSelect = { id: true, email: true, name: true }

/** Resolve the distinct set of recipient users for an audience. Platform admins are excluded. */
export async function resolveRecipients(
  audience: BroadcastAudience,
  orgIds: string[] = [],
  userIds: string[] = []
): Promise<Recipient[]> {
  let users: Recipient[] = []

  if (audience === 'ALL_USERS') {
    users = await prisma.user.findMany({
      where: { role: { not: 'PLATFORM_ADMIN' } },
      select: userSelect,
    })
  } else if (audience === 'ALL_ORG_ADMINS') {
    const admins = await prisma.organizationUser.findMany({
      where: { orgRole: 'ORG_ADMIN' },
      select: { userId: true },
    })
    const ids = [...new Set(admins.map((a) => a.userId))]
    users = await prisma.user.findMany({
      where: { id: { in: ids }, role: { not: 'PLATFORM_ADMIN' } },
      select: userSelect,
    })
  } else if (audience === 'ORGS') {
    if (orgIds.length === 0) return []
    const shops = await prisma.shop.findMany({ where: { orgId: { in: orgIds } }, select: { id: true } })
    const shopIds = shops.map((s) => s.id)
    const [orgUsers, shopUsers] = await Promise.all([
      prisma.organizationUser.findMany({ where: { orgId: { in: orgIds } }, select: { userId: true } }),
      shopIds.length
        ? prisma.userShop.findMany({ where: { shopId: { in: shopIds } }, select: { userId: true } })
        : Promise.resolve([] as { userId: string }[]),
    ])
    const ids = [...new Set([...orgUsers.map((u) => u.userId), ...shopUsers.map((u) => u.userId)])]
    users = await prisma.user.findMany({
      where: { id: { in: ids }, role: { not: 'PLATFORM_ADMIN' } },
      select: userSelect,
    })
  } else if (audience === 'USERS') {
    if (userIds.length === 0) return []
    users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: userSelect })
  }

  // De-dupe by id (a user could match more than one source).
  const byId = new Map<string, Recipient>()
  for (const u of users) byId.set(u.id, u)
  return [...byId.values()]
}

/** Send a broadcast over the chosen channels. Returns delivery counts. */
export async function runBroadcast(
  params: BroadcastParams
): Promise<{ recipients: number; inApp: number; email: number }> {
  const recipients = await resolveRecipients(params.audience, params.orgIds, params.userIds)
  if (recipients.length === 0) return { recipients: 0, inApp: 0, email: 0 }

  let inApp = 0
  let email = 0

  if (params.channels.inApp) {
    const created = await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        type: 'ADMIN_BROADCAST',
        title: params.subject,
        body: params.message,
        href: params.href || null,
      })),
    })
    inApp = created.count
  }

  if (params.channels.email) {
    // Send in small batches so we don't fire hundreds of requests at once.
    const batchSize = 25
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)
      const results = await Promise.all(
        batch
          .filter((r) => r.email)
          .map((r) =>
            sendEmail({
              to: r.email,
              subject: params.subject,
              html: generateBroadcastEmail(params.subject, params.message, r.name),
            })
          )
      )
      email += results.filter((res) => res.success).length
    }
  }

  return { recipients: recipients.length, inApp, email }
}
