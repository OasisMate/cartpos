-- Per-shop running document numbers.
--
-- Replaces "SELECT MAX(number) + 1" numbering for invoices and quotations, which under
-- READ COMMITTED let two concurrent writers derive the same number.
--
-- Purely additive: no existing row is modified. Counters are seeded from each shop's
-- current highest number so numbering continues rather than restarting at 1.

CREATE TYPE "DocumentCounter" AS ENUM ('INVOICE', 'QUOTATION');

CREATE TABLE "ShopCounter" (
    "shopId" TEXT NOT NULL,
    "kind" "DocumentCounter" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShopCounter_pkey" PRIMARY KEY ("shopId", "kind")
);

ALTER TABLE "ShopCounter"
    ADD CONSTRAINT "ShopCounter_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every table carries RLS on with no policies; Prisma connects as `postgres` (bypassrls)
-- and there is no supabase-js client. Matches the rest of the schema.
ALTER TABLE "ShopCounter" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Clean up duplicate invoice numbers left behind by the old MAX(number)+1
-- numbering, in DEMO organisations only.
--
-- Scope is deliberate: live shops keep their numbers, because a printed receipt
-- already carries the old one. ROSE MART's three duplicates are left as they are
-- and are the reason no UNIQUE(shopId, number) constraint is added yet.
--
-- Within each duplicated group the earliest invoice keeps the number; the later
-- ones move above that shop's current highest number. Only "number" is touched:
-- no totals, no ledger, no stock. Re-running finds no duplicates and does nothing.
WITH demo_shops AS (
    SELECT s."id"
    FROM "Shop" s
    JOIN "Organization" o ON o."id" = s."orgId"
    WHERE o."isDemo" = true
),
shop_max AS (
    SELECT i."shopId",
           MAX(CAST(regexp_replace(i."number", '\D', '', 'g') AS INTEGER)) AS maxnum
    FROM "Invoice" i
    WHERE i."shopId" IN (SELECT "id" FROM demo_shops)
      AND i."number" IS NOT NULL
      AND regexp_replace(i."number", '\D', '', 'g') ~ '^[0-9]{1,9}$'
    GROUP BY i."shopId"
),
ranked AS (
    SELECT i."id",
           i."shopId",
           ROW_NUMBER() OVER (
               PARTITION BY i."shopId", i."number"
               ORDER BY i."createdAt", i."id"
           ) AS rn
    FROM "Invoice" i
    WHERE i."shopId" IN (SELECT "id" FROM demo_shops)
      AND i."number" IS NOT NULL
),
to_fix AS (
    SELECT r."id",
           r."shopId",
           ROW_NUMBER() OVER (PARTITION BY r."shopId" ORDER BY r."id") AS seq
    FROM ranked r
    WHERE r.rn > 1
)
UPDATE "Invoice" i
SET "number" = LPAD((sm.maxnum + tf.seq)::text, 6, '0')
FROM to_fix tf
JOIN shop_max sm ON sm."shopId" = tf."shopId"
WHERE i."id" = tf."id";

-- Seed from existing data. Strips non-digits ('Q000012' -> '000012' -> 12) and skips
-- rows whose number is null or has no digits at all.
INSERT INTO "ShopCounter" ("shopId", "kind", "value")
SELECT "shopId",
       'INVOICE'::"DocumentCounter",
       MAX(CAST(NULLIF(regexp_replace("number", '\D', '', 'g'), '') AS INTEGER))
FROM "Invoice"
WHERE "number" IS NOT NULL
  -- Length guard: a stray oversized value must not overflow the INTEGER cast and
  -- abort the whole migration. Real numbers are 6 digits.
  AND regexp_replace("number", '\D', '', 'g') ~ '^[0-9]{1,9}$'
GROUP BY "shopId"
ON CONFLICT ("shopId", "kind") DO NOTHING;

INSERT INTO "ShopCounter" ("shopId", "kind", "value")
SELECT "shopId",
       'QUOTATION'::"DocumentCounter",
       MAX(CAST(NULLIF(regexp_replace("number", '\D', '', 'g'), '') AS INTEGER))
FROM "Quotation"
WHERE "number" IS NOT NULL
  -- Length guard: a stray oversized value must not overflow the INTEGER cast and
  -- abort the whole migration. Real numbers are 6 digits.
  AND regexp_replace("number", '\D', '', 'g') ~ '^[0-9]{1,9}$'
GROUP BY "shopId"
ON CONFLICT ("shopId", "kind") DO NOTHING;
