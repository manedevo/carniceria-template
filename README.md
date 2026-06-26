# Carnicería Artesanal — Full-Stack Web Application

A production-ready ordering platform for an artisan butcher shop in Madrid. Customers browse a live product catalogue, build a cart, and submit delivery orders. Authenticated customers can track their order history. An admin panel lets the owner manage products, stock, promotions, and orders — all with role-based access control.

Built as a personal portfolio project to demonstrate end-to-end web development: REST API design, JWT authentication, RBAC, relational databases, Docker-based deployment, and clean vanilla JavaScript on the frontend.

**Live demo** → _self-host in under 5 minutes using the instructions below_

---

## What it does

- **Product catalogue** with category filtering, real-time search, and live promotion badges
- **Shopping cart** with add/remove and quantity controls, persisted in memory
- **Order form** with delivery zone, time slot, and payment method selection
- **Authentication** — customer registration and login via JWT (JSON Web Token)
- **Role-based access** — three roles: `admin`, `ventas` (sales), `cliente` (customer)
- **Admin panel** — manage products (CRUD + stock), orders (status flow), and promotions
- **Promotions engine** — percentage or fixed-price discounts scoped to all products, a category, or specific items; reflected live on the storefront
- **Customer account** — order history page for authenticated customers
- **REST API** (Node.js + Express) backed by MariaDB
- **Bilingual docs** (English + Spanish)
- **One-command deployment** via Docker Compose or a Vagrant VM

---

## Tech stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Runtime     | Node.js 20 LTS                                    |
| Framework   | Express 4                                         |
| Database    | MariaDB 11 (mysql2/promise pool)                  |
| Auth        | bcryptjs · jsonwebtoken · express-rate-limit      |
| Frontend    | Vanilla JS (ES2020, no build step)                |
| Styling     | Plain CSS (custom properties, CSS Grid)           |
| Fonts       | Google Fonts — Cormorant Garamond + Montserrat    |
| Container   | Docker + Docker Compose v2                        |
| Security    | Helmet.js, parameterized queries, bcrypt cost 12  |
| Dev VM      | Vagrant + VirtualBox / VMware (Ubuntu 22.04)      |

---

## Project structure

```
carniceria-template/
├── backend/
│   ├── index.js                    Express entry point — registers all routes
│   ├── Dockerfile
│   ├── package.json
│   ├── database/
│   │   └── schema.sql              5 tables + 30 seed products
│   ├── scripts/
│   │   └── create-admin.js         CLI tool to create the first admin user
│   └── src/
│       ├── config/
│       │   └── database.js         mysql2 connection pool
│       ├── middleware/
│       │   ├── authenticate.js     JWT verification middleware
│       │   └── requireRole.js      RBAC role-check middleware
│       └── routes/
│           ├── products.js         GET /api/products (public, includes promo data)
│           ├── orders.js           POST /api/orders (public, links user_id if logged in)
│           ├── auth.js             POST /register, /login · GET /me
│           ├── admin/
│           │   ├── products.js     Full CRUD — admin only
│           │   ├── orders.js       All orders — admin + ventas; status update admin only
│           │   └── promotions.js   Promotion management — admin only
│           └── user/
│               └── orders.js       Customer's own order history — cliente only
├── public/                         Served as static files by Express
│   ├── index.html                  Storefront (promo banner, stock badges, auth nav)
│   ├── login.html
│   ├── registro.html
│   ├── mi-cuenta.html              Customer order history
│   ├── admin/
│   │   ├── index.html              Dashboard (stats + recent orders)
│   │   ├── productos.html          Product table with inline editing
│   │   ├── pedidos.html            Order list with filters and status selector
│   │   └── promociones.html        Promotion creator
│   └── assets/
│       ├── css/
│       │   ├── main.css            Storefront styles
│       │   └── admin.css           Admin panel styles
│       ├── js/
│       │   ├── main.js             Storefront logic (cart, products, promos)
│       │   ├── auth.js             JWT helpers (localStorage, apiFetch, requireAuth)
│       │   └── admin.js            Admin panel logic (all pages)
│       └── img_realistas/          Product images
├── deployment/
│   ├── setup/setup_sh/setup.sh     Automated Linux installer (VPS)
│   └── Vm_tests/
│       ├── Vagrantfile             Local test VM (auto-detects VirtualBox / VMware)
│       └── windows/
│           ├── launch.bat          Double-click launcher for Windows (no prerequisites)
│           └── launch.ps1          PowerShell setup logic (installs everything)
├── docs/                           English documentation
│   ├── architecture.md
│   └── deployment.md
├── docs/es/                        Spanish documentation
│   ├── arquitectura.md
│   └── despliegue.md
├── tasks/                          Dev planning (not committed by .gitignore)
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Quick start (Docker)

**Requirements:** Docker Engine 24+ and Docker Compose v2.

```bash
git clone https://github.com/manedevo/carniceria-template.git
cd carniceria-template
cp .env.example .env
```

Edit `.env`: set `DB_PASSWORD`, and generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# paste the output as JWT_SECRET in .env
```

Then start:

```bash
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000).

### Create the first admin user

Once the containers are running:

```bash
docker compose exec app \
  node scripts/create-admin.js admin@carniceria.es MyStr0ngPass "Admin Name"
```

Then log in at [http://localhost:3000/login.html](http://localhost:3000/login.html).

---

## Quick start (Vagrant — local VM)

No Docker on your machine? Spin up a full Ubuntu VM.

**On Windows** — double-click `deployment/Vm_tests/windows/launch.bat`. It installs everything from scratch (Chocolatey, VirtualBox or detects VMware, Vagrant, plugins) and starts the VM. No prerequisites needed.

**On Linux / macOS** — with Vagrant already installed:

```bash
cd deployment/Vm_tests
vagrant up
```

The Vagrantfile **auto-detects** the installed hypervisor and installs the VMware Vagrant plugin automatically if needed. First boot takes 15–20 minutes. App available at [http://localhost:8080](http://localhost:8080).

---

## Environment variables

Copy `.env.example` to `.env` and adjust:

| Variable          | Default         | Description                                        |
|-------------------|-----------------|----------------------------------------------------|
| `DB_HOST`         | `db`            | MariaDB host (use `db` for Docker)                 |
| `DB_PORT`         | `3306`          | MariaDB port                                       |
| `DB_USER`         | `carniceria`    | Database user                                      |
| `DB_PASSWORD`     | _(required)_    | Database password                                  |
| `DB_NAME`         | `carniceria_db` | Database name                                      |
| `PORT`            | `3000`          | HTTP port the app listens on                       |
| `NODE_ENV`        | `production`    | Node environment                                   |
| `JWT_SECRET`      | _(required)_    | 64-byte random secret — **generate, never reuse**  |
| `JWT_EXPIRES_IN`  | `8h`            | Token lifetime                                     |
| `BCRYPT_ROUNDS`   | `12`            | bcrypt work factor (higher = slower = safer)       |

---

## API reference

### Public endpoints

| Method | Endpoint                    | Description                                          |
|--------|-----------------------------|------------------------------------------------------|
| GET    | `/api/products`             | Active products with optional promo fields           |
| GET    | `/api/products?category=X`  | Filter by category                                   |
| GET    | `/api/products?search=X`    | Full-text search on name and note                    |
| GET    | `/api/products/categories`  | Distinct active categories                           |
| POST   | `/api/orders`               | Create order (links to user if JWT present in header)|

### Auth endpoints

| Method | Endpoint            | Description                          |
|--------|---------------------|--------------------------------------|
| POST   | `/api/auth/register`| Register a new customer account      |
| POST   | `/api/auth/login`   | Log in — returns JWT                 |
| GET    | `/api/auth/me`      | Current user info (requires JWT)     |

### Admin endpoints — require `Authorization: Bearer <token>`

| Method | Endpoint                          | Roles              |
|--------|-----------------------------------|--------------------|
| GET    | `/api/admin/products`             | admin              |
| POST   | `/api/admin/products`             | admin              |
| PUT    | `/api/admin/products/:id`         | admin              |
| DELETE | `/api/admin/products/:id`         | admin              |
| PATCH  | `/api/admin/products/:id/stock`   | admin              |
| GET    | `/api/admin/orders`               | admin, ventas    |
| GET    | `/api/admin/orders/:id`           | admin, ventas    |
| PUT    | `/api/admin/orders/:id/status`    | admin              |
| GET    | `/api/admin/promotions`           | admin              |
| POST   | `/api/admin/promotions`           | admin              |
| PUT    | `/api/admin/promotions/:id`       | admin              |
| DELETE | `/api/admin/promotions/:id`       | admin              |

### Customer endpoints — require JWT with role `cliente`

| Method | Endpoint              | Description             |
|--------|-----------------------|-------------------------|
| GET    | `/api/user/orders`    | Authenticated customer's orders   |
| GET    | `/api/user/orders/:id`| Single order (ownership verified) |

---

## Role matrix (RBAC)

| Feature                          | admin | ventas | cliente | anonymous |
|----------------------------------|-------|----------|---------|-----------|
| Browse catalogue / add to cart   | ✓     | ✓        | ✓       | ✓         |
| Place an order                   | ✓     | ✓        | ✓       | ✓         |
| View own order history           | ✓     | ✓        | ✓       | —         |
| View all orders                  | ✓     | ✓        | —       | —         |
| Change order status              | ✓     | —        | —       | —         |
| Manage products / stock          | ✓     | —        | —       | —         |
| Manage promotions                | ✓     | —        | —       | —         |

---

## Product images

Drop `.jpg` or `.webp` files into `public/assets/img_realistas/`. The filename must match the `image_url` column in the `products` table. Products without an image fall back to a neutral background.

---

## Production deployment

See [docs/deployment.md](docs/deployment.md) for:

- Running the automated setup script on a VPS
- Nginx reverse proxy + Let's Encrypt SSL configuration
- Admin user creation on first boot
- PM2 (no-Docker option)
- Firewall rules and backup cron

---

## Security

| Measure                | Implementation                                                    |
|------------------------|-------------------------------------------------------------------|
| Password hashing       | bcrypt, cost 12 — never MD5 or plain SHA                          |
| Stateless sessions     | JWT signed with 64-byte random secret, 8 h expiry                 |
| Brute-force protection | `express-rate-limit`: 10 login attempts / 15 min per IP           |
| SQL injection          | All queries use `?` parameterized placeholders via `mysql2`       |
| XSS                    | `escHtml()` applied to every server-returned value before DOM write|
| Security headers       | `helmet()` — X-Frame-Options, X-Content-Type-Options, HSTS, etc. |
| Secrets                | `.env` never committed (enforced by `.gitignore`)                  |
| Admin routes           | JWT verified server-side on every request; role checked per route  |

---

## License

MIT — do whatever you want with it. A link back is appreciated but not required.
