'use strict';

// ── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

let toastTimer;
function showToast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, duration);
}

// ── Cart state ────────────────────────────────────────────────────────────────

const cart = new Map(); // productId → { name, price, qty }

function cartTotal() {
  let sum = 0;
  cart.forEach(item => { sum += item.price * item.qty; });
  return sum;
}

function cartItemCount() {
  let n = 0;
  cart.forEach(item => { n += item.qty; });
  return n;
}

function updateCartBadge() {
  document.getElementById('cartCount').textContent = cartItemCount();
}

function renderCartPanel() {
  const body = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotal');

  body.innerHTML = '';

  if (cart.size === 0) {
    body.innerHTML = '<p class="cart-empty-msg">Tu selección está vacía.</p>';
    subtotalEl.textContent = formatEur(0);
    return;
  }

  cart.forEach((item, id) => {
    const div = document.createElement('div');
    div.className = 'cart-item-row';
    div.innerHTML = `
      <div style="flex:1">
        <p class="cart-item-name">${escHtml(item.name)}</p>
        <p class="cart-item-sub">${formatEur(item.price)}/kg</p>
      </div>
      <div class="qty-control">
        <button class="qty-btn" data-id="${escHtml(String(id))}" data-action="dec" aria-label="Reducir">−</button>
        <span class="qty-value">${item.qty}</span>
        <button class="qty-btn" data-id="${escHtml(String(id))}" data-action="inc" aria-label="Aumentar">+</button>
      </div>
      <span class="cart-item-price">${formatEur(item.price * item.qty)}</span>
      <button class="cart-item-remove" data-id="${escHtml(String(id))}" aria-label="Eliminar">✕</button>`;
    body.appendChild(div);
  });

  subtotalEl.textContent = formatEur(cartTotal());
}

function renderCartInline() {
  const list = document.getElementById('cartInlineList');
  const totalEl = document.getElementById('cartInlineTotal');
  if (!list) return;

  list.innerHTML = '';

  if (cart.size === 0) {
    list.innerHTML = '<li class="cart-inline-empty">Aún no has añadido productos.</li>';
    totalEl.textContent = formatEur(0);
    return;
  }

  cart.forEach((item, id) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="cart-item-row">
        <div style="flex:1">
          <p class="cart-item-name">${escHtml(item.name)}</p>
          <p class="cart-item-sub">${formatEur(item.price)}/kg</p>
        </div>
        <div class="qty-control">
          <button class="qty-btn" data-id="${escHtml(String(id))}" data-action="dec" aria-label="Reducir">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" data-id="${escHtml(String(id))}" data-action="inc" aria-label="Aumentar">+</button>
        </div>
        <span class="cart-item-price">${formatEur(item.price * item.qty)}</span>
        <button class="cart-item-remove" data-id="${escHtml(String(id))}" aria-label="Eliminar">✕</button>
      </div>`;
    list.appendChild(li);
  });

  totalEl.textContent = formatEur(cartTotal());
}

function refreshAllCartUIs() {
  updateCartBadge();
  renderCartPanel();
  renderCartInline();
}

function handleCartAction(e) {
  const btn = e.target.closest('[data-id]');
  if (!btn) return;

  const id = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;

  if (action === 'inc') {
    if (cart.has(id)) cart.get(id).qty += 1;
  } else if (action === 'dec') {
    if (cart.has(id)) {
      cart.get(id).qty -= 1;
      if (cart.get(id).qty <= 0) cart.delete(id);
    }
  } else if (btn.classList.contains('cart-item-remove')) {
    cart.delete(id);
  }

  refreshAllCartUIs();
}

// ── Side cart panel ───────────────────────────────────────────────────────────

function openCart() {
  refreshAllCartUIs();
  document.getElementById('cartPanel').classList.add('open');
  document.getElementById('cartOverlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartPanel').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('visible');
  document.body.style.overflow = '';
}

// ── Products ──────────────────────────────────────────────────────────────────

let activeCategory = 'Todos';

async function loadCategories() {
  try {
    const res = await fetch('/api/products/categories');
    if (!res.ok) throw new Error('categories');
    const cats = await res.json();
    const bar = document.getElementById('filterBar');

    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.category = cat;
      btn.textContent = cat.toUpperCase();
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      bar.appendChild(btn);
    });
  } catch {
    // silently ignore — "Todos" still works
  }
}

async function loadProducts(category, search) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '<div class="loading-state">Actualizando existencias del día...</div>';

  try {
    const params = new URLSearchParams();
    if (category && category !== 'Todos') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetch(`/api/products?${params}`);
    if (!res.ok) throw new Error('products');
    const products = await res.json();
    renderProducts(products);
  } catch {
    grid.innerHTML = '<div class="loading-state">No se pudieron cargar los productos. Inténtalo de nuevo.</div>';
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productGrid');

  if (products.length === 0) {
    grid.innerHTML = '<div class="loading-state">No se encontraron productos.</div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const imgStyle = p.image_url
      ? `background-image: url('/assets/img_realistas/${escHtml(p.image_url)}');`
      : '';

    return `
      <article class="product-card" data-id="${p.id}">
        <div class="product-img" style="${imgStyle}" role="img" aria-label="${escHtml(p.name)}"></div>
        <div class="product-body">
          <p class="product-category">${escHtml(p.category || '')}</p>
          <p class="product-name">${escHtml(p.name)}</p>
          <p class="product-note">${escHtml(p.note || '')}</p>
          <div class="product-footer">
            <div>
              <span class="product-price">${formatEur(p.price)}</span>
              <span class="product-unit">/kg</span>
            </div>
            <button class="add-btn" data-id="${p.id}" data-name="${escHtml(p.name)}" data-price="${p.price}" aria-label="Añadir ${escHtml(p.name)} al carrito">+</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function handleAddToCart(e) {
  const btn = e.target.closest('.add-btn');
  if (!btn) return;

  const id    = parseInt(btn.dataset.id, 10);
  const name  = btn.dataset.name;
  const price = parseFloat(btn.dataset.price);

  if (cart.has(id)) {
    cart.get(id).qty += 1;
  } else {
    cart.set(id, { name, price, qty: 1 });
  }

  refreshAllCartUIs();
  showToast(`${name} añadido al carrito`);
}

// ── Order form ────────────────────────────────────────────────────────────────

async function submitOrder(e) {
  e.preventDefault();

  if (cart.size === 0) {
    showToast('Añade al menos un producto antes de confirmar.', 3500);
    return;
  }

  const required = ['custName', 'custPhone', 'custAddress', 'custZone', 'custSlot'];
  let valid = true;
  required.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (!el.value.trim()) {
      el.classList.add('invalid');
      valid = false;
    } else {
      el.classList.remove('invalid');
    }
  });

  if (!valid) {
    showToast('Por favor, completa todos los campos obligatorios.', 3500);
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'ENVIANDO...';

  const items = [];
  cart.forEach((item, id) => {
    items.push({ id, name: item.name, price: item.price, qty: item.qty });
  });

  const body = {
    name:           document.getElementById('custName').value.trim(),
    phone:          document.getElementById('custPhone').value.trim(),
    address:        document.getElementById('custAddress').value.trim(),
    zone:           document.getElementById('custZone').value,
    time_slot:      document.getElementById('custSlot').value,
    payment_method: document.getElementById('custPayment').value,
    items,
  };

  const msgEl = document.getElementById('orderMessage');

  try {
    const res = await fetch('/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error desconocido');

    cart.clear();
    refreshAllCartUIs();
    e.target.reset();
    msgEl.textContent = '¡Pedido recibido! Te contactamos en breve para confirmar.';
    showToast('¡Pedido recibido! Te llamamos en breve para confirmar.', 5000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    msgEl.textContent = `Error: ${err.message}`;
    showToast(`Error al enviar el pedido: ${err.message}`, 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'CONFIRMAR PEDIDO';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Año en footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  await loadCategories();
  await loadProducts('Todos', '');

  // Filtros de categoría
  document.getElementById('filterBar').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    activeCategory = btn.dataset.category;
    loadProducts(activeCategory, document.getElementById('searchInput').value.trim());
  });

  // Búsqueda con debounce
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadProducts(activeCategory, e.target.value.trim());
    }, 320);
  });

  // Añadir al carrito (delegación de eventos)
  document.getElementById('productGrid').addEventListener('click', handleAddToCart);

  // Controles de cantidad — panel lateral
  document.getElementById('cartItems').addEventListener('click', handleCartAction);

  // Controles de cantidad — resumen en formulario
  document.getElementById('cartInlineList').addEventListener('click', handleCartAction);

  // Abrir/cerrar carrito
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  // Limpiar carrito
  document.getElementById('clearCartBtn').addEventListener('click', () => {
    cart.clear();
    refreshAllCartUIs();
  });

  // Ir al formulario y cerrar panel
  document.getElementById('goToOrderBtn').addEventListener('click', closeCart);

  // Formulario de pedido
  document.getElementById('orderForm').addEventListener('submit', submitOrder);

  // Quitar clase invalid al escribir
  document.getElementById('orderForm').addEventListener('input', e => {
    e.target.classList.remove('invalid');
  });

  // Escape cierra el panel
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCart();
  });
});
