# Deployment guide

## Option A — Docker Compose (recommended)

The fastest path to a running instance. Works on any Linux VPS or local machine with Docker Engine 24+ and Docker Compose v2.

```bash
git clone https://github.com/manedevo/carniceria-template.git
cd carniceria-template
cp .env.example .env
```

Edit `.env`:

1. Set a strong `DB_PASSWORD`.
2. Generate a secure `JWT_SECRET` (required — the placeholder value is not safe):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# paste the output as JWT_SECRET= in .env
```

Then start:

```bash
docker compose up -d --build
```

Check the status:

```bash
docker compose ps
docker compose logs -f app
```

Open `http://<your-server-ip>:3000`.

### Create the first admin user

The schema ships without any users. Run the setup script once after the containers are up:

```bash
docker compose exec app \
  node scripts/create-admin.js admin@yourdomain.com MyStr0ngPass "Admin Name"
```

You can then log in at `/login.html`. The script hashes the password with bcrypt at the configured cost and inserts the row — it will refuse to run if the email already exists.

### Updating

```bash
git pull origin master
docker compose up -d --build
```

The database schema is only applied once (on first boot), so existing orders and products are safe across rebuilds.

---

## Option B — Automated setup script

For a fresh Ubuntu 22.04 / 24.04 or RHEL/Fedora VPS. The script installs Docker, clones the repo, generates a `.env`, and starts the containers.

```bash
curl -fsSL https://raw.githubusercontent.com/manedevo/carniceria-template/master/deployment/setup/setup_sh/setup.sh \
  | sudo bash
```

Or if you already have the repo:

```bash
sudo bash deployment/setup/setup_sh/setup.sh
```

The script generates all credentials automatically — `DB_PASSWORD`, `DB_ROOT_PASSWORD`, and `JWT_SECRET` (64-byte random hex). No manual `.env` editing needed. After it finishes, just create the admin user as described in Option A.

The script is idempotent — running it again on an existing installation will pull the latest code and restart containers without losing data.

---

## Option C — Vagrant VM (local testing)

No Docker? No VPS? Spin up a local Ubuntu VM.

### Windows (zero prerequisites)

Double-click `deployment/Vm_tests/windows/launch.bat`. The launcher:

1. Requests administrator privileges automatically (UAC prompt)
2. Installs **Chocolatey** (Windows package manager) if not present
3. Detects VMware Workstation — or installs **VirtualBox** if no hypervisor is found
4. Installs **Vagrant** if not present
5. Installs the `vagrant-vmware-desktop` plugin if VMware was detected
6. Runs `vagrant up` with the correct provider

No manual steps. No prior software needed.

### Linux / macOS

With Vagrant already installed:

```bash
cd deployment/Vm_tests
vagrant up
```

The Vagrantfile auto-detects the installed hypervisor (VMware Fusion, VMware Workstation, or VirtualBox) and installs the VMware Vagrant plugin automatically if needed.

### After the VM is running

First boot takes 15–20 minutes. After that:

```bash
cd deployment/Vm_tests
vagrant halt       # stop VM
vagrant up         # start again (seconds)
vagrant ssh        # open a shell inside the VM
vagrant destroy -f # delete everything
```

App is available at `http://localhost:8080` on your host machine.

> **Override provider manually** (optional):
> ```bash
> VAGRANT_DEFAULT_PROVIDER=virtualbox vagrant up
> # or on Windows:
> $env:VAGRANT_DEFAULT_PROVIDER="virtualbox"; vagrant up
> ```

---

## Production setup — Nginx + SSL

For a public-facing server, put Nginx in front of the Node app and terminate SSL there.

### 1. Install Nginx and Certbot

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

### 2. Nginx site configuration

Create `/etc/nginx/sites-available/carniceria`:

```nginx
server {
    listen 80;
    server_name tu-dominio.es www.tu-dominio.es;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Static assets — let Nginx serve them directly for better performance
    location /assets/ {
        alias /opt/carniceria-template/public/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/carniceria /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 3. Obtain SSL certificate

```bash
certbot --nginx -d tu-dominio.es -d www.tu-dominio.es
```

Certbot rewrites the Nginx config to add the HTTPS block and auto-renews the certificate.

### 4. Firewall

```bash
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP (redirect to HTTPS)
ufw allow 443/tcp    # HTTPS
ufw enable
```

Do **not** open port 3000 to the internet — let Nginx proxy it.

> **`trust proxy` note:** The Express app is hardcoded with `app.set('trust proxy', 1)`, which assumes exactly one proxy hop (Nginx → Node). This is correct for this deployment topology and required for per-IP rate limiting to work. If you add another proxy layer in front (e.g. a CDN like Cloudflare), update that value in `backend/index.js` to match the total number of hops.

---

## Option D — PM2 (no Docker)

If you prefer to run Node directly on the host:

### 1. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### 2. Install MariaDB

```bash
apt-get install -y mariadb-server
mysql_secure_installation
mysql -u root -p < /opt/carniceria-template/backend/database/schema.sql
```

### 3. Configure environment

```bash
cp .env.example .env
# set DB_HOST=localhost, DB_PASSWORD, and a generated JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Install dependencies and start with PM2

```bash
cd /opt/carniceria-template/backend
npm ci --omit=dev
npm install -g pm2
pm2 start index.js --name carniceria
pm2 save
pm2 startup   # follow the printed command to enable autostart
```

### 5. Create the first admin user

```bash
cd /opt/carniceria-template/backend
node scripts/create-admin.js admin@yourdomain.com MyStr0ngPass "Admin Name"
```

### 6. PM2 ecosystem file (optional)

Create `backend/ecosystem.config.js` to manage env vars via PM2:

```js
module.exports = {
  apps: [{
    name: 'carniceria',
    script: 'index.js',
    env: {
      NODE_ENV:       'production',
      PORT:           3000,
      DB_HOST:        'localhost',
      DB_USER:        'carniceria',
      DB_PASSWORD:    'your-password',
      DB_NAME:        'carniceria_db',
      JWT_SECRET:     'your-64-byte-hex-secret',
      JWT_EXPIRES_IN: '8h',
      BCRYPT_ROUNDS:  '12',
    },
  }],
};
```

Then: `pm2 start ecosystem.config.js`

---

## Database migrations

The schema is applied only once on first boot. Subsequent updates that add indexes or alter tables require running migration files manually.

Migration files live in `backend/database/migrations/` and are numbered sequentially. All migrations use `IF NOT EXISTS` / `IF NOT EXISTS` guards so they are safe to re-run.

### Apply a migration (Docker)

```bash
docker compose exec db mariadb \
  -u carniceria -p"${DB_PASSWORD}" carniceria_db \
  < backend/database/migrations/001_add_indexes.sql
```

### Apply a migration (PM2 / bare metal)

```bash
mariadb -u carniceria -p carniceria_db \
  < backend/database/migrations/001_add_indexes.sql
```

### Available migrations

| File | Description |
|---|---|
| `001_add_indexes.sql` | Adds performance indexes on `orders.status`, `orders.created_at`, and `promotions(active, starts_at, ends_at)` |

---

## Logs and monitoring

```bash
# Docker
docker compose logs -f app
docker compose logs -f db

# PM2
pm2 logs carniceria
pm2 monit
```

---

## Backups

### Database backup (Docker)

```bash
docker compose exec db \
  mariadb-dump -u carniceria -p"$DB_PASSWORD" carniceria_db \
  > backup-$(date +%F).sql
```

### Database backup (PM2/bare metal)

```bash
mariadb-dump -u carniceria -p carniceria_db > backup-$(date +%F).sql
```

Schedule with cron:

```cron
0 3 * * * /opt/carniceria-template/backup.sh >> /var/log/carniceria-backup.log 2>&1
```
