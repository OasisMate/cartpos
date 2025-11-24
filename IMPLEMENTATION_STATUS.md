# Implementation Status

## ✅ Completed

1. **Stock Adjustment Domain & API**
   - Created `src/lib/domain/stock-adjustments.ts` with full CRUD
   - Created `src/app/api/stock-adjustments/route.ts` API endpoint
   - Supports: ADJUSTMENT, DAMAGE, EXPIRY, RETURN, SELF_USE types
   - Permission checks (Store Managers only)

2. **Negative Stock Handling**
   - Added `allowNegativeStock` field to ShopSettings schema
   - Updated `src/lib/domain/sales.ts` to check shop settings
   - If `allowNegativeStock=false`: Blocks sale with clear error
   - If `allowNegativeStock=true`: Allows sale but returns warnings
   - Updated API to return `stockWarnings` array
   - trackStock=false products bypass check (logical)

3. **Carton Handling**
   - ✅ Purchases: Already implemented - multiplies by cartonSize when "carton" selected
   - ✅ POS: Already implemented - scans carton barcode → adds cartonSize quantity

4. **Shop Settings**
   - Updated schema with `allowNegativeStock` field
   - Updated shop creation to set default `allowNegativeStock: true`

## 🚧 In Progress / Remaining

1. **Stock Adjustment UI**
   - Need to add "Adjust Stock" button on Products page (per product)
   - Need to create modal/form for stock adjustment
   - Need to create new page `/store/stock-adjustments` with list view

2. **Shop Settings UI**
   - Need to create settings page for Store Managers
   - Allow toggling `allowNegativeStock` setting
   - Should be accessible from Store Manager account

## Next Steps

1. Add stock adjustment modal to Products page
2. Create Stock Adjustments list page
3. Create Shop Settings page
4. Run database migration for `allowNegativeStock` field
5. Update POS to show stock warnings when sale completes


