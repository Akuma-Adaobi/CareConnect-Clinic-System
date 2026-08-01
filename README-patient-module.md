# CareConnect — Full Build (Patient, Appointment, Doctor, Admin, Medical Records)

PostgreSQL (Supabase) + Express, raw SQL via `pg` (no ORM). Plain HTML/CSS/JS
frontend, three portals: Patient, Doctor, Admin.

## What's in here

```
server.js                      entry point -- just boots Backend/app.js + serves static files
Backend/
  app.js                       Express app + all route mounting (this is what tests import)
  db.js                        Postgres connection pool
  migrations/
    001_patient_appointment_fixes.sql   run first
    002_doctor_admin_medrecord_fixes.sql run second
  models/            patientModel, doctorModel, appointmentModel, adminModel,
                      medicalRecordModel, auditLogModel -- raw SQL query functions
  controllers/       patientController, appointmentController, doctorController,
                      adminController, medicalRecordController
  routes/            patientRoutes, appointmentRoutes, doctorRoutes,
                      adminRoutes, medicalRecordRoutes
  middleware/auth.js  protect (any logged-in user) + requireRole('doctor'|'admin'|'patient')
  seed/               seedDoctors.js, seedAdmin.js
  tests/              patient.test.js, appointment.test.js, doctorAdmin.test.js
patient/              register, login, profile, appointments, medical-history
Appointment/           book.html (live slot picker)
Doctor/                login, dashboard (today's schedule + visit notes + no-show)
Admin/                 login, dashboard (add doctors + attendance/utilization reports)
js/, css/              frontend logic + one shared stylesheet
```

## 1. A heads-up (still applies)

Postgres lowercases unquoted column names -- `PatientID` in your original
`CREATE TABLE` is actually stored as `patientid`. Every query here uses the
real lowercase names.

## 2. Dependencies

```bash
npm install express pg bcrypt jsonwebtoken dotenv cors
npm install --save-dev jest supertest
```

## 3. Run both migrations, in order

```bash
psql "$DATABASE_URL" -f Backend/migrations/001_patient_appointment_fixes.sql
psql "$DATABASE_URL" -f Backend/migrations/002_doctor_admin_medrecord_fixes.sql
```
(Or paste each file's contents into your hosting provider's SQL console.)

If you already ran the old `seedDoctors.js` before migration 002 added the
doctor password column, those 3 rows have an unusable blank password --
run `DELETE FROM doctor;` and re-seed (step 5).

## 4. `.env` -- same as before, nothing new needed

```
DATABASE_URL=postgresql://...
JWT_SECRET=some-long-random-string
PORT=5000
PGSSL=true
```

## 5. Seed test accounts

```bash
node Backend/seed/seedDoctors.js   # 3 doctors, password: Doctor123!
node Backend/seed/seedAdmin.js     # 1 admin,  manager@careconnect.test / Manager123!
```

## 6. Replace your `server.js` with the one in this zip

It's now much simpler -- it just requires `Backend/app.js` (which does all
the route mounting) and starts listening. This split matters: it's what
lets the test suite import the app directly without opening a real port.

## 7. Run it

```bash
node server.js
```
`Server running on port 5000` with an actual number.

## 8. Try all three portals

- Patient: `http://localhost:5000/patient/register.html`
- Doctor: `http://localhost:5000/Doctor/login.html` (`ifeoma.nwosu@careconnect.test` / `Doctor123!`)
- Admin: `http://localhost:5000/Admin/login.html` (`manager@careconnect.test` / `Manager123!`)

A realistic walkthrough: register a patient → book an appointment with a
seeded doctor → log in as that doctor → see it on today's schedule → add a
visit note (auto-marks it Completed) → log back in as the patient → see it
under Medical History. Then check the Admin reports tab to see the
completed count reflected there.

## 9. Run the tests

```bash
npx jest Backend/tests
```
These mock the database (`jest.mock('../db', ...)`), so they run without
touching Supabase at all -- they're testing your actual controller logic
(validation, conflict checks, role gating), not the database itself.

## 10. What's still a stub / simplification, and why

- **Working hours are a shared default** (9am-5pm, 30-min slots, no Sundays)
  for every doctor, since the schema has no per-doctor hours. Add
  `starttime`/`endtime`/`slotminutes` columns to `doctor` if you want that.
- **SMS reminders from the presentation aren't built.** Real SMS costs money
  and needs business verification (Twilio etc.) -- not realistic for a
  student project's budget. Free email reminders are a reasonable
  substitute if you want to add them (Nodemailer + a free-tier transactional
  email API), but they're not in this drop.
- **CSV export only** for reports, not PDF -- PDF generation is a bigger
  lift for what it adds; the Admin dashboard's Export button downloads a
  CSV client-side from data already on the page.
- **Audit log** only covers doctor-added and medical-record-added events
  right now (`Backend/models/auditLogModel.js`) -- extend the same
  `logAction()` call into other controllers if your rubric wants broader
  coverage.

## 11. Deploying (Render, not Vercel -- see reasoning from before)

1. Push everything to GitHub (step 12 below covers the git commands)
2. Go to render.com → New → Web Service → connect your repo
3. Build command: `npm install` · Start command: `node server.js`
4. Add the same 4 env vars from your `.env` in Render's dashboard
5. Deploy -- you get a live `https://your-app.onrender.com` URL

Free tier spins down after 15 min idle -- first request after that takes
~30-60s to wake back up. Fine for a demo, just don't let it catch you off
guard mid-presentation; open the live URL a minute before you need it.

## 12. Push to the group repo

```bash
git clone https://github.com/Akuma-Adaobi/CareConnect-Clinic-System.git
cd CareConnect-Clinic-System
git checkout -b full-system-build

# copy in server.js, Backend/, patient/, Appointment/, Doctor/, Admin/, js/, css/
# from this zip, merging into existing folders

git add .
git commit -m "Add patient, appointment, doctor, admin, and medical records modules"
git push origin full-system-build
```

Open a Pull Request into `main`.
