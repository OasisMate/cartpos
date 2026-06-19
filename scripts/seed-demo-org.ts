/**
 * Seed the persistent DEMO / TEST org — a stable fixture for QA and live demos.
 *
 *   npx tsx scripts/seed-demo-org.ts
 *
 * Creates ONE org (isDemo=true) with 22 shops — one per supported business type —
 * each with a realistic trade catalog and ~90 days of dated activity that exercises
 * every entity/field/enum (products, packaging, batch/expiry & serial lots,
 * suppliers + payables, purchases, invoices PAID/UDHAAR/PARTIAL/VOID with
 * discount/service/delivery/card-fee, payments + udhaar receipts, refunds/exchanges,
 * quotations, all 7 stock-move types, expenses). Data is deterministic (seeded PRNG).
 *
 * Idempotent: if the demo org already exists it does nothing. To rebuild the baseline,
 * run scripts/reset-demo-org.ts (which wipes the demo org's data and re-seeds).
 *
 * Demo users (password below) can use the app normally but CANNOT perform destructive
 * actions — Organization.isDemo blocks them at the API layer (see src/lib/demo.ts).
 * Use scripts/toggle-demo-lock.ts off/on to test blocked flows live.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import type { OrganizationType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { presetShopSettingsData } from '../src/lib/domain/business-presets'

const prisma = new PrismaClient()

export const DEMO_ORG_NAME = 'CartPOS Demo'
export const DEMO_PASSWORD = 'Demo@12345' // meets policy: 10+ chars, upper/lower/number/symbol
export const DEMO_USERS = {
  admin: 'demo.admin@cartpos.app',
  manager: 'demo.manager@cartpos.app',
  cashier: 'demo.cashier@cartpos.app',
}

const D = (n: number) => new Prisma.Decimal(Number(n.toFixed(2)))

// Fixed "today" so backfilled history is reproducible across reseeds.
const TODAY = new Date('2026-06-19T12:00:00+05:00')
const dayMs = 86_400_000
/** A Date `n` days before TODAY (n=0 => today), at a pseudo-business hour. */
function daysAgo(n: number, hour = 13): Date {
  const d = new Date(TODAY.getTime() - n * dayMs)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** Deterministic PRNG so demo numbers are stable across reseeds. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]
const randInt = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

type FeatureProfile = 'LEAN' | 'TRADE' | 'PHARMACY' | 'RESTAURANT' | 'SPECIALTY'

interface SeedLot {
  lotNo?: string
  serial?: string
  expiryDaysFromToday?: number
  quantity: number
  cost?: number
}
interface SeedPackaging {
  name: string
  factorToBase: number
  price?: number
  level: number
  barcode?: string
}
interface SeedProduct {
  name: string
  price: number
  cost: number
  unit?: string
  sku?: string
  barcode?: string
  category?: string
  stock?: number // opening stock; omit => not stock-tracked
  reorderLevel?: number
  tradePrice?: number
  cartonSize?: number
  cartonPrice?: number
  cartonBarcode?: string
  archived?: boolean
  packaging?: SeedPackaging[]
  lots?: SeedLot[]
}
interface Vertical {
  type: OrganizationType
  shopName: string
  city: string
  profile: FeatureProfile
  products: SeedProduct[]
}

// -----------------------------------------------------
// The 22 vertical catalogs (one per OrganizationType).
// UPPERCASE names are intentional. Barcodes unique within a shop.
// -----------------------------------------------------
const VERTICALS: Vertical[] = [
  // ---------- A. LEAN RETAIL ----------
  {
    type: 'KIRYANA_STORE', shopName: 'Demo Kiryana Store', city: 'Lahore', profile: 'LEAN',
    products: [
      { name: 'COOKING OIL 1L', price: 650, cost: 560, category: 'Grocery', barcode: '8964010011111', stock: 80, reorderLevel: 20 },
      { name: 'SUGAR 1KG', price: 290, cost: 250, category: 'Grocery', stock: 120, reorderLevel: 30 },
      { name: 'WHEAT FLOUR 5KG', price: 1100, cost: 980, category: 'Grocery', stock: 60, reorderLevel: 15 },
      { name: 'TEA 250G', price: 480, cost: 400, category: 'Beverages', barcode: '8964010022222', stock: 40, reorderLevel: 10 },
      { name: 'BASMATI RICE 5KG', price: 1750, cost: 1550, category: 'Grocery', stock: 35, reorderLevel: 10 },
      { name: 'WASHING SOAP', price: 120, cost: 95, category: 'Household', stock: 200, reorderLevel: 40 },
      { name: 'SALT 800G', price: 60, cost: 45, category: 'Grocery', stock: 150, reorderLevel: 30 },
      { name: 'RED CHILLI POWDER 200G', price: 220, cost: 170, category: 'Spices', stock: 70, reorderLevel: 15 },
      { name: 'MILK PACK 1L', price: 320, cost: 290, category: 'Dairy', stock: 90, reorderLevel: 25 },
      { name: 'EGGS (DOZEN)', price: 360, cost: 320, category: 'Dairy', stock: 50, reorderLevel: 12 },
      { name: 'MATCHBOX (PACK)', price: 40, cost: 28, category: 'Household', stock: 300, reorderLevel: 50 },
      { name: 'BISCUITS FAMILY PACK', price: 150, cost: 115, category: 'Snacks', barcode: '8964010033333', stock: 110, reorderLevel: 25 },
      { name: 'LENTILS DAAL 1KG', price: 340, cost: 290, category: 'Grocery', stock: 65, reorderLevel: 15 },
      { name: 'OLD STOCK CANDLE', price: 30, cost: 20, category: 'Household', stock: 0, reorderLevel: 0, archived: true },
    ],
  },
  {
    type: 'GENERAL_STORE', shopName: 'Demo General Store', city: 'Islamabad', profile: 'LEAN',
    products: [
      { name: 'SHAMPOO 200ML', price: 380, cost: 300, category: 'Personal Care', barcode: '8964020011111', stock: 70, reorderLevel: 15 },
      { name: 'TOOTHPASTE 100G', price: 220, cost: 170, category: 'Personal Care', stock: 90, reorderLevel: 20 },
      { name: 'DETERGENT POWDER 1KG', price: 560, cost: 470, category: 'Household', stock: 60, reorderLevel: 15 },
      { name: 'DISH WASH LIQUID 500ML', price: 290, cost: 230, category: 'Household', stock: 80, reorderLevel: 20 },
      { name: 'TISSUE BOX', price: 180, cost: 130, category: 'Household', stock: 120, reorderLevel: 30 },
      { name: 'COLA 1.5L', price: 220, cost: 175, category: 'Beverages', barcode: '8964020022222', stock: 100, reorderLevel: 24 },
      { name: 'POTATO CHIPS', price: 100, cost: 72, category: 'Snacks', stock: 200, reorderLevel: 40 },
      { name: 'CHOCOLATE BAR', price: 150, cost: 110, category: 'Snacks', stock: 160, reorderLevel: 30 },
      { name: 'BATTERY AA (4 PACK)', price: 360, cost: 270, category: 'Electronics', stock: 50, reorderLevel: 12 },
      { name: 'NOTEBOOK A4', price: 160, cost: 110, category: 'Stationery', stock: 90, reorderLevel: 20 },
      { name: 'BALL PEN (PACK)', price: 120, cost: 80, category: 'Stationery', stock: 130, reorderLevel: 25 },
      { name: 'HAND WASH 250ML', price: 240, cost: 185, category: 'Personal Care', stock: 75, reorderLevel: 18 },
      { name: 'DISCONTINUED AIR FRESHENER', price: 350, cost: 260, category: 'Household', stock: 0, archived: true },
    ],
  },
  {
    type: 'RETAIL_STORE', shopName: 'Demo Retail Store', city: 'Rawalpindi', profile: 'LEAN',
    products: [
      { name: 'CERAMIC MUG', price: 450, cost: 300, category: 'Homeware', stock: 60, reorderLevel: 15 },
      { name: 'STEEL WATER BOTTLE', price: 850, cost: 600, category: 'Homeware', barcode: '8964030011111', stock: 45, reorderLevel: 12 },
      { name: 'WALL CLOCK', price: 1200, cost: 850, category: 'Homeware', stock: 25, reorderLevel: 6 },
      { name: 'TABLE LAMP', price: 1800, cost: 1300, category: 'Lighting', stock: 20, reorderLevel: 5 },
      { name: 'PHOTO FRAME 8X10', price: 600, cost: 400, category: 'Homeware', stock: 50, reorderLevel: 12 },
      { name: 'CUSHION COVER', price: 550, cost: 360, category: 'Textile', stock: 70, reorderLevel: 15 },
      { name: 'BATH TOWEL', price: 980, cost: 700, category: 'Textile', stock: 40, reorderLevel: 10 },
      { name: 'PLASTIC STORAGE BOX', price: 750, cost: 520, category: 'Homeware', stock: 35, reorderLevel: 8 },
      { name: 'SCENTED CANDLE', price: 400, cost: 260, category: 'Decor', stock: 80, reorderLevel: 18 },
      { name: 'DOOR MAT', price: 650, cost: 450, category: 'Homeware', stock: 45, reorderLevel: 10 },
      { name: 'KEY HOLDER WALL', price: 500, cost: 320, category: 'Decor', stock: 30, reorderLevel: 8 },
      { name: 'CLEARANCE VASE', price: 900, cost: 650, category: 'Decor', stock: 0, archived: true },
    ],
  },
  {
    type: 'SUPERMARKET', shopName: 'Demo Supermarket', city: 'Lahore', profile: 'LEAN',
    products: [
      { name: 'FROZEN CHICKEN 1KG', price: 720, cost: 620, category: 'Frozen', barcode: '8964040011111', stock: 80, reorderLevel: 20 },
      { name: 'BUTTER 200G', price: 480, cost: 400, category: 'Dairy', barcode: '8964040022222', stock: 60, reorderLevel: 15 },
      { name: 'CHEESE SLICES', price: 540, cost: 440, category: 'Dairy', barcode: '8964040033333', stock: 50, reorderLevel: 12 },
      { name: 'CORN FLAKES 500G', price: 690, cost: 560, category: 'Breakfast', barcode: '8964040044444', stock: 45, reorderLevel: 10 },
      { name: 'KETCHUP 800G', price: 420, cost: 330, category: 'Condiments', barcode: '8964040055555', stock: 70, reorderLevel: 15 },
      { name: 'MAYONNAISE 500G', price: 480, cost: 380, category: 'Condiments', stock: 55, reorderLevel: 12 },
      { name: 'PASTA 500G', price: 320, cost: 240, category: 'Grocery', barcode: '8964040066666', stock: 90, reorderLevel: 20 },
      { name: 'OLIVE OIL 500ML', price: 1450, cost: 1200, category: 'Grocery', stock: 30, reorderLevel: 8 },
      { name: 'YOGHURT 500G', price: 220, cost: 175, category: 'Dairy', stock: 100, reorderLevel: 25 },
      { name: 'JUICE 1L', price: 360, cost: 280, category: 'Beverages', barcode: '8964040077777', stock: 85, reorderLevel: 20 },
      { name: 'ICE CREAM TUB 1L', price: 850, cost: 650, category: 'Frozen', stock: 40, reorderLevel: 10 },
      { name: 'BROWN BREAD', price: 180, cost: 130, category: 'Bakery', stock: 60, reorderLevel: 15 },
      { name: 'CANNED BEANS', price: 250, cost: 185, category: 'Grocery', stock: 75, reorderLevel: 18 },
      { name: 'OLD STOCK SAUCE', price: 300, cost: 220, category: 'Condiments', stock: 0, archived: true },
    ],
  },
  {
    type: 'CONVENIENCE_STORE', shopName: 'Demo Convenience Store', city: 'Karachi', profile: 'LEAN',
    products: [
      { name: 'ENERGY DRINK 250ML', price: 250, cost: 190, category: 'Beverages', barcode: '8964050011111', stock: 120, reorderLevel: 30 },
      { name: 'BOTTLED WATER 500ML', price: 60, cost: 35, category: 'Beverages', stock: 300, reorderLevel: 60 },
      { name: 'INSTANT NOODLES', price: 90, cost: 60, category: 'Snacks', stock: 200, reorderLevel: 40 },
      { name: 'CIGARETTE PACK', price: 320, cost: 280, category: 'Tobacco', stock: 150, reorderLevel: 40 },
      { name: 'GUM PACK', price: 50, cost: 32, category: 'Snacks', stock: 250, reorderLevel: 50 },
      { name: 'CANDY BAG', price: 120, cost: 85, category: 'Snacks', stock: 180, reorderLevel: 35 },
      { name: 'MOBILE LOAD CARD', price: 100, cost: 96, category: 'Telecom', stock: 100, reorderLevel: 25 },
      { name: 'COFFEE SACHET', price: 70, cost: 48, category: 'Beverages', stock: 160, reorderLevel: 30 },
      { name: 'CHEWING MINTS', price: 80, cost: 55, category: 'Snacks', stock: 140, reorderLevel: 30 },
      { name: 'SANDWICH PACK', price: 220, cost: 160, category: 'Ready Food', stock: 40, reorderLevel: 10 },
      { name: 'CRACKERS', price: 110, cost: 78, category: 'Snacks', barcode: '8964050022222', stock: 90, reorderLevel: 20 },
      { name: 'EXPIRED JUICE LINE', price: 150, cost: 110, category: 'Beverages', stock: 0, archived: true },
    ],
  },

  // ---------- B. QUOTE + TRADE PRICING ----------
  {
    type: 'HARDWARE_STORE', shopName: 'Demo Hardware Store', city: 'Faisalabad', profile: 'TRADE',
    products: [
      { name: 'CEMENT BAG 50KG', price: 1350, cost: 1220, tradePrice: 1280, category: 'Construction', stock: 120, reorderLevel: 30, cartonSize: 20, cartonPrice: 25600, cartonBarcode: '8964060099001' },
      { name: 'STEEL NAILS 1KG', price: 320, cost: 250, tradePrice: 290, category: 'Fasteners', stock: 200, reorderLevel: 40 },
      { name: 'PAINT 1 GALLON', price: 2200, cost: 1850, tradePrice: 2050, category: 'Paint', barcode: '8964060011111', stock: 60, reorderLevel: 15 },
      { name: 'TILE ADHESIVE 20KG', price: 980, cost: 820, tradePrice: 910, category: 'Construction', stock: 80, reorderLevel: 20 },
      { name: 'HAMMER 1LB', price: 750, cost: 540, tradePrice: 690, category: 'Tools', stock: 40, reorderLevel: 10 },
      { name: 'SCREWDRIVER SET', price: 1200, cost: 850, tradePrice: 1080, category: 'Tools', stock: 35, reorderLevel: 8 },
      { name: 'MEASURING TAPE 5M', price: 480, cost: 330, tradePrice: 430, category: 'Tools', stock: 70, reorderLevel: 15 },
      { name: 'PADLOCK MEDIUM', price: 650, cost: 460, tradePrice: 590, category: 'Hardware', stock: 90, reorderLevel: 20 },
      { name: 'WALL PUTTY 5KG', price: 720, cost: 590, tradePrice: 670, category: 'Construction', stock: 65, reorderLevel: 15 },
      { name: 'WIRE BRUSH', price: 220, cost: 140, tradePrice: 190, category: 'Tools', stock: 100, reorderLevel: 25 },
      { name: 'SAND PAPER (PACK)', price: 180, cost: 110, tradePrice: 160, category: 'Tools', stock: 120, reorderLevel: 30 },
      { name: 'GRINDING DISC', price: 150, cost: 95, tradePrice: 130, category: 'Tools', stock: 150, reorderLevel: 35 },
      { name: 'OLD STOCK DOOR HINGE', price: 300, cost: 200, category: 'Hardware', stock: 0, archived: true },
    ],
  },
  {
    type: 'SANITARY_STORE', shopName: 'Demo Sanitary Store', city: 'Gujranwala', profile: 'TRADE',
    products: [
      { name: 'PVC PIPE 1IN (PER FT)', price: 75, cost: 55, tradePrice: 68, unit: 'ft', category: 'Pipes', stock: 800, reorderLevel: 150 },
      { name: 'WATER TAP BRASS', price: 850, cost: 620, tradePrice: 780, category: 'Fittings', barcode: '8964070011111', stock: 90, reorderLevel: 20 },
      { name: 'WASH BASIN', price: 4500, cost: 3600, tradePrice: 4200, category: 'Ceramics', stock: 25, reorderLevel: 6 },
      { name: 'TOILET COMMODE', price: 12000, cost: 9500, tradePrice: 11200, category: 'Ceramics', stock: 15, reorderLevel: 4 },
      { name: 'PIPE ELBOW 1IN', price: 45, cost: 28, tradePrice: 40, category: 'Fittings', stock: 500, reorderLevel: 100, cartonSize: 100, cartonPrice: 3800, cartonBarcode: '8964070099002' },
      { name: 'SHOWER SET', price: 2800, cost: 2100, tradePrice: 2600, category: 'Fittings', stock: 40, reorderLevel: 10 },
      { name: 'TEFLON TAPE', price: 60, cost: 35, tradePrice: 52, category: 'Consumables', stock: 300, reorderLevel: 60 },
      { name: 'WATER MOTOR 0.5HP', price: 9500, cost: 7800, tradePrice: 9000, category: 'Pumps', stock: 18, reorderLevel: 5 },
      { name: 'GATE VALVE 2IN', price: 1400, cost: 1050, tradePrice: 1300, category: 'Fittings', stock: 50, reorderLevel: 12 },
      { name: 'FLEXIBLE HOSE', price: 320, cost: 220, tradePrice: 290, category: 'Fittings', stock: 110, reorderLevel: 25 },
      { name: 'PVC SOLVENT GLUE', price: 250, cost: 170, tradePrice: 220, category: 'Consumables', stock: 130, reorderLevel: 30 },
      { name: 'DISCONTINUED TANK FLOAT', price: 400, cost: 280, category: 'Fittings', stock: 0, archived: true },
    ],
  },
  {
    type: 'ELECTRONICS_STORE', shopName: 'Demo Electronics Store', city: 'Karachi', profile: 'TRADE',
    products: [
      {
        name: 'LED TV 43IN', price: 78000, cost: 66000, tradePrice: 74000, category: 'Television', stock: 12, reorderLevel: 3,
        lots: [
          { serial: 'IMEI-TV43-0001', quantity: 1, cost: 66000 },
          { serial: 'IMEI-TV43-0002', quantity: 1, cost: 66000 },
          { serial: 'IMEI-TV43-0003', quantity: 1, cost: 65500 },
        ],
      },
      {
        name: 'WASHING MACHINE 8KG', price: 62000, cost: 52000, tradePrice: 59000, category: 'Appliance', stock: 8, reorderLevel: 2,
        lots: [
          { serial: 'SN-WM8-1001', quantity: 1, cost: 52000 },
          { serial: 'SN-WM8-1002', quantity: 1, cost: 52000 },
        ],
      },
      { name: 'MICROWAVE OVEN', price: 28000, cost: 23000, tradePrice: 26500, category: 'Appliance', barcode: '8964080011111', stock: 20, reorderLevel: 5 },
      { name: 'ELECTRIC KETTLE', price: 4500, cost: 3300, tradePrice: 4100, category: 'Small Appliance', stock: 50, reorderLevel: 12 },
      { name: 'CEILING FAN', price: 8500, cost: 6800, tradePrice: 8000, category: 'Cooling', stock: 60, reorderLevel: 15 },
      { name: 'IRON STEAM', price: 5200, cost: 3900, tradePrice: 4800, category: 'Small Appliance', stock: 45, reorderLevel: 10 },
      { name: 'BLENDER 1.5L', price: 6800, cost: 5100, tradePrice: 6300, category: 'Small Appliance', stock: 35, reorderLevel: 8 },
      { name: 'AIR COOLER', price: 22000, cost: 18000, tradePrice: 20500, category: 'Cooling', stock: 15, reorderLevel: 4 },
      { name: 'LED BULB 12W', price: 350, cost: 230, tradePrice: 310, category: 'Lighting', stock: 300, reorderLevel: 60, cartonSize: 50, cartonPrice: 14500, cartonBarcode: '8964080099003' },
      { name: 'EXTENSION CORD', price: 950, cost: 680, tradePrice: 870, category: 'Accessories', stock: 90, reorderLevel: 20 },
      { name: 'UPS 1000VA', price: 18500, cost: 15000, tradePrice: 17500, category: 'Power', stock: 22, reorderLevel: 6 },
      { name: 'OLD MODEL DVD PLAYER', price: 6000, cost: 4500, category: 'Television', stock: 0, archived: true },
    ],
  },
  {
    type: 'AUTO_PARTS', shopName: 'Demo Auto Parts', city: 'Lahore', profile: 'TRADE',
    products: [
      { name: 'ENGINE OIL 4L', price: 4200, cost: 3500, tradePrice: 3950, category: 'Lubricants', barcode: '8964090011111', stock: 100, reorderLevel: 25 },
      { name: 'AIR FILTER', price: 850, cost: 600, tradePrice: 780, category: 'Filters', stock: 120, reorderLevel: 30 },
      { name: 'OIL FILTER', price: 550, cost: 380, tradePrice: 500, category: 'Filters', stock: 150, reorderLevel: 35 },
      { name: 'BRAKE PADS SET', price: 3200, cost: 2400, tradePrice: 2950, category: 'Brakes', stock: 60, reorderLevel: 15 },
      { name: 'SPARK PLUG', price: 450, cost: 300, tradePrice: 400, category: 'Ignition', stock: 200, reorderLevel: 40, cartonSize: 50, cartonPrice: 18000, cartonBarcode: '8964090099004' },
      { name: 'WIPER BLADE', price: 950, cost: 680, tradePrice: 870, category: 'Accessories', stock: 90, reorderLevel: 20 },
      { name: 'CAR BATTERY 12V', price: 18500, cost: 15500, tradePrice: 17500, category: 'Electrical', stock: 25, reorderLevel: 6 },
      { name: 'HEADLIGHT BULB', price: 750, cost: 520, tradePrice: 690, category: 'Lighting', stock: 110, reorderLevel: 25 },
      { name: 'COOLANT 1L', price: 680, cost: 480, tradePrice: 620, category: 'Lubricants', stock: 80, reorderLevel: 18 },
      { name: 'FAN BELT', price: 1200, cost: 850, tradePrice: 1100, category: 'Engine', stock: 70, reorderLevel: 15 },
      { name: 'CLUTCH PLATE', price: 5500, cost: 4200, tradePrice: 5100, category: 'Transmission', stock: 30, reorderLevel: 8 },
      { name: 'OBSOLETE CARBURETOR', price: 4000, cost: 3000, category: 'Engine', stock: 0, archived: true },
    ],
  },
  {
    type: 'FURNITURE_STORE', shopName: 'Demo Furniture Store', city: 'Chiniot', profile: 'TRADE',
    products: [
      { name: 'WOODEN DINING TABLE', price: 45000, cost: 34000, tradePrice: 42000, category: 'Dining', stock: 12, reorderLevel: 3 },
      { name: 'DINING CHAIR', price: 6500, cost: 4800, tradePrice: 6000, category: 'Dining', stock: 80, reorderLevel: 16 },
      { name: 'KING SIZE BED', price: 68000, cost: 52000, tradePrice: 63000, category: 'Bedroom', stock: 8, reorderLevel: 2 },
      { name: 'WARDROBE 3 DOOR', price: 55000, cost: 42000, tradePrice: 51000, category: 'Bedroom', stock: 10, reorderLevel: 3 },
      { name: 'SOFA SET 5 SEATER', price: 95000, cost: 72000, tradePrice: 88000, category: 'Living', stock: 6, reorderLevel: 2 },
      { name: 'OFFICE CHAIR', price: 12500, cost: 9000, tradePrice: 11500, category: 'Office', barcode: '8964100011111', stock: 40, reorderLevel: 10 },
      { name: 'STUDY TABLE', price: 14000, cost: 10500, tradePrice: 13000, category: 'Office', stock: 25, reorderLevel: 6 },
      { name: 'COFFEE TABLE', price: 18000, cost: 13500, tradePrice: 16500, category: 'Living', stock: 20, reorderLevel: 5 },
      { name: 'BOOK SHELF', price: 16000, cost: 12000, tradePrice: 15000, category: 'Living', stock: 18, reorderLevel: 5 },
      { name: 'SIDE TABLE', price: 7500, cost: 5400, tradePrice: 6900, category: 'Bedroom', stock: 35, reorderLevel: 8 },
      { name: 'TV CONSOLE', price: 22000, cost: 16500, tradePrice: 20500, category: 'Living', stock: 15, reorderLevel: 4 },
      { name: 'DISCONTINUED STOOL', price: 3500, cost: 2500, category: 'Living', stock: 0, archived: true },
    ],
  },
  {
    type: 'WHOLESALE', shopName: 'Demo Wholesale Depot', city: 'Faisalabad', profile: 'TRADE',
    products: [
      { name: 'COOKING OIL 1L', price: 640, cost: 560, tradePrice: 600, category: 'Grocery', stock: 600, reorderLevel: 120, cartonSize: 12, cartonPrice: 7080, cartonBarcode: '8964110099001' },
      { name: 'SUGAR 1KG', price: 285, cost: 250, tradePrice: 268, category: 'Grocery', stock: 1000, reorderLevel: 200, cartonSize: 25, cartonPrice: 6600, cartonBarcode: '8964110099002' },
      { name: 'TEA 250G', price: 470, cost: 400, tradePrice: 440, category: 'Beverages', stock: 400, reorderLevel: 80, cartonSize: 24, cartonPrice: 10300, cartonBarcode: '8964110099003' },
      { name: 'SOAP BAR', price: 110, cost: 88, tradePrice: 100, category: 'Household', stock: 1500, reorderLevel: 300, cartonSize: 48, cartonPrice: 4700, cartonBarcode: '8964110099004' },
      { name: 'BISCUITS PACK', price: 140, cost: 112, tradePrice: 128, category: 'Snacks', stock: 800, reorderLevel: 160, cartonSize: 24, cartonPrice: 3000, cartonBarcode: '8964110099005' },
      { name: 'DETERGENT 1KG', price: 540, cost: 470, tradePrice: 510, category: 'Household', stock: 500, reorderLevel: 100 },
      { name: 'MILK PACK 1L', price: 310, cost: 290, tradePrice: 300, category: 'Dairy', stock: 700, reorderLevel: 140 },
      { name: 'RICE 25KG', price: 8500, cost: 7700, tradePrice: 8100, category: 'Grocery', stock: 200, reorderLevel: 40 },
      { name: 'WHEAT FLOUR 10KG', price: 2100, cost: 1900, tradePrice: 2000, category: 'Grocery', stock: 300, reorderLevel: 60 },
      { name: 'COLA 1.5L', price: 210, cost: 175, tradePrice: 195, category: 'Beverages', stock: 600, reorderLevel: 120, cartonSize: 6, cartonPrice: 1140, cartonBarcode: '8964110099006' },
      { name: 'SALT 800G', price: 55, cost: 45, tradePrice: 50, category: 'Grocery', stock: 1200, reorderLevel: 240 },
      { name: 'CLEARANCE SAUCE BULK', price: 280, cost: 220, category: 'Condiments', stock: 0, archived: true },
    ],
  },

  // ---------- C. PHARMACY ----------
  {
    type: 'PHARMACY', shopName: 'Demo Pharmacy', city: 'Karachi', profile: 'PHARMACY',
    products: [
      {
        name: 'PARACETAMOL 500MG', price: 4.5, cost: 2.8, unit: 'tablet', category: 'Painkiller',
        barcode: '8964120033333', stock: 2000, reorderLevel: 500,
        packaging: [
          { name: 'Tablet', factorToBase: 1, level: 0 },
          { name: 'Box', factorToBase: 10, price: 45, level: 1 },
          { name: 'Carton', factorToBase: 200, price: 850, level: 2, barcode: '8964120033334' },
        ],
        lots: [
          { lotNo: 'BATCH-A', expiryDaysFromToday: 20, quantity: 300, cost: 2.7 }, // near-expiry
          { lotNo: 'BATCH-B', expiryDaysFromToday: 400, quantity: 1700, cost: 2.8 },
        ],
      },
      {
        name: 'AMOXICILLIN 250MG', price: 9, cost: 6, unit: 'capsule', category: 'Antibiotic', stock: 600, reorderLevel: 150,
        packaging: [
          { name: 'Capsule', factorToBase: 1, level: 0 },
          { name: 'Strip', factorToBase: 10, price: 95, level: 1 },
        ],
        lots: [
          { lotNo: 'EXP-OLD', expiryDaysFromToday: -10, quantity: 40, cost: 6 }, // expired
          { lotNo: 'AMX-22', expiryDaysFromToday: 300, quantity: 560, cost: 6 },
        ],
      },
      {
        name: 'IBUPROFEN 400MG', price: 6, cost: 3.8, unit: 'tablet', category: 'Painkiller', barcode: '8964120044444', stock: 1200, reorderLevel: 300,
        packaging: [
          { name: 'Tablet', factorToBase: 1, level: 0 },
          { name: 'Box', factorToBase: 10, price: 60, level: 1 },
        ],
      },
      { name: 'VITAMIN C 1000MG', price: 25, cost: 18, unit: 'tablet', category: 'Supplement', stock: 400, reorderLevel: 100 },
      {
        name: 'COUGH SYRUP 120ML', price: 220, cost: 160, unit: 'bottle', category: 'Syrup', barcode: '8964120055555', stock: 70, reorderLevel: 20,
        lots: [
          { lotNo: 'CS-NEAR', expiryDaysFromToday: 25, quantity: 20, cost: 160 },
          { lotNo: 'CS-OK', expiryDaysFromToday: 500, quantity: 50, cost: 160 },
        ],
      },
      { name: 'HAND SANITIZER 100ML', price: 180, cost: 120, unit: 'bottle', category: 'Hygiene', stock: 110, reorderLevel: 30 },
      { name: 'FACE MASK BOX 50', price: 450, cost: 300, unit: 'box', category: 'Hygiene', stock: 50, reorderLevel: 15 },
      { name: 'ORS SACHET', price: 35, cost: 22, unit: 'sachet', category: 'Supplement', stock: 500, reorderLevel: 100 },
      { name: 'BANDAGE ROLL', price: 90, cost: 60, unit: 'roll', category: 'First Aid', stock: 140, reorderLevel: 30 },
      { name: 'ANTACID SUSPENSION', price: 160, cost: 110, unit: 'bottle', category: 'Digestive', stock: 90, reorderLevel: 20 },
      { name: 'INSULIN PEN', price: 1850, cost: 1500, unit: 'pen', category: 'Diabetes', stock: 30, reorderLevel: 8,
        lots: [ { lotNo: 'INS-NEAR', expiryDaysFromToday: 15, quantity: 8, cost: 1500 }, { lotNo: 'INS-OK', expiryDaysFromToday: 240, quantity: 22, cost: 1500 } ] },
      { name: 'DISCONTINUED TONIC', price: 200, cost: 150, unit: 'bottle', category: 'Syrup', stock: 0, archived: true },
    ],
  },

  // ---------- D. RESTAURANT ----------
  {
    type: 'RESTAURANT', shopName: 'Demo Restaurant', city: 'Lahore', profile: 'RESTAURANT',
    products: [
      { name: 'CHICKEN BIRYANI', price: 450, cost: 230, unit: 'plate', category: 'Rice' },
      { name: 'BEEF NIHARI', price: 520, cost: 280, unit: 'plate', category: 'Curry' },
      { name: 'CHICKEN KARAHI (FULL)', price: 1650, cost: 950, unit: 'item', category: 'Curry' },
      { name: 'SEEKH KEBAB (4 PCS)', price: 480, cost: 250, unit: 'item', category: 'BBQ' },
      { name: 'MUTTON PULAO', price: 600, cost: 340, unit: 'plate', category: 'Rice' },
      { name: 'NAAN', price: 40, cost: 15, unit: 'item', category: 'Bread' },
      { name: 'GARLIC NAAN', price: 90, cost: 35, unit: 'item', category: 'Bread' },
      { name: 'SOFT DRINK 345ML', price: 90, cost: 60, unit: 'item', category: 'Beverages', stock: 240, reorderLevel: 48 },
      { name: 'MINERAL WATER 500ML', price: 60, cost: 35, unit: 'item', category: 'Beverages', stock: 300, reorderLevel: 60 },
      { name: 'KHEER', price: 180, cost: 80, unit: 'item', category: 'Dessert' },
      { name: 'GULAB JAMUN (2 PCS)', price: 160, cost: 70, unit: 'item', category: 'Dessert' },
      { name: 'TEA (CUP)', price: 80, cost: 25, unit: 'cup', category: 'Beverages' },
      { name: 'SEASONAL SOUP (OFF MENU)', price: 250, cost: 110, unit: 'bowl', category: 'Soup', archived: true },
    ],
  },

  // ---------- E. SPECIALTY RETAIL ----------
  {
    type: 'MOBILE_ACCESSORIES', shopName: 'Demo Mobile Accessories', city: 'Karachi', profile: 'SPECIALTY',
    products: [
      {
        name: 'SMARTPHONE BUDGET', price: 32000, cost: 27000, category: 'Phones', stock: 15, reorderLevel: 4,
        lots: [
          { serial: 'IMEI-PH-900001', quantity: 1, cost: 27000 },
          { serial: 'IMEI-PH-900002', quantity: 1, cost: 27000 },
          { serial: 'IMEI-PH-900003', quantity: 1, cost: 26800 },
        ],
      },
      { name: 'PHONE CHARGER FAST', price: 1200, cost: 800, category: 'Chargers', barcode: '8964130011111', stock: 120, reorderLevel: 30 },
      { name: 'USB CABLE TYPE-C', price: 450, cost: 280, category: 'Cables', stock: 200, reorderLevel: 40 },
      { name: 'EARPHONES WIRED', price: 650, cost: 420, category: 'Audio', stock: 150, reorderLevel: 35 },
      { name: 'BLUETOOTH HANDSFREE', price: 2800, cost: 2000, category: 'Audio', stock: 60, reorderLevel: 15 },
      { name: 'PHONE CASE', price: 550, cost: 320, category: 'Cases', stock: 250, reorderLevel: 50 },
      { name: 'SCREEN PROTECTOR', price: 350, cost: 180, category: 'Protection', stock: 300, reorderLevel: 60 },
      { name: 'POWER BANK 10000MAH', price: 3200, cost: 2400, category: 'Power', barcode: '8964130022222', stock: 70, reorderLevel: 18 },
      { name: 'MEMORY CARD 64GB', price: 1500, cost: 1050, category: 'Storage', stock: 90, reorderLevel: 20 },
      { name: 'CAR PHONE MOUNT', price: 800, cost: 520, category: 'Accessories', stock: 80, reorderLevel: 18 },
      { name: 'SMART WATCH', price: 6500, cost: 4800, category: 'Wearables', stock: 40, reorderLevel: 10 },
      { name: 'OLD STOCK SELFIE STICK', price: 600, cost: 380, category: 'Accessories', stock: 0, archived: true },
    ],
  },
  {
    type: 'CLOTHING_STORE', shopName: 'Demo Clothing Store', city: 'Lahore', profile: 'SPECIALTY',
    products: [
      { name: "MEN'S T-SHIRT", price: 1200, cost: 750, category: 'Menswear', barcode: '8964140011111', stock: 120, reorderLevel: 30 },
      { name: 'DENIM JEANS', price: 2800, cost: 1900, category: 'Menswear', stock: 70, reorderLevel: 18 },
      { name: 'KURTA (UNSTITCHED)', price: 3500, cost: 2400, category: 'Eastern', stock: 50, reorderLevel: 12 },
      { name: 'WINTER HOODIE', price: 2400, cost: 1600, category: 'Winter', stock: 60, reorderLevel: 15 },
      { name: 'COTTON SOCKS (PAIR)', price: 250, cost: 140, category: 'Accessories', stock: 300, reorderLevel: 60 },
      { name: "LADIES SHAWL", price: 1800, cost: 1200, category: 'Womenswear', stock: 80, reorderLevel: 18 },
      { name: 'FORMAL SHIRT', price: 2200, cost: 1500, category: 'Menswear', stock: 65, reorderLevel: 15 },
      { name: 'TROUSER DRESS PANT', price: 2600, cost: 1750, category: 'Menswear', stock: 55, reorderLevel: 12 },
      { name: "KIDS FROCK", price: 1600, cost: 1000, category: 'Kidswear', stock: 70, reorderLevel: 16 },
      { name: 'WOOLEN SWEATER', price: 2900, cost: 2000, category: 'Winter', stock: 45, reorderLevel: 10 },
      { name: 'CAP BASEBALL', price: 700, cost: 420, category: 'Accessories', stock: 100, reorderLevel: 25 },
      { name: 'LAST SEASON JACKET', price: 4500, cost: 3200, category: 'Winter', stock: 0, archived: true },
    ],
  },
  {
    type: 'FOOTWEAR_STORE', shopName: 'Demo Footwear Store', city: 'Lahore', profile: 'SPECIALTY',
    products: [
      { name: 'LEATHER FORMAL SHOES', price: 5500, cost: 3800, category: 'Formal', barcode: '8964150011111', stock: 60, reorderLevel: 15 },
      { name: 'SPORTS JOGGERS', price: 4200, cost: 2900, category: 'Sports', stock: 80, reorderLevel: 18 },
      { name: 'CASUAL SNEAKERS', price: 3500, cost: 2300, category: 'Casual', stock: 90, reorderLevel: 20 },
      { name: 'LADIES HEELS', price: 3200, cost: 2100, category: 'Ladies', stock: 50, reorderLevel: 12 },
      { name: 'KIDS SCHOOL SHOES', price: 2200, cost: 1450, category: 'Kids', stock: 100, reorderLevel: 25 },
      { name: 'RUBBER SLIPPERS', price: 650, cost: 380, category: 'Casual', stock: 200, reorderLevel: 40 },
      { name: 'SANDALS LEATHER', price: 2800, cost: 1850, category: 'Casual', stock: 70, reorderLevel: 16 },
      { name: 'PESHAWARI CHAPPAL', price: 3800, cost: 2600, category: 'Eastern', stock: 55, reorderLevel: 12 },
      { name: 'CANVAS SHOES', price: 2400, cost: 1550, category: 'Casual', stock: 85, reorderLevel: 20 },
      { name: 'SHOE POLISH', price: 180, cost: 110, category: 'Care', stock: 150, reorderLevel: 35 },
      { name: 'SOCKS PACK', price: 350, cost: 200, category: 'Accessories', stock: 180, reorderLevel: 40 },
      { name: 'OLD STOCK CLOGS', price: 1500, cost: 950, category: 'Casual', stock: 0, archived: true },
    ],
  },
  {
    type: 'COSMETICS_STORE', shopName: 'Demo Cosmetics Store', city: 'Karachi', profile: 'SPECIALTY',
    products: [
      { name: 'LIPSTICK MATTE', price: 950, cost: 580, category: 'Makeup', barcode: '8964160011111', stock: 120, reorderLevel: 30 },
      { name: 'FOUNDATION', price: 1800, cost: 1200, category: 'Makeup', stock: 70, reorderLevel: 18 },
      { name: 'FACE POWDER', price: 1200, cost: 780, category: 'Makeup', stock: 80, reorderLevel: 20 },
      { name: 'KAJAL EYELINER', price: 450, cost: 270, category: 'Makeup', stock: 150, reorderLevel: 35 },
      { name: 'NAIL POLISH', price: 350, cost: 200, category: 'Makeup', stock: 200, reorderLevel: 45 },
      { name: 'FACE WASH 100ML', price: 680, cost: 450, category: 'Skincare', stock: 90, reorderLevel: 22 },
      { name: 'MOISTURIZER 50ML', price: 1100, cost: 760, category: 'Skincare', stock: 75, reorderLevel: 18 },
      { name: 'SUNSCREEN SPF50', price: 1400, cost: 980, category: 'Skincare', barcode: '8964160022222', stock: 60, reorderLevel: 15 },
      { name: 'PERFUME 50ML', price: 3200, cost: 2300, category: 'Fragrance', stock: 45, reorderLevel: 10 },
      { name: 'HAIR SERUM', price: 1250, cost: 850, category: 'Haircare', stock: 65, reorderLevel: 15 },
      { name: 'MAKEUP REMOVER', price: 750, cost: 480, category: 'Skincare', stock: 85, reorderLevel: 20 },
      { name: 'DISCONTINUED BLUSH', price: 900, cost: 600, category: 'Makeup', stock: 0, archived: true },
    ],
  },
  {
    type: 'JEWELRY_STORE', shopName: 'Demo Jewelry Store', city: 'Lahore', profile: 'SPECIALTY',
    products: [
      { name: 'GOLD RING 22K', price: 145000, cost: 132000, category: 'Gold', stock: 20, reorderLevel: 5 },
      { name: 'GOLD CHAIN 22K', price: 310000, cost: 285000, category: 'Gold', stock: 12, reorderLevel: 3 },
      { name: 'GOLD EARRINGS', price: 88000, cost: 79000, category: 'Gold', stock: 25, reorderLevel: 6 },
      { name: 'GOLD BANGLE PAIR', price: 420000, cost: 388000, category: 'Gold', stock: 8, reorderLevel: 2 },
      { name: 'SILVER RING', price: 4500, cost: 3200, category: 'Silver', stock: 60, reorderLevel: 15 },
      { name: 'SILVER BRACELET', price: 7800, cost: 5600, category: 'Silver', stock: 40, reorderLevel: 10 },
      { name: 'ARTIFICIAL NECKLACE SET', price: 3500, cost: 2200, category: 'Artificial', barcode: '8964170011111', stock: 80, reorderLevel: 18 },
      { name: 'PEARL EARRINGS', price: 2800, cost: 1800, category: 'Artificial', stock: 90, reorderLevel: 20 },
      { name: 'DIAMOND NOSE PIN', price: 65000, cost: 58000, category: 'Diamond', stock: 15, reorderLevel: 4 },
      { name: 'GEMSTONE PENDANT', price: 18000, cost: 13500, category: 'Gemstone', stock: 30, reorderLevel: 8 },
      { name: 'WATCH LADIES', price: 12500, cost: 9000, category: 'Watches', stock: 35, reorderLevel: 8 },
      { name: 'OLD DESIGN ANKLET', price: 5500, cost: 4000, category: 'Silver', stock: 0, archived: true },
    ],
  },
  {
    type: 'OPTICAL_STORE', shopName: 'Demo Optical Store', city: 'Islamabad', profile: 'SPECIALTY',
    products: [
      { name: 'PRESCRIPTION FRAME', price: 4500, cost: 2800, category: 'Frames', barcode: '8964180011111', stock: 70, reorderLevel: 18 },
      { name: 'SUNGLASSES UV', price: 3200, cost: 2000, category: 'Sunglasses', stock: 90, reorderLevel: 20 },
      { name: 'CONTACT LENS PAIR', price: 2500, cost: 1600, category: 'Lenses', stock: 60, reorderLevel: 15 },
      { name: 'LENS CLEANING SOLUTION', price: 850, cost: 540, category: 'Care', stock: 120, reorderLevel: 28 },
      { name: 'READING GLASSES', price: 1800, cost: 1100, category: 'Frames', stock: 80, reorderLevel: 18 },
      { name: 'BLUE LIGHT GLASSES', price: 2800, cost: 1750, category: 'Frames', stock: 65, reorderLevel: 15 },
      { name: 'GLASSES CASE', price: 450, cost: 250, category: 'Accessories', stock: 150, reorderLevel: 35 },
      { name: 'ANTI GLARE COATING', price: 1500, cost: 900, category: 'Lenses', stock: 100, reorderLevel: 25 },
      { name: 'PROGRESSIVE LENS', price: 9500, cost: 6800, category: 'Lenses', stock: 30, reorderLevel: 8 },
      { name: 'KIDS FRAME', price: 2200, cost: 1350, category: 'Frames', stock: 55, reorderLevel: 12 },
      { name: 'MICROFIBER CLOTH', price: 150, cost: 80, category: 'Accessories', stock: 200, reorderLevel: 45 },
      { name: 'OLD FRAME MODEL', price: 3000, cost: 1900, category: 'Frames', stock: 0, archived: true },
    ],
  },
  {
    type: 'STATIONERY_STORE', shopName: 'Demo Stationery Store', city: 'Multan', profile: 'SPECIALTY',
    products: [
      { name: 'NOTEBOOK A4 200PG', price: 220, cost: 150, category: 'Notebooks', barcode: '8964190011111', stock: 200, reorderLevel: 45 },
      { name: 'BALL PEN BLUE', price: 30, cost: 18, category: 'Pens', stock: 800, reorderLevel: 150 },
      { name: 'GEL PEN BLACK', price: 60, cost: 38, category: 'Pens', stock: 500, reorderLevel: 100 },
      { name: 'PENCIL HB (PACK)', price: 120, cost: 78, category: 'Pencils', stock: 300, reorderLevel: 60 },
      { name: 'GEOMETRY BOX', price: 450, cost: 290, category: 'Sets', stock: 90, reorderLevel: 20 },
      { name: 'A4 PAPER REAM', price: 1250, cost: 1000, category: 'Paper', stock: 80, reorderLevel: 18 },
      { name: 'GLUE STICK', price: 110, cost: 65, category: 'Adhesives', stock: 250, reorderLevel: 50 },
      { name: 'SCISSORS', price: 220, cost: 140, category: 'Tools', stock: 120, reorderLevel: 28 },
      { name: 'STAPLER', price: 380, cost: 250, category: 'Tools', stock: 70, reorderLevel: 16 },
      { name: 'HIGHLIGHTER SET', price: 320, cost: 200, category: 'Pens', stock: 130, reorderLevel: 30 },
      { name: 'FILE FOLDER', price: 90, cost: 55, category: 'Filing', stock: 300, reorderLevel: 60 },
      { name: 'DISCONTINUED DIARY', price: 400, cost: 270, category: 'Notebooks', stock: 0, archived: true },
    ],
  },
  {
    type: 'BAKERY', shopName: 'Demo Bakery', city: 'Lahore', profile: 'SPECIALTY',
    products: [
      { name: 'CHOCOLATE CAKE 1LB', price: 1200, cost: 700, unit: 'item', category: 'Cakes', stock: 30, reorderLevel: 8 },
      { name: 'VANILLA CUPCAKE', price: 180, cost: 95, unit: 'item', category: 'Cupcakes', stock: 80, reorderLevel: 20 },
      { name: 'CHICKEN PATTIES', price: 120, cost: 70, unit: 'item', category: 'Savory', stock: 100, reorderLevel: 25 },
      { name: 'PLAIN BREAD LOAF', price: 160, cost: 100, unit: 'item', category: 'Bread', barcode: '8964200011111', stock: 60, reorderLevel: 15 },
      { name: 'DOUGHNUT GLAZED', price: 150, cost: 80, unit: 'item', category: 'Pastry', stock: 90, reorderLevel: 22 },
      { name: 'CHOCOLATE BROWNIE', price: 220, cost: 120, unit: 'item', category: 'Pastry', stock: 70, reorderLevel: 18 },
      { name: 'BISCUIT BOX', price: 650, cost: 420, unit: 'box', category: 'Biscuits', stock: 50, reorderLevel: 12 },
      { name: 'CREAM ROLL', price: 130, cost: 70, unit: 'item', category: 'Pastry', stock: 110, reorderLevel: 25 },
      { name: 'BIRTHDAY CAKE 2LB', price: 2500, cost: 1500, unit: 'item', category: 'Cakes', stock: 15, reorderLevel: 4 },
      { name: 'RUSK PACK', price: 240, cost: 160, unit: 'pack', category: 'Biscuits', stock: 80, reorderLevel: 18 },
      { name: 'PIZZA SLICE', price: 280, cost: 160, unit: 'item', category: 'Savory', stock: 60, reorderLevel: 15 },
      { name: 'YESTERDAY UNSOLD CAKE', price: 800, cost: 500, unit: 'item', category: 'Cakes', stock: 0, archived: true },
    ],
  },
  {
    type: 'OTHER', shopName: 'Demo General Trade', city: 'Lahore', profile: 'LEAN',
    products: [
      { name: 'GIFT WRAP ROLL', price: 150, cost: 90, category: 'Gifts', stock: 120, reorderLevel: 28 },
      { name: 'GREETING CARD', price: 120, cost: 70, category: 'Gifts', stock: 200, reorderLevel: 40 },
      { name: 'PARTY BALLOONS (PACK)', price: 250, cost: 150, category: 'Party', stock: 150, reorderLevel: 35 },
      { name: 'TOY CAR', price: 850, cost: 550, category: 'Toys', barcode: '8964210011111', stock: 60, reorderLevel: 15 },
      { name: 'BOARD GAME', price: 1800, cost: 1200, category: 'Toys', stock: 30, reorderLevel: 8 },
      { name: 'PHONE COVER GENERIC', price: 400, cost: 240, category: 'Accessories', stock: 90, reorderLevel: 20 },
      { name: 'UMBRELLA', price: 950, cost: 620, category: 'Seasonal', stock: 50, reorderLevel: 12 },
      { name: 'RAINCOAT', price: 1200, cost: 800, category: 'Seasonal', stock: 40, reorderLevel: 10 },
      { name: 'WATER GUN TOY', price: 650, cost: 400, category: 'Toys', stock: 70, reorderLevel: 16 },
      { name: 'KEY CHAIN', price: 200, cost: 120, category: 'Gifts', stock: 180, reorderLevel: 40 },
      { name: 'PHOTO ALBUM', price: 700, cost: 450, category: 'Gifts', stock: 45, reorderLevel: 10 },
      { name: 'OLD STOCK PUZZLE', price: 900, cost: 600, category: 'Toys', stock: 0, archived: true },
    ],
  },
]

// -----------------------------------------------------
// seedShop: catalog, packaging, lots, opening stock, customers, suppliers.
// -----------------------------------------------------
interface SeededProduct { id: string; name: string; price: number; cost: number; tradePrice?: number; trackStock: boolean }
interface ShopContext {
  shop: { id: string }
  products: SeededProduct[]
  customers: { id: string; name: string }[]
  suppliers: { id: string }[]
  rng: () => number
}

const CUST_NAMES = ['ALI TRADERS', 'BILAL KHAN', 'FATIMA STORE', 'HASSAN AND SONS', 'IMRAN ENTERPRISE', 'JAVED MART', 'KASHIF', 'MEHWISH', 'NADIA BEGUM', 'OMAR FAROOQ', 'QADEER', 'RIZWAN', 'SADIA', 'USMAN', 'WAQAR', 'ZAINAB']

async function seedShop(orgId: string, managerId: string, v: Vertical, shopIndex: number): Promise<ShopContext> {
  const rng = mulberry32(1000 + shopIndex * 97)
  const shop = await prisma.shop.create({
    data: {
      orgId, name: v.shopName, city: v.city,
      settings: { create: { timezone: 'Asia/Karachi', ...presetShopSettingsData(v.type) } },
      owners: { create: { userId: managerId, shopRole: 'STORE_MANAGER' } },
    },
  })

  const products: SeededProduct[] = []
  for (const p of v.products) {
    const tracks = p.stock != null
    const product = await prisma.product.create({
      data: {
        shopId: shop.id, name: p.name, unit: p.unit || 'pcs',
        sku: p.sku ?? null, barcode: p.barcode ?? null, category: p.category ?? null,
        price: D(p.price), costPrice: D(p.cost),
        tradePrice: p.tradePrice != null ? D(p.tradePrice) : null,
        cartonSize: p.cartonSize ?? null,
        cartonPrice: p.cartonPrice != null ? D(p.cartonPrice) : null,
        cartonBarcode: p.cartonBarcode ?? null,
        reorderLevel: p.reorderLevel ?? null,
        trackStock: tracks,
        archivedAt: p.archived ? daysAgo(60) : null,
      },
    })
    if (p.packaging?.length) {
      for (const pk of p.packaging) {
        await prisma.packagingLevel.create({
          data: {
            productId: product.id, name: pk.name, factorToBase: D(pk.factorToBase),
            price: pk.price != null ? D(pk.price) : null, barcode: pk.barcode ?? null, level: pk.level,
          },
        })
      }
    }
    if (tracks && p.stock! > 0) {
      await prisma.stockLedger.create({
        data: {
          shopId: shop.id, productId: product.id, changeQty: D(p.stock!), type: 'PURCHASE',
          refType: 'opening', createdAt: daysAgo(90),
        },
      })
    }
    if (p.lots?.length) {
      for (const lot of p.lots) {
        await prisma.stockLot.create({
          data: {
            shopId: shop.id, productId: product.id, lotNo: lot.lotNo ?? null, serial: lot.serial ?? null,
            expiry: lot.expiryDaysFromToday != null ? daysAgo(-lot.expiryDaysFromToday) : null,
            quantity: D(lot.quantity), costPrice: lot.cost != null ? D(lot.cost) : null, receivedAt: daysAgo(80),
          },
        })
      }
    }
    products.push({ id: product.id, name: product.name, price: p.price, cost: p.cost, tradePrice: p.tradePrice, trackStock: tracks })
  }

  // Customers: walk-in + named; ~30% carry an udhaar opening balance.
  const customers: { id: string; name: string }[] = []
  const walkin = await prisma.customer.create({ data: { shopId: shop.id, name: 'WALK-IN CUSTOMER', phone: '03001234567' } })
  customers.push(walkin)
  const nCust = randInt(rng, 8, 14)
  for (let i = 0; i < nCust; i++) {
    const c = await prisma.customer.create({
      data: { shopId: shop.id, name: pick(rng, CUST_NAMES) + ' ' + (i + 1), phone: '0300' + randInt(rng, 1000000, 9999999) },
    })
    customers.push(c)
    if (rng() < 0.3) {
      const bal = randInt(rng, 1, 8) * 1000
      await prisma.customerLedger.create({
        data: {
          shopId: shop.id, customerId: c.id, type: 'ADJUSTMENT', direction: 'DEBIT', amount: D(bal),
          refType: 'opening_balance', createdAt: daysAgo(88),
        },
      })
    }
  }

  // Suppliers (2-3) with payables ledger.
  const suppliers: { id: string }[] = []
  const nSup = randInt(rng, 2, 3)
  for (let i = 0; i < nSup; i++) {
    const s = await prisma.supplier.create({ data: { shopId: shop.id, name: `${v.city} WHOLESALE CO ${i + 1}`, phone: '042' + randInt(rng, 1000000, 9999999) } })
    suppliers.push(s)
    await prisma.supplierLedger.createMany({
      data: [
        { shopId: shop.id, supplierId: s.id, type: 'OPENING_BALANCE', direction: 'CREDIT', amount: D(randInt(rng, 10, 40) * 1000), refType: 'opening', createdByUserId: managerId, createdAt: daysAgo(89) },
        { shopId: shop.id, supplierId: s.id, type: 'PAYMENT_MADE', direction: 'DEBIT', amount: D(randInt(rng, 5, 15) * 1000), method: rng() < 0.5 ? 'CASH' : 'CARD', refType: 'payment', createdByUserId: managerId, createdAt: daysAgo(randInt(rng, 10, 70)) },
        { shopId: shop.id, supplierId: s.id, type: 'ADJUSTMENT', direction: 'CREDIT', amount: D(randInt(rng, 1, 3) * 500), refType: 'adjustment', note: 'Price correction', createdByUserId: managerId, createdAt: daysAgo(randInt(rng, 5, 40)) },
      ],
    })
  }

  return { shop, products, customers, suppliers, rng }
}

// -----------------------------------------------------
// simulate90Days: purchases, sales, payments, returns, quotations, expenses, stock moves.
// -----------------------------------------------------
const EXPENSE_CATS = ['Utilities', 'Rent', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Misc']

async function simulate90Days(orgId: string, managerId: string, v: Vertical, ctx: ShopContext) {
  const { shop, products, customers, suppliers, rng } = ctx
  const stocked = products.filter((p) => p.trackStock)
  const named = customers.filter((c) => c.name !== 'WALK-IN CUSTOMER')
  let invoiceNo = 0
  const nextNo = () => String(++invoiceNo).padStart(6, '0')
  const isTrade = v.profile === 'TRADE'
  const isRestaurant = v.profile === 'RESTAURANT'

  // --- Purchases over the period (restock) ---
  const nPurchases = randInt(rng, 4, 8)
  for (let i = 0; i < nPurchases && suppliers.length && stocked.length; i++) {
    const when = daysAgo(randInt(rng, 1, 85))
    const lineProducts = Array.from({ length: randInt(rng, 2, 5) }, () => pick(rng, stocked))
    const purchase = await prisma.purchase.create({
      data: {
        shopId: shop.id, supplierId: pick(rng, suppliers).id, date: when, createdAt: when,
        reference: 'PO-' + (1000 + i), createdByUserId: managerId,
        lines: { create: lineProducts.map((p) => ({ productId: p.id, quantity: D(randInt(rng, 5, 30)), unitCost: D(p.cost) })) },
      },
      include: { lines: true },
    })
    for (const ln of purchase.lines) {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: ln.productId, changeQty: D(Number(ln.quantity)), type: 'PURCHASE', refType: 'purchase_line', refId: ln.id, createdAt: when } })
    }
  }

  // --- Sales across 90 days ---
  const nSales = randInt(rng, 45, 70)
  const madeInvoices: { id: string; total: number; customerId: string; items: { productId: string; qty: number; price: number }[] }[] = []
  for (let i = 0; i < nSales; i++) {
    const when = daysAgo(randInt(rng, 0, 89), randInt(rng, 10, 21))
    const itemCount = randInt(rng, 1, 4)
    const chosen = Array.from({ length: itemCount }, () => pick(rng, products))
    const items = chosen.map((p) => {
      const qty = randInt(rng, 1, 3)
      const price = isTrade && p.tradePrice && rng() < 0.5 ? p.tradePrice : p.price
      return { productId: p.id, qty, price }
    })
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const discount = rng() < 0.25 ? Math.round(subtotal * (rng() < 0.5 ? 0.05 : 0.1)) : 0
    const serviceCharge = isRestaurant ? Math.round((subtotal - discount) * 0.05) : 0
    const deliveryCharge = isRestaurant && rng() < 0.3 ? 100 : 0
    const r = rng()
    const isUdhaar = r < 0.2 && named.length > 0
    const isPartial = !isUdhaar && r < 0.28 && named.length > 0
    const isCard = !isUdhaar && !isPartial && rng() < 0.3
    const cardFee = isCard ? Math.round((subtotal - discount + serviceCharge + deliveryCharge) * 0.01) : 0
    const total = subtotal - discount + serviceCharge + deliveryCharge + cardFee
    const customer = isUdhaar || isPartial ? pick(rng, named) : (rng() < 0.5 ? customers[0] : pick(rng, customers))
    const invoice = await prisma.invoice.create({
      data: {
        shopId: shop.id, customerId: customer.id, number: nextNo(), createdAt: when,
        status: 'COMPLETED',
        paymentStatus: isUdhaar ? 'UDHAAR' : isPartial ? 'PARTIAL' : 'PAID',
        paymentMethod: isUdhaar ? null : isCard ? 'CARD' : (rng() < 0.1 ? 'OTHER' : 'CASH'),
        subtotal: D(subtotal), discount: D(discount), serviceCharge: D(serviceCharge), deliveryCharge: D(deliveryCharge), total: D(total),
        createdByUserId: managerId,
        lines: { create: items.map((it) => ({ productId: it.productId, quantity: D(it.qty), unitPrice: D(it.price), lineTotal: D(it.price * it.qty), createdAt: when })) },
      },
      include: { lines: true },
    })
    for (const ln of invoice.lines) {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: ln.productId, changeQty: D(-Number(ln.quantity)), type: 'SALE', refType: 'invoice_line', refId: ln.id, createdAt: when } })
    }
    if (isUdhaar) {
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: customer.id, type: 'SALE_UDHAAR', direction: 'DEBIT', amount: D(total), refType: 'invoice', refId: invoice.id, createdAt: when } })
    } else if (isPartial) {
      const paidPart = Math.round(total * 0.5)
      await prisma.payment.create({ data: { shopId: shop.id, invoiceId: invoice.id, amount: D(paidPart), method: 'CASH', createdAt: when } })
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: customer.id, type: 'SALE_UDHAAR', direction: 'DEBIT', amount: D(total - paidPart), refType: 'invoice', refId: invoice.id, createdAt: when } })
    } else {
      await prisma.payment.create({ data: { shopId: shop.id, invoiceId: invoice.id, amount: D(total), method: isCard ? 'CARD' : 'CASH', createdAt: when } })
    }
    madeInvoices.push({ id: invoice.id, total, customerId: customer.id, items: items.map((it) => ({ productId: it.productId, qty: it.qty, price: it.price })) })
  }

  // --- A couple of VOID invoices (no net stock change) ---
  for (let i = 0; i < 2 && stocked.length; i++) {
    const when = daysAgo(randInt(rng, 5, 60))
    const p = pick(rng, stocked)
    await prisma.invoice.create({
      data: {
        shopId: shop.id, customerId: customers[0].id, number: nextNo(), createdAt: when, status: 'VOID',
        paymentStatus: 'PAID', paymentMethod: 'CASH', subtotal: D(p.price), discount: D(0), total: D(p.price), createdByUserId: managerId,
        lines: { create: [{ productId: p.id, quantity: D(1), unitPrice: D(p.price), lineTotal: D(p.price), createdAt: when }] },
      },
    })
  }

  // --- Udhaar receipts (cash-in) for some udhaar customers ---
  for (const c of named) {
    if (rng() < 0.4) {
      const amt = randInt(rng, 1, 5) * 500
      const when = daysAgo(randInt(rng, 1, 50))
      await prisma.payment.create({ data: { shopId: shop.id, customerId: c.id, amount: D(amt), method: 'CASH', note: 'Udhaar received', createdAt: when } })
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: c.id, type: 'PAYMENT_RECEIVED', direction: 'CREDIT', amount: D(amt), refType: 'payment', createdAt: when } })
    }
  }

  // --- Sale returns: refund (cash), refund (account credit), exchange ---
  const refundable = madeInvoices.filter((m) => m.items.length).slice(0, 3)
  for (let idx = 0; idx < refundable.length; idx++) {
    const m = refundable[idx]
    const it = m.items[0]
    const when = daysAgo(randInt(rng, 1, 30))
    const returnTotal = it.price * 1
    const kind = idx === 2 ? 'EXCHANGE' : 'REFUND'
    const settlement = idx === 1 ? 'ACCOUNT_CREDIT' : 'CASH'
    const replacementTotal = kind === 'EXCHANGE' ? it.price : 0
    const netRefund = returnTotal - replacementTotal
    const restocked = idx !== 0 // first return is damaged (not restocked)
    const sr = await prisma.saleReturn.create({
      data: {
        shopId: shop.id, originalInvoiceId: m.id, customerId: m.customerId, kind, createdAt: when,
        returnTotal: D(returnTotal), replacementTotal: D(replacementTotal), netRefund: D(netRefund),
        settlementMethod: settlement, createdByUserId: managerId,
        lines: {
          create: [
            { productId: it.productId, quantity: D(1), unitPrice: D(it.price), lineTotal: D(it.price), isReplacement: false, restocked, createdAt: when },
            ...(kind === 'EXCHANGE' ? [{ productId: it.productId, quantity: D(1), unitPrice: D(it.price), lineTotal: D(it.price), isReplacement: true, restocked: false, createdAt: when }] : []),
          ],
        },
      },
    })
    if (restocked) {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: it.productId, changeQty: D(1), type: 'RETURN', refType: 'sale_return', refId: sr.id, createdAt: when } })
    } else {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: it.productId, changeQty: D(0), type: 'DAMAGE', refType: 'sale_return', refId: sr.id, createdAt: when } })
    }
    if (settlement === 'CASH' && netRefund > 0) {
      await prisma.payment.create({ data: { shopId: shop.id, customerId: m.customerId, amount: D(-netRefund), method: 'CASH', note: 'Refund', createdAt: when } })
    } else if (settlement === 'ACCOUNT_CREDIT' && netRefund > 0) {
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: m.customerId, type: 'ADJUSTMENT', direction: 'CREDIT', amount: D(netRefund), refType: 'sale_return', refId: sr.id, createdAt: when } })
    }
  }

  // --- Quotations (quote-enabled trades only): OPEN, CANCELLED, CONVERTED ---
  if (isTrade) {
    const mkLines = () => Array.from({ length: randInt(rng, 1, 3) }, () => {
      const p = pick(rng, products); const q = randInt(rng, 1, 5)
      return { productId: p.id, quantity: D(q), unitPrice: D(p.tradePrice ?? p.price), lineTotal: D((p.tradePrice ?? p.price) * q) }
    })
    const sum = (ls: { lineTotal: Prisma.Decimal }[]) => ls.reduce((s, l) => s + Number(l.lineTotal), 0)
    let qno = 0; const nextQ = () => 'Q' + String(++qno).padStart(6, '0')
    for (const status of ['OPEN', 'CANCELLED', 'CONVERTED'] as const) {
      const when = daysAgo(randInt(rng, 5, 40))
      const lines = mkLines(); const subtotal = sum(lines)
      const q = await prisma.quotation.create({
        data: {
          shopId: shop.id, customerName: 'CONTRACTOR ' + status, number: nextQ(), status, createdAt: when,
          subtotal: D(subtotal), discount: D(0), total: D(subtotal), validUntil: daysAgo(-15), note: 'Site quotation',
          createdByUserId: managerId, lines: { create: lines },
        },
      })
      if (status === 'CONVERTED') {
        const inv = await prisma.invoice.create({
          data: {
            shopId: shop.id, customerId: customers[0].id, number: nextNo(), createdAt: when, status: 'COMPLETED', paymentStatus: 'PAID', paymentMethod: 'CASH', subtotal: D(subtotal), discount: D(0), total: D(subtotal), createdByUserId: managerId,
            lines: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, createdAt: when })) },
          },
          include: { lines: true },
        })
        for (const ln of inv.lines) await prisma.stockLedger.create({ data: { shopId: shop.id, productId: ln.productId, changeQty: D(-Number(ln.quantity)), type: 'SALE', refType: 'invoice_line', refId: ln.id, createdAt: when } })
        await prisma.payment.create({ data: { shopId: shop.id, invoiceId: inv.id, amount: D(subtotal), method: 'CASH', createdAt: when } })
        await prisma.quotation.update({ where: { id: q.id }, data: { convertedInvoiceId: inv.id, convertedAt: when } })
      }
    }
  }

  // --- Misc stock movements: ADJUSTMENT, EXPIRY, SELF_USE ---
  if (stocked.length) {
    const a = pick(rng, stocked)
    await prisma.stockLedger.create({ data: { shopId: shop.id, productId: a.id, changeQty: D(-randInt(rng, 1, 3)), type: 'ADJUSTMENT', refType: 'manual', createdAt: daysAgo(randInt(rng, 5, 40)) } })
    const b = pick(rng, stocked)
    await prisma.stockLedger.create({ data: { shopId: shop.id, productId: b.id, changeQty: D(-1), type: 'SELF_USE', refType: 'manual', createdAt: daysAgo(randInt(rng, 5, 40)) } })
    if (v.profile === 'PHARMACY' || v.profile === 'SPECIALTY') {
      const c = pick(rng, stocked)
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: c.id, changeQty: D(-randInt(rng, 1, 5)), type: 'EXPIRY', refType: 'manual', createdAt: daysAgo(randInt(rng, 5, 40)) } })
    }
  }

  // --- Expenses across categories over the period ---
  const nExp = randInt(rng, 10, 18)
  const expenses = Array.from({ length: nExp }, () => {
    const when = daysAgo(randInt(rng, 0, 89))
    return { shopId: shop.id, userId: managerId, amount: D(randInt(rng, 2, 30) * 500), category: pick(rng, EXPENSE_CATS), description: 'Demo expense', date: when, createdAt: when }
  })
  await prisma.expense.createMany({ data: expenses })
}

export async function seedDemoOrg() {
  const existing = await prisma.organization.findFirst({ where: { isDemo: true } })
  if (existing) {
    console.log(`Demo org already exists (${existing.name}, id=${existing.id}). Skipping. Use reset-demo-org.ts to rebuild.`)
    return existing
  }

  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12)

  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      type: 'GENERAL_STORE',
      status: 'ACTIVE',
      isDemo: true,
      city: 'Lahore',
      approvedAt: new Date(),
    },
  })

  const admin = await prisma.user.create({
    data: { name: 'Demo Admin', email: DEMO_USERS.admin, password: hashed, role: 'NORMAL', emailVerified: true, organizations: { create: { orgId: org.id, orgRole: 'ORG_ADMIN' } } },
  })
  const manager = await prisma.user.create({
    data: { name: 'Demo Manager', email: DEMO_USERS.manager, password: hashed, role: 'NORMAL', emailVerified: true },
  })
  const cashier = await prisma.user.create({
    data: { name: 'Demo Cashier', email: DEMO_USERS.cashier, password: hashed, role: 'NORMAL', emailVerified: true },
  })
  void admin

  const shopIds: string[] = []
  for (let i = 0; i < VERTICALS.length; i++) {
    const ctx = await seedShop(org.id, manager.id, VERTICALS[i], i)
    await simulate90Days(org.id, manager.id, VERTICALS[i], ctx)
    shopIds.push(ctx.shop.id)
    console.log(`  seeded ${VERTICALS[i].shopName} (${i + 1}/${VERTICALS.length})`)
  }

  // Cashier limited to the first shop (Kiryana); manager already STORE_MANAGER on all.
  await prisma.userShop.create({ data: { userId: cashier.id, shopId: shopIds[0], shopRole: 'CASHIER' } })

  console.log('✅ Demo org seeded.')
  console.log(`   Org: ${org.name} (id=${org.id})`)
  console.log(`   Shops: ${shopIds.length} (one per business type)`)
  console.log(`   Login password (all demo users): ${DEMO_PASSWORD}`)
  console.log(`   Org Admin:     ${DEMO_USERS.admin}`)
  console.log(`   Store Manager: ${DEMO_USERS.manager} (all shops)`)
  console.log(`   Cashier:       ${DEMO_USERS.cashier} (first shop only)`)
  return org
}

if (require.main === module) {
  seedDemoOrg()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
