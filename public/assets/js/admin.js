'use strict';

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatEur(v) {
  return new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' }).format(v);
}

function statusBadge(status) {
  const map = {
    pendiente:  'badge-pendiente',
    confirmado: 'badge-confirmado',
    'en camino':'badge-en-camino',
    entregado:  'badge-entregado',
    cancelado:  'badge-cancelado',
  };
  const cls = map[status] || 'badge-pendiente';
  return `<span class="badge-status ${cls}">${escHtml(status)}</span>`;
}

let toastTimer;
function showToast(msg, ok = true) {
  const el = document.getElementById('adminToast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = ok ? 'var(--madrid-dark)' : 'var(--danger)';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }

document.addEventListener('click', e => {
  if (e.target.matches('.modal-overlay')) {
    e.target.classList.add('hidden');
  }
  if (e.target.matches('.modal-close')) {
    e.target.closest('.modal-overlay').classList.add('hidden');
  }
});

// ── Products page ─────────────────────────────────────────────────────────────

async function loadAdminProducts() {
  const tbody = document.getElementById('productsTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="padding:2rem;color:#888">Cargando...</td></tr>';
  try {
    const res  = await Auth.apiFetch('/api/admin/products');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    tbody.innerHTML = data.map(p => `
      <tr data-id="${p.id}">
        <td>${escHtml(p.name)}</td>
        <td>${escHtml(p.category)}</td>
        <td>${escHtml(p.unit_type)}</td>
        <td>
          <input class="inline-input" type="number" step="0.01" min="0"
            value="${p.price}" data-field="price" style="width:70px" />
        </td>
        <td>
          <input class="inline-input" type="number" step="0.001" min="0"
            value="${p.stock_qty ?? ''}" data-field="stock_qty" placeholder="—" style="width:70px" />
          <label class="toggle" title="Control de stock activo" style="margin-left:4px">
            <input type="checkbox" data-field="stock_enabled" ${p.stock_enabled ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <label class="toggle">
            <input type="checkbox" data-field="active" ${p.active ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <button class="btn-outline-sm" onclick="saveProductInline(${p.id}, this)">Guardar</button>
          <button class="btn-outline-sm" onclick="openEditModal(${p.id})" style="margin-left:4px">Editar</button>
          <button class="btn-danger-sm"  onclick="deleteProduct(${p.id})" style="margin-left:4px">Baja</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--danger);padding:1rem">${escHtml(err.message)}</td></tr>`;
  }
}

async function saveProductInline(id, btn) {
  const row = btn.closest('tr');
  const price         = parseFloat(row.querySelector('[data-field=price]').value);
  const stock_qty     = row.querySelector('[data-field=stock_qty]').value;
  const stock_enabled = row.querySelector('[data-field=stock_enabled]').checked;
  const active        = row.querySelector('[data-field=active]').checked;

  const res = await Auth.apiFetch(`/api/admin/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ price, stock_qty: stock_qty !== '' ? parseFloat(stock_qty) : null, stock_enabled, active }),
  });
  showToast(res.ok ? 'Guardado' : 'Error al guardar', res.ok);
}

async function deleteProduct(id) {
  if (!confirm('¿Dar de baja este producto?')) return;
  const res = await Auth.apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
  showToast(res.ok ? 'Producto dado de baja' : 'Error', res.ok);
  if (res.ok) loadAdminProducts();
}

// Datos completos del producto actual para el modal de edición
let editingProduct = null;

async function openEditModal(id) {
  const res  = await Auth.apiFetch('/api/admin/products');
  const data = await res.json();
  editingProduct = data.find(p => p.id === id);
  if (!editingProduct) return;

  const f = document.getElementById('editProductForm');
  f.querySelector('[name=name]').value          = editingProduct.name;
  f.querySelector('[name=category]').value      = editingProduct.category;
  f.querySelector('[name=price]').value         = editingProduct.price;
  f.querySelector('[name=unit_type]').value     = editingProduct.unit_type;
  f.querySelector('[name=note]').value          = editingProduct.note || '';
  f.querySelector('[name=image_url]').value     = editingProduct.image_url || '';
  f.querySelector('[name=stock_qty]').value     = editingProduct.stock_qty ?? '';
  f.querySelector('[name=stock_enabled]').checked = !!editingProduct.stock_enabled;
  f.querySelector('[name=active]').checked      = !!editingProduct.active;

  openModal('editProductModal');
}

async function submitEditProduct(e) {
  e.preventDefault();
  if (!editingProduct) return;
  const f = e.target;
  const body = {
    name:          f.querySelector('[name=name]').value,
    category:      f.querySelector('[name=category]').value,
    price:         parseFloat(f.querySelector('[name=price]').value),
    unit_type:     f.querySelector('[name=unit_type]').value,
    note:          f.querySelector('[name=note]').value || null,
    image_url:     f.querySelector('[name=image_url]').value || null,
    stock_qty:     f.querySelector('[name=stock_qty]').value !== '' ? parseFloat(f.querySelector('[name=stock_qty]').value) : null,
    stock_enabled: f.querySelector('[name=stock_enabled]').checked,
    active:        f.querySelector('[name=active]').checked,
  };
  const res = await Auth.apiFetch(`/api/admin/products/${editingProduct.id}`, { method:'PUT', body: JSON.stringify(body) });
  showToast(res.ok ? 'Producto actualizado' : 'Error', res.ok);
  if (res.ok) { closeModal('editProductModal'); loadAdminProducts(); }
}

async function submitNewProduct(e) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name:          f.querySelector('[name=name]').value,
    category:      f.querySelector('[name=category]').value,
    price:         parseFloat(f.querySelector('[name=price]').value),
    unit_type:     f.querySelector('[name=unit_type]').value,
    note:          f.querySelector('[name=note]').value || null,
    image_url:     f.querySelector('[name=image_url]').value || null,
    stock_qty:     f.querySelector('[name=stock_qty]').value !== '' ? parseFloat(f.querySelector('[name=stock_qty]').value) : null,
    stock_enabled: f.querySelector('[name=stock_enabled]').checked,
  };
  const res = await Auth.apiFetch('/api/admin/products', { method:'POST', body: JSON.stringify(body) });
  showToast(res.ok ? 'Producto creado' : 'Error al crear', res.ok);
  if (res.ok) { closeModal('newProductModal'); f.reset(); loadAdminProducts(); }
}

// ── Promotions page ───────────────────────────────────────────────────────────

async function loadAdminPromotions() {
  const tbody = document.getElementById('promosTbody');
  if (!tbody) return;
  try {
    const res  = await Auth.apiFetch('/api/admin/promotions');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    tbody.innerHTML = data.map(p => {
      const valStr = p.type === 'porcentaje' ? `−${p.value}%` : `−${formatEur(p.value)}`;
      const activeBadge = p.active
        ? '<span class="badge-status badge-active">ACTIVA</span>'
        : '<span class="badge-status badge-inactive">INACTIVA</span>';
      const scope = p.applies_to === 'todos' ? 'Todos' : p.applies_to === 'categoria' ? `Cat: ${escHtml(p.category)}` : 'Productos concretos';
      return `<tr>
        <td>${escHtml(p.name)}</td>
        <td>${escHtml(valStr)}</td>
        <td>${escHtml(scope)}</td>
        <td>${p.starts_at ? p.starts_at.substring(0,10) : '—'}</td>
        <td>${p.ends_at   ? p.ends_at.substring(0,10)   : '—'}</td>
        <td>${activeBadge}</td>
        <td>
          <button class="btn-outline-sm" onclick="togglePromo(${p.id}, ${p.active ? 0 : 1})">${p.active ? 'Desactivar' : 'Activar'}</button>
          <button class="btn-danger-sm"  onclick="deletePromo(${p.id})" style="margin-left:4px">Eliminar</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger);padding:1rem">${escHtml(err.message)}</td></tr>`;
  }
}

async function togglePromo(id, active) {
  const res = await Auth.apiFetch(`/api/admin/promotions/${id}`, { method:'PUT', body: JSON.stringify({ active }) });
  showToast(res.ok ? (active ? 'Promoción activada' : 'Promoción desactivada') : 'Error', res.ok);
  if (res.ok) loadAdminPromotions();
}

async function deletePromo(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  const res = await Auth.apiFetch(`/api/admin/promotions/${id}`, { method:'DELETE' });
  showToast(res.ok ? 'Promoción eliminada' : 'Error', res.ok);
  if (res.ok) loadAdminPromotions();
}

function handleAppliesToChange(selectEl) {
  const catField    = document.getElementById('promoCategoryField');
  const prodField   = document.getElementById('promoProductsField');
  if (!catField || !prodField) return;
  catField.style.display  = selectEl.value === 'categoria' ? '' : 'none';
  prodField.style.display = selectEl.value === 'producto'  ? '' : 'none';
}

async function submitNewPromo(e) {
  e.preventDefault();
  const f = e.target;
  const applies_to = f.querySelector('[name=applies_to]').value;

  const selectedProducts = Array.from(
    f.querySelectorAll('[name=product_ids]:checked')
  ).map(el => parseInt(el.value, 10));

  const body = {
    name:       f.querySelector('[name=name]').value,
    type:       f.querySelector('[name=type]').value,
    value:      parseFloat(f.querySelector('[name=value]').value),
    applies_to,
    category:   applies_to === 'categoria' ? f.querySelector('[name=category]').value : null,
    active:     f.querySelector('[name=active]').checked,
    starts_at:  f.querySelector('[name=starts_at]').value || null,
    ends_at:    f.querySelector('[name=ends_at]').value   || null,
    product_ids: applies_to === 'producto' ? selectedProducts : [],
  };

  const res = await Auth.apiFetch('/api/admin/promotions', { method:'POST', body: JSON.stringify(body) });
  showToast(res.ok ? 'Promoción creada' : 'Error al crear', res.ok);
  if (res.ok) { closeModal('newPromoModal'); e.target.reset(); loadAdminPromotions(); }
}

// ── Orders page ───────────────────────────────────────────────────────────────

async function loadAdminOrders(filters = {}) {
  const tbody = document.getElementById('ordersTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="padding:2rem;color:#888">Cargando...</td></tr>';
  try {
    const params = new URLSearchParams(filters);
    const res  = await Auth.apiFetch('/api/admin/orders?' + params);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    tbody.innerHTML = data.map(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      const count = items.reduce((s, i) => s + i.qty, 0);
      return `<tr>
        <td>#${o.id}</td>
        <td>${escHtml(o.customer_name)}</td>
        <td>${escHtml(o.zone)}</td>
        <td>${escHtml(o.time_slot)}</td>
        <td>${formatEur(o.total)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${new Date(o.created_at).toLocaleDateString('es-ES')}</td>
        <td>
          <button class="btn-outline-sm" onclick="expandOrderRow(${o.id}, this)">Detalles</button>
          ${Auth.isAdmin() ? `
          <select class="btn-outline-sm" style="margin-left:4px"
            onchange="updateOrderStatus(${o.id}, this.value, this)">
            <option value="">Estado...</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="en camino">En camino</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>` : ''}
        </td>
      </tr>
      <tr id="detail-${o.id}" style="display:none">
        <td colspan="8">
          <div class="order-items-detail">
            <strong>Artículos (${count}):</strong>
            <table>
              ${items.map(i => `<tr><td>${escHtml(i.name)}</td><td>${i.qty}x</td><td>${formatEur(i.price)}</td><td>${formatEur(i.price * i.qty)}</td></tr>`).join('')}
            </table>
            <p style="margin-top:.5rem;font-size:.75rem">Tel: ${escHtml(o.phone)} · Dirección: ${escHtml(o.address)} · Pago: ${escHtml(o.payment_method)}</p>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--danger);padding:1rem">${escHtml(err.message)}</td></tr>`;
  }
}

function expandOrderRow(id, btn) {
  const row = document.getElementById('detail-' + id);
  if (!row) return;
  const hidden = row.style.display === 'none';
  row.style.display = hidden ? '' : 'none';
  btn.textContent = hidden ? 'Ocultar' : 'Detalles';
}

async function updateOrderStatus(id, status, sel) {
  if (!status) return;
  const res = await Auth.apiFetch(`/api/admin/orders/${id}/status`, { method:'PUT', body: JSON.stringify({ status }) });
  showToast(res.ok ? `Estado → ${status}` : 'Error', res.ok);
  sel.value = '';
  if (res.ok) loadAdminOrders(currentOrderFilters());
}

function currentOrderFilters() {
  const status = document.getElementById('filterStatus')?.value;
  const zone   = document.getElementById('filterZone')?.value;
  const from   = document.getElementById('filterFrom')?.value;
  const to     = document.getElementById('filterTo')?.value;
  const f = {};
  if (status) f.status = status;
  if (zone)   f.zone   = zone;
  if (from)   f.from   = from;
  if (to)     f.to     = to;
  return f;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

async function loadDashboard() {
  const role = Auth.getUser()?.role;

  try {
    // Pedidos: accesible para admin y ventas
    const rOrders = await Auth.apiFetch('/api/admin/orders');
    const orders  = await rOrders.json();

    const pending   = orders.filter(o => o.status === 'pendiente').length;
    const todayStr  = new Date().toDateString();
    const todayOrds = orders.filter(o => new Date(o.created_at).toDateString() === todayStr);
    const todayRev  = todayOrds.reduce((s, o) => s + parseFloat(o.total), 0);

    setStatCard('statPending', pending);
    setStatCard('statTodayOrders', todayOrds.length);
    setStatCard('statTodayRevenue', formatEur(todayRev));

    // Productos y promociones: solo accesibles para admin
    if (role === 'admin') {
      const [rProducts, rPromos] = await Promise.all([
        Auth.apiFetch('/api/admin/products'),
        Auth.apiFetch('/api/admin/promotions'),
      ]);
      const products = await rProducts.json();
      const promos   = await rPromos.json();

      setStatCard('statActiveProducts', products.filter(p => p.active).length);
      setStatCard('statActivePromos',   promos.filter(p => p.active).length);
    } else {
      // Ventas: ocultar tarjetas que no corresponden
      document.getElementById('statActiveProducts')?.closest('.stat-card')?.remove();
      document.getElementById('statActivePromos')?.closest('.stat-card')?.remove();
    }

    // Últimos 5 pedidos
    const tbody = document.getElementById('recentOrdersTbody');
    if (tbody) {
      tbody.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
          <td>#${o.id}</td>
          <td>${escHtml(o.customer_name)}</td>
          <td>${formatEur(o.total)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${new Date(o.created_at).toLocaleDateString('es-ES')}</td>
        </tr>`).join('');
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function setStatCard(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth(['admin','ventas'])) return;

  const user = Auth.getUser();
  document.querySelectorAll('.admin-user-name').forEach(el => { el.textContent = user.name; });

  document.getElementById('logoutBtn')?.addEventListener('click', Auth.logout);

  // Highlight active nav link
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    if (a.pathname === path || (path.endsWith('/') && a.pathname === path + 'index.html')) {
      a.classList.add('active');
    }
  });

  // Page-specific init
  if (document.getElementById('productsTbody')) loadAdminProducts();
  if (document.getElementById('promosTbody'))   loadAdminPromotions();
  if (document.getElementById('ordersTbody'))   loadAdminOrders();
  if (document.getElementById('statPending'))   loadDashboard();

  // Product form handlers
  document.getElementById('editProductForm')?.addEventListener('submit', submitEditProduct);
  document.getElementById('newProductForm')?.addEventListener('submit',  submitNewProduct);

  // Promo form handlers
  document.getElementById('newPromoForm')?.addEventListener('submit', submitNewPromo);
  document.getElementById('promoAppliesTo')?.addEventListener('change', e => handleAppliesToChange(e.target));

  // Orders filter
  document.getElementById('applyFilters')?.addEventListener('click', () => loadAdminOrders(currentOrderFilters()));
});
