# CartPOS Setup Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase recommended)

## Initial Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

1. Create a PostgreSQL database (via Supabase or your preferred provider)
2. Get your database connection string
3. Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
```

**⚠️ Important:** Replace the connection string with your actual database credentials.

### 3. Run Prisma Migrations

Once you have the DATABASE_URL set up:

```bash
# Generate Prisma Client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init_schema

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the app running.

## Project Structure

```
cartpos/
├── docs/
│   └── PRD.md              # Product Requirements Document
├── prisma/
│   └── schema.prisma        # Database schema
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   └── lib/
│       ├── db/
│       │   └── prisma.ts    # Prisma client singleton
│       ├── domain/           # Business logic (to be added)
│       └── offline/          # Offline & sync logic (to be added)
├── package.json
├── tsconfig.json
└── next.config.js
```

## Next Steps (Milestone M1)

After completing M0, proceed to:
- Set up base project structure & layout
- Create placeholder pages for POS, Backoffice, and Admin sections

See `docs/PRD.md` Section 12 for the complete development roadmap.

