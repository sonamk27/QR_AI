-- Migration: Add database-level constraints for loyalty program correctness
-- Date: 20261021000000_loyalty_constraints
--
-- 1. Partial unique index on loyalty_transactions(programId, customerId, billReference)
--    where billReference IS NOT NULL. This ensures no customer can have two stamp
--    transactions with the same bill reference number within the same program, even
--    under concurrent requests (preventing TOCTOU bypass of the app-level check).
--
-- 2. The loyalty_rewards.code column already has a @unique constraint from the ORM,
--    which maps to a unique index on the code column — confirmed via schema.
--    No additional index needed for codes.

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_tx_unique_bill_ref"
  ON "loyalty_transactions" ("program_id", "customer_id", "billReference")
  WHERE "billReference" IS NOT NULL;
