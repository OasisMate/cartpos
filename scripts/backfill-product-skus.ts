import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Generate a random SKU
 * Format: SKU-XXXXXX where X is alphanumeric
 */
function generateRandomSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomPart = Array.from({ length: 6 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
  return `SKU-${randomPart}`
}

/**
 * Generate a unique SKU for a shop
 * Retries up to 10 times if generated SKU already exists
 */
async function generateUniqueSKU(shopId: string, existingSKUs: Set<string>): Promise<string> {
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const sku = generateRandomSKU()
    
    // Check if SKU already exists in our set or in the database
    if (!existingSKUs.has(sku)) {
      const existing = await prisma.product.findFirst({
        where: {
          shopId,
          sku,
        },
      })

      if (!existing) {
        return sku
      }
    }

    attempts++
  }

  // If we couldn't generate a unique SKU after max attempts, use timestamp-based fallback
  const timestamp = Date.now().toString(36).toUpperCase()
  return `SKU-${timestamp}`
}

async function main() {
  console.log('Starting SKU backfill migration...')

  // Get all shops
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true },
  })

  console.log(`Found ${shops.length} shops`)

  let totalUpdated = 0

  for (const shop of shops) {
    console.log(`\nProcessing shop: ${shop.name} (${shop.id})`)

    // Get all products without SKU for this shop
    const productsWithoutSKU = await prisma.product.findMany({
      where: {
        shopId: shop.id,
        OR: [
          { sku: null },
          { sku: '' },
        ],
      },
      select: { id: true, name: true },
    })

    if (productsWithoutSKU.length === 0) {
      console.log(`  No products need SKU generation`)
      continue
    }

    console.log(`  Found ${productsWithoutSKU.length} products without SKU`)

    // Get all existing SKUs for this shop to avoid duplicates
    const existingProducts = await prisma.product.findMany({
      where: {
        shopId: shop.id,
        sku: { not: null },
      },
      select: { sku: true },
    })

    const existingSKUs = new Set(
      existingProducts
        .map(p => p.sku)
        .filter((sku): sku is string => sku !== null)
    )

    // Generate and assign SKUs
    let shopUpdated = 0
    for (const product of productsWithoutSKU) {
      const newSKU = await generateUniqueSKU(shop.id, existingSKUs)
      existingSKUs.add(newSKU)

      await prisma.product.update({
        where: { id: product.id },
        data: { sku: newSKU },
      })

      shopUpdated++
      if (shopUpdated % 10 === 0) {
        console.log(`    Updated ${shopUpdated}/${productsWithoutSKU.length} products...`)
      }
    }

    console.log(`  ✓ Generated SKUs for ${shopUpdated} products`)
    totalUpdated += shopUpdated
  }

  console.log(`\n✅ Migration complete!`)
  console.log(`   Total products updated: ${totalUpdated}`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

