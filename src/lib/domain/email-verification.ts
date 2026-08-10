import { prisma } from '@/lib/db/prisma'
import { randomBytes, randomInt } from 'crypto'
import {
  sendEmail,
  generateVerificationEmail,
  generateVerificationReminderEmail,
  generateAccessRequestEmail,
  generateTrialStartedEmail,
} from '@/lib/email'
import { notifyPlatformAdmins } from '@/lib/domain/notifications'
import { TRIAL_DAYS } from '@/lib/billing/trial'

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

// 6-digit numeric code (100000–999999) as an alternative to the link.
function generateCode(): string {
  return String(randomInt(100000, 1000000))
}

function baseUrl(originFallback?: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || originFallback || 'http://localhost:3000'
}

/**
 * After a signup verifies their email, alert platform admins (in-app + email).
 *
 * Approval was dropped in favour of the trial + paywall, so this is now an FYI,
 * not a task. It is deliberately kept: knowing who just started a trial, and
 * where they came from, is the whole point of tracking signups.
 *
 * Never throws.
 */
async function notifyAdminsOfAccessRequest(userId: string, origin?: string): Promise<void> {
  try {
    // No status filter: new orgs are ACTIVE from the start now. Filtering on
    // PENDING here would silently kill the alert.
    const org = await prisma.organization.findFirst({
      where: { requestedBy: userId },
      select: { id: true, name: true, city: true, referralSource: true },
    })
    if (!org) return // not a fresh signup (e.g. admin-created)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })

    await notifyPlatformAdmins({
      type: 'ORG_ACCESS_REQUEST',
      title: 'New trial started',
      body: `${org.name}${user?.name ? ` (${user.name})` : ''} verified their email and started a ${TRIAL_DAYS}-day trial.`,
      href: '/admin/organizations',
    })

    const admins = await prisma.user.findMany({
      where: { role: 'PLATFORM_ADMIN' },
      select: { email: true },
    })
    const reviewLink = `${baseUrl(origin)}/admin/organizations`
    await Promise.all(
      admins.map((a) =>
        sendEmail({
          to: a.email,
          subject: `New Cart POS trial: ${org.name}`,
          html: generateAccessRequestEmail({
            orgName: org.name,
            ownerName: user?.name,
            ownerEmail: user?.email,
            city: org.city,
            referralSource: org.referralSource,
            trialDays: TRIAL_DAYS,
            reviewLink,
          }),
        })
      )
    )
  } catch (error) {
    console.error('Failed to notify admins of access request:', error)
  }
}

/**
 * Welcome the owner and tell them exactly when their trial ends.
 *
 * Sent once, on verification, because that is the moment the account actually
 * becomes usable. Naming the end date here is what stops the eventual read-only
 * lockout feeling like a trap.
 *
 * Never throws: a failed welcome email must not fail the verification itself.
 */
async function sendTrialStartedEmail(userId: string, origin?: string): Promise<void> {
  try {
    const org = await prisma.organization.findFirst({
      where: { requestedBy: userId },
      select: {
        name: true,
        subscription: {
          select: { status: true, trialEndsAt: true, plan: { select: { name: true } } },
        },
      },
    })
    // Only for a genuine new signup that is actually on a trial. An org that was
    // grandfathered, or created by an admin, gets nothing.
    const sub = org?.subscription
    if (!org || !sub || sub.status !== 'TRIALING' || !sub.trialEndsAt) return

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    if (!user?.email) return

    const trialEndsOn = sub.trialEndsAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const settings = await prisma.billingSettings.findUnique({
      where: { id: 'default' },
      select: { whatsappNumber: true },
    })

    await sendEmail({
      to: user.email,
      subject: `Your Cart POS trial is active until ${trialEndsOn}`,
      html: generateTrialStartedEmail({
        ownerName: user.name,
        orgName: org.name,
        trialDays: TRIAL_DAYS,
        trialEndsOn,
        planName: sub.plan?.name ?? 'Business',
        loginLink: `${baseUrl(origin)}/login`,
        supportPhone: settings?.whatsappNumber ?? null,
      }),
    })
  } catch (error) {
    console.error('Failed to send trial started email:', error)
  }
}

/**
 * Issue a fresh verification token and email it. Invalidates any prior unused
 * tokens for the user so only the latest link works. Never throws.
 */
export async function issueVerificationEmail(params: {
  userId: string
  email: string
  name?: string | null
  origin?: string
  /** Use the reminder template/subject instead of the first-time one. */
  reminder?: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const token = randomBytes(32).toString('hex')
    const code = generateCode()
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS)

    await prisma.emailVerificationToken.updateMany({
      where: { userId: params.userId, used: false },
      data: { used: true },
    })
    await prisma.emailVerificationToken.create({
      data: { userId: params.userId, token, code, expiresAt },
    })

    const link = `${baseUrl(params.origin)}/verify-email?token=${token}`
    const name = params.name || undefined
    return await sendEmail({
      to: params.email,
      subject: params.reminder ? 'Reminder: verify your Cart POS email' : 'Confirm your Cart POS email',
      html: params.reminder
        ? generateVerificationReminderEmail(link, code, name)
        : generateVerificationEmail(link, code, name),
    })
  } catch (error) {
    console.error('Failed to issue verification email:', error)
    return { success: false, error: 'Failed to send verification email' }
  }
}

/**
 * Validate a verification token and mark the user verified.
 * Returns a coarse status so the UI can show the right message.
 */
export async function verifyEmailToken(
  token: string,
  origin?: string
): Promise<{ status: 'verified' | 'already' | 'invalid' | 'expired' }> {
  if (!token) return { status: 'invalid' }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, emailVerified: true } } },
  })

  if (!record || !record.user) return { status: 'invalid' }
  if (record.user.emailVerified) return { status: 'already' }
  if (record.used) return { status: 'invalid' }
  if (record.expiresAt < new Date()) return { status: 'expired' }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { used: true } }),
  ])

  // Owner first: their welcome matters more than our internal alert.
  await sendTrialStartedEmail(record.userId, origin)
  await notifyAdminsOfAccessRequest(record.userId, origin)
  return { status: 'verified' }
}

/**
 * Validate a 6-digit code against the user's latest active token.
 * Used by the on-page code entry (email is known from signup/resend).
 */
export async function verifyEmailCode(
  email: string,
  code: string,
  origin?: string
): Promise<{ status: 'verified' | 'already' | 'invalid' | 'expired' }> {
  if (!email || !/^\d{6}$/.test(code || '')) return { status: 'invalid' }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, emailVerified: true },
  })
  if (!user) return { status: 'invalid' }
  if (user.emailVerified) return { status: 'already' }

  // Latest issued token for this user (the only one that's unused).
  const record = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, used: false },
    orderBy: { createdAt: 'desc' },
  })
  if (!record || !record.code) return { status: 'invalid' }
  if (record.expiresAt < new Date()) return { status: 'expired' }
  if (record.code !== code) return { status: 'invalid' }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { used: true } }),
  ])

  await sendTrialStartedEmail(user.id, origin)
  await notifyAdminsOfAccessRequest(user.id, origin)
  return { status: 'verified' }
}
