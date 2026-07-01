# Guía de despliegue

## Opción A — Docker Compose (recomendado)

La forma más rápida de tener una instancia funcionando. Funciona en cualquier VPS Linux o máquina local con Docker Engine 24+ y Docker Compose v2.

```bash
git clone https://github.com/manedevo/carniceria-template.git
cd carniceria-template
cp .env.example .env
```

Edita `.env`:

1. Establece una `DB_PASSWORD` fuerte.
2. Genera un `JWT_SECRET` (JSON Web Token Secret) seguro — el valor de ejemplo NO es seguro para producción:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# pega el resultado como JWT_SECRET= en .env
```

Luego arranca:

```bash
docker compose up -d --build
```

Comprueba el estado:

```bash
docker compose ps
docker compose logs -f app
```

Abre `http://<ip-de-tu-servidor>:3000`.

### Crear el primer usuario admin

El esquema no incluye ningún usuario. Ejecuta el script de configuración una vez con los contenedores en marcha:

```bash
docker compose exec app \
  node scripts/create-admin.js admin@tudominio.es MiContraseña123 "Nombre Admin"
```

Luego inicia sesión en `/login.html`. El script aplica bcrypt a la contraseña con el coste configurado e inserta la fila — rechazará ejecutarse si el correo ya existe.

### Actualizar

```bash
git pull origin master
docker compose up -d --build
```

El esquema de la base de datos solo se aplica una vez (en el primer arranque), por lo que los pedidos y productos existentes son seguros en cada reconstrucción.

---

## Opción B — Script de instalación automatizado

Para un VPS con Ubuntu 22.04 / 24.04 o RHEL/Fedora recién instalado. El script instala Docker, clona el repositorio, genera un `.env` e inicia los contenedores.

```bash
curl -fsSL https://raw.githubusercontent.com/manedevo/carniceria-template/master/deployment/setup/setup_sh/setup.sh \
  | sudo bash
```

O si ya tienes el repositorio:

```bash
sudo bash deployment/setup/setup_sh/setup.sh
```

El script genera todas las credenciales automáticamente — `DB_PASSWORD`, `DB_ROOT_PASSWORD` y `JWT_SECRET` (hex de 64 bytes). No es necesario editar el `.env` manualmente. Al terminar, solo hay que crear el usuario admin como se describe en la Opción A.

El script es idempotente: ejecutarlo de nuevo en una instalación existente descargará el último código y reiniciará los contenedores sin perder datos.

---

## Opción C — VM con Vagrant (pruebas locales)

¿Sin Docker? ¿Sin VPS? Levanta una VM Ubuntu local. Solo Linux/macOS — con Vagrant ya instalado:

```bash
cd deployment/Vm_tests
vagrant up
```

El Vagrantfile detecta automáticamente el hipervisor instalado e instala el plugin de VMware si es necesario.

### Después de que la VM esté en marcha

El primer arranque tarda 15–20 minutos. Después:

```bash
cd deployment/Vm_tests
vagrant halt       # parar la VM
vagrant up         # volver a arrancar (segundos)
vagrant ssh        # abrir una shell dentro de la VM
vagrant destroy -f # borrar todo
```

La app está disponible en `http://localhost:8080` desde tu máquina anfitriona.

> **Forzar un provider manualmente** (opcional):
> ```bash
> VAGRANT_DEFAULT_PROVIDER=virtualbox vagrant up
> ```

---

## Producción — Nginx + SSL

Para un servidor de cara al público, pon Nginx delante de la app Node y termina SSL ahí.

### 1. Instalar Nginx y Certbot

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

### 2. Configuración del sitio en Nginx

Crea `/etc/nginx/sites-available/carniceria`:

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

    location /assets/ {
        alias /opt/carniceria-template/public/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Activa el sitio:

```bash
ln -s /etc/nginx/sites-available/carniceria /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 3. Obtener certificado SSL

```bash
certbot --nginx -d tu-dominio.es -d www.tu-dominio.es
```

Certbot reescribe la configuración de Nginx para añadir el bloque HTTPS y renueva el certificado automáticamente.

### 4. Cortafuegos

```bash
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP (redirige a HTTPS)
ufw allow 443/tcp    # HTTPS
ufw enable
```

**No** abras el puerto 3000 a Internet — deja que Nginx lo proxifique.

> **Nota sobre `trust proxy`:** La app tiene `app.set('trust proxy', 1)`, que asume la topología Internet → Nginx → Node (1 salto). Esto es necesario para que el limitador de velocidad (rate limiter) funcione por IP real. Si añades una CDN delante de Nginx (p. ej. Cloudflare), cambia el valor a `2` en `backend/index.js`. Si Node queda expuesto directamente a Internet sin proxy, elimina esa línea.

---

## Opción D — PM2 (sin Docker)

Si prefieres ejecutar Node directamente en el servidor:

### 1. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### 2. Instalar MariaDB

```bash
apt-get install -y mariadb-server
mysql_secure_installation
mysql -u root -p < /opt/carniceria-template/backend/database/schema.sql
```

### 3. Configurar el entorno

```bash
cp .env.example .env
# Establece DB_HOST=localhost, DB_PASSWORD y un JWT_SECRET generado:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Establece ALLOWED_ORIGIN con tu dominio público (p. ej. https://tutienda.es)
# Si se deja vacío, las peticiones cross-origin quedan bloqueadas para todos los orígenes.
```

### 4. Instalar dependencias y arrancar con PM2

```bash
cd /opt/carniceria-template/backend
npm ci --omit=dev
npm install -g pm2
pm2 start index.js --name carniceria
pm2 save
pm2 startup   # sigue el comando impreso para habilitar el inicio automático
```

### 5. Crear el primer usuario admin

```bash
cd /opt/carniceria-template/backend
node scripts/create-admin.js admin@tudominio.es MiContraseña123 "Nombre Admin"
```

---

## Migraciones de base de datos

El esquema solo se aplica una vez en el primer arranque. Las actualizaciones que añadan índices o modifiquen tablas requieren ejecutar los archivos de migración manualmente.

Los archivos de migración están en `backend/database/migrations/` y están numerados secuencialmente. Todos usan `IF NOT EXISTS` para que sea seguro re-ejecutarlos.

### Aplicar una migración (Docker)

```bash
docker compose exec db mariadb \
  -u carniceria -p"${DB_PASSWORD}" carniceria_db \
  < backend/database/migrations/001_add_indexes.sql
```

### Aplicar una migración (PM2 / bare metal)

```bash
mariadb -u carniceria -p carniceria_db \
  < backend/database/migrations/001_add_indexes.sql
```

### Migraciones disponibles

| Archivo | Descripción |
|---|---|
| `001_add_indexes.sql` | Añade índices de rendimiento en `orders.status`, `orders.created_at` y `promotions(active, starts_at, ends_at)` |

---

## Logs y monitorización

```bash
# Docker
docker compose logs -f app
docker compose logs -f db

# PM2
pm2 logs carniceria
pm2 monit
```

---

## Copias de seguridad

### Base de datos (Docker)

```bash
docker compose exec db \
  mariadb-dump -u carniceria -p"$DB_PASSWORD" carniceria_db \
  > backup-$(date +%F).sql
```

### Base de datos (PM2 / servidor bare metal)

```bash
mariadb-dump -u carniceria -p carniceria_db > backup-$(date +%F).sql
```

Programa con cron:

```cron
0 3 * * * mariadb-dump -u carniceria -p"PASS" carniceria_db > /backups/backup-$(date +\%F).sql
```
