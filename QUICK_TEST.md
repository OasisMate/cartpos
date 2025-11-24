# Quick Backend Testing Guide

## Step 1: Check if Migration is Applied

### Option A: Using Node Script (Recommended)
```bash
node scripts/check-migration.js
```

### Option B: Direct SQL Check
Go to your Supabase dashboard → SQL Editor and run:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ShopSettings' 
AND column_name = 'allowNegativeStock';
```

If you see `allowNegativeStock` in results → ✅ Migration applied
If empty → ❌ Need to apply migration

### Option C: Check via Prisma Studio
```bash
npx prisma studio
```
Then navigate to ShopSettings table and see if `allowNegativeStock` column exists.

---

## Step 2: Apply Migration (if needed)

### Option A: Manual SQL (Fastest - Recommended)
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the SQL from `scripts/apply-migration-manual.sql`
3. Run it

### Option B: Prisma DB Push (Alternative)
```bash
npx prisma db push --skip-generate
```

### Option C: Create Migration File Manually
1. Create folder: `prisma/migrations/[timestamp]_add_allow_negative_stock/migration.sql`
2. Add SQL from `scripts/apply-migration-manual.sql`
3. Run: `npx prisma migrate resolve --applied [timestamp]_add_allow_negative_stock`

---

## Step 3: Test Backend APIs

### Test 1: Stock Adjustments

**In Browser Console (on your app):**

```javascript
// 1. Get a product ID
const products = await fetch('/api/products?limit=1').then(r => r.json());
const productId = products.products[0].id;
console.log('Product ID:', productId);

// 2. Get current stock
const stock = await fetch(`/api/stock?productId=${productId}`).then(r => r.json());
console.log('Current Stock:', stock.stock);

// 3. Add stock via adjustment
const addResult = await fetch('/api/stock-adjustments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: productId,
    type: 'ADJUSTMENT',
    quantity: 10,
    notes: 'Test addition'
  })
}).then(r => r.json());
console.log('Add Result:', addResult);

// 4. Reduce stock via adjustment
const reduceResult = await fetch('/api/stock-adjustments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: productId,
    type: 'DAMAGE',
    quantity: -3,
    notes: 'Test damage'
  })
}).then(r => r.json());
console.log('Reduce Result:', reduceResult);

// 5. List adjustments
const list = await fetch(`/api/stock-adjustments?productId=${productId}`).then(r => r.json());
console.log('Adjustments:', list);
```

### Test 2: Negative Stock Handling

```javascript
// 1. Update shop settings to block negative stock
// (Do this via SQL or wait for settings UI)
// UPDATE "ShopSettings" SET "allowNegativeStock" = false WHERE "shopId" = 'YOUR_SHOP_ID';

// 2. Try to sell more than available
const saleResult = await fetch('/api/sales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{
      productId: productId,
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
}).then(r => r.json());

console.log('Sale Result:', saleResult);
// If allowNegativeStock = false: Should see error
// If allowNegativeStock = true: Should see invoice + stockWarnings
```

---

## Quick Verification Checklist

- [ ] Migration applied (column exists in database)
- [ ] `npx prisma generate` run (to update Prisma client)
- [ ] Dev server restarted
- [ ] Stock adjustment API works
- [ ] Negative stock handling works based on setting

---

## Troubleshooting

**If Prisma commands hang:**
- Use manual SQL approach (Option A in Step 2)
- Check database connection in `.env`
- Try direct SQL in Supabase dashboard

**If API returns errors:**
- Check browser console for full error
- Verify you're logged in
- Check network tab for actual request/response

**If migration already applied:**
- Just run: `npx prisma generate`
- Restart dev server


