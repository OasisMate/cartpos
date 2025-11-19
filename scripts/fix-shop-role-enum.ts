/**
 * Script to fix ShopRole enum in database
 * Run this if migration hasn't been applied: npx tsx scripts/fix-shop-role-enum.ts
 * 
 * If you get connection errors, try:
 * 1. Check your Supabase dashboard - ensure database is running
 * 2. Use direct connection URL instead of pooler (remove .pooler from hostname)
 * 3. Add connection pool params: ?connection_limit=1&pool_timeout=20
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

// Retry helper
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (i === maxRetries - 1) throw error
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Retry failed')
}

async function main() {
  console.log('Checking ShopRole enum in database...')
  console.log('Note: If connection fails, check your DATABASE_URL in .env')
  console.log('')

  try {
    // Test connection first with retry
    await retry(async () => {
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Database connection successful')
    })

    // Try to query with STORE_MANAGER to see if it exists
    const testQuery = await retry(async () => {
      return await prisma.$queryRaw<Array<{ enumlabel: string }>>`
        SELECT enumlabel 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ShopRole'
        ORDER BY e.enumsortorder;
      `
    })

    console.log('Current enum values:', testQuery.map((e) => e.enumlabel))

    // Check if SHOP_OWNER exists
    const hasShopOwner = await retry(async () => {
      return await prisma.$queryRaw<Array<{ enumlabel: string }>>`
        SELECT enumlabel 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ShopRole'
          AND e.enumlabel = 'SHOP_OWNER';
      `
    })

    if (hasShopOwner.length > 0) {
      console.log('Found SHOP_OWNER enum value. Renaming to STORE_MANAGER...')

      // Rename the enum value
      await retry(async () => {
        await prisma.$executeRaw`
          ALTER TYPE "ShopRole" RENAME VALUE 'SHOP_OWNER' TO 'STORE_MANAGER';
        `
      })

      console.log('✅ Successfully renamed SHOP_OWNER to STORE_MANAGER')
    } else {
      console.log('✅ ShopRole enum already has STORE_MANAGER (or SHOP_OWNER does not exist)')
    }

    // Verify the fix
    const afterQuery = await retry(async () => {
      return await prisma.$queryRaw<Array<{ enumlabel: string }>>`
        SELECT enumlabel 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'ShopRole'
        ORDER BY e.enumsortorder;
      `
    })

    console.log('Enum values after fix:', afterQuery.map((e) => e.enumlabel))
  } catch (error: any) {
    console.error('')
    console.error('❌ Error fixing enum:', error.message)
    console.error('')
    console.error('Troubleshooting:')
    console.error('1. Check your Supabase dashboard - ensure database is running')
    console.error('2. Verify DATABASE_URL in .env file')
    console.error('3. Try using direct connection (remove .pooler from hostname)')
    console.error('4. Add connection params: ?connection_limit=1&pool_timeout=20')
    throw error
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('✅ Script completed successfully')
  })
  .catch(async (e) => {
    console.error('❌ Script failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })

