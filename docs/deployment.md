# Deployment guide

## Option A — Docker Compose (recommended)

The fastest path to a running instance. Works on any Linux VPS or local machine with Docker Engine 24+ and Docker Compose v2.

```bash
git clone https://github.com/manedevo/carniceria-template.git
cd carniceria-template
cp .env.example .env
```

Edit `.env` and set at minimum a strong `DB_PASSWORD`. Then:

```bash
docker compose up -d --build
```

Check the status:

```bash
docker compose ps
docker compose logs -f app
```

Open `http://<your-server-ip>:3000`.

### Updating

```bash
git pull origin main
docker compose up -d --build
```

The database schema is only applied once (on first boot), so existing orders and products are safe across rebuilds.

---

## Option B — Automated setup script

For a fresh Ubuntu 22.04 / 24.04 or RHEL/Fedora VPS. The script installs Docker, clones the repo, generates a `.env`, and starts the containers.

```bash
curl -fsSL https://raw.githubusercontent.com/manedevo/carniceria-template/main/deployment/setup.sh \
  | sudo bash
```

Or if you already have the repo:

```bash
sudo bash deployment/setup.sh
```

The script is idempotent — running it again on an existing installation will pull the latest code and restart containers without losing data.

---

## Option C — Vagrant VM (local testing)

No Docker? No VPS? Spin up a local Ubuntu VM:

```bash
cd deployment/Vm_tests
vagrant up
```

First boot takes 15–20 minutes (downloads the box, installs Docker, builds the app). After that:

```bash
vagrant halt       # stop VM
vagrant up         # start again (seconds)
vagrant destroy -f # delete everything
```

The app is available at `http://localhost:8080` on your host machine.

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

### 3. Install dependencies and start with PM2

```bash
cd /opt/carniceria-template/backend
npm ci --omit=dev
npm install -g pm2
pm2 start index.js --name carniceria
pm2 save
pm2 startup   # follow the printed command to enable autostart
```

### 4. Environment variables with PM2

Create an `ecosystem.config.js` in the backend directory:

```js
module.exports = {
  apps: [{
    name: 'carniceria',
    script: 'index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_HOST: 'localhost',
      DB_USER: 'carniceria',
      DB_PASSWORD: 'your-password',
      DB_NAME: 'carniceria_db',
    },
  }],
};
```

Then: `pm2 start ecosystem.config.js`

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
