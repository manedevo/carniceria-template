# Carnicería Artesanal — Full-Stack Web Application

A production-ready ordering platform for an artisan butcher shop in Madrid. Customers browse a live product catalogue, build a cart, and submit delivery orders — all from a single-page interface with no external dependencies or heavy frameworks.

Built as a personal portfolio project to demonstrate end-to-end web development: REST API design, relational databases, Docker-based deployment, and clean vanilla JavaScript on the frontend.

**Live demo** → _self-host in under 5 minutes using the instructions below_

---

## What it does

- **Product catalogue** with category filtering and real-time search
- **Shopping cart** with add/remove and quantity controls, persisted in memory
- **Order form** with delivery zone, time slot, and payment method selection
- **REST API** (Node.js + Express) backed by MariaDB
- **Bilingual docs** (English + Spanish)
- **One-command deployment** via Docker Compose or a Vagrant VM

---

## Tech stack

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Runtime     | Node.js 20 LTS                          |
| Framework   | Express 4                               |
| Database    | MariaDB 11 (mysql2/promise pool)        |
| Frontend    | Vanilla JS (ES2020, no build step)      |
| Styling     | Plain CSS (custom properties, CSS Grid) |
| Fonts       | Google Fonts — Playfair Display + Inter |
| Container   | Docker + Docker Compose v2              |
| Security    | Helmet.js, parameterized queries        |
| Dev VM      | Vagrant + VirtualBox / VMware (Ubuntu 22.04) |

---

## Project structure

```
carniceria-template/
├── backend/
│   ├── index.js                  Express entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── database/
│   │   └── schema.sql            Table definitions + 30 seed products
│   └── src/
│       ├── config/
│       │   └── database.js       mysql2 connection pool
│       └── routes/
│           ├── products.js       GET /api/products, /api/products/categories
│           └── orders.js         POST /api/orders
├── public/                       Served as static files by Express
│   ├── index.html
│   └── assets/
│       ├── css/main.css
│       ├── js/main.js
│       └── img/                  Drop product images here (see below)
├── deployment/
│   ├── setup.sh                  Automated Linux installer (VPS)
│   └── Vm_tests/
│       ├── Vagrantfile           Local test VM (auto-detects VirtualBox / VMware)
│       └── windows/
│           ├── launch.bat        Double-click launcher for Windows (no prerequisites)
│           └── launch.ps1        PowerShell setup logic (installs everything)
├── setup/
│   ├── setup_sh/
│   │   └── setup.sh              Smart installer (multi-distro, auto Docker)
│   └── undo_limpieza_total/
│       └── limpieza_total.sh     Full cleanup script for test machines
├── docs/                         English documentation
│   ├── architecture.md
│   └── deployment.md
├── docs/es/                      Spanish documentation
│   ├── arquitectura.md
│   └── despliegue.md
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
cp .env.example .env        # edit DB_PASSWORD at minimum
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000).

The database schema and seed data are applied automatically on the first start via the `db` service's `docker-entrypoint-initdb.d/` mechanism.

---

## Quick start (Vagrant — local VM)

No Docker on your machine? Spin up a full Ubuntu VM.

**On Windows** — double-click `deployment/Vm_tests/windows/launch.bat`. It installs everything from scratch (Chocolatey, VirtualBox or detects VMware, Vagrant, plugins) and starts the VM. No prerequisites needed.

**On Linux / macOS** — with Vagrant already installed:

```bash
cd deployment/Vm_tests
vagrant up
```

The Vagrantfile **auto-detects** the installed hypervisor (VMware Fusion, VMware Workstation, or VirtualBox) and installs the VMware Vagrant plugin automatically if needed. No flags or manual steps required.

First boot takes 15–20 minutes (downloads the box, installs Docker, builds the app). App will be available at [http://localhost:8080](http://localhost:8080) on your host.

---

## Environment variables

Copy `.env.example` to `.env` and adjust:

| Variable      | Default         | Description                          |
|---------------|-----------------|--------------------------------------|
| `DB_HOST`     | `db`            | MariaDB host (use `db` for Docker)   |
| `DB_PORT`     | `3306`          | MariaDB port                         |
| `DB_USER`     | `carniceria`    | Database user                        |
| `DB_PASSWORD` | _(required)_    | Database password                    |
| `DB_NAME`     | `carniceria_db` | Database name                        |
| `PORT`        | `3000`          | HTTP port the app listens on         |
| `NODE_ENV`    | `production`    | Node environment                     |

---

## API reference

### Products

| Method | Endpoint                   | Description                              |
|--------|----------------------------|------------------------------------------|
| GET    | `/api/products`            | List active products (filterable)        |
| GET    | `/api/products?category=X` | Filter by category                       |
| GET    | `/api/products?search=X`   | Full-text search on name and note fields |
| GET    | `/api/products/categories` | Distinct active categories               |

### Orders

| Method | Endpoint      | Description        |
|--------|---------------|--------------------|
| POST   | `/api/orders` | Create a new order |

**POST /api/orders — request body:**

```json
{
  "name": "Ana García",
  "phone": "612345678",
  "address": "Calle Mayor 12, 3º B, Madrid",
  "zone": "Centro",
  "time_slot": "Tarde (16:00–20:00)",
  "payment_method": "Bizum",
  "items": [
    { "id": 4, "name": "Solomillo de ternera", "price": 22.90, "qty": 1 }
  ]
}
```

---

## Product images

Drop `.jpg` or `.webp` files into `public/assets/img/`. The filename must match the `image_url` column in the `products` table (e.g. `solomillo.jpg`). Products without an image fall back to a neutral background.

---

## Production deployment

See [docs/deployment.md](docs/deployment.md) for:

- Running the automated setup script on a VPS
- Nginx reverse proxy configuration
- Let's Encrypt SSL with Certbot
- PM2 (no-Docker option)
- Firewall rules

---

## Security

- **SQL injection** — all queries use parameterized placeholders (`?`) via `mysql2`
- **XSS** — all user-supplied data rendered via `escHtml()` before DOM insertion
- **Headers** — `helmet()` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, etc.
- **Secrets** — credentials live in `.env`, never committed (`.gitignore` enforced)

---

## License

MIT — do whatever you want with it. A link back is appreciated but not required.
