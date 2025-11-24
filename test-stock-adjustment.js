/**
 * Stock Adjustment API Test Script
 * 
 * Run this in your browser console while logged into the app
 * Make sure you're logged in as a Store Manager with a shop selected
 */

async function testStockAdjustment() {
  console.log('🧪 Testing Stock Adjustment API...\n')

  try {
    // Step 1: Get a product
    console.log('1️⃣ Fetching products...')
    const productsRes = await fetch('/api/products?limit=5')
    const productsData = await productsRes.json()
    
    if (!productsData.products || productsData.products.length === 0) {
      console.error('❌ No products found. Please create a product first.')
      return
    }

    const product = productsData.products[0]
    console.log('✅ Product found:', product.name, '(ID:', product.id + ')')

    // Step 2: Get current stock
    console.log('\n2️⃣ Fetching current stock...')
    const stockRes = await fetch(`/api/stock?productId=${product.id}`)
    const stockData = await stockRes.json()
    const currentStock = stockData.stock || 0
    console.log('✅ Current stock:', currentStock)

    // Step 3: Add stock via adjustment
    console.log('\n3️⃣ Creating stock adjustment (adding 10 units)...')
    const addRes = await fetch('/api/stock-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: 10,
        notes: 'Test addition - API test'
      })
    })

    if (!addRes.ok) {
      const error = await addRes.json()
      console.error('❌ Add adjustment failed:', error)
      return
    }

    const addResult = await addRes.json()
    console.log('✅ Stock added successfully!')
    console.log('   Previous stock:', addResult.previousStock)
    console.log('   New stock:', addResult.newStock)
    console.log('   Change:', addResult.newStock - addResult.previousStock)

    // Step 4: Reduce stock via adjustment
    console.log('\n4️⃣ Creating stock adjustment (reducing 3 units - damage)...')
    const reduceRes = await fetch('/api/stock-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        type: 'DAMAGE',
        quantity: -3,
        notes: 'Test damage - API test'
      })
    })

    if (!reduceRes.ok) {
      const error = await reduceRes.json()
      console.error('❌ Reduce adjustment failed:', error)
      return
    }

    const reduceResult = await reduceRes.json()
    console.log('✅ Stock reduced successfully!')
    console.log('   Previous stock:', reduceResult.previousStock)
    console.log('   New stock:', reduceResult.newStock)
    console.log('   Change:', reduceResult.newStock - reduceResult.previousStock)

    // Step 5: List adjustments
    console.log('\n5️⃣ Fetching adjustment history...')
    const listRes = await fetch(`/api/stock-adjustments?productId=${product.id}&limit=10`)
    const listData = await listRes.json()
    
    console.log('✅ Adjustments found:', listData.adjustments.length)
    console.log('\n📋 Adjustment History:')
    listData.adjustments.forEach((adj, idx) => {
      const change = parseFloat(adj.changeQty)
      const sign = change > 0 ? '+' : ''
      console.log(`   ${idx + 1}. ${adj.type}: ${sign}${change} units - ${adj.notes || 'No notes'}`)
      console.log(`      Date: ${new Date(adj.createdAt).toLocaleString()}`)
    })

    // Step 6: Verify final stock
    console.log('\n6️⃣ Verifying final stock...')
    const finalStockRes = await fetch(`/api/stock?productId=${product.id}`)
    const finalStockData = await finalStockRes.json()
    console.log('✅ Final stock:', finalStockData.stock)
    console.log('   Expected:', currentStock + 10 - 3)
    console.log('   Match:', finalStockData.stock === currentStock + 10 - 3 ? '✅' : '❌')

    console.log('\n🎉 All tests passed! Stock adjustment API is working correctly.')

  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('Make sure you are:')
    console.error('  1. Logged in as a Store Manager')
    console.error('  2. Have a shop selected')
    console.error('  3. Have at least one product in your shop')
  }
}

// Run the test
testStockAdjustment()

