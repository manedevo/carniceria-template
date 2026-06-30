#!/usr/bin/env bash
# setup_domain.sh — Nginx + SSL Let's Encrypt para carniceria-template
# Uso: sudo bash setup_domain.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
step()  { echo -e "\n${BLUE}━━━ $* ━━━${NC}"; }

[[ "$EUID" -ne 0 ]] && error "Ejecuta con sudo: sudo bash setup_domain.sh"

# ─────────────────────────────────────────────────────────────────────────────
# PASO 0 — Recoger datos interactivamente
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Carnicería — Configuración de dominio       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

read -rp "  Dominio (ej: demoapp.es):          " DOMAIN
read -rp "  IP pública de la VM (ej: 20.49.3.160): " VM_IP
read -rp "  Email para Let's Encrypt (opcional): " EMAIL
read -rp "  Puerto local de la app [3000]:      " APP_PORT
APP_PORT="${APP_PORT:-3000}"

# Limpiar www. si el usuario lo incluyó
DOMAIN="${DOMAIN#www.}"
WWW_DOMAIN="www.${DOMAIN}"

echo ""
info "Dominio     : $DOMAIN  y  $WWW_DOMAIN"
info "IP de la VM : $VM_IP"
info "Puerto app  : $APP_PORT"
echo ""
read -rp "  ¿Todo correcto? (s/n): " CONFIRM
[[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]] && error "Cancelado por el usuario."

# ─────────────────────────────────────────────────────────────────────────────
# PASO 1 — Detectar gestor de paquetes
# ─────────────────────────────────────────────────────────────────────────────
step "1. Detectando sistema operativo"
if   command -v apt-get >/dev/null; then PM=apt
elif command -v dnf     >/dev/null; then PM=dnf
elif command -v yum     >/dev/null; then PM=yum
else error "Gestor de paquetes no soportado. Instala Nginx y Certbot manualmente."; fi
info "Gestor de paquetes: $PM"

# ─────────────────────────────────────────────────────────────────────────────
# PASO 2 — Instalar Nginx
# ─────────────────────────────────────────────────────────────────────────────
step "2. Instalando Nginx"
case "$PM" in
    apt) apt-get update -q && apt-get install -y nginx ;;
    dnf) dnf install -y nginx ;;
    yum) yum install -y nginx ;;
esac
systemctl enable --now nginx
info "Nginx instalado y activo."

# ─────────────────────────────────────────────────────────────────────────────
# PASO 3 — Crear configuración de Nginx (HTTP primero)
# ─────────────────────────────────────────────────────────────────────────────
step "3. Creando configuración de Nginx"

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# Incluir sites-enabled en nginx.conf si la distro no lo trae por defecto
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
    sed -i '/^http {/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
    info "Añadido 'include sites-enabled' en nginx.conf"
fi

# Desactivar el site por defecto para evitar conflictos en puerto 80
[[ -L /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default

mkdir -p /var/www/certbot

cat > "/etc/nginx/sites-available/${DOMAIN}" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    # Carpeta que usa Certbot para verificar que somos dueños del dominio
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Todo lo demás va a la app Node.js en el puerto ${APP_PORT}
    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

# Activar el site
[[ -L "/etc/nginx/sites-enabled/${DOMAIN}" ]] && rm -f "/etc/nginx/sites-enabled/${DOMAIN}"
ln -s "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"

nginx -t && systemctl reload nginx
info "Nginx configurado y recargado."

# ─────────────────────────────────────────────────────────────────────────────
# PASO 4 — Verificar que el DNS ya apunta a esta VM
# ─────────────────────────────────────────────────────────────────────────────
step "4. Verificando DNS"
RESOLVED_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' || echo "")

if [[ -z "$RESOLVED_IP" ]]; then
    warn "$DOMAIN no resuelve todavía. El DNS de GoDaddy puede tardar hasta 30 minutos en propagarse."
    warn "Certbot fallará si el DNS no apunta aún a $VM_IP. Puedes volver a ejecutar el script cuando propague."
elif [[ "$RESOLVED_IP" != "$VM_IP" ]]; then
    warn "$DOMAIN resuelve a $RESOLVED_IP, pero la IP indicada es $VM_IP"
    warn "Si acabas de cambiar el DNS en GoDaddy, espera la propagación y vuelve a correr el script."
else
    info "$DOMAIN → $VM_IP ✓  DNS correcto."
fi

# ─────────────────────────────────────────────────────────────────────────────
# PASO 5 — Instalar Certbot
# ─────────────────────────────────────────────────────────────────────────────
step "5. Instalando Certbot (Let's Encrypt)"
case "$PM" in
    apt)
        apt-get install -y snapd || true
        snap install --classic certbot 2>/dev/null || apt-get install -y certbot python3-certbot-nginx
        ;;
    dnf|yum)
        "$PM" install -y epel-release certbot python3-certbot-nginx 2>/dev/null || \
        snap install --classic certbot
        ;;
esac

# Asegurar que certbot está en el PATH
if ! command -v certbot >/dev/null; then
    [[ -f /snap/bin/certbot ]] && ln -sf /snap/bin/certbot /usr/local/bin/certbot
fi
info "Certbot: $(certbot --version 2>&1)"

# ─────────────────────────────────────────────────────────────────────────────
# PASO 6 — Obtener certificado SSL y actualizar Nginx automáticamente
# ─────────────────────────────────────────────────────────────────────────────
step "6. Obteniendo certificado SSL"

CERTBOT_ARGS="--nginx -d ${DOMAIN} -d ${WWW_DOMAIN} --redirect --agree-tos --non-interactive"
[[ -n "$EMAIL" ]] && CERTBOT_ARGS="$CERTBOT_ARGS --email $EMAIL" \
                  || CERTBOT_ARGS="$CERTBOT_ARGS --register-unsafely-without-email"

if certbot $CERTBOT_ARGS; then
    info "Certificado SSL obtenido. Nginx actualizado para HTTPS."
else
    warn "Certbot no pudo obtener el certificado."
    warn "Causas comunes:"
    warn "  1. El DNS de $DOMAIN aún no propagó a $VM_IP"
    warn "  2. El puerto 80 está bloqueado en el NSG de Azure"
    warn "  3. Ya existe un certificado: prueba 'certbot renew --dry-run'"
    warn ""
    warn "La app sigue funcionando por HTTP mientras tanto."
    warn "Cuando el DNS propague, vuelve a ejecutar este script."
fi

# ─────────────────────────────────────────────────────────────────────────────
# PASO 7 — Headers de seguridad en Nginx
# ─────────────────────────────────────────────────────────────────────────────
step "7. Añadiendo headers de seguridad"

mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/carniceria-security.conf <<'SECEOF'
# Evita que la página sea embebida en un iframe de otro dominio (clickjacking)
add_header X-Frame-Options "SAMEORIGIN" always;
# Evita que el navegador adivine el tipo de contenido (MIME sniffing)
add_header X-Content-Type-Options "nosniff" always;
# Controla qué URL se envía en el header Referer a otros sitios
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
# Fuerza HTTPS durante 1 año en el navegador del usuario (HSTS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
# Limita el tamaño del cuerpo de las peticiones a 1 MB
client_max_body_size 1m;
SECEOF

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

if grep -q "ssl_certificate" "$NGINX_CONF" && ! grep -q "carniceria-security" "$NGINX_CONF"; then
    # Inyectar el include justo después de la línea ssl_certificate del bloque HTTPS
    sed -i "/ssl_certificate /a\\    include /etc/nginx/snippets/carniceria-security.conf;" "$NGINX_CONF"
    nginx -t && systemctl reload nginx
    info "Headers de seguridad añadidos al bloque HTTPS."
else
    warn "Bloque HTTPS no encontrado (Certbot no completó o ya estaban aplicados)."
    warn "El snippet /etc/nginx/snippets/carniceria-security.conf está creado."
    warn "Vuelve a ejecutar este script cuando el DNS propague para inyectarlos."
fi

# ─────────────────────────────────────────────────────────────────────────────
# PASO 8 — Renovación automática del certificado
# ─────────────────────────────────────────────────────────────────────────────
step "8. Configurando renovación automática"

# Let's Encrypt caduca cada 90 días — renovamos automáticamente cada noche
if systemctl list-timers 2>/dev/null | grep -q certbot; then
    info "Timer de renovación de certbot ya activo (systemd)."
elif crontab -l 2>/dev/null | grep -q certbot; then
    info "Cron de renovación de certbot ya presente."
else
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
    info "Cron añadido: certbot renew cada noche a las 3:00 AM."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Resumen final
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Configuración completada                                ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  https://${DOMAIN}"
echo -e "  https://${WWW_DOMAIN}"
echo ""
echo -e "  Comandos útiles:"
echo -e "    sudo nginx -t                                    — verificar configuración"
echo -e "    sudo systemctl reload nginx                      — recargar Nginx sin cortar"
echo -e "    sudo certbot certificates                        — ver certificados activos"
echo -e "    sudo certbot renew --dry-run                     — simular renovación"
echo -e "    cat /etc/nginx/snippets/carniceria-security.conf — ver headers de seguridad"
echo ""
