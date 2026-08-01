-- Run this once against your database (psql, or your host's SQL console)
-- before starting the server. Safe to run on an empty/test dataset.

-- 1. The patient table has no password column -- login can't work without one.
ALTER TABLE patient ADD COLUMN IF NOT EXISTS passwordhash TEXT NOT NULL DEFAULT '';
ALTER TABLE patient ALTER COLUMN passwordhash DROP DEFAULT;

-- 2. Email needs to be unique and required -- it's the login credential.
--    If this fails with a duplicate/null key error, you've got leftover
--    test rows with blank/duplicate emails -- run `DELETE FROM patient;`
--    (safe on test data) and re-run this block.
ALTER TABLE patient ALTER COLUMN email SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_email_unique'
  ) THEN
    ALTER TABLE patient ADD CONSTRAINT patient_email_unique UNIQUE (email);
  END IF;
END
$$;

-- 3. Status currently only allows 'true' / 'pending' / 'false', which doesn't
--    describe an appointment's real state. Switching to values that actually
--    mean something.
ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_status_check;
ALTER TABLE appointment ALTER COLUMN status SET DEFAULT 'Scheduled';
ALTER TABLE appointment ADD CONSTRAINT appointment_status_check
  CHECK (status IN ('Scheduled', 'Completed', 'Cancelled'));

-- 4. AppointmentTime was TIMESTAMP even though AppointmentDate already
--    covers the date -- just needs to be a time of day.
ALTER TABLE appointment ALTER COLUMN appointmenttime TYPE TIME USING appointmenttime::time;
