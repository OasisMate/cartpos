# Store Manager Flow - Complete Guide

## Quick Overview

**Store Manager** = Full access to one store. Can manage products, inventory, purchases, sales, customers, suppliers, reports.

---

## 1. PRODUCT MANAGEMENT

### Adding Products (`/store/products`)

**Required Fields:**
- **Name**: Product name (e.g., "Coca Cola 1.5L")
- **Unit**: Measurement unit (pcs, kg, L, etc.) - can be custom
- **Price**: Selling price (required)

**Optional Fields:**
- **SKU**: Stock Keeping Unit - internal product code (e.g., "COKE-1.5L-001")
  - Purpose: Internal reference, search, organization
  - Not unique - multiple products can have same SKU
  - Used for: Searching, filtering, reports
- **Barcode**: Scannable code (e.g., "8901030865379")
  - Must be unique per shop
  - Used for: POS scanning, quick lookup
  - Can be manufacturer barcode or internal generated
- **Cost Price**: Purchase cost (for profit calculation)
- **Category**: Product grouping (e.g., "Beverages", "Snacks")
- **Track Stock**: Enable/disable stock tracking (default: true)
- **Reorder Level**: Alert when stock falls below this number

**How It Works:**
1. Click "Add Product" → Form opens
2. Fill required fields (name, unit, price)
3. Optional: Add SKU, barcode, cost price, category
4. Save → Product created in database
5. If `trackStock=true`, stock starts at 0 (add via Purchase)

---

## 2. INVENTORY MANAGEMENT

### Stock System (StockLedger)

**How Stock Works:**
- Stock = Sum of all `StockLedger.changeQty` entries for a product
- No direct stock field - calculated from ledger
- Ledger entries track every stock movement

**Stock Movement Types:**
- **PURCHASE**: +quantity (adds stock)
- **SALE**: -quantity (reduces stock)
- **ADJUSTMENT**: Manual correction (+ or -)
- **DAMAGE**: -quantity (damaged items)
- **EXPIRY**: -quantity (expired items)
- **RETURN**: +quantity (customer returns)

**Adding Stock (Purchases):**
1. Go to `/store/purchases` → "New Purchase"
2. Select supplier (optional)
3. Add products with quantities
4. Save → Creates:
   - Purchase record
   - PurchaseLine entries
   - StockLedger entries (PURCHASE type, +quantity)
   - Updates product costPrice if provided

**Current Stock Calculation:**
```typescript
stock = sum(StockLedger.changeQty) where productId = X
```

---

## 3. COMPLETE STORE MANAGER FLOW

### A. Setup Phase
1. **Add Suppliers** (`/store/suppliers`)
   - Name, phone, notes
   - Used when creating purchases

2. **Add Products** (`/store/products`)
   - Create product catalog
   - Set prices, units, categories
   - Add SKU/barcode for easy lookup

3. **Add Customers** (`/store/customers`)
   - For udhaar (credit) sales
   - Name, phone required

### B. Daily Operations

**Stock In (Purchases):**
1. `/store/purchases` → New Purchase
2. Select supplier
3. Add products + quantities
4. Save → Stock increases automatically

**Sales (POS):**
1. `/store/pos` → Scan barcode or search product
2. Add to cart, set quantity
3. Apply discount (optional)
4. Select payment: Cash/Card/Other or Udhaar
5. Complete → Creates:
   - Invoice
   - InvoiceLine entries
   - StockLedger entries (SALE, -quantity)
   - Payment record (if paid)
   - CustomerLedger entry (if udhaar)

**Stock Adjustments:**
- Manual corrections for discrepancies
- Damage/expiry tracking
- Returns processing

### C. Monitoring

**Dashboard** (`/store`):
- Today's invoices count
- Today's payments total
- Today's udhaar created
- Low stock items count

**Reports** (`/store/reports`):
- Sales reports
- Stock reports
- Profit analysis (if costPrice set)

---

## 4. KEY CONCEPTS

### SKU vs Barcode

**SKU (Stock Keeping Unit):**
- Internal reference code
- Not unique (can repeat)
- Purpose: Organization, search, reports
- Example: "COKE-1.5L-001", "SNACKS-CHIPS-001"

**Barcode:**
- Scannable identifier
- Must be unique per shop
- Purpose: Quick POS lookup, scanning
- Can be: Manufacturer barcode OR internal generated

**When to Use:**
- SKU: Internal organization, reports, manual entry
- Barcode: POS scanning, quick lookup

### Stock Tracking

**trackStock = true:**
- Stock calculated from StockLedger
- Sales reduce stock
- Purchases add stock
- Can set reorderLevel for alerts

**trackStock = false:**
- No stock tracking
- Used for: Services, unlimited items, non-inventory items
- Sales don't affect stock

### Cost Price vs Selling Price

**Cost Price:**
- What you paid for the product
- Used for: Profit calculation, margin analysis
- Optional field

**Selling Price:**
- What customer pays
- Required field
- Used in: POS, invoices

**Profit = Selling Price - Cost Price** (if both set)

---

## 5. PERMISSIONS

**Store Manager Can:**
- ✅ Create/edit/delete products
- ✅ Create purchases (add stock)
- ✅ View all sales
- ✅ Manage customers
- ✅ Manage suppliers
- ✅ View reports
- ✅ Access POS
- ✅ Record udhaar payments

**Store Manager Cannot:**
- ❌ Access organization-level features
- ❌ Manage other stores
- ❌ Manage organization users

---

## 6. DATA FLOW

**Product Creation:**
```
Form → API → Domain Layer → Prisma → Database
```

**Purchase Flow:**
```
Purchase Form → API → createPurchase()
  → Transaction:
    1. Create Purchase
    2. Create PurchaseLines
    3. Create StockLedger entries (+qty)
    4. Update Product costPrice
```

**Sale Flow:**
```
POS → API → createSale()
  → Transaction:
    1. Create Invoice
    2. Create InvoiceLines
    3. Create StockLedger entries (-qty)
    4. Create Payment (if paid)
    5. Create CustomerLedger (if udhaar)
```

---

## 7. BEST PRACTICES CHECKLIST

### Current Implementation Status

✅ **Product Management:**
- CRUD operations working
- Permission checks in place
- Barcode uniqueness enforced
- Search by name/SKU/barcode

✅ **Stock Management:**
- Ledger-based system (accurate)
- Automatic stock updates on purchase/sale
- Stock calculation function exists

✅ **Purchases:**
- Can add stock via purchases
- Supplier linking
- Cost price updates

✅ **Sales:**
- POS functional
- Stock reduction on sale
- Payment tracking
- Udhaar support

⚠️ **Potential Issues to Review:**
- Stock display in product list (needs verification)
- Stock adjustment UI (manual corrections)
- Low stock alerts (dashboard shows count, but alert system?)
- Carton/packing fields (cartonSize, cartonBarcode) - not fully implemented

---

## 8. QUESTIONS ANSWERED

**Q: What is SKU?**
A: Internal product code for organization/search. Not unique, optional.

**Q: How is inventory added?**
A: Via Purchases → Creates StockLedger entries → Stock increases.

**Q: How is stock calculated?**
A: Sum of all StockLedger.changeQty entries for that product.

**Q: Can I sell without stock?**
A: Yes, if trackStock=false. If trackStock=true, stock can go negative (no validation currently).

**Q: How do I add initial stock?**
A: Create a Purchase with the products and quantities.

**Q: What's the difference between SKU and barcode?**
A: SKU = internal code (not unique). Barcode = scannable code (unique per shop).

---

## 9. PRODUCTION READINESS CHECKLIST

**Critical for Store Manager:**
- [ ] Verify stock display in product list
- [ ] Test purchase flow end-to-end
- [ ] Test sale flow with stock reduction
- [ ] Verify low stock alerts work
- [ ] Test barcode scanning in POS
- [ ] Verify SKU search works
- [ ] Test offline functionality (if applicable)
- [ ] Verify permission checks on all routes
- [ ] Test error handling (duplicate barcode, etc.)
- [ ] Verify translations work on all pages


