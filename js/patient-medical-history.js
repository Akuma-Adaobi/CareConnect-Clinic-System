const API_BASE = '/api/medical-records';
const TOKEN_KEY = 'careconnect_patient_token';
const { escapeHtml, formatISODate, readJson } = window.CareConnect;

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

async function loadRecords() {
  const token = requireAuthOrRedirect();
  if (!token) return;

  const wrap = document.getElementById('recordsWrap');

  try {
    const response = await fetch(`${API_BASE}/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'login.html';
      return;
    }

    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load your medical history');

    renderRecords(data.records);
  } catch (err) {
    wrap.innerHTML = `<div class="cc-empty"><strong>Something went wrong</strong>${escapeHtml(err.message)}</div>`;
  }
}

function renderRecords(records) {
  const wrap = document.getElementById('recordsWrap');

  if (!records || records.length === 0) {
    wrap.innerHTML = `
      <div class="cc-empty">
        <strong>No visit notes yet</strong>
        Once a doctor completes a visit, it will show up here.
      </div>`;
    return;
  }

  const rows = records
    .map((record) => {
      const doctorName = record.doctorId
        ? `Dr. ${record.doctorId.firstName || ''} ${record.doctorId.lastName || ''}`.trim()
        : 'Unknown';
      return `
        <tr>
          <td>${escapeHtml(formatISODate(record.visitDate))}</td>
          <td>${escapeHtml(doctorName)}</td>
          <td>${escapeHtml(record.diagnosis || '-')}</td>
          <td>${escapeHtml(record.prescription || '-')}</td>
          <td>${escapeHtml(record.notes || '-')}</td>
        </tr>`;
    })
    .join('');

  wrap.innerHTML = `
    <div class="cc-table-scroll">
      <table class="cc-table">
        <thead><tr><th>Date</th><th>Doctor</th><th>Diagnosis</th><th>Prescription</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

document.getElementById('logoutLink').addEventListener('click', (event) => {
  event.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('careconnect_patient');
  window.location.href = 'login.html';
});

loadRecords();
