'use strict';
if (Auth.isLoggedIn()) {
  const u = Auth.getUser();
  window.location.href = (u.role === 'admin' || u.role === 'ventas') ? '/admin/' : '/mi-cuenta.html';
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'ENTRANDO...';

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

    Auth.setToken(data.token);
    const params = new URLSearchParams(window.location.search);
    const ret    = params.get('return');
    if (ret && ret.startsWith('/') && !ret.startsWith('//')) {
      window.location.href = ret;
    } else if (data.role === 'admin' || data.role === 'ventas') {
      window.location.href = '/admin/';
    } else {
      window.location.href = '/mi-cuenta.html';
    }
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'ENTRAR';
  }
});
