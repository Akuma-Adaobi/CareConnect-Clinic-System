const API_BASE = '/api/patients';

const TOKEN_KEY = 'careconnect_patient_token';
const PATIENT_KEY = 'careconnect_patient';
const { localISODate, readJson } = window.CareConnect;

function showMessage(text, type) {
  const box = document.getElementById('formMessage');
  box.textContent = text;
  box.className = `cc-message cc-show cc-${type}`;
}

function setLoading(isLoading) {
  const btn = document.getElementById('submitBtn');
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Please wait…' : btn.dataset.label;
}

async function submitAuthForm(endpoint, payload) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }
  return data;
}

// ----- Registration -----
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  document.getElementById('submitBtn').dataset.label = 'Create account';
  document.getElementById('dateOfBirth').max = localISODate(new Date(Date.now() - 86400000));

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      phone: document.getElementById('phone').value.trim(),
      dateOfBirth: document.getElementById('dateOfBirth').value,
      gender: document.getElementById('gender').value,
      address: document.getElementById('address').value.trim(),
    };

    try {
      const data = await submitAuthForm('register', payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(PATIENT_KEY, JSON.stringify(data.patient));
      showMessage('Account created — redirecting to your profile…', 'success');
      setTimeout(() => (window.location.href = 'profile.html'), 800);
    } catch (err) {
      showMessage(err.message, 'error');
      setLoading(false);
    }
  });
}

// ----- Login -----
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  document.getElementById('submitBtn').dataset.label = 'Log in';

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
    };

    try {
      const data = await submitAuthForm('login', payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(PATIENT_KEY, JSON.stringify(data.patient));
      showMessage('Logged in — redirecting…', 'success');
      setTimeout(() => (window.location.href = 'profile.html'), 600);
    } catch (err) {
      showMessage(err.message, 'error');
      setLoading(false);
    }
  });
}
