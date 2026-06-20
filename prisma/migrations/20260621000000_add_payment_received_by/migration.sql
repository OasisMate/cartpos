-- Payment accountability: which staff member received/recorded the payment.
-- Nullable; existing rows stay NULL ("recorded before tracking"). FK is ON DELETE SET NULL
-- so deleting a user never deletes their payment history.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receivedById" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_receivedById_idx" ON "Payment"("receivedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_receivedById_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_receivedById_fkey"
      FOREIGN KEY ("receivedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
