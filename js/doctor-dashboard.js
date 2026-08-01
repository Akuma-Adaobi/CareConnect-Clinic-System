const API_BASE = '/api';
const DOCTOR_TOKEN_KEY = 'careconnect_doctor_token';
const DOCTOR_KEY = 'careconnect_doctor';
const { escapeHtml, localISODate, readJson } = window.CareConnect;

function getToken() {
  return localStorage.getItem(DOCTOR_TOKEN_KEY);
}

function requireAuthOrRedirect() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  return token;
}

function getStoredDoctor() {
  try {
    return JSON.parse(localStorage.getItem(DOCTOR_KEY) || '{}');
  } catch (err) {
    return {};
  }
}

function showMessage(text, type) {
  const box = document.getElementById('formMessage');
  box.textContent = text;
  box.className = `cc-message cc-show cc-${type}`;
}

function formatTime(value) {
  return (value || '').toString().slice(0, 5);
}

function statusClass(status) {
  const key = (status || '').toLowerCase();
  if (key.includes('complet')) return 'completed';
  if (key.includes('cancel') || key.includes('no-show')) return 'cancelled';
  return 'scheduled';
}

function appointmentHasStarted(appointment) {
  const today = localISODate();
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return appointment.date < today || (
    appointment.date === today && formatTime(appointment.time) <= currentTime
  );
}

let currentAppointments = [];

async function loadSchedule() {
  const token = requireAuthOrRedirect();
  if (!token) return;

  const date = document.getElementById('dateFilter').value || localISODate();
  const doctor = getStoredDoctor();
  const wrap = document.getElementById('scheduleWrap');

  if (!doctor.id) {
    localStorage.removeItem(DOCTOR_TOKEN_KEY);
    window.location.href = 'login.html';
    return;
  }

  if (doctor.firstName) {
    document.getElementById('doctorNameLabel').textContent = `Dr. ${doctor.firstName} ${doctor.lastName || ''}`;
  }
  document.getElementById('scheduleTitle').textContent = date === localISODate()
    ? "Today's schedule"
    : `Schedule for ${date}`;

  try {
    const query = new URLSearchParams({ date });
    const response = await fetch(
      `${API_BASE}/appointments/doctor/${encodeURIComponent(doctor.id)}?${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(DOCTOR_TOKEN_KEY);
      localStorage.removeItem(DOCTOR_KEY);
      window.location.href = 'login.html';
      return;
    }

    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load schedule');

    currentAppointments = data.appointments || [];
    renderKpis(currentAppointments);
    renderSchedule(currentAppointments);
  } catch (err) {
    wrap.innerHTML = `<div class="cc-empty"><strong>Something went wrong</strong>${escapeHtml(err.message)}</div>`;
  }
}

function renderKpis(appointments) {
  const total = appointments.length;
  const completed = appointments.filter((appointment) => appointment.status === 'Completed').length;
  const upcoming = appointments.filter((appointment) => appointment.status === 'Scheduled').length;

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiCompleted').textContent = completed;
  document.getElementById('kpiUpcoming').textContent = upcoming;
}

function renderSchedule(appointments) {
  const wrap = document.getElementById('scheduleWrap');

  if (appointments.length === 0) {
    wrap.innerHTML = '<div class="cc-empty"><strong>Nothing scheduled</strong>No appointments for this day.</div>';
    return;
  }

  const rows = appointments
    .map((appointment) => {
      const patientName = appointment.patientId
        ? `${appointment.patientId.firstName || ''} ${appointment.patientId.lastName || ''}`.trim()
        : 'Unknown patient';
      const isActionable = appointment.status === 'Scheduled' && appointmentHasStarted(appointment);
      const id = escapeHtml(appointment._id);
      const actions = isActionable
        ? `<button class="cc-action-btn cc-reschedule" data-id="${id}" data-action="note">Add visit note</button>
           <button class="cc-action-btn cc-cancel" data-id="${id}" data-action="noshow">Mark no-show</button>`
        : '-';

      return `
        <tr data-row="${id}">
          <td>${escapeHtml(formatTime(appointment.time))}</td>
          <td>${escapeHtml(patientName)}</td>
          <td>${escapeHtml(appointment.patientId?.phone || '-')}</td>
          <td>${escapeHtml(appointment.reason || '-')}</td>
          <td><span class="cc-status ${statusClass(appointment.status)}">${escapeHtml(appointment.status)}</span></td>
          <td>${actions}</td>
        </tr>`;
    })
    .join('');

  wrap.innerHTML = `
    <div class="cc-table-scroll">
      <table class="cc-table">
        <thead>
          <tr><th>Time</th><th>Patient</th><th>Phone</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  wrap.querySelectorAll('button[data-action="noshow"]').forEach((button) => {
    button.addEventListener('click', () => markNoShow(button.dataset.id));
  });
  wrap.querySelectorAll('button[data-action="note"]').forEach((button) => {
    button.addEventListener('click', () => openVisitNoteRow(button.dataset.id));
  });
}

async function markNoShow(appointmentId) {
  if (!confirm('Mark this appointment as a no-show?')) return;
  const token = requireAuthOrRedirect();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/appointments/${encodeURIComponent(appointmentId)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'No-show' }),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not update status');
    showMessage('Appointment marked as a no-show.', 'success');
    loadSchedule();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

function findAppointmentRow(appointmentId) {
  return [...document.querySelectorAll('tr[data-row]')]
    .find((row) => row.dataset.row === appointmentId);
}

function openVisitNoteRow(appointmentId) {
  const existingRow = [...document.querySelectorAll('tr.cc-reschedule-row')]
    .find((row) => row.dataset.for === appointmentId);
  if (existingRow) {
    existingRow.remove();
    return;
  }
  document.querySelectorAll('tr.cc-reschedule-row').forEach((row) => row.remove());

  const targetRow = findAppointmentRow(appointmentId);
  if (!targetRow) return;

  const row = document.createElement('tr');
  row.className = 'cc-reschedule-row';
  row.dataset.for = appointmentId;
  row.innerHTML = `
    <td colspan="6">
      <div class="cc-field">
        <label>Diagnosis</label>
        <input type="text" class="cc-note-diagnosis" maxlength="2000" />
      </div>
      <div class="cc-field">
        <label>Prescription (optional)</label>
        <input type="text" class="cc-note-prescription" maxlength="4000" />
      </div>
      <div class="cc-field">
        <label>Notes (optional)</label>
        <textarea class="cc-note-notes" rows="3" maxlength="8000"></textarea>
      </div>
      <div class="cc-reschedule-inline">
        <button type="button" class="cc-btn cc-note-save">Save visit note</button>
        <button type="button" class="cc-btn cc-btn-secondary cc-note-close">Close</button>
      </div>
    </td>`;

  targetRow.after(row);

  row.querySelector('.cc-note-close').addEventListener('click', () => row.remove());
  row.querySelector('.cc-note-save').addEventListener('click', async () => {
    const diagnosis = row.querySelector('.cc-note-diagnosis').value.trim();
    const prescription = row.querySelector('.cc-note-prescription').value.trim();
    const notes = row.querySelector('.cc-note-notes').value.trim();

    if (!diagnosis) {
      showMessage('Diagnosis is required.', 'error');
      return;
    }

    await saveVisitNote(appointmentId, diagnosis, prescription, notes);
  });
}

async function saveVisitNote(appointmentId, diagnosis, prescription, notes) {
  const token = requireAuthOrRedirect();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/medical-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appointmentId, diagnosis, prescription, notes }),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not save visit note');

    showMessage('Visit note saved and appointment marked completed.', 'success');
    loadSchedule();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

document.getElementById('logoutLink').addEventListener('click', (event) => {
  event.preventDefault();
  localStorage.removeItem(DOCTOR_TOKEN_KEY);
  localStorage.removeItem(DOCTOR_KEY);
  window.location.href = 'login.html';
});

document.getElementById('dateFilter').addEventListener('change', loadSchedule);
document.getElementById('dateFilter').value = localISODate();

requireAuthOrRedirect();
loadSchedule();
