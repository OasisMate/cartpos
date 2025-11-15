# CartPOS

Offline-first POS (Point of Sale) for small retail / kiryana-style shops.  
Built as a modern web app (PWA) with support for basic stock, udhaar, and daily summaries.

> **Status:** Early development (v1 – internal use only)

---

## 🎯 Project Goals

CartPOS is designed to:

- Work smoothly on low-end **Windows PCs** using a browser.
- Keep billing working for a **few hours without internet** (offline-first).
- Be simple enough that a cashier with basic education can learn it in **~1 hour**.
- Support:
  - Fast billing (barcode scanner or manual search)
  - Basic stock control (purchases + stock ledger)
  - Udhaar (customer credit) and payments
  - Daily sales summary

---

## 🧱 Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **UI:** React + Tailwind CSS
- **Database:** PostgreSQL (e.g. Supabase)
- **ORM:** Prisma
- **Auth:** Email/password (implementation detail)
- **Offline:** PWA + IndexedDB (via custom helpers / Dexie or similar)
- **Hosting (planned):** Vercel for app, Supabase for DB

---

## 📂 Project Structure (planned)

```txt
/
  docs/
    PRD.md              # Full product requirements document
  prisma/
    schema.prisma       # Database schema
  src/                  # Next.js App Router (if using /src)
    app/
      (pos)/            # POS UI
      (backoffice)/     # Owner views (products, purchases, customers, reports)
      (admin)/          # Platform admin (shops, users)
      api/              # Route handlers (backend endpoints)
  lib/
    db/
      prisma.ts         # Prisma client singleton
    domain/             # Business logic (sales, products, purchases, udhaar, etc.)
    offline/            # IndexedDB + sync logic (PWA)
