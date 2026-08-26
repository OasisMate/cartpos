/**
 * One-off: strip leading/trailing whitespace from Organization and Shop names.
 *
 * A trailing space is invisible in the admin UI but it broke type-to-confirm on
 * org deletion, and forced defensive .trim() calls at every display site. The
 * write paths now trim, so this is only for rows created before that.
 *
 * Run: npx tsx scripts/normalize-org-names.ts            (dry run)
 *      npx tsx scripts/normalize-org-names.ts --confirm
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CONFIRM = process.argv.includes('--confirm')

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, legalName: true } })
  const shops = await prisma.shop.findMany({ select: { id: true, name: true } })

  const dirtyOrgs = orgs.filter((o) => o.name !== o.name.trim() || (o.legalName && o.legalName !== o.legalName.trim()))
  const dirtyShops = shops.filter((s) => s.name !== s.name.trim())

  console.log(`Organizations needing a trim: ${dirtyOrgs.length} of ${orgs.length}`)
  for (const o of dirtyOrgs) console.log(`  ${JSON.stringify(o.name)} -> ${JSON.stringify(o.name.trim())}`)
  console.log(`Shops needing a trim: ${dirtyShops.length} of ${shops.length}`)
  for (const s of dirtyShops) console.log(`  ${JSON.stringify(s.name)} -> ${JSON.stringify(s.name.trim())}`)

  if (!dirtyOrgs.length && !dirtyShops.length) {
    console.log('\nNothing to do.')
    return
  }
  if (!CONFIRM) {
    console.log('\nDRY RUN. Re-run with --confirm to apply.')
    return
  }

  for (const o of dirtyOrgs) {
    await prisma.organization.update({
      where: { id: o.id },
      data: { name: o.name.trim(), ...(o.legalName ? { legalName: o.legalName.trim() } : {}) },
    })
  }
  for (const s of dirtyShops) {
    await prisma.shop.update({ where: { id: s.id }, data: { name: s.name.trim() } })
  }
  console.log(`\nApplied. ${dirtyOrgs.length} org(s), ${dirtyShops.length} shop(s) trimmed.`)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
