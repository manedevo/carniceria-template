# CLAUDE.md — Carnicería Artesanal

Contexto completo del proyecto para evitar leer archivos individuales al inicio de sesión.

---

## Stack

- **Runtime:** Node.js 20, Express 4
- **DB:** MariaDB 11, mysql2/promise pool (max 10 conexiones)
- **Auth:** bcryptjs (coste 12) + jsonwebtoken (8h) + express-rate-limit (10 intentos/15min)
- **Frontend:** Vanilla JS ES2020, sin build step, sin framework
- **Deploy:** Docker Compose v2 / Vagrant / PM2

---

## Estructura crítica

```
backend/
  index.js                  ← punto de entrada, registra todas las rutas
  .env                      ← DB_*, JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS
  database/schema.sql       ← 5 tablas, 30 productos seed
  scripts/create-admin.js   ← CLI para crear primer admin
  src/
    config/database.js      ← pool mysql2
    middleware/
      authenticate.js       ← verifica Bearer JWT → req.user
      requireRole.js        ← RBAC, acepta lista variádica de roles
    routes/
      products.js           ← GET /api/products (público + promo data)
      orders.js             ← POST /api/orders (público, user_id opcional)
      auth.js               ← /register /login /me
      admin/
        products.js         ← CRUD, solo admin
        orders.js           ← GET todos, PUT status solo admin; GET permitido admin+ventas
        promotions.js       ← CRUD con transacción, solo admin
      user/
        orders.js           ← historial cliente, solo role=cliente

public/
  index.html                ← storefront (promo banner, stock badges, auth nav)
  login.html / registro.html / mi-cuenta.html
  admin/
    index.html              ← dashboard (stat cards + recent orders)
    productos.html / pedidos.html / promociones.html
  assets/js/
    auth.js                 ← JWT helpers: getUser, apiFetch, requireAuth, updateAuthNav
    main.js                 ← storefront: cart Map, debounced search, promo render, escHtml
    login.js                ← lógica de login.html (extraído para cumplir CSP)
    registro.js             ← lógica de registro.html (extraído para cumplir CSP)
    mi-cuenta.js            ← lógica de mi-cuenta.html (extraído para cumplir CSP)
    admin.js                ← panel admin: products/orders/promos/dashboard (~480 líneas)
  assets/css/
    main.css / admin.css
```

---

## Schema DB (orden de creación — respetar FK)

1. `users` — id, email, password_hash, role ENUM(admin|ventas|cliente), name, phone, active
2. `products` — id, name, category, price, unit_type ENUM(kg|pieza), stock_qty, stock_enabled, note, image_url, active
3. `orders` — id, **user_id FK→users NULL**, customer_name, phone, address, zone, time_slot, payment_method, items JSON, total, status ENUM(pendiente|confirmado|preparando|en camino|entregado|cancelado)
4. `promotions` — id, name, type ENUM(porcentaje|precio_fijo), value, applies_to ENUM(todos|categoria|producto), category, active, starts_at, ends_at
5. `promotion_products` — (promotion_id FK, product_id FK), composite PK, CASCADE DELETE

---

## Rutas API

| Método | Ruta | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/products` | — | público |
| POST | `/api/orders` | opcional | público |
| POST | `/api/auth/register` | — | público |
| POST | `/api/auth/login` | — | público |
| GET | `/api/auth/me` | JWT | cualquiera |
| GET/POST/PUT/DELETE | `/api/admin/products` | JWT | admin |
| PATCH | `/api/admin/products/:id/stock` | JWT | admin |
| GET | `/api/admin/orders` | JWT | admin, ventas |
| PUT | `/api/admin/orders/:id/status` | JWT | admin |
| GET/POST/PUT/DELETE | `/api/admin/promotions` | JWT | admin |
| GET | `/api/user/orders` | JWT | cliente |

---

## Patrones clave

- **Soft delete:** `active = 0` en products y promotions — nunca hard delete
- **Promo priority en products.js:** producto específico > categoría > todos (N+1 conocido, ver T-04)
- **optionalUser()** en orders.js: extrae JWT si está presente, no falla si no hay token
- **escHtml()** en main.js y mi-cuenta.js: aplicar SIEMPRE antes de innerHTML con datos del servidor
- **Auth.apiFetch()**: redirige a /login.html en 401 automáticamente
- **loadDashboard()** en admin.js: role-aware — ventas solo ve stats de pedidos, admin ve todo
- **Transacción** en admin/promotions.js POST: `conn.beginTransaction()` para promo + promotion_products
- **CSP estricta activa** (`script-src 'self'`, `style-src 'self' + fonts`, sin `unsafe-inline`): nunca añadir `style=""`, `onclick=` ni `<script>` inline en HTML. Scripts a archivos `.js` externos; eventos admin via `data-action`/`data-id` + listener delegado (ver `admin.js`); estilos a `.css`; `backgroundImage` dinámica via CSSOM (`el.style.backgroundImage = ...`), no interpolada en template strings

---

## Variables de entorno (.env)

```
DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
PORT=3000
NODE_ENV=production
JWT_SECRET=<64 bytes hex — GENERAR con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=12
```

---

## Comandos frecuentes

```bash
# Crear primer admin
docker compose exec app node scripts/create-admin.js email@x.es Pass123 "Nombre"

# Verificar sintaxis backend
node --check backend/src/routes/products.js

# Arrancar dev
cd backend && node index.js

# Docker
docker compose up -d --build
docker compose logs -f app

# Despliegue automatizado en VPS/Azure (genera .env completo incluido JWT_SECRET)
curl -fsSL https://raw.githubusercontent.com/manedevo/carniceria-template/master/deployment/setup/setup_sh/setup.sh | sudo bash
```

---

## Issues conocidos / decisiones

- **TICK-002:** `JWT_SECRET` placeholder en `.env` — resuelto automáticamente por `setup.sh` (openssl rand -hex 64). Solo aplica si se configura el `.env` a mano
- **T-04:** N+1 queries en `GET /api/products` (1 query por producto para buscar promo). Aceptable con <200 productos
- **localStorage para JWT:** tradeoff consciente por simplicidad; mover a `httpOnly` cookie es S-01 en el backlog
- `user_id = NULL` en orders = pedido anónimo (retrocompatible)
- FK ordering en schema.sql: `users` debe ir ANTES que `orders` (error histórico ya corregido)
- **`trust proxy: 1`** hardcodeado en `index.js` — asume topología Internet → Nginx → Node (1 hop). Si se añade CDN delante ajustar a 2; si Node queda expuesto directamente a Internet eliminar la línea. Ver `docs/deployment.md`
- **Precios calculados en servidor** (`orders.js`) — `item.price` del cliente se descarta; se consulta `products.price` en BD por cada item antes de insertar el pedido. Ver `docs/security_changelog.md`

---

## Docs

- `docs/architecture.md` / `docs/es/arquitectura.md`
- `docs/deployment.md` / `docs/es/despliegue.md`
- `docs/security_changelog.md` — historial de correcciones de seguridad aplicadas
- `tasks/informe-implementacion.md` — tickets, troubleshooting, sugerencias
- `tasks/plan-mejoras-app.md` — plan original de las 4 fases
