# Guía de despliegue

## Opción A — Docker Compose (recomendado)

La forma más rápida de tener una instancia funcionando. Funciona en cualquier VPS Linux o máquina local con Docker Engine 24+ y Docker Compose v2.

```bash
git clone https://github.com/manedevo/carniceria-template.git
cd carniceria-template
cp .env.example .env
```

Edita `.env` y establece como mínimo una `DB_PASSWORD` fuerte. Después:

```bash
docker compose up -d --build
```

Comprueba el estado:

```bash
docker compose ps
docker compose logs -f app
```

Abre `http://<ip-de-tu-servidor>:3000`.

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
curl -fsSL https://raw.githubusercontent.com/manedevo/carniceria-template/master/deployment/setup.sh \
  | sudo bash
```

O si ya tienes el repositorio:

```bash
sudo bash deployment/setup.sh
```

El script es idempotente: ejecutarlo de nuevo en una instalación existente descargará el último código y reiniciará los contenedores sin perder datos.

---

## Opción C — VM con Vagrant (pruebas locales)

¿Sin Docker? ¿Sin VPS? Levanta una VM Ubuntu local.

### Windows (sin requisitos previos)

Haz doble-click en `deployment/Vm_tests/windows/launch.bat`. El lanzador:

1. Solicita privilegios de administrador automáticamente (prompt UAC)
2. Instala **Chocolatey** (gestor de paquetes de Windows) si no está presente
3. Detecta VMware Workstation — o instala **VirtualBox** si no hay hipervisor
4. Instala **Vagrant** si no está presente
5. Instala el plugin `vagrant-vmware-desktop` si se detectó VMware
6. Ejecuta `vagrant up` con el provider correcto

Sin pasos manuales. Sin software previo necesario.

### Linux / macOS

Con Vagrant ya instalado:

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
> # o en Windows PowerShell:
> $env:VAGRANT_DEFAULT_PROVIDER="virtualbox"; vagrant up
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

### 3. Instalar dependencias y arrancar con PM2

```bash
cd /opt/carniceria-template/backend
npm ci --omit=dev
npm install -g pm2
pm2 start index.js --name carniceria
pm2 save
pm2 startup   # sigue el comando impreso para habilitar el inicio automático
```

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
