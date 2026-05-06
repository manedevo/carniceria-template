#!/usr/bin/env bash
set -e

echo ""
echo "═══════════════════════════════════════════════════════"
echo "     Carnicería — Instalador Universal (Todas las distros)"
echo "═══════════════════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[INFO] Script ubicado en: $SCRIPT_DIR"

is_valid_project() {
    [[ -d "$1/backend" ]] && \
    [[ -f "$1/backend/package.json" ]] && \
    [[ -f "$1/docker-compose.yml" ]] && \
    [[ -d "$1/public" ]]
}

if is_valid_project "$SCRIPT_DIR"; then
    PROJECT_ROOT="$SCRIPT_DIR"
    echo "[OK] Proyecto válido detectado en el directorio del script."
else
    echo "[WARN] No se detectó un proyecto válido en el directorio actual."

    INSTALL_DIR="/opt/carniceria"

    if [[ ! -d "$INSTALL_DIR" ]]; then
        echo "[INFO] Clonando proyecto en $INSTALL_DIR…"
        sudo git clone https://github.com/manedevo/carniceria "$INSTALL_DIR"
        PROJECT_ROOT="$INSTALL_DIR"
    else
        echo "[INFO] Proyecto ya existe en /opt/carniceria. Usándolo."
        PROJECT_ROOT="$INSTALL_DIR"
        sudo git -C "$PROJECT_ROOT" pull
    fi
fi

echo "[INFO] Proyecto raíz: $PROJECT_ROOT"

if ! is_valid_project "$PROJECT_ROOT"; then
    echo "[ERROR] El proyecto está incompleto o corrupto."
    exit 1
fi

echo "[OK] Estructura del proyecto validada."

ENV_FILE="$PROJECT_ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "[INFO] Generando archivo .env…"
    cat > "$ENV_FILE" <<EOF
DB_USER=carniceria
DB_PASSWORD=$(openssl rand -hex 12)
DB_ROOT_PASSWORD=$(openssl rand -hex 12)
DB_NAME=carniceria_db
APP_PORT=3000
EOF
    echo "[OK] .env creado."
else
    echo "[OK] .env ya existe."
fi

DOCKERFILE="$PROJECT_ROOT/backend/Dockerfile"

if grep -q "npm ci" "$DOCKERFILE"; then
    echo "[WARN] Dockerfile usa 'npm ci'. Corrigiendo…"
    sed -i 's/npm ci --only=production/npm install --omit=dev/' "$DOCKERFILE"
    echo "[OK] Dockerfile corregido."
else
    echo "[OK] Dockerfile ya está correcto."
fi

detect_pkg_manager() {
    if command -v apt >/dev/null 2>&1; then echo "apt"
    elif command -v dnf >/dev/null 2>&1; then echo "dnf"
    elif command -v pacman >/dev/null 2>&1; then echo "pacman"
    elif command -v zypper >/dev/null 2>&1; then echo "zypper"
    else echo "unknown"
    fi
}

PKG_MANAGER=$(detect_pkg_manager)
echo "[INFO] Gestor de paquetes detectado: $PKG_MANAGER"

if ! command -v docker >/dev/null 2>&1; then
    echo "[INFO] Docker no encontrado. Instalando…"

    case "$PKG_MANAGER" in
        apt)
            sudo apt update
            sudo apt install -y docker.io docker-compose-plugin
            ;;
        dnf)
            sudo dnf install -y docker docker-compose
            ;;
        pacman)
            sudo pacman -Sy --noconfirm docker docker-compose
            ;;
        zypper)
            sudo zypper install -y docker docker-compose
            ;;
        *)
            echo "[ERROR] No se puede instalar Docker automáticamente en esta distro."
            exit 1
            ;;
    esac
fi

echo "[OK] Docker disponible."

cd "$PROJECT_ROOT"
sudo docker compose build --no-cache
sudo docker compose up -d

echo ""
echo "═══════════════════════════════════════════════════════"
echo "   ✔ Instalación completada"
echo "   ✔ Contenedores levantados"
echo "   ✔ App disponible en: http://localhost:3000"
echo "═══════════════════════════════════════════════════════"
echo ""
