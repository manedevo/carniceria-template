'use strict';
if (!Auth.requireAuth(['cliente'])) { /* redirected */ }

function escHtml(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatEur(v) {
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v);
}

document.getElementById('year').textContent = new Date().getFullYear();

const user = Auth.getUser();
document.getElementById('welcomeMsg').textContent = `Hola, ${user.name} · ${user.email}`;

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'logout')  Auth.logout();
  if (el.dataset.action === 'go-home') window.location.href = '/';
});

async function loadOrders() {
  const list = document.getElementById('ordersList');
  try {
    const res  = await Auth.apiFetch('/api/user/orders');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (!data.length) {
      list.innerHTML = '<li><div class="empty-state">Aún no has realizado ningún pedido.<br><a href="/" class="link-gold">Explorar productos</a></div></li>';
      return;
    }

    list.innerHTML = data.map(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      const statusClass = 'status-' + o.status.replace(' ', '-');
      return `<li>
        <div class="order-card">
          <div class="order-card-header">
            <span class="order-card-title">PEDIDO #${o.id}</span>
            <span class="status-pill ${statusClass}">${escHtml(o.status).toUpperCase()}</span>
            <span class="order-card-date">${new Date(o.created_at).toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'})}</span>
          </div>
          <div class="order-items-mini">
            ${items.map(i => `${escHtml(i.name)} × ${i.qty}`).join(' &nbsp;·&nbsp; ')}
          </div>
          <p class="order-total">Total: ${formatEur(o.total)}</p>
          <p class="meta-line">
            ${escHtml(o.zone)} · ${escHtml(o.time_slot)} · ${escHtml(o.payment_method)}
          </p>
        </div>
      </li>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<li><div class="empty-state error-text">${escHtml(err.message)}</div></li>`;
  }
}

loadOrders();
