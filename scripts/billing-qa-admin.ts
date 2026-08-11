/**
 * Throwaway PLATFORM_ADMIN for QA, so the admin billing screens can be tested
 * without touching the real platform-admin account or resetting its password.
 *
 * Uses a @cartpos.test address, which the teardown recognises and which cannot
 * receive real mail.
 *
 * Run: npx tsx scripts/billing-qa-admin.ts create
 *      npx tsx scripts/billing-qa-admin.ts delete
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { QA_PASSWORD } from './billing-qa-constants'

const prisma = new PrismaClient()
const EMAIL = 'qa-platform@cartpos.test'
const action = (process.argv[2] || 'create').toLowerCase()

async function main() {
  if (action === 'delete') {
    const existing = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (!existing) {
      console.log('No QA platform admin to delete.')
      return
    }
    // Guard: never delete a real admin, only the .test one.
    if (!existing.email.endsWith('@cartpos.test')) {
      console.error('Refusing: not a test address.')
      process.exit(1)
    }
    await prisma.notification.deleteMany({ where: { userId: existing.id } })
    await prisma.user.delete({ where: { id: existing.id } })
    console.log(`Deleted ${EMAIL}`)
    return
  }

  const hashed = await bcrypt.hash(QA_PASSWORD, 12)
  const admin = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      name: 'QA Platform Admin',
      email: EMAIL,
      password: hashed,
      role: 'PLATFORM_ADMIN',
      emailVerified: true,
    },
    update: { role: 'PLATFORM_ADMIN', password: hashed, emailVerified: true },
  })

  const realAdmins = await prisma.user.count({
    where: { role: 'PLATFORM_ADMIN', email: { not: { endsWith: '@cartpos.test' } } },
  })

  console.log(`QA platform admin ready: ${admin.email} / ${QA_PASSWORD}`)
  console.log(`(real platform admins untouched: ${realAdmins})`)
  console.log('Delete when done: npx tsx scripts/billing-qa-admin.ts delete')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
