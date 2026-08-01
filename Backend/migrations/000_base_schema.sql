-- Base tables for a fresh CareConnect database.
-- Existing installations can run this safely before the later migrations.

CREATE SEQUENCE IF NOT EXISTS patient_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS doctor_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS appointment_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS medical_record_id_seq START 1;

CREATE TABLE IF NOT EXISTS patient (
  PatientID TEXT PRIMARY KEY DEFAULT ('P' || LPAD(nextval('patient_id_seq')::TEXT, 3, '0')),
  FirstName VARCHAR(50) NOT NULL,
  LastName VARCHAR(50) NOT NULL,
  DateOfBirth DATE NOT NULL,
  Gender VARCHAR(20) NOT NULL,
  Phone VARCHAR(15) NOT NULL,
  Email VARCHAR(100),
  Address VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS doctor (
  DoctorID TEXT PRIMARY KEY DEFAULT ('D' || LPAD(nextval('doctor_id_seq')::TEXT, 3, '0')),
  FirstName VARCHAR(50) NOT NULL,
  LastName VARCHAR(50) NOT NULL,
  Specialization VARCHAR(50) NOT NULL DEFAULT 'General Practice',
  Phone VARCHAR(15),
  Email VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS appointment (
  AppointmentID TEXT PRIMARY KEY DEFAULT ('A' || LPAD(nextval('appointment_id_seq')::TEXT, 3, '0')),
  PatientID TEXT NOT NULL REFERENCES patient(PatientID),
  DoctorID TEXT NOT NULL REFERENCES doctor(DoctorID),
  AppointmentDate DATE NOT NULL,
  AppointmentTime TIME NOT NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
  Reason VARCHAR(255)
);

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
