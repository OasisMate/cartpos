# CartPOS

Offline-first POS (Point of Sale) for small retail / kiryana-style shops.  
Built as a modern web app (PWA) with support for basic stock, udhaar, and daily summaries.

> **Status:** Early development (v1 – internal use only)

> 📋 **Product Requirements:** See [`docs/PRD.md`](./docs/PRD.md) for the complete Product Requirements Document (single source of truth for all project requirements).

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

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase recommended)

### Setup Steps

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Set Up Database

1. Create a PostgreSQL database (via Supabase or your preferred provider)
2. Get your database connection string
3. Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
JWT_SECRET="your-secret-key-change-in-production-min-32-characters"
```

**⚠️ Important:** 
- Replace the connection string with your actual database credentials
- Generate a secure random string for JWT_SECRET (at least 32 characters)

#### 3. Run Prisma Migrations

Once you have the DATABASE_URL set up:

```bash
# Generate Prisma Client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init_schema

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

#### 4. Create Admin User

After running migrations, create your first admin user:

```bash
npm run create-admin
```

This will create an admin user with:
- Email: `admin@cartpos.com` (or set `ADMIN_EMAIL` env var)
- Password: `admin123` (or set `ADMIN_PASSWORD` env var)
- Name: `Admin User` (or set `ADMIN_NAME` env var)
- Role: `PLATFORM_ADMIN`

**⚠️ Important:** Change the default password after first login!

#### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the app running. You'll be redirected to `/login` if not authenticated.

**Login Credentials:**
- Email: `admin@cartpos.com` (or your custom `ADMIN_EMAIL`)
- Password: `admin123` (or your custom `ADMIN_PASSWORD`)

---

## 📂 Project Structure

```
cartpos/
├── docs/
│   └── PRD.md              # Product Requirements Document
├── prisma/
│   └── schema.prisma        # Database schema
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (admin)/         # Platform admin routes
│   │   ├── (backoffice)/    # Backoffice routes
│   │   ├── (pos)/           # POS routes
│   │   ├── api/             # API route handlers
│   │   └── ...
│   ├── components/         # React components
│   ├── lib/                 # Utilities and business logic
│   │   ├── db/              # Database (Prisma)
│   │   ├── domain/          # Business logic
│   │   └── offline/         # Offline & sync logic
│   └── ...
├── package.json
├── tsconfig.json
└── next.config.js
```
