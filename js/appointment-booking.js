const API_BASE = '/api';
const TOKEN_KEY = 'careconnect_patient_token';
const { escapeHtml, localISODate, readJson } = window.CareConnect;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function requireAuthOrRedirect() {
  const token = getToken();
  if (!token) {
    window.location.href = '../patient/login.html';
    return null;
  }
  return token;
}

function showMessage(text, type) {
  const box = document.getElementById('formMessage');
  box.textContent = text;
  box.className = `cc-message cc-show cc-${type}`;
}

let selectedTime = null;

async function loadDoctors() {
  try {
    const response = await fetch(`${API_BASE}/doctors`);
    const data = await readJson(response);
    const select = document.getElementById('doctorSelect');

    if (!data.doctors || data.doctors.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No doctors available yet</option>';
      return;
    }

    select.innerHTML =
      '<option value="" disabled selected>Select a doctor</option>' +
      data.doctors
        .map((doctor) => `
          <option value="${escapeHtml(doctor._id)}">
            Dr. ${escapeHtml(doctor.firstName)} ${escapeHtml(doctor.lastName)} - ${escapeHtml(doctor.specialty)}
          </option>`)
        .join('');
  } catch (err) {
    showMessage('Could not load the doctor list. Is the backend running?', 'error');
  }
}

async function loadSlots() {
  const doctorId = document.getElementById('doctorSelect').value;
  const date = document.getElementById('dateInput').value;
  const grid = document.getElementById('slotGrid');

  if (!doctorId || !date) return;

  grid.innerHTML = '<p class="cc-sub" style="grid-column: 1 / -1;">Loading slots…</p>';
  selectedTime = null;
  document.getElementById('selectedTime').value = '';

  const token = requireAuthOrRedirect();
  if (!token) return;

  try {
    const query = new URLSearchParams({ doctorId, date });
    const response = await fetch(
      `${API_BASE}/appointments/available-slots?${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load slots');

    if (!data.slots || data.slots.length === 0) {
      grid.innerHTML = `<p class="cc-sub cc-grid-message">${escapeHtml(data.message || 'No open slots for this day.')}</p>`;
      return;
    }

    grid.innerHTML = data.slots
      .map((slot) => {
        const safeSlot = escapeHtml(slot);
        return `<button type="button" class="cc-slot-btn" data-slot="${safeSlot}">${safeSlot}</button>`;
      })
      .join('');

    grid.querySelectorAll('.cc-slot-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.cc-slot-btn').forEach((b) => b.classList.remove('cc-selected'));
        btn.classList.add('cc-selected');
        selectedTime = btn.dataset.slot;
        document.getElementById('selectedTime').value = selectedTime;
      });
    });
  } catch (err) {
    grid.innerHTML = `<p class="cc-sub cc-grid-message">${escapeHtml(err.message)}</p>`;
  }
}

document.getElementById('doctorSelect').addEventListener('change', loadSlots);
document.getElementById('dateInput').addEventListener('change', loadSlots);

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = requireAuthOrRedirect();
  if (!token) return;

  if (!selectedTime) {
    showMessage('Please choose a time slot.', 'error');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Booking…';

  const payload = {
    doctorId: document.getElementById('doctorSelect').value,
    date: document.getElementById('dateInput').value,
    time: selectedTime,
    reason: document.getElementById('reason').value.trim(),
  };

  try {
    const response = await fetch(`${API_BASE}/appointments/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not book the appointment');

    showMessage('Appointment booked! Redirecting to your appointments…', 'success');
    setTimeout(() => (window.location.href = '../patient/appointments.html'), 900);
  } catch (err) {
    showMessage(err.message, 'error');
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  }
});

document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('careconnect_patient');
  window.location.href = '../patient/login.html';
});

requireAuthOrRedirect();
document.getElementById('dateInput').min = localISODate();
loadDoctors();
