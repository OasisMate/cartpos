/**
 * Set the payment details shops see on /billing.
 *
 * The same thing /admin/billing-settings does, from the command line, for
 * first-time setup before the admin UI has been clicked through.
 *
 * Only writes the flags you pass, so it can be run repeatedly to fill in one
 * field at a time. Reports what is still empty.
 *
 * Run: npx tsx scripts/set-billing-settings.ts --raast=03001234567 --title="Your Name"
 *      npx tsx scripts/set-billing-settings.ts            (show current values)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FLAGS: Record<string, string> = {
  raast: 'raastId',
  title: 'accountTitle',
  jazzcash: 'jazzcashNumber',
  easypaisa: 'easypaisaNumber',
  whatsapp: 'whatsappNumber',
  email: 'supportEmail',
  bank: 'bankName',
  account: 'accountNumber',
  iban: 'iban',
  instructions: 'instructions',
}

async function main() {
  const data: Record<string, string | null> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-z]+)=(.*)$/)
    if (!m) continue
    const column = FLAGS[m[1]]
    if (!column) {
      console.error(`Unknown flag --${m[1]}. Known: ${Object.keys(FLAGS).join(', ')}`)
      process.exit(1)
    }
    data[column] = m[2].trim() || null
  }

  if (Object.keys(data).length > 0) {
    await prisma.billingSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })
    console.log(`updated: ${Object.keys(data).join(', ')}\n`)
  }

  const s = await prisma.billingSettings.findUnique({ where: { id: 'default' } })
  console.log('WHAT SHOPS WILL SEE ON /billing')
  const rows: Array<[string, string | null | undefined]> = [
    ['Raast ID', s?.raastId],
    ['Account title', s?.accountTitle],
    ['JazzCash', s?.jazzcashNumber],
    ['Easypaisa', s?.easypaisaNumber],
    ['Bank', s?.bankName],
    ['Account number', s?.accountNumber],
    ['IBAN', s?.iban],
  ]
  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(16)} ${value || '(hidden, not set)'}`)
  }
  console.log('\nCONTACT')
  console.log(`  WhatsApp         ${s?.whatsappNumber || '(no WhatsApp button will show)'}`)
  console.log(`  Support email    ${s?.supportEmail || '(no email button will show)'}`)
  console.log(`  Instructions     ${s?.instructions || '(none)'}`)

  // Can a shop actually pay us right now?
  const payable = Boolean(s?.raastId || s?.jazzcashNumber || s?.easypaisaNumber || s?.accountNumber)
  console.log(
    payable
      ? '\nPAYABLE: shops have at least one way to send money.'
      : '\nNOT PAYABLE: /billing will say payment details are not set up yet.'
  )
  if (s?.raastId && !s?.accountTitle) {
    console.log(
      'NOTE: no account title. Raast shows the payer a name before they confirm; without it here they cannot check it matches.'
    )
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
