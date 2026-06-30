# Architecture

## Overview

Carnicería Artesanal is a three-tier web application: a static frontend served by the same Express process that also exposes a REST API, backed by a MariaDB database. There is no separate build step, no frontend framework, and no ORM — every layer is thin and easy to reason about.

```
Browser
  │
  │  GET /          →  index.html (static)
  │  GET /admin/**  →  admin HTML pages (static, JWT-guarded client-side)
  │  GET /assets/** →  CSS, JS, images (static)
  │  GET /api/**    →  JSON API
  ▼
Express (Node.js 20)
  ├── helmet()             security headers
  ├── cors()               CORS policy
  ├── express.json()       body parser
  ├── express.static()     serves public/
  │
  ├── /api/products        public products router (+ promo data)
  ├── /api/orders          public orders router  (links user_id if JWT present)
  ├── /api/auth            register · login · me
  │
  ├── authenticate()  ──── JWT middleware (applied to all routes below)
  ├── requireRole()   ──── RBAC middleware
  │
  ├── /api/admin/products    admin only
  ├── /api/admin/orders      admin + ventas
  ├── /api/admin/promotions  admin only
  └── /api/user/orders       cliente only
        │
        ▼
  mysql2 connection pool
        │
        ▼
  MariaDB 11
```

In Docker Compose the two services (`app` and `db`) share a user-defined bridge network. The app container never exposes port 3306; only the host machine can reach the app on port 3000 (or whichever `PORT` is set).

---

## Backend

### Entry point — `backend/index.js`

Registers middleware in order:

1. `trust proxy: 1` — tells Express there is exactly one proxy hop in front of it (Nginx). Without this, `express-rate-limit` sees every request as coming from `127.0.0.1` and the per-IP rate limit does not work in production. **If you change the deployment topology (e.g. add a CDN in front of Nginx), adjust this value to match the number of proxy hops.**
2. `helmet()` — sets secure HTTP headers including an active Content Security Policy: `script-src 'self'`, `style-src 'self' https://fonts.googleapis.com`, `font-src 'self' https://fonts.gstatic.com`, `img-src 'self' data:`, `connect-src 'self'`. No `'unsafe-inline'` — all frontend JS and CSS is in external files.
3. `cors()` — restricted to the origin in `ALLOWED_ORIGIN`. If the variable is not set, `false` blocks all cross-origin requests by default.
4. `express.json()` — parses request bodies
5. `express.static(PUBLIC_DIR)` — serves everything under `public/`
6. Public API routes (products, orders, auth)
7. Protected API routes (admin/*, user/*)
8. Catch-all `*` — returns `index.html` for client-side navigation

### Database — `backend/src/config/database.js`

Uses `mysql2/promise` in pool mode (up to 10 concurrent connections). All credentials come from environment variables; the file has no hardcoded secrets.

### Authentication middleware — `backend/src/middleware/authenticate.js`

Reads the `Authorization: Bearer <token>` header, verifies the JWT (JSON Web Token) signature against `JWT_SECRET`, and attaches the decoded payload (`id`, `email`, `role`, `name`) to `req.user`. Returns HTTP 401 if the token is absent or invalid.

### RBAC middleware — `backend/src/middleware/requireRole.js`

Accepts a variadic list of allowed roles. Returns HTTP 403 if `req.user.role` is not in the list. Applied after `authenticate`.

### Products route — `GET /api/products`

Builds a dynamic `SELECT` query with optional `category` and `search` filters. After fetching the product rows, enriches each one with the highest-priority active promotion that applies to it (product-specific > category > all), adding `promo_name`, `promo_type`, `promo_value`, `promo_price`, and `promo_applies_to` fields. All parameters use `?` placeholders — never string interpolation.

> **Note:** promotion lookup currently runs one query per product (N+1 pattern). Acceptable for the current catalogue size; a single JOIN query is the recommended optimisation for larger catalogues.

### Orders route — `POST /api/orders`

Validates required fields, calculates total server-side, and inserts the order. If a valid JWT is present in the `Authorization` header the order is linked to that user via `user_id`; anonymous orders set `user_id = NULL` for backwards compatibility.

### Admin routes

All routes under `/api/admin/*` apply `authenticate → requireRole(...)` as router-level middleware. Individual routes may apply a stricter `requireRole` — for example, `PUT /api/admin/orders/:id/status` requires `admin` even though the router allows `admin` and `ventas`.

---

## Frontend

No bundler, no transpiler, no `node_modules` on the client. Six JS files cover the entire UI:

### `public/assets/js/auth.js`

Loaded on every page. Manages the JWT lifecycle in `localStorage`:

- `setToken` / `getToken` / `clearToken`
- `getUser()` — decodes the JWT payload and checks expiry
- `apiFetch()` — wrapper around `fetch` that automatically injects the `Authorization` header and redirects to `/login.html` on HTTP 401
- `requireAuth(roles)` — guards admin/account pages client-side; redirects if the token is absent or the role is not in the allowed list
- `updateAuthNav()` — updates the storefront "MI CUENTA" nav link to show the user's name or point to the admin panel

### `public/assets/js/main.js`

Storefront logic:

- **`escHtml()`** — every piece of server-returned data is escaped before DOM insertion. No `innerHTML` with raw API values.
- **`Map` for cart state** — keyed by product ID; O(1) lookups.
- **Event delegation** — single listeners on `#productGrid` and cart containers.
- **Debounced search** — 320 ms delay prevents API flooding.
- **Promo rendering** — reads `promo_name`, `promo_price`, `promo_applies_to` from product data; renders discount badges, strikethrough original price, and a top banner (global promos only; category/product promos show a generic message).
- **Stock indicator** — renders "Quedan X kg/pieza" when `stock_enabled = 1`.
- **CSDOM image assignment** — product `background-image` is set via `el.style.backgroundImage` after `innerHTML` render, not interpolated into the template string, to comply with the active CSP.

### `public/assets/js/login.js` / `registro.js`

Page-specific logic for `login.html` and `registro.html` respectively: redirect if already logged in, form submit handler, error display. Extracted from inline `<script>` blocks to comply with the active CSP.

### `public/assets/js/mi-cuenta.js`

Account page logic: session guard, order history fetch and render, delegated event listener for logout and navigation. Also extracted from an inline `<script>` block.

### `public/assets/js/admin.js`

Loaded only on admin pages. Provides:

- Table rendering for products, orders, and promotions — all interaction wired via `data-action`/`data-id` attributes and a single delegated `click` listener (and a `change` listener for the order status select). No `onclick=` attributes anywhere in the HTML.
- Inline editing of price and stock
- Modal open/close helpers (`openModal` / `closeModal`)
- `loadDashboard()` — role-aware: fetches orders for all admin roles; fetches products and promotions only for `admin` (ventas sees those cards removed)
- Order status update and expand/collapse row details (uses `classList.toggle('hidden')`)
- `handlePromoNameSelect` — shows/hides the free-text promo name input when "Personalizado…" is selected

### Product images

Images live in `public/assets/img_realistas/`. The `image_url` column in `products` stores only the filename. The frontend prepends `/assets/img_realistas/` to form the URL. Products with `image_url = NULL` fall back to a CSS background colour.

---

## Database schema

Five tables (creation order respects foreign key dependencies):

**`users`**

| Column          | Type                               | Notes                        |
|-----------------|------------------------------------|------------------------------|
| `id`            | INT UNSIGNED PK                    | Auto-increment               |
| `email`         | VARCHAR(255) UNIQUE                |                              |
| `password_hash` | VARCHAR(255)                       | bcrypt, cost 12              |
| `role`          | ENUM(admin, ventas, cliente)     | Default: cliente             |
| `name`          | VARCHAR(120)                       |                              |
| `phone`         | VARCHAR(30) NULL                   |                              |
| `active`        | TINYINT(1)                         | Soft-delete flag             |
| `created_at`    | TIMESTAMP                          |                              |

**`products`**

| Column          | Type                               | Notes                              |
|-----------------|------------------------------------|------------------------------------|
| `id`            | INT UNSIGNED PK                    | Auto-increment                     |
| `name`          | VARCHAR(120)                       |                                    |
| `category`      | ENUM(Ternera…Embutidos)            |                                    |
| `price`         | DECIMAL(8,2)                       | EUR per kg or per unit             |
| `unit_type`     | ENUM(kg, pieza)                    | Default: kg                        |
| `stock_qty`     | DECIMAL(10,3) NULL                 | NULL = no limit defined            |
| `stock_enabled` | TINYINT(1)                         | Show stock to customers when 1     |
| `note`          | VARCHAR(255) NULL                  | Short description                  |
| `image_url`     | VARCHAR(255) NULL                  | Filename in `img_realistas/`       |
| `active`        | TINYINT(1)                         | Soft-delete flag                   |
| `created_at`    | TIMESTAMP                          |                                    |

**`orders`**

| Column           | Type                               | Notes                              |
|------------------|------------------------------------|------------------------------------|
| `id`             | INT UNSIGNED PK                    | Auto-increment                     |
| `user_id`        | INT UNSIGNED NULL FK → users       | NULL = anonymous order             |
| `customer_name`  | VARCHAR(120)                       |                                    |
| `phone`          | VARCHAR(30)                        |                                    |
| `address`        | TEXT                               |                                    |
| `zone`           | VARCHAR(80)                        | Delivery zone name                 |
| `time_slot`      | VARCHAR(60)                        | Human-readable time window         |
| `payment_method` | VARCHAR(40)                        |                                    |
| `items`          | JSON                               | Array of {id, name, price, qty}    |
| `total`          | DECIMAL(10,2)                      | Calculated server-side             |
| `status`         | ENUM(pendiente…cancelado)          | Default: pendiente                 |
| `created_at`     | TIMESTAMP                          |                                    |
| `updated_at`     | TIMESTAMP                          | Auto-updated on change             |

**`promotions`**

| Column       | Type                               | Notes                              |
|--------------|------------------------------------|------------------------------------|
| `id`         | INT UNSIGNED PK                    | Auto-increment                     |
| `name`       | VARCHAR(120)                       | Display name                       |
| `type`       | ENUM(porcentaje, precio_fijo)      |                                    |
| `value`      | DECIMAL(8,2)                       | 15 = 15 % or 15 EUR off            |
| `applies_to` | ENUM(todos, categoria, producto)   | Scope of the discount              |
| `category`   | VARCHAR(80) NULL                   | Used when applies_to = categoria   |
| `active`     | TINYINT(1)                         | Only active promos apply           |
| `starts_at`  | TIMESTAMP NULL                     | NULL = no start restriction        |
| `ends_at`    | TIMESTAMP NULL                     | NULL = no expiry                   |
| `created_at` | TIMESTAMP                          |                                    |

**`promotion_products`** (junction table)

| Column         | Type             | Notes                              |
|----------------|------------------|------------------------------------|
| `promotion_id` | INT UNSIGNED FK  | → promotions(id) CASCADE DELETE    |
| `product_id`   | INT UNSIGNED FK  | → products(id) CASCADE DELETE      |

---

## Docker setup

`docker-compose.yml` defines two services:

- **`db`** — MariaDB 11. Mounts `backend/database/schema.sql` into `docker-entrypoint-initdb.d/` so it runs exactly once on the first boot. Data is persisted in a named volume `db_data`.
- **`app`** — Node.js. Depends on `db` with a `service_healthy` condition. Mounts `public/` as a bind mount so you can update static assets without rebuilding the image.

Both services share the `carniceria_net` bridge network. Neither container runs as root.

---

## Security model

The application follows a defence-in-depth approach:

1. **Transport** — HTTPS enforced via Nginx in production; HTTP Strict Transport Security header set by `helmet`.
2. **Authentication** — Passwords hashed with bcrypt (cost 12). Login rate-limited to 10 attempts / 15 min per IP. `trust proxy: 1` ensures the rate limiter sees real client IPs behind Nginx.
3. **Authorisation** — JWT verified on every protected request server-side; role checked per route. Client-side `requireAuth` provides UX-only gating (not a security boundary).
4. **Input handling** — All SQL parameters use `?` placeholders. All HTML output escapes via `escHtml()`. Order prices are calculated server-side from the database — client-supplied prices are ignored.
5. **Secrets** — All credentials in `.env` (`.gitignore` enforced). `JWT_SECRET` must be 64 random bytes.
6. **Redirect safety** — Post-login `?return=` parameter is validated to allow only same-origin paths (must start with `/` and not `//`).
