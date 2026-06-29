// frontend/auth.js
const API_URL = window.location.origin;

// 1. LOGIN
async function handleLogin(email, password) {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_role', data.user.role);
      window.location.href = data.user.role === 'admin' ? '/admin.html' : (data.user.role === 'seller' ? '/seller.html' : '/customer.html');
    } else {
      alert(data.error);
    }
  } catch (e) { alert('Connection Error'); }
}

// 2. REGISTER
async function handleRegister(userData) {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await response.json();
    if (data.success) {
      alert('Success! Please login.');
      window.location.href = '/index.html';
    } else {
      alert(data.error);
    }
  } catch (e) { alert('Connection Error'); }
}
