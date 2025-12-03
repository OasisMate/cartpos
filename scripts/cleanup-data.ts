/**
 * Cleanup script to remove sales, purchases, and products
 * while keeping users and organizations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupData() {
  console.log('Starting data cleanup...')
  
  try {
    // Delete in correct order (respecting foreign key constraints)
    
    // 1. Delete all invoice lines (dependencies of invoices)
    console.log('Deleting invoice lines...')
    const invoiceLinesDeleted = await prisma.invoiceLine.deleteMany({})
    console.log(`Deleted ${invoiceLinesDeleted.count} invoice lines`)
    
    // 2. Delete all payments
    console.log('Deleting payments...')
    const paymentsDeleted = await prisma.payment.deleteMany({})
    console.log(`Deleted ${paymentsDeleted.count} payments`)
    
    // 3. Delete all invoices (sales)
    console.log('Deleting invoices (sales)...')
    const invoicesDeleted = await prisma.invoice.deleteMany({})
    console.log(`Deleted ${invoicesDeleted.count} invoices`)
    
    // 4. Delete all purchase lines
    console.log('Deleting purchase lines...')
    const purchaseLinesDeleted = await prisma.purchaseLine.deleteMany({})
    console.log(`Deleted ${purchaseLinesDeleted.count} purchase lines`)
    
    // 5. Delete all purchases
    console.log('Deleting purchases...')
    const purchasesDeleted = await prisma.purchase.deleteMany({})
    console.log(`Deleted ${purchasesDeleted.count} purchases`)
    
    // 6. Delete all stock ledger entries
    console.log('Deleting stock ledger entries...')
    const stockLedgerDeleted = await prisma.stockLedger.deleteMany({})
    console.log(`Deleted ${stockLedgerDeleted.count} stock ledger entries`)
    
    // 7. Delete all customer ledger entries
    console.log('Deleting customer ledger entries...')
    const customerLedgerDeleted = await prisma.customerLedger.deleteMany({})
    console.log(`Deleted ${customerLedgerDeleted.count} customer ledger entries`)
    
    // 8. Delete all expenses
    console.log('Deleting expenses...')
    const expensesDeleted = await prisma.expense.deleteMany({})
    console.log(`Deleted ${expensesDeleted.count} expenses`)
    
    // 9. Delete all activity logs
    console.log('Deleting activity logs...')
    const activityLogsDeleted = await prisma.activityLog.deleteMany({})
    console.log(`Deleted ${activityLogsDeleted.count} activity logs`)
    
    // 10. Delete all products
    console.log('Deleting products...')
    const productsDeleted = await prisma.product.deleteMany({})
    console.log(`Deleted ${productsDeleted.count} products`)
    
    // 11. Delete all suppliers
    console.log('Deleting suppliers...')
    const suppliersDeleted = await prisma.supplier.deleteMany({})
    console.log(`Deleted ${suppliersDeleted.count} suppliers`)
    
    // 12. Delete all customers
    console.log('Deleting customers...')
    const customersDeleted = await prisma.customer.deleteMany({})
    console.log(`Deleted ${customersDeleted.count} customers`)
    
    console.log('\n✅ Data cleanup completed successfully!')
    console.log('\nKept:')
    console.log('  - Users')
    console.log('  - Organizations')
    console.log('  - Shops')
    console.log('  - Shop Settings')
    console.log('  - User-Organization relationships')
    console.log('  - User-Shop relationships')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanupData()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })


