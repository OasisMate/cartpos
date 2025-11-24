/**
 * Backend Testing Script
 * 
 * Usage:
 * 1. Start your dev server: npm run dev
 * 2. Login to your app and copy your session cookie
 * 3. Update the variables below
 * 4. Run: node scripts/test-backend.js
 */

const BASE_URL = 'http://localhost:3000';
const SESSION_COOKIE = 'YOUR_SESSION_COOKIE_HERE'; // Get from browser cookies
const SHOP_ID = 'YOUR_SHOP_ID'; // Get from app state
const PRODUCT_ID = 'YOUR_PRODUCT_ID'; // Get from products list

async function testAPI(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session=${SESSION_COOKIE}`,
      ...options.headers,
    },
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('🧪 Starting Backend Tests...\n');

  // Test 1: List Products (to get a product ID)
  console.log('1️⃣ Testing: List Products');
  const productsResult = await testAPI('/api/products?limit=1');
  if (productsResult.status === 200 && productsResult.data.products?.length > 0) {
    const testProductId = productsResult.data.products[0].id;
    console.log(`✅ Found product: ${testProductId}\n`);

    // Test 2: Get Current Stock
    console.log('2️⃣ Testing: Get Current Stock');
    const stockResult = await testAPI(`/api/stock?productId=${testProductId}`);
    if (stockResult.status === 200) {
      console.log(`✅ Current Stock: ${stockResult.data.stock}\n`);
    }

    // Test 3: Create Stock Adjustment (Add Stock)
    console.log('3️⃣ Testing: Create Stock Adjustment (Add)');
    const addAdjustment = await testAPI('/api/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        productId: testProductId,
        type: 'ADJUSTMENT',
        quantity: 10,
        notes: 'Test addition',
      }),
    });
    if (addAdjustment.status === 201) {
      console.log(`✅ Stock Added: ${addAdjustment.data.previousStock} → ${addAdjustment.data.newStock}\n`);
    } else {
      console.log(`❌ Failed: ${addAdjustment.data.error}\n`);
    }

    // Test 4: Create Stock Adjustment (Reduce Stock)
    console.log('4️⃣ Testing: Create Stock Adjustment (Reduce)');
    const reduceAdjustment = await testAPI('/api/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        productId: testProductId,
        type: 'DAMAGE',
        quantity: -3,
        notes: 'Test damage',
      }),
    });
    if (reduceAdjustment.status === 201) {
      console.log(`✅ Stock Reduced: ${reduceAdjustment.data.previousStock} → ${reduceAdjustment.data.newStock}\n`);
    } else {
      console.log(`❌ Failed: ${reduceAdjustment.data.error}\n`);
    }

    // Test 5: List Stock Adjustments
    console.log('5️⃣ Testing: List Stock Adjustments');
    const listAdjustments = await testAPI(`/api/stock-adjustments?productId=${testProductId}`);
    if (listAdjustments.status === 200) {
      console.log(`✅ Found ${listAdjustments.data.adjustments.length} adjustments\n`);
    }

    // Test 6: Test Negative Stock (if product tracks stock)
    console.log('6️⃣ Testing: Negative Stock Handling');
    const currentStock = stockResult.data.stock + 10 - 3; // After adjustments
    if (currentStock > 0) {
      const saleResult = await testAPI('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: [{
            productId: testProductId,
            quantity: currentStock + 100, // More than available
            unitPrice: 10,
            lineTotal: (currentStock + 100) * 10,
          }],
          subtotal: (currentStock + 100) * 10,
          discount: 0,
          total: (currentStock + 100) * 10,
          paymentStatus: 'PAID',
          paymentMethod: 'CASH',
          amountReceived: (currentStock + 100) * 10,
        }),
      });

      if (saleResult.status === 201) {
        console.log('✅ Sale completed (negative stock allowed)');
        if (saleResult.data.stockWarnings) {
          console.log(`⚠️  Warnings: ${JSON.stringify(saleResult.data.stockWarnings)}\n`);
        }
      } else if (saleResult.status === 400) {
        console.log(`✅ Sale blocked (negative stock not allowed): ${saleResult.data.error}\n`);
      } else {
        console.log(`❌ Unexpected result: ${saleResult.status} - ${JSON.stringify(saleResult.data)}\n`);
      }
    }
  } else {
    console.log('❌ Could not fetch products. Check authentication.\n');
  }

  console.log('✅ Tests Complete!');
}

// Run tests
runTests().catch(console.error);


