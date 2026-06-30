'use strict';
if (Auth.isLoggedIn()) window.location.href = '/mi-cuenta.html';

document.getElementById('regForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('regError');
  errEl.textContent = '';
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'CREANDO CUENTA...';

  const name     = document.getElementById('name').value.trim();
  const email    = document.getElementById('email').value.trim();
  const phone    = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res  = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone: phone || undefined, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrarse');

    Auth.setToken(data.token);
    window.location.href = '/mi-cuenta.html';
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'REGISTRARME';
  }
});
