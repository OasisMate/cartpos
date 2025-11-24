/**
 * Quick script to check if allowNegativeStock column exists
 * Run: node scripts/check-migration.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMigration() {
  try {
    console.log('Checking database schema...\n');
    
    // Try to query ShopSettings with allowNegativeStock
    const settings = await prisma.shopSettings.findFirst({
      select: {
        id: true,
        shopId: true,
        allowNegativeStock: true,
      },
    });

    if (settings && 'allowNegativeStock' in settings) {
      console.log('✅ Migration SUCCESSFUL!');
      console.log('✅ allowNegativeStock column exists\n');
      console.log('Sample settings:', settings);
    } else {
      console.log('❌ Migration NOT APPLIED');
      console.log('❌ allowNegativeStock column does not exist\n');
      console.log('You need to run the migration.');
    }
  } catch (error) {
    if (error.message.includes('Unknown column') || error.message.includes('does not exist')) {
      console.log('❌ Migration NOT APPLIED');
      console.log('❌ allowNegativeStock column does not exist\n');
      console.log('Error:', error.message);
    } else {
      console.log('❌ Error checking migration:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkMigration();


