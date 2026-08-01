-- Prevent booking races and keep common lookups fast.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM appointment
    WHERE status != 'Cancelled'
    GROUP BY doctorid, appointmentdate, appointmenttime
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Active duplicate appointment slots exist. Resolve them before running migration 003.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS appointment_active_slot_unique
  ON appointment (doctorid, appointmentdate, appointmenttime)
  WHERE status != 'Cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS medical_record_appointment_unique
  ON medical_record (appointmentid);

CREATE UNIQUE INDEX IF NOT EXISTS patient_email_lower_unique
  ON patient (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS doctor_email_lower_unique
  ON doctor (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS admin_email_lower_unique
  ON admin_user (LOWER(email));

CREATE INDEX IF NOT EXISTS appointment_patient_date_idx
  ON appointment (patientid, appointmentdate DESC, appointmenttime DESC);

CREATE INDEX IF NOT EXISTS appointment_doctor_date_idx
  ON appointment (doctorid, appointmentdate, appointmenttime);

CREATE INDEX IF NOT EXISTS medical_record_patient_date_idx
  ON medical_record (patientid, visitdate DESC);
