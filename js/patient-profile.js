const API_BASE = '/api/patients';
const TOKEN_KEY = 'careconnect_patient_token';
const { dateInputValue, localISODate, readJson } = window.CareConnect;

function showMessage(text, type) {
  const box = document.getElementById('formMessage');
  box.textContent = text;
  box.className = `cc-message cc-show cc-${type}`;
}

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

async function loadProfile() {
  const token = requireAuthOrRedirect();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'login.html';
      return;
    }

    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not load your profile');

    const p = data.patient;
    document.getElementById('firstName').value = p.firstName || '';
    document.getElementById('lastName').value = p.lastName || '';
    document.getElementById('email').value = p.email || '';
    document.getElementById('phone').value = p.phone || '';
    document.getElementById('dateOfBirth').value = dateInputValue(p.dateOfBirth);
    document.getElementById('gender').value = p.gender || 'Other';
    document.getElementById('address').value = p.address || '';
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = requireAuthOrRedirect();
  if (!token) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    dateOfBirth: document.getElementById('dateOfBirth').value,
    gender: document.getElementById('gender').value,
    address: document.getElementById('address').value.trim(),
  };

  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Could not save changes');

    showMessage('Profile updated.', 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
});

document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('careconnect_patient');
  window.location.href = 'login.html';
});

loadProfile();
document.getElementById('dateOfBirth').max = localISODate(new Date(Date.now() - 86400000));
