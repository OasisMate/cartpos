const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function clearSales() {
  try {
    console.log('Clearing sales data from Supabase...')
    
    // TRUNCATE CASCADE will delete all related records
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Invoice" CASCADE;')
    
    console.log('✓ Sales data cleared from Supabase database')
    
    // Clear IndexedDB (local database)
    console.log('\nTo clear local IndexedDB sales:')
    console.log('1. Open the app in your browser')
    console.log('2. Open DevTools (F12)')
    console.log('3. Go to Application > IndexedDB > CartPOS_DB')
    console.log('4. Right-click on "sales" store and delete all records')
    console.log('   OR run this in the browser console:')
    console.log('   indexedDB.deleteDatabase("CartPOS_DB")')
    
  } catch (error) {
    console.error('Error clearing sales:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clearSales()

