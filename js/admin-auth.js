const API_BASE = '/api';
const ADMIN_TOKEN_KEY = 'careconnect_admin_token';
const ADMIN_KEY = 'careconnect_admin';
const { readJson } = window.CareConnect;

function showMessage(text, type) {
  const box = document.getElementById('formMessage');
  box.textContent = text;
  box.className = `cc-message cc-show cc-${type}`;
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Please wait…';

  const payload = {
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
  };

  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || 'Login failed');

    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
    showMessage('Logged in — redirecting…', 'success');
    setTimeout(() => (window.location.href = 'dashboard.html'), 600);
  } catch (err) {
    showMessage(err.message, 'error');
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  }
});
