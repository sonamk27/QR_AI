BEGIN;

DO $$
DECLARE
  old_name TEXT;
  new_name TEXT;
BEGIN
  FOR old_name, new_name IN
    SELECT * FROM (VALUES
      ('payments_gatewayorderid_key', 'payments_gatewayOrderId_key'),
      ('payments_gatewaypaymentid_key', 'payments_gatewayPaymentId_key'),
      ('payments_gatewayorderid_idx', 'payments_gatewayOrderId_idx'),
      ('payments_recordedbyid_idx', 'payments_recordedById_idx'),
      ('payments_qrrequestid_fkey', 'payments_qrRequestId_fkey'),
      ('qr_codes_qrrequestid_fkey', 'qr_codes_qrRequestId_fkey')
    )
  LOOP
    IF old_name LIKE '%_fkey' THEN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = to_regclass(
          CASE WHEN old_name LIKE 'payments_%' THEN 'payments' ELSE 'qr_codes' END
        )
          AND conname = old_name
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = to_regclass(
          CASE WHEN old_name LIKE 'payments_%' THEN 'payments' ELSE 'qr_codes' END
        )
          AND conname = new_name
      ) THEN
        EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
          CASE WHEN old_name LIKE 'payments_%' THEN 'payments' ELSE 'qr_codes' END,
          old_name,
          new_name);
      END IF;
    ELSIF to_regclass(format('%I', old_name)) IS NOT NULL
      AND to_regclass(format('%I', new_name)) IS NULL THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', old_name, new_name);
    END IF;
  END LOOP;
END $$;

ALTER TABLE qr_requests
  DROP CONSTRAINT IF EXISTS qr_requests_restaurant_id_fkey;
ALTER TABLE qr_requests
  ADD CONSTRAINT qr_requests_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES "Restaurant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE qr_codes
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

COMMIT;
