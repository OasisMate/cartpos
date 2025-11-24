# Store Manager - Quick Reference

## What is SKU?
**SKU (Stock Keeping Unit)** = Internal product code for your reference
- **Not unique** - can repeat across products
- **Purpose**: Organization, search, reports
- **Example**: "COKE-1.5L-001", "SNACKS-CHIPS-001"
- **Optional** - not required

## What is Barcode?
**Barcode** = Scannable product identifier
- **Must be unique** per shop
- **Purpose**: POS scanning, quick lookup
- **Can be**: Manufacturer barcode OR your own generated code
- **Optional** - but recommended for POS

## How Inventory Works

### Stock Calculation
- **Stock = Sum of all StockLedger entries** for that product
- No direct "stock" field - calculated from ledger
- Every purchase/sale/adjustment creates a ledger entry

### Adding Stock
1. Go to **Purchases** → "New Purchase"
2. Select supplier (optional)
3. Add products + quantities
4. Save → Stock automatically increases

### Stock Tracking
- **trackStock = true**: Stock is tracked, sales reduce stock
- **trackStock = false**: No stock tracking (services, unlimited items)

## Complete Flow

### 1. Setup (One-time)
- Add **Suppliers** (`/store/suppliers`)
- Add **Products** (`/store/products`)
- Add **Customers** (`/store/customers`) - for udhaar

### 2. Daily Operations

**Stock In:**
- Purchases → New Purchase → Add products → Save

**Sales:**
- POS → Scan/search product → Add to cart → Complete sale
- Stock automatically decreases

**Stock Display:**
- Products list now shows current stock
- Red = Out of stock
- Orange = Low stock (below reorder level)
- Green = Normal stock

### 3. Monitoring
- **Dashboard**: Today's sales, payments, udhaar, low stock count
- **Reports**: Sales, stock, profit analysis

## Key Concepts

**Cost Price vs Selling Price:**
- **Cost Price**: What you paid (optional, for profit calculation)
- **Selling Price**: What customer pays (required)

**Profit = Selling Price - Cost Price** (if both set)

**Reorder Level:**
- Alert threshold for low stock
- Set in product form
- Dashboard shows count of low stock items

## Permissions

**Store Manager Can:**
- ✅ Create/edit products
- ✅ Create purchases (add stock)
- ✅ View all sales
- ✅ Manage customers/suppliers
- ✅ Access POS
- ✅ View reports

**Store Manager Cannot:**
- ❌ Access organization features
- ❌ Manage other stores
- ❌ Manage organization users

## Production Checklist

✅ **Working:**
- Product CRUD with stock display
- Purchase flow (adds stock)
- Sale flow (reduces stock)
- Stock calculation (ledger-based)
- Low stock warnings
- Permission checks
- Barcode uniqueness enforcement

⚠️ **To Verify:**
- Stock adjustment UI (manual corrections)
- Carton/packing fields (cartonSize, cartonBarcode) - in form but not fully used
- Negative stock validation (currently allows negative stock)

## Common Questions

**Q: How do I add initial stock?**
A: Create a Purchase with the products and quantities.

**Q: Can I sell without stock?**
A: Yes, if trackStock=false. If trackStock=true, stock can go negative (no validation currently).

**Q: What's the difference between SKU and barcode?**
A: SKU = internal code (not unique). Barcode = scannable code (unique per shop).

**Q: How is stock calculated?**
A: Sum of all StockLedger.changeQty entries for that product.

**Q: Where do I see current stock?**
A: Products list (`/store/products`) - shows stock column with color coding.


