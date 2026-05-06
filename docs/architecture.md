# Architecture

## Overview

Carnicería Artesanal is a three-tier web application: a static frontend served by the same Express process that also exposes a REST API, backed by a MariaDB database. There is no separate build step, no frontend framework, and no ORM — every layer is thin and easy to reason about.

```
Browser
  │
  │  GET /  →  index.html (static)
  │  GET /assets/**  →  CSS, JS, images (static)
  │  GET /api/**     →  JSON API
  ▼
Express (Node.js 20)
  ├── helmet()          security headers
  ├── express.static()  serves public/
  ├── /api/products     products router
  └── /api/orders       orders router
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

1. `helmet()` — sets secure HTTP headers (CSP disabled to allow Google Fonts)
2. `cors()` — permissive in development; tighten the `origin` option for production
3. `express.json()` — parses request bodies
4. `express.static(PUBLIC_DIR)` — serves everything under `public/`
5. API routes
6. Catch-all `*` — returns `index.html` for client-side navigation

### Database — `backend/src/config/database.js`

Uses `mysql2/promise` in pool mode (up to 10 concurrent connections). All credentials come from environment variables; the file has no hardcoded secrets.

### Products route — `GET /api/products`

Builds a dynamic `SELECT` query:

- Base filter: `active = 1`
- Optional `category` filter: appended with `AND category = ?`
- Optional `search` filter: `AND (name LIKE ? OR note LIKE ?)`
- Final `ORDER BY FIELD(category, …), name` guarantees a deterministic display order matching the butcher's own taxonomy (Ternera → Cerdo → Pollo → Cordero → Embutidos)

All parameters are passed as `?` placeholders — never interpolated into the SQL string.

### Orders route — `POST /api/orders`

Validates that the required fields are present, calculates the order total server-side (never trusting the client total), serialises `items` as JSON, and inserts a single row.

---

## Frontend

A single HTML file loads one CSS file and one JS file. No bundler, no transpiler, no `node_modules` on the client.

### `public/assets/js/main.js`

Key design decisions:

- **`escHtml()`** — every piece of server-returned data is escaped before DOM insertion. No `innerHTML` with raw API values anywhere.
- **`Map` for cart state** — keyed by product ID; O(1) lookups and clean iteration with `forEach`.
- **Event delegation** — a single listener on `#productGrid` handles all "add to cart" clicks; likewise for cart quantity controls. No listener-per-element.
- **Debounced search** — 320 ms delay on the `input` event prevents a flood of API calls while the user is typing.
- **`fetch` + `async/await`** — no third-party HTTP library needed.
- **`Intl.NumberFormat`** — locale-aware euro formatting (`es-ES`, EUR) without a library.

### Product images

Images live in `public/assets/img/`. The `image_url` column in `products` stores only the filename (e.g. `solomillo.jpg`). The frontend prepends `/assets/img/` to form the URL, so the image is served by `express.static` like any other asset. Products with a `NULL` `image_url` fall back to a CSS background colour.

---

## Database schema

Two tables:

**`products`**

| Column      | Type                  | Notes                            |
|-------------|-----------------------|----------------------------------|
| `id`        | INT UNSIGNED PK       | Auto-increment                   |
| `name`      | VARCHAR(120)          | Display name                     |
| `category`  | ENUM                  | Ternera / Cerdo / Pollo / Cordero / Embutidos |
| `price`     | DECIMAL(8,2)          | EUR per kg                       |
| `note`      | VARCHAR(255) NULL     | Short description                |
| `image_url` | VARCHAR(255) NULL     | Filename in `public/assets/img/` |
| `active`    | TINYINT(1)            | Soft-delete flag                 |
| `created_at`| TIMESTAMP             | Auto-set on insert               |

**`orders`**

| Column           | Type                  | Notes                              |
|------------------|-----------------------|------------------------------------|
| `id`             | INT UNSIGNED PK       | Auto-increment                     |
| `customer_name`  | VARCHAR(120)          |                                    |
| `phone`          | VARCHAR(30)           |                                    |
| `address`        | TEXT                  |                                    |
| `zone`           | VARCHAR(80)           | Delivery zone name                 |
| `time_slot`      | VARCHAR(60)           | Human-readable time window         |
| `payment_method` | VARCHAR(40)           | Efectivo / Bizum / Tarjeta / etc.  |
| `items`          | JSON                  | Array of `{id, name, price, qty}`  |
| `total`          | DECIMAL(10,2)         | Calculated server-side             |
| `status`         | ENUM                  | pendiente → confirmado → entregado |
| `created_at`     | TIMESTAMP             |                                    |
| `updated_at`     | TIMESTAMP             | Auto-updated on change             |

---

## Docker setup

`docker-compose.yml` defines two services:

- **`db`** — MariaDB 11. Mounts `backend/database/schema.sql` into `docker-entrypoint-initdb.d/` so it runs exactly once on the first boot. Data is persisted in a named volume `db_data`.
- **`app`** — Node.js. Depends on `db` with a `service_healthy` condition. Mounts `public/` as a bind mount so you can update static assets without rebuilding the image.

Both services share the `carniceria_net` bridge network. Neither container runs as root.

---

## Extending the project

Common next steps people ask about:

- **Admin panel** — add a `POST /api/products` route and a separate admin HTML page protected by a simple bearer token or session cookie.
- **Order status updates** — the `status` ENUM is already in the schema; wire up a `PATCH /api/orders/:id` route.
- **WebSockets / SSE** — push order notifications to an admin dashboard in real time without polling.
- **Authentication** — `express-session` + `bcrypt` is the straightforward path; JWT if you want stateless API tokens.
- **Rate limiting** — `express-rate-limit` on the `/api/orders` route to prevent spam.
