# Backend Testing Guide

## Prerequisites

1. **Run Database Migration**
   ```bash
   npx prisma migrate dev --name add_allow_negative_stock_setting
   npx prisma generate
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Login and get session cookie** (needed for API calls)

---

## Test 1: Stock Adjustments API

### Create Stock Adjustment

**Endpoint:** `POST /api/stock-adjustments`

**Request Body:**
```json
{
  "productId": "YOUR_PRODUCT_ID",
  "type": "ADJUSTMENT",
  "quantity": -5,
  "notes": "Manual correction",
  "date": "2024-01-15T10:00:00Z"
}
```

**Types Available:**
- `ADJUSTMENT` - General adjustment
- `DAMAGE` - Damaged items
- `EXPIRY` - Expired items
- `RETURN` - Customer returns
- `SELF_USE` - Self consumption

**Test Cases:**
1. ✅ Add stock (positive quantity): `"quantity": 10`
2. ✅ Reduce stock (negative quantity): `"quantity": -5`
3. ❌ Zero quantity should fail: `"quantity": 0`
4. ❌ Non-existent product should fail
5. ❌ Product with trackStock=false should fail

**Expected Response (201):**
```json
{
  "stockLedger": { ... },
  "product": { ... },
  "previousStock": 15,
  "newStock": 10
}
```

### List Stock Adjustments

**Endpoint:** `GET /api/stock-adjustments?productId=XXX&type=DAMAGE&page=1&limit=50`

**Query Parameters:**
- `productId` (optional) - Filter by product
- `type` (optional) - Filter by type
- `startDate` (optional) - Filter from date
- `endDate` (optional) - Filter to date
- `page` (optional) - Page number
- `limit` (optional) - Items per page

**Expected Response (200):**
```json
{
  "adjustments": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "totalPages": 1
  }
}
```

---

## Test 2: Negative Stock Handling

### Setup: Configure Shop Settings

First, update shop settings to test both scenarios:

**Option A: Allow Negative Stock (Default)**
```sql
UPDATE "ShopSettings" 
SET "allowNegativeStock" = true 
WHERE "shopId" = 'YOUR_SHOP_ID';
```

**Option B: Block Negative Stock**
```sql
UPDATE "ShopSettings" 
SET "allowNegativeStock" = false 
WHERE "shopId" = 'YOUR_SHOP_ID';
```

### Test Sale with Insufficient Stock

**Endpoint:** `POST /api/sales`

**Request Body:**
```json
{
  "items": [
    {
      "productId": "PRODUCT_ID_WITH_LOW_STOCK",
      "quantity": 100,
      "unitPrice": 10,
      "lineTotal": 1000
    }
  ],
  "subtotal": 1000,
  "discount": 0,
  "total": 1000,
  "paymentStatus": "PAID",
  "paymentMethod": "CASH",
  "amountReceived": 1000
}
```

**Test Cases:**

1. **allowNegativeStock = false**
   - Product stock: 5, Sale quantity: 100
   - **Expected:** ❌ Error 400: "Insufficient stock... Negative stock is not allowed"

2. **allowNegativeStock = true**
   - Product stock: 5, Sale quantity: 100
   - **Expected:** ✅ Success (201) with warnings:
   ```json
   {
     "invoice": { ... },
     "stockWarnings": [
       {
         "productName": "Product Name",
         "available": 5,
         "requested": 100
       }
     ]
   }
   ```

3. **trackStock = false**
   - Should bypass stock check completely
   - **Expected:** ✅ Success, no warnings

---

## Test 3: Carton Handling (Already Working)

### Purchase with Carton

**Endpoint:** `POST /api/purchases`

**Request Body:**
```json
{
  "supplierId": "SUPPLIER_ID",
  "lines": [
    {
      "productId": "PRODUCT_WITH_CARTON_SIZE_12",
      "quantity": 2,
      "unit": "carton",
      "unitCost": 100
    }
  ]
}
```

**Expected:**
- If cartonSize = 12, quantity = 2 cartons
- Stock should increase by: 2 × 12 = 24 pieces

### POS Carton Barcode Scan

**Test:**
1. Scan carton barcode in POS
2. Should add `cartonSize` quantity to cart
3. Should show message: "Added carton of X units"

---

## Manual Testing via Browser Console

### 1. Get Your Shop ID and Product ID

Open browser console on your app and run:
```javascript
// Get current shop ID (from cookies/localStorage)
const shopId = 'YOUR_SHOP_ID'; // Get from your app state

// Get a product ID
fetch('/api/products?limit=1')
  .then(r => r.json())
  .then(data => {
    console.log('Product ID:', data.products[0].id);
    console.log('Product:', data.products[0]);
  });
```

### 2. Test Stock Adjustment

```javascript
const productId = 'YOUR_PRODUCT_ID';

// Add stock
fetch('/api/stock-adjustments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: productId,
    type: 'ADJUSTMENT',
    quantity: 10,
    notes: 'Test addition'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Adjustment Result:', data);
  console.log('Previous Stock:', data.previousStock);
  console.log('New Stock:', data.newStock);
});

// Reduce stock
fetch('/api/stock-adjustments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: productId,
    type: 'DAMAGE',
    quantity: -5,
    notes: 'Test damage'
  })
})
.then(r => r.json())
.then(data => console.log('Damage Result:', data));
```

### 3. Test Negative Stock Sale

```javascript
// First, check current stock
fetch('/api/stock?productId=YOUR_PRODUCT_ID')
  .then(r => r.json())
  .then(data => console.log('Current Stock:', data.stock));

// Try to sell more than available
fetch('/api/sales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{
      productId: 'YOUR_PRODUCT_ID',
      quantity: 1000, // More than available
      unitPrice: 10,
      lineTotal: 10000
    }],
    subtotal: 10000,
    discount: 0,
    total: 10000,
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    amountReceived: 10000
  })
})
.then(r => r.json())
.then(data => {
  if (r.ok) {
    console.log('Sale successful');
    console.log('Warnings:', data.stockWarnings);
  } else {
    console.log('Sale blocked:', data.error);
  }
});
```

---

## Quick Test Checklist

- [ ] Migration ran successfully
- [ ] Stock adjustment API creates entries
- [ ] Stock adjustment API lists entries
- [ ] Negative stock blocked when setting = false
- [ ] Negative stock allowed with warnings when setting = true
- [ ] trackStock=false products bypass stock check
- [ ] Carton purchases multiply correctly
- [ ] Carton barcode scanning works in POS

---

## Troubleshooting

**Migration fails:**
- Check database connection
- Ensure Prisma schema is correct
- Try: `npx prisma db push` (for development only)

**API returns 401/403:**
- Ensure you're logged in
- Check session cookie is valid
- Verify user has Store Manager role

**Stock not updating:**
- Check StockLedger entries: `SELECT * FROM "StockLedger" WHERE "productId" = 'XXX'`
- Verify product has `trackStock = true`


