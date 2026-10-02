BEGIN;

ALTER TABLE IF EXISTS "Payment" DROP CONSTRAINT IF EXISTS "Payment_requestId_fkey";
ALTER TABLE IF EXISTS "QrCode" DROP CONSTRAINT IF EXISTS "QrCode_requestId_fkey";

DO $$
DECLARE
  relation_name TEXT;
  relation_kind "char";
  row_count BIGINT;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['audit_log', 'payments', 'qr_codes', 'qr_requests']
  LOOP
    SELECT c.relkind INTO relation_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = relation_name;

    IF relation_kind = 'v' THEN
      EXECUTE format('DROP VIEW public.%I', relation_name);
    ELSIF relation_kind = 'm' THEN
      EXECUTE format('DROP MATERIALIZED VIEW public.%I', relation_name);
    ELSIF relation_kind = 'r' THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', relation_name)
        INTO row_count;
      IF row_count <> 0 THEN
        RAISE EXCEPTION 'Refusing to drop non-empty compatibility table %', relation_name;
      END IF;
      EXECUTE format('DROP TABLE public.%I', relation_name);
    END IF;
    relation_kind := NULL;
  END LOOP;
END $$;

ALTER TABLE "QrRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "QrRequestStatus" RENAME TO "QrRequestStatus_old";
CREATE TYPE "QrRequestStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED_PAYMENT_DUE',
  'PAID',
  'ACTIVE',
  'REJECTED'
);
ALTER TABLE "QrRequest"
  ALTER COLUMN "status" TYPE "QrRequestStatus"
  USING (
    CASE "status"::text
      WHEN 'APPROVED' THEN 'APPROVED_PAYMENT_DUE'
      ELSE "status"::text
    END
  )::"QrRequestStatus";
ALTER TABLE "QrRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';
DROP TYPE "QrRequestStatus_old";

ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "PaymentStatus_new" AS ENUM (
  'RECORDED',
  'CONFIRMED',
  'REJECTED',
  'PENDING',
  'PAID'
);
ALTER TABLE "Payment"
  ALTER COLUMN "status" TYPE "PaymentStatus_new"
  USING (
    CASE "status"::text
      WHEN 'CREATED' THEN 'PENDING'
      WHEN 'FAILED' THEN 'REJECTED'
      ELSE "status"::text
    END
  )::"PaymentStatus_new";
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
UPDATE "Payment"
SET method = COALESCE(method, 'UPI'),
    reference = COALESCE(
      reference,
      "gatewayPaymentId",
      "gatewayOrderId",
      "razorpayPaymentId",
      "razorpayOrderId",
      "invoiceNo",
      'legacy-unreferenced'
    );
ALTER TABLE "Payment"
  ALTER COLUMN "method" TYPE "PaymentMethod"
  USING upper(method)::"PaymentMethod";
ALTER TABLE "Payment"
  ALTER COLUMN "method" SET DEFAULT 'UPI',
  ALTER COLUMN "method" SET NOT NULL,
  ALTER COLUMN "reference" SET NOT NULL;

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'SUPER_ADMIN');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'SALES_AGENT' THEN 'ADMIN'
      ELSE "role"::text
    END
  )::"Role_new";
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';

ALTER TABLE "QrRequest" RENAME TO qr_requests;
ALTER TABLE "QrCode" RENAME TO qr_codes;
ALTER TABLE "Payment" RENAME TO payments;
ALTER TABLE "AuditLog" RENAME TO audit_log;

ALTER TABLE qr_requests RENAME COLUMN "restaurantId" TO restaurant_id;
ALTER TABLE qr_codes RENAME COLUMN "restaurantId" TO restaurant_id;
ALTER TABLE payments RENAME COLUMN "restaurantId" TO restaurant_id;
UPDATE qr_codes
SET "qrRequestId" = "requestId"
WHERE "qrRequestId" IS NULL
  AND "requestId" IS NOT NULL;
UPDATE payments
SET "qrRequestId" = "requestId"
WHERE "qrRequestId" IS NULL
  AND "requestId" IS NOT NULL;

DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('qr_requests', 'QrRequest_pkey', 'qr_requests_pkey'),
      ('qr_requests', 'QrRequest_restaurantId_fkey', 'qr_requests_restaurant_id_fkey'),
      ('qr_codes', 'QrCode_pkey', 'qr_codes_pkey'),
      ('qr_codes', 'QrCode_restaurantId_fkey', 'qr_codes_restaurant_id_fkey'),
      ('qr_codes', 'QrCode_qrRequestId_fkey', 'qr_codes_qrRequestId_fkey'),
      ('payments', 'Payment_pkey', 'payments_pkey'),
      ('payments', 'Payment_restaurantId_fkey', 'payments_restaurant_id_fkey'),
      ('payments', 'Payment_qrId_fkey', 'payments_qrId_fkey'),
      ('payments', 'Payment_qrRequestId_fkey', 'payments_qrRequestId_fkey'),
      ('payments', 'Payment_recordedById_fkey', 'payments_recordedById_fkey'),
      ('audit_log', 'AuditLog_pkey', 'audit_log_pkey')
    ) AS names(table_name, old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = to_regclass(item.table_name) AND conname = item.old_name
    ) THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        item.table_name, item.old_name, item.new_name);
    END IF;
  END LOOP;

  FOR item IN
    SELECT * FROM (VALUES
      ('QrRequest_restaurantId_idx', 'qr_requests_restaurant_id_idx'),
      ('QrRequest_status_idx', 'qr_requests_status_idx'),
      ('QrCode_slug_key', 'qr_codes_slug_key'),
      ('QrCode_restaurantId_idx', 'qr_codes_restaurant_id_idx'),
      ('QrCode_status_validUntil_idx', 'qr_codes_status_validUntil_idx'),
      ('Payment_invoiceNo_key', 'payments_invoiceNo_key'),
      ('Payment_gatewayOrderId_key', 'payments_gatewayOrderId_key'),
      ('Payment_gatewayPaymentId_key', 'payments_gatewayPaymentId_key'),
      ('Payment_restaurantId_idx', 'payments_restaurant_id_idx'),
      ('Payment_status_idx', 'payments_status_idx'),
      ('Payment_recordedById_idx', 'payments_recordedById_idx'),
      ('Payment_gatewayOrderId_idx', 'payments_gatewayOrderId_idx')
    ) AS names(old_name, new_name)
  LOOP
    IF to_regclass(format('%I', item.old_name)) IS NOT NULL THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', item.old_name, item.new_name);
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_gatewayOrderId_key
  ON payments ("gatewayOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS payments_gatewayPaymentId_key
  ON payments ("gatewayPaymentId");
CREATE INDEX IF NOT EXISTS payments_recordedById_idx ON payments ("recordedById");
CREATE INDEX IF NOT EXISTS payments_gatewayOrderId_idx ON payments ("gatewayOrderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qr_codes_qrRequestId_fkey'
  ) THEN
    ALTER TABLE qr_codes
      ADD CONSTRAINT qr_codes_qrRequestId_fkey
      FOREIGN KEY ("qrRequestId") REFERENCES qr_requests(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_qrRequestId_fkey'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_qrRequestId_fkey
      FOREIGN KEY ("qrRequestId") REFERENCES qr_requests(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE audit_log ADD COLUMN restaurant_id TEXT;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX audit_log_restaurant_id_created_at_idx ON audit_log (restaurant_id, "createdAt");

UPDATE qr_codes AS qr
SET
  status = 'ACTIVE',
  "validFrom" = COALESCE(qr."validFrom", CURRENT_TIMESTAMP),
  "validUntil" = COALESCE(qr."validUntil", CURRENT_TIMESTAMP + INTERVAL '365 days')
FROM qr_requests AS request
WHERE qr."qrRequestId" = request.id
  AND qr.status = 'PENDING_PAYMENT'
  AND EXISTS (
    SELECT 1
    FROM payments AS payment
    WHERE payment."qrRequestId" = request.id
      AND payment.status IN ('PAID', 'CONFIRMED')
  );

INSERT INTO qr_codes (
  "id",
  restaurant_id,
  "name",
  "location",
  "tableNo",
  "slug",
  "status",
  "validFrom",
  "validUntil",
  "qrRequestId"
)
SELECT
  'migrated_qr_' || md5(random()::text || clock_timestamp()::text || request.id || code_number::text),
  request.restaurant_id,
  request.name || CASE WHEN request.quantity > 1 THEN ' #' || code_number::text ELSE '' END,
  request.location,
  request."tableNo",
  'migrated-' || md5(random()::text || clock_timestamp()::text || request.id || code_number::text),
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '365 days',
  request.id
FROM qr_requests AS request
CROSS JOIN LATERAL generate_series(
  (
    SELECT COUNT(*) + 1
    FROM qr_codes
    WHERE "qrRequestId" = request.id
      AND status IN ('ACTIVE', 'GRACE')
  ),
  request.quantity
) AS code_number
WHERE request.status IN ('APPROVED_PAYMENT_DUE', 'PAID', 'ACTIVE')
  AND EXISTS (
    SELECT 1
    FROM payments AS payment
    WHERE payment."qrRequestId" = request.id
      AND payment.status IN ('PAID', 'CONFIRMED')
  );

UPDATE qr_requests AS request
SET status = 'ACTIVE'
WHERE status IN ('APPROVED_PAYMENT_DUE', 'PAID')
  AND EXISTS (
    SELECT 1
    FROM payments AS payment
    WHERE payment."qrRequestId" = request.id
      AND payment.status IN ('PAID', 'CONFIRMED')
      AND (
        SELECT COUNT(*)
        FROM qr_codes AS qr
        WHERE qr."qrRequestId" = request.id
          AND qr.status IN ('ACTIVE', 'GRACE')
      ) >= request.quantity
  );

UPDATE qr_requests AS request
SET status = 'PAID'
WHERE status = 'APPROVED_PAYMENT_DUE'
  AND EXISTS (
    SELECT 1
    FROM payments AS payment
    WHERE payment."qrRequestId" = request.id
      AND payment.status IN ('PAID', 'CONFIRMED')
  );

UPDATE audit_log AS log
SET restaurant_id = CASE
  WHEN log.action LIKE 'qr_request.%' THEN (
    SELECT request.restaurant_id FROM qr_requests AS request WHERE request.id = log.target
  )
  WHEN log.action LIKE 'payment.%' THEN (
    SELECT payment.restaurant_id FROM payments AS payment WHERE payment.id = log.target
  )
  WHEN log.action LIKE 'qr.%' OR log.action = 'qr.create_and_activate' THEN (
    SELECT qr.restaurant_id FROM qr_codes AS qr WHERE qr.id = log.target
  )
  WHEN log.action LIKE 'restaurant.%' THEN log.target
  ELSE NULL
END;

COMMIT;
