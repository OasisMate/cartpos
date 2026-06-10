import { prisma } from '@/lib/db/prisma'

export interface NotificationContent {
  type: string
  title: string
  body?: string | null
  href?: string | null
}

interface CreateNotificationInput extends NotificationContent {
  userId: string
  orgId?: string | null
  shopId?: string | null
}

/**
 * Create one notification for a single recipient.
 * Never throws - notifications must not break the main flow.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        orgId: input.orgId ?? null,
        shopId: input.shopId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}

/** Fan a notification out to every store manager of a shop. */
export async function notifyShopManagers(
  shopId: string,
  orgId: string | null,
  content: NotificationContent
): Promise<void> {
  try {
    const managers = await prisma.userShop.findMany({
      where: { shopId, shopRole: 'STORE_MANAGER' },
      select: { userId: true },
    })
    if (managers.length === 0) return
    await prisma.notification.createMany({
      data: managers.map((m) => ({
        userId: m.userId,
        orgId,
        shopId,
        type: content.type,
        title: content.title,
        body: content.body ?? null,
        href: content.href ?? null,
      })),
    })
  } catch (error) {
    console.error('Failed to notify shop managers:', error)
  }
}

/** Fan a notification out to every admin of an organization. */
export async function notifyOrgAdmins(
  orgId: string,
  content: NotificationContent
): Promise<void> {
  try {
    const admins = await prisma.organizationUser.findMany({
      where: { orgId, orgRole: 'ORG_ADMIN' },
      select: { userId: true },
    })
    if (admins.length === 0) return
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.userId,
        orgId,
        shopId: null,
        type: content.type,
        title: content.title,
        body: content.body ?? null,
        href: content.href ?? null,
      })),
    })
  } catch (error) {
    console.error('Failed to notify org admins:', error)
  }
}

/** Fan a notification out to every platform admin. */
export async function notifyPlatformAdmins(content: NotificationContent): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'PLATFORM_ADMIN' },
      select: { id: true },
    })
    if (admins.length === 0) return
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        orgId: null,
        shopId: null,
        type: content.type,
        title: content.title,
        body: content.body ?? null,
        href: content.href ?? null,
      })),
    })
  } catch (error) {
    console.error('Failed to notify platform admins:', error)
  }
}

export async function listNotifications(userId: string, limit = 20) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(50, Math.max(1, limit)),
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ])
  return {
    unread,
    notifications: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt,
    })),
  }
}

/** Set read/unread for a user's notifications. Pass ids to target specific ones, omit for all. */
export async function setNotificationsRead(
  userId: string,
  read: boolean,
  ids?: string[]
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      userId,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { read },
  })
}

/** Delete notifications for a user. Pass ids to clear specific ones, omit to clear all. */
export async function clearNotifications(userId: string, ids?: string[]): Promise<void> {
  await prisma.notification.deleteMany({
    where: {
      userId,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
  })
}
