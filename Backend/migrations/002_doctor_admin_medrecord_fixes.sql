-- Run this once, after 001_patient_appointment_fixes.sql. Same deal: safe
-- on an empty/test dataset.

-- 1. Doctors need a password to log in -- wasn't in the original schema at all.
ALTER TABLE doctor ADD COLUMN IF NOT EXISTS passwordhash TEXT NOT NULL DEFAULT '';
ALTER TABLE doctor ALTER COLUMN passwordhash DROP DEFAULT;
ALTER TABLE doctor ALTER COLUMN email SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_email_unique'
  ) THEN
    ALTER TABLE doctor ADD CONSTRAINT doctor_email_unique UNIQUE (email);
  END IF;
END
$$;

-- If you already ran the old seed script before this migration, those 3
-- test doctors now have passwordhash = '' and can't log in. Easiest fix:
--   DELETE FROM doctor;
-- then re-run the updated Backend/seed/seedDoctors.js after this migration.

-- 2. A simple admin/manager table -- didn't exist before at all.
--    Named admin_user, not admin, to keep it unambiguous in tools/queries.
CREATE SEQUENCE IF NOT EXISTS AdminIdSeq START 1;
CREATE TABLE IF NOT EXISTS admin_user (
  AdminID TEXT PRIMARY KEY DEFAULT ('AM' || LPAD(nextval('AdminIdSeq')::TEXT, 3, '0')),
  FirstName TEXT NOT NULL,
  LastName TEXT NOT NULL,
  Email TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL
);

-- 2b. Some copies of the original schema did not include MedicalRecord.
CREATE SEQUENCE IF NOT EXISTS medical_record_id_seq START 1;
CREATE TABLE IF NOT EXISTS medical_record (
  RecordID TEXT PRIMARY KEY DEFAULT ('MR' || LPAD(nextval('medical_record_id_seq')::TEXT, 3, '0')),
  PatientID TEXT NOT NULL REFERENCES patient(PatientID),
  AppointmentID TEXT NOT NULL REFERENCES appointment(AppointmentID),
  DoctorID TEXT NOT NULL REFERENCES doctor(DoctorID),
  VisitDate DATE NOT NULL DEFAULT CURRENT_DATE,
  Diagnosis TEXT NOT NULL,
  Prescription TEXT,
  Notes TEXT
);

-- 3. Utilization reporting needs to distinguish "didn't show up" from
--    "cancelled in advance" -- adding No-show as a real status.
ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_status_check;
ALTER TABLE appointment ADD CONSTRAINT appointment_status_check
  CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No-show'));

-- 4. Minimal audit trail -- who changed what, when. Covers the "Full Audit
--    Trail" line from the security slide without over-engineering it.
CREATE TABLE IF NOT EXISTS audit_log (
  AuditLogID SERIAL PRIMARY KEY,
  TableName TEXT NOT NULL,
  RecordID TEXT NOT NULL,
  Action TEXT NOT NULL,           -- 'INSERT' | 'UPDATE' | 'DELETE'
  PerformedBy TEXT,               -- doctorid / adminid / patientid of whoever did it
  PerformedByRole TEXT,           -- 'doctor' | 'admin' | 'patient'
  PerformedAt TIMESTAMPTZ NOT NULL DEFAULT now(),
  Details TEXT
);
