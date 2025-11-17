/**
 * Script to reset database and create platform admin user
 * Run with: npx tsx scripts/reset-db-and-create-admin.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { normalizePhone, normalizeCNIC } from '../src/lib/validation'

const prisma = new PrismaClient()

async function resetDatabase() {
  console.log('Resetting database...')

  // Delete all data in correct order to respect foreign key constraints
  await prisma.$transaction([
    // Delete all dependent records first
    prisma.customerLedger.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoiceLine.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.purchaseLine.deleteMany(),
    prisma.purchase.deleteMany(),
    prisma.stockLedger.deleteMany(),
    prisma.product.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.shopSettings.deleteMany(),
    prisma.userShop.deleteMany(),
    prisma.shop.deleteMany(),
    prisma.organizationUser.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.user.deleteMany(),
  ])

  console.log('Database reset complete.')
}

async function createAdminUser() {
  const email = 'hamzamakhdoom786@gmail.com'
  const password = 'Makhdoom@6367'
  const phone = '03067006367'
  const cnic = '38403-0468388-7'
  const name = 'Platform Admin'

  try {
    // Convert Pakistani phone format (0XXXXXXXXXX) to international format (+92XXXXXXXXXX)
    let finalPhone = phone
    if (phone.startsWith('0')) {
      finalPhone = '+92' + phone.substring(1)
    } else if (!phone.startsWith('+92')) {
      finalPhone = '+92' + phone
    }

    // Normalize CNIC
    const normalizedCNIC = normalizeCNIC(cnic)
    if (!normalizedCNIC) {
      throw new Error(`Invalid CNIC format: ${cnic}`)
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { phone: finalPhone },
          { cnic: normalizedCNIC },
        ],
      },
    })

    if (existingUser) {
      console.log(`User already exists with email: ${email}`)
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create admin user
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: finalPhone,
        cnic: normalizedCNIC,
        isWhatsApp: false,
        password: hashedPassword,
        role: 'PLATFORM_ADMIN',
      },
    })

    console.log('Platform admin user created successfully:')
    console.log(`Email: ${user.email}`)
    console.log(`Name: ${user.name}`)
    console.log(`Phone: ${user.phone}`)
    console.log(`CNIC: ${user.cnic}`)
    console.log(`Role: ${user.role}`)
    console.log(`Password: ${password} (please change after first login)`)
  } catch (error) {
    console.error('Error creating admin user:', error)
    throw error
  }
}

async function main() {
  try {
    await resetDatabase()
    await createAdminUser()
    console.log('\nDone!')
  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

