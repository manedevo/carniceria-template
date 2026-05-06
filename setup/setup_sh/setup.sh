#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "=== Instalador Carnicería (Modo Inteligente) ==="
echo ""

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

#############################################################
##### 1. Detectar dónde está el script
#############################################################

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
info "Script en: $SCRIPT_DIR"


#############################################################
##### 2. Función para comprobar si estamos dentro del proyecto
#############################################################

is_project() {
    [[ -d "$1/backend" ]] && \
    [[ -f "$1/docker-compose.yml" ]] && \
    [[ -d "$1/public" ]]
}


#############################################################
##### 3. Decidir si usar el proyecto local o /opt/carniceria-template
#############################################################

if is_project "$SCRIPT_DIR"; then
    PROJECT_ROOT="$SCRIPT_DIR"
    info "Proyecto encontrado en el directorio actual."
else
    warn "No parece haber un proyecto aquí."

    INSTALL_DIR="/opt/carniceria-template"

    if [[ ! -d "$INSTALL_DIR" ]]; then
        info "Clonando proyecto en $INSTALL_DIR..."
        sudo git clone https://github.com/manedevo/carniceria-template "$INSTALL_DIR"
    else
        info "Proyecto ya existe en $INSTALL_DIR, actualizando..."
        sudo git -C "$INSTALL_DIR" stash --include-untracked || true
        sudo git -C "$INSTALL_DIR" fetch origin
        sudo git -C "$INSTALL_DIR" reset --hard origin/master
        sudo git -C "$INSTALL_DIR" stash pop 2>/dev/null || true
    fi

    PROJECT_ROOT="$INSTALL_DIR"
fi

info "Proyecto raíz: $PROJECT_ROOT"


#############################################################
##### 4. Validar estructura del proyecto
#############################################################

if ! is_project "$PROJECT_ROOT"; then
    error "El proyecto está incompleto. Revisa la carpeta."
fi


#############################################################
##### 5. Crear archivo .env si no existe
#############################################################

ENV_FILE="$PROJECT_ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    info "Creando .env..."
    db_pass=$(openssl rand -hex 24)
    db_root_pass=$(openssl rand -hex 24)
    cat > "$ENV_FILE" <<EOF
# Auto-generado por setup.sh el $(date -u +"%Y-%m-%d %H:%M UTC")
DB_HOST=db
DB_PORT=3306
DB_USER=carniceria
DB_PASSWORD=${db_pass}
DB_ROOT_PASSWORD=${db_root_pass}
DB_NAME=carniceria_db
PORT=3000
NODE_ENV=production
EOF
    chmod 600 "$ENV_FILE"
    info ".env creado (contraseñas generadas automáticamente)."
else
    warn ".env ya existe — se omite la generación. Edítalo manualmente si es necesario."
fi


#############################################################
##### 6. Corregir Dockerfile si usa npm ci
#############################################################

DOCKERFILE="$PROJECT_ROOT/backend/Dockerfile"

if grep -q "npm ci" "$DOCKERFILE"; then
    info "Corrigiendo Dockerfile (npm ci → npm install --omit=dev)..."
    sed -i 's/npm ci --only=production/npm install --omit=dev/' "$DOCKERFILE"
fi


#############################################################
##### 7. Detectar gestor de paquetes de la distro
#############################################################

if command -v apt-get >/dev/null; then
    PM=apt
elif command -v dnf >/dev/null; then
    PM=dnf
elif command -v yum >/dev/null; then
    PM=yum
elif command -v pacman >/dev/null; then
    PM=pacman
elif command -v zypper >/dev/null; then
    PM=zypper
else
    PM=unknown
fi

info "Gestor de paquetes detectado: $PM"


#############################################################
##### 8. Instalar dependencias base
#############################################################

info "Actualizando listas de paquetes e instalando dependencias base..."
case "$PM" in
    apt)    sudo apt-get update -q && sudo apt-get install -y git curl openssl ;;
    dnf)    sudo dnf check-update -q || true && sudo dnf install -y git curl openssl ;;
    yum)    sudo yum check-update -q || true && sudo yum install -y git curl openssl ;;
    pacman) sudo pacman -Sy --noconfirm git curl openssl ;;
    zypper) sudo zypper install -y git curl openssl ;;
    *)      warn "No se pudieron instalar dependencias base automáticamente." ;;
esac


#############################################################
##### 9. Instalar Docker si no está instalado
#############################################################

if ! command -v docker >/dev/null; then
    info "Docker no encontrado. Instalando..."

    case "$PM" in
        apt)
            sudo apt-get install -y ca-certificates gnupg lsb-release
            sudo install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
                | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            sudo chmod a+r /etc/apt/keyrings/docker.gpg
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
                https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
                | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update -q
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        dnf|yum)
            sudo "$PM" install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo "$PM" install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            sudo systemctl enable --now docker
            ;;
        pacman)
            sudo pacman -Sy --noconfirm docker docker-compose
            sudo systemctl enable --now docker
            ;;
        zypper)
            sudo zypper install -y docker docker-compose
            sudo systemctl enable --now docker
            ;;
        *)
            error "No sé instalar Docker automáticamente en esta distro."
            ;;
    esac
fi

info "Docker listo: $(docker --version)"

# Añadir usuario al grupo docker si se ejecuta con sudo
if [[ -n "${SUDO_USER:-}" ]] && ! groups "${SUDO_USER}" | grep -q docker; then
    sudo usermod -aG docker "${SUDO_USER}"
    warn "Usuario '${SUDO_USER}' añadido al grupo docker. Cierra sesión y vuelve a entrar (o ejecuta: newgrp docker)."
fi


#############################################################
##### 10. Construir y levantar contenedores
#############################################################

cd "$PROJECT_ROOT"

info "Descargando imágenes base..."
sudo docker compose pull --quiet || true

info "Construyendo y levantando contenedores..."
sudo docker compose up -d --build

info "Esperando health checks..."
retries=30
while [[ $retries -gt 0 ]]; do
    status=$(sudo docker compose ps --format json 2>/dev/null \
        | grep -o '"Health":"[^"]*"' | grep -v '"Health":""' | head -1 || echo "")
    [[ "${status}" == *"healthy"* ]] && break
    sleep 3; ((retries--))
done

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Carnicería Artesanal — instalación completa  ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  App:  http://$(hostname -I | awk '{print $1}'):3000"
echo -e "  Logs: sudo docker compose -C ${PROJECT_ROOT} logs -f"
echo ""
