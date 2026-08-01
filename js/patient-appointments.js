const API_BASE = '/api/patients';
const APPOINTMENTS_BASE = '/api/appointments';
const TOKEN_KEY = 'careconnect_patient_token';
const {
  escapeHtml,
  formatISODate,
  dateInputValue,
  localISODate,
  readJson,
} = window.CareConnect;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function requireAuthOrRedirect() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  return token;
}

function showMessage(text, type) {
  const box = document.getElementById('formMessage');
  box.textContent = text;
  box.className = `cc-message cc-show cc-${type}`;
}

function statusClass(status) {
  const key = (status || '').toLowerCase();
  if (key.includes('complet')) return 'completed';
  if (key.includes('cancel') || key.includes('no-show')) return 'cancelled';
  return 'scheduled';
}

function renderAppointments(appointments) {
  const wrap = document.getElementById('appointmentsWrap');

  if (!appointments || appointments.length === 0) {
    wrap.innerHTML = `
      <div class="cc-empty">
        <strong>No appointments yet</strong>
        Once you book with a doctor, it will show up here.
      </div>`;
    return;
  }

  const rows = appointments
    .map((appointment) => {
      const doctorName = appointment.doctorId
        ? `Dr. ${appointment.doctorId.firstName || ''} ${appointment.doctorId.lastName || ''}`.trim()
        : 'Unassigned';
      const isScheduled = (appointment.status || 'Scheduled') === 'Scheduled';
      const id = escapeHtml(appointment._id);
      const actions = isScheduled
        ? `<button class="cc-action-btn cc-reschedule" data-id="${id}" data-action="reschedule">Reschedule</button>
           <button class="cc-action-btn cc-cancel" data-id="${id}" data-action="cancel">Cancel</button>`
        : '-';

      return `
        <tr data-row="${id}">
          <td>${escapeHtml(formatISODate(appointment.date))}</td>
          <td>${escapeHtml(appointment.time || '-')}</td>
          <td>${escapeHtml(doctorName)}</td>
          <td>${escapeHtml(appointment.reason || '-')}</td>
          <td><span class="cc-status ${statusClass(appointment.status)}">${escapeHtml(appointment.status || 'Scheduled')}</span></td>
          <td>${actions}</td>
        </tr>`;
    })
    .join('');

  wrap.innerHTML = `
    <div class="cc-table-scroll">
      <table class="cc-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Doctor</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  wrap.querySelectorAll('button[data-action="cancel"]').forEach((button) => {
    button.addEventListener('click', () => handleCancel(button.dataset.id));
  });
  wrap.querySelectorAll('button[data-action="reschedule"]').forEach((button) => {
    button.addEventListener('click', () => openRescheduleRow(button.dataset.id, appointments));
  });
}

async function handleCancel(appointmentId) {
  if (!confirm('Cancel this appointment?')) return;

  const token = requireAuthOrRedirect();
  if (!token) return;

  try {
    const response = await fetch(`${APPOINTMENTS_BASE}/${encodeURIComponent(appointmentId)}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not cancel appointment');

    showMessage('Appointment cancelled.', 'success');
    loadAppointments();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

function findAppointmentRow(appointmentId) {
  return [...document.querySelectorAll('tr[data-row]')]
    .find((row) => row.dataset.row === appointmentId);
}

function openRescheduleRow(appointmentId, appointments) {
  const existingRow = [...document.querySelectorAll('tr.cc-reschedule-row')]
    .find((row) => row.dataset.for === appointmentId);
  if (existingRow) {
    existingRow.remove();
    return;
  }

  document.querySelectorAll('tr.cc-reschedule-row').forEach((row) => row.remove());

  const appointment = appointments.find((item) => String(item._id) === appointmentId);
  const targetRow = findAppointmentRow(appointmentId);
  if (!appointment || !targetRow || !appointment.doctorId?.id) return;

  const row = document.createElement('tr');
  row.className = 'cc-reschedule-row';
  row.dataset.for = appointmentId;
  row.innerHTML = `
    <td colspan="6">
      <div class="cc-reschedule-inline">
        <div class="cc-field">
          <label>New date</label>
          <input type="date" class="cc-reschedule-date" min="${localISODate()}" value="${escapeHtml(dateInputValue(appointment.date))}" />
        </div>
        <div class="cc-field">
          <label>Available time</label>
          <select class="cc-reschedule-time" disabled>
            <option value="">Loading slots...</option>
          </select>
        </div>
        <button type="button" class="cc-btn cc-reschedule-confirm" disabled>Confirm</button>
        <button type="button" class="cc-btn cc-btn-secondary cc-reschedule-close">Close</button>
      </div>
    </td>`;

  targetRow.after(row);

  const dateInput = row.querySelector('.cc-reschedule-date');
  const closeButton = row.querySelector('.cc-reschedule-close');
  const confirmButton = row.querySelector('.cc-reschedule-confirm');

  closeButton.addEventListener('click', () => row.remove());
  dateInput.addEventListener('change', () => loadRescheduleSlots(row, appointment));
  confirmButton.addEventListener('click', async () => {
    const date = dateInput.value;
    const time = row.querySelector('.cc-reschedule-time').value;
    if (!date || !time) {
      showMessage('Choose a new date and an available time.', 'error');
      return;
    }
    await submitReschedule(appointmentId, date, time);
  });

  loadRescheduleSlots(row, appointment);
}

async function loadRescheduleSlots(row, appointment) {
  const token = requireAuthOrRedirect();
  if (!token) return;

  const date = row.querySelector('.cc-reschedule-date').value;
  const select = row.querySelector('.cc-reschedule-time');
  const confirmButton = row.querySelector('.cc-reschedule-confirm');
  select.disabled = true;
  confirmButton.disabled = true;
  select.innerHTML = '<option value="">Loading slots...</option>';

  try {
    const query = new URLSearchParams({
      doctorId: appointment.doctorId.id,
      date,
    });
    const response = await fetch(`${APPOINTMENTS_BASE}/available-slots?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load available times');

    if (!data.slots || data.slots.length === 0) {
      select.innerHTML = '<option value="">No open times</option>';
      return;
    }

    select.innerHTML = '<option value="">Select a time</option>' + data.slots
      .map((slot) => `<option value="${escapeHtml(slot)}">${escapeHtml(slot)}</option>`)
      .join('');
    select.disabled = false;
    select.onchange = () => {
      confirmButton.disabled = !select.value;
    };
  } catch (err) {
    select.innerHTML = `<option value="">${escapeHtml(err.message)}</option>`;
  }
}

async function submitReschedule(appointmentId, date, time) {
  const token = requireAuthOrRedirect();
  if (!token) return;

  try {
    const response = await fetch(`${APPOINTMENTS_BASE}/${encodeURIComponent(appointmentId)}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, time }),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not reschedule appointment');

    showMessage('Appointment rescheduled.', 'success');
    loadAppointments();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function loadAppointments() {
  const token = requireAuthOrRedirect();
  if (!token) return;

  const wrap = document.getElementById('appointmentsWrap');

  try {
    const response = await fetch(`${API_BASE}/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'login.html';
      return;
    }

    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load your appointments');

    renderAppointments(data.appointments);
  } catch (err) {
    wrap.innerHTML = `<div class="cc-empty"><strong>Something went wrong</strong>${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('logoutLink').addEventListener('click', (event) => {
  event.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('careconnect_patient');
  window.location.href = 'login.html';
});

loadAppointments();
