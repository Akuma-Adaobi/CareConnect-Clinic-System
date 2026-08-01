const API_BASE = '/api';
const ADMIN_TOKEN_KEY = 'careconnect_admin_token';
const ADMIN_KEY = 'careconnect_admin';
const { escapeHtml, localISODate, readJson } = window.CareConnect;

function getToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
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

document.querySelectorAll('.cc-tab-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.cc-tab-btn').forEach((item) => item.classList.remove('cc-active'));
    document.querySelectorAll('.cc-tab-panel').forEach((panel) => panel.classList.add('cc-hidden'));
    button.classList.add('cc-active');
    document.getElementById(`tab-${button.dataset.tab}`).classList.remove('cc-hidden');
    if (button.dataset.tab === 'reports') loadReports();
  });
});

async function loadDoctors() {
  const wrap = document.getElementById('doctorListWrap');
  try {
    const response = await fetch(`${API_BASE}/doctors`);
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load doctors');

    if (!data.doctors || data.doctors.length === 0) {
      wrap.innerHTML = '<div class="cc-empty"><strong>No doctors yet</strong>Add one above.</div>';
      return;
    }

    const rows = data.doctors
      .map((doctor) => `
        <tr>
          <td>Dr. ${escapeHtml(doctor.firstName)} ${escapeHtml(doctor.lastName)}</td>
          <td>${escapeHtml(doctor.specialty)}</td>
        </tr>`)
      .join('');
    wrap.innerHTML = `
      <div class="cc-table-scroll">
        <table class="cc-table">
          <thead><tr><th>Name</th><th>Specialty</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err) {
    wrap.innerHTML = `<div class="cc-empty"><strong>Could not load doctors</strong>${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('addDoctorForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = requireAuthOrRedirect();
  if (!token) return;

  const button = document.getElementById('addDoctorBtn');
  button.disabled = true;
  button.textContent = 'Adding...';

  const payload = {
    firstName: document.getElementById('docFirstName').value.trim(),
    lastName: document.getElementById('docLastName').value.trim(),
    email: document.getElementById('docEmail').value.trim(),
    phone: document.getElementById('docPhone').value.trim(),
    specialization: document.getElementById('docSpecialty').value.trim(),
    password: document.getElementById('docPassword').value,
  };

  try {
    const response = await fetch(`${API_BASE}/admin/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not add doctor');

    showMessage(`Dr. ${data.doctor.firstName} ${data.doctor.lastName} added.`, 'success');
    document.getElementById('addDoctorForm').reset();
    loadDoctors();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = button.dataset.label;
  }
});

let lastUtilization = [];

async function loadReports() {
  const token = requireAuthOrRedirect();
  if (!token) return;

  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;

  try {
    const query = new URLSearchParams({ from, to });
    const response = await fetch(`${API_BASE}/admin/reports?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load report');

    document.getElementById('kpiScheduled').textContent = data.summary.Scheduled;
    document.getElementById('kpiCompleted').textContent = data.summary.Completed;
    document.getElementById('kpiCancelled').textContent = data.summary.Cancelled;
    document.getElementById('kpiNoShow').textContent = data.summary['No-show'];
    document.getElementById('kpiNoShowRate').textContent = `${data.noShowRate}%`;

    lastUtilization = data.doctorUtilization;
    renderUtilization(lastUtilization);
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

function renderUtilization(rows) {
  const wrap = document.getElementById('utilizationWrap');
  if (!rows || rows.length === 0) {
    wrap.innerHTML = '<div class="cc-empty"><strong>No data</strong>No doctors or appointments in this range.</div>';
    return;
  }

  const body = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.total)}</td>
        <td>${escapeHtml(row.scheduled)}</td>
        <td>${escapeHtml(row.completed)}</td>
        <td>${escapeHtml(row.noShow)}</td>
        <td>${escapeHtml(row.utilizationRate)}%</td>
      </tr>`)
    .join('');
  wrap.innerHTML = `
    <div class="cc-table-scroll">
      <table class="cc-table">
        <thead><tr><th>Doctor</th><th>Total</th><th>Scheduled</th><th>Completed</th><th>No-shows</th><th>Utilization</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

document.getElementById('refreshReportBtn').addEventListener('click', loadReports);

document.getElementById('exportCsvBtn').addEventListener('click', () => {
  if (!lastUtilization || lastUtilization.length === 0) {
    showMessage('Nothing to export yet. Load a report first.', 'error');
    return;
  }

  const header = 'Doctor,Total,Scheduled,Completed,No-shows,Utilization\n';
  const body = lastUtilization
    .map((row) => [
      csvCell(row.name),
      row.total,
      row.scheduled,
      row.completed,
      row.noShow,
      `${row.utilizationRate}%`,
    ].join(','))
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'doctor-utilization.csv';
  anchor.click();
  URL.revokeObjectURL(url);
});

document.getElementById('logoutLink').addEventListener('click', (event) => {
  event.preventDefault();
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
  window.location.href = 'login.html';
});

const today = new Date();
const monthAgo = new Date(today);
monthAgo.setDate(monthAgo.getDate() - 30);
document.getElementById('toDate').value = localISODate(today);
document.getElementById('fromDate').value = localISODate(monthAgo);

requireAuthOrRedirect();
loadDoctors();
