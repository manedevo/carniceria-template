'use strict';

// ── Utilities ─────────────────────────────────────────────────────────────────

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
  const body    = document.getElementById('cartItems');
  const subtotal = document.getElementById('cartSubtotal');

  if (cart.size === 0) {
    body.innerHTML = '<p class="cart-empty-msg">Aún no has añadido productos.</p>';
    subtotal.textContent = formatEur(0);
    return;
  }

  let html = '';
  cart.forEach((item, id) => {
    html += `
      <div class="cart-item">
        <div class="cart-item-info">
          <p class="cart-item-name">${escHtml(item.name)}</p>
          <p class="cart-item-sub">${formatEur(item.price)}/kg × ${item.qty} kg</p>
        </div>
        <div class="cart-item-right">
          <span class="cart-item-total">${formatEur(item.price * item.qty)}</span>
          <button class="cart-item-remove" data-id="${escHtml(String(id))}" aria-label="Eliminar ${escHtml(item.name)}">✕ quitar</button>
        </div>
      </div>`;
  });

  body.innerHTML = html;
  subtotal.textContent = formatEur(cartTotal());
}

function refreshCart() {
  updateCartBadge();
  renderCartPanel();
}

// ── Cart panel toggle ──────────────────────────────────────────────────────────

function openCart() {
  document.getElementById('cartPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
  refreshCart();
}

function closeCart() {
  document.getElementById('cartPanel').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Products ──────────────────────────────────────────────────────────────────

let activeCategory = 'Todos';

async function loadCategories() {
  try {
    const res = await fetch('/api/products/categories');
    if (!res.ok) throw new Error();
    const cats = await res.json();
    const bar  = document.getElementById('filters');

    // "Todos" button (already in HTML template via JS to keep it DRY)
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.dataset.category = 'Todos';
    allBtn.textContent = 'Todos';
    bar.appendChild(allBtn);

    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.category = cat;
      btn.textContent = cat;
      bar.appendChild(btn);
    });
  } catch {
    // Filters unavailable — search still works
  }
}

async function loadProducts(category, search) {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<p class="loading-msg">Preparando el mostrador…</p>';

  try {
    const params = new URLSearchParams();
    if (category && category !== 'Todos') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetch(`/api/products?${params}`);
    if (!res.ok) throw new Error();
    const products = await res.json();
    renderProducts(products);
  } catch {
    grid.innerHTML = '<p class="loading-msg">No se pudieron cargar los productos. Inténtalo de nuevo.</p>';
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');

  if (products.length === 0) {
    grid.innerHTML = '<p class="loading-msg">No encontramos ese corte. Prueba con otro término.</p>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const bgStyle = p.image_url
      ? `background-image:url('/assets/img/${escHtml(p.image_url)}');`
      : '';

    return `
      <article class="product-card">
        <div class="product-image" style="${bgStyle}" role="img" aria-label="${escHtml(p.name)}">
          <span class="product-price-badge">${formatEur(p.price)}/kg</span>
        </div>
        <div class="product-body">
          <span class="product-category">${escHtml(p.category)}</span>
          <p class="product-name">${escHtml(p.name)}</p>
          <p class="product-note">${escHtml(p.note || '')}</p>
          <div class="product-actions">
            <input class="qty-input"
              type="number" min="1" max="20" value="1"
              id="qty-${p.id}"
              aria-label="Cantidad en kg para ${escHtml(p.name)}" />
            <button class="btn-primary"
              data-id="${p.id}"
              data-name="${escHtml(p.name)}"
              data-price="${p.price}">
              AÑADIR
            </button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function handleAddToCart(e) {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;

  const id    = parseInt(btn.dataset.id, 10);
  const name  = btn.dataset.name;
  const price = parseFloat(btn.dataset.price);
  const qtyEl = document.getElementById(`qty-${id}`);
  const qty   = Math.max(1, parseInt(qtyEl?.value || '1', 10));

  if (cart.has(id)) {
    cart.get(id).qty += qty;
  } else {
    cart.set(id, { name, price, qty });
  }

  refreshCart();
  showToast(`${name} (${qty} kg) añadido al carrito`);
}

function handleCartRemove(e) {
  const btn = e.target.closest('.cart-item-remove');
  if (!btn) return;
  cart.delete(parseInt(btn.dataset.id, 10));
  refreshCart();
}

// ── Order submission ──────────────────────────────────────────────────────────

const App = {
  submitOrder: async function () {
    if (cart.size === 0) {
      showToast('Añade al menos un producto antes de confirmar.', 3500);
      return;
    }

    const required = [
      { id: 'custName',    label: 'nombre' },
      { id: 'custPhone',   label: 'teléfono' },
      { id: 'custAddress', label: 'dirección' },
      { id: 'custZone',    label: 'zona' },
      { id: 'custSlot',    label: 'horario' },
    ];

    let valid = true;
    required.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.classList.add('invalid');
        valid = false;
      } else {
        el.classList.remove('invalid');
      }
    });

    if (!valid) {
      showToast('Completa todos los campos obligatorios (*).', 3500);
      return;
    }

    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('orderMessage');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    msg.textContent = '';

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

    try {
      const res  = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error desconocido');

      cart.clear();
      refreshCart();
      document.getElementById('custName').closest('form')?.reset();
      msg.textContent = '✔ Pedido recibido. Te llamamos en breve para confirmar.';
      showToast('¡Pedido enviado con éxito!', 5000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      msg.textContent = `Error: ${err.message}`;
      showToast(`No se pudo enviar el pedido: ${err.message}`, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'CONFIRMAR PEDIDO';
    }
  },
};

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  await loadCategories();
  await loadProducts('Todos', '');

  // Category filters
  document.getElementById('filters').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.category;
    loadProducts(activeCategory, document.getElementById('searchInput').value.trim());
  });

  // Search with debounce
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadProducts(activeCategory, e.target.value.trim());
    }, 320);
  });

  // Add to cart (event delegation on grid)
  document.getElementById('productsGrid').addEventListener('click', handleAddToCart);

  // Cart panel controls
  document.getElementById('cartFloatBtn').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  document.getElementById('clearCartBtn').addEventListener('click', () => {
    cart.clear();
    refreshCart();
  });
  document.getElementById('goToCheckoutBtn').addEventListener('click', () => {
    closeCart();
    document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' });
  });

  // Remove items from panel
  document.getElementById('cartItems').addEventListener('click', handleCartRemove);

  // Remove invalid on input
  document.querySelectorAll('#checkout input, #checkout select, #checkout textarea')
    .forEach(el => el.addEventListener('input', () => el.classList.remove('invalid')));

  // Escape closes panel
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
});
