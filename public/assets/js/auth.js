'use strict';

const AUTH_KEY = 'ca_token';

function getToken()  { return localStorage.getItem(AUTH_KEY); }
function setToken(t) { localStorage.setItem(AUTH_KEY, t); }
function clearToken(){ localStorage.removeItem(AUTH_KEY); }

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function getUser() {
  const t = getToken();
  if (!t) return null;
  const payload = parseJwt(t);
  if (!payload) return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) { clearToken(); return null; }
  return payload;
}

function isLoggedIn()  { return !!getUser(); }
function isAdmin()     { return getUser()?.role === 'admin'; }
function isVentas()    { return getUser()?.role === 'ventas'; }

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { clearToken(); redirectToLogin(); }
  return res;
}

function redirectToLogin(returnTo) {
  const dest = '/login.html' + (returnTo ? '?return=' + encodeURIComponent(returnTo) : '');
  window.location.href = dest;
}

function requireAuth(allowedRoles) {
  const user = getUser();
  if (!user) { redirectToLogin(window.location.pathname); return false; }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = '/';
    return false;
  }
  return true;
}

function logout() {
  clearToken();
  window.location.href = '/';
}

// Actualiza el nav de index.html si existe
function updateAuthNav() {
  const link = document.getElementById('authNavLink');
  if (!link) return;
  const user = getUser();
  if (user) {
    link.textContent = user.name.split(' ')[0].toUpperCase();
    link.href = user.role === 'admin' || user.role === 'ventas' ? '/admin/' : '/mi-cuenta.html';
  } else {
    link.textContent = 'MI CUENTA';
    link.href = '/login.html';
  }
}

window.Auth = { getToken, setToken, clearToken, getUser, isLoggedIn, isAdmin, isVentas,
                authHeaders, apiFetch, redirectToLogin, requireAuth, logout, updateAuthNav };
