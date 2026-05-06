#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "=== Limpieza completa del proyecto Carnicería ==="
echo ""

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }


#############################################################
##### 1. Detener contenedores del proyecto (scope limitado)
#############################################################

PROJECT_DIR="/opt/carniceria-template"
LOCAL_COMPOSE="./docker-compose.yml"

if [[ -f "$PROJECT_DIR/docker-compose.yml" ]]; then
    info "Deteniendo contenedores del proyecto (${PROJECT_DIR})..."
    sudo docker compose -f "$PROJECT_DIR/docker-compose.yml" down --volumes --remove-orphans 2>/dev/null || true
elif [[ -f "$LOCAL_COMPOSE" ]]; then
    info "Deteniendo contenedores del proyecto (directorio actual)..."
    sudo docker compose -f "$LOCAL_COMPOSE" down --volumes --remove-orphans 2>/dev/null || true
else
    warn "No se encontró docker-compose.yml. Saltando parada de contenedores."
fi


#############################################################
##### 2. Borrar imágenes del proyecto
#############################################################

info "Eliminando imágenes del proyecto (carniceria-template)..."
sudo docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
    | grep -i "carniceria" \
    | awk '{print $2}' \
    | xargs -r sudo docker rmi -f 2>/dev/null || true


#############################################################
##### 3. Limpiar recursos Docker huérfanos
#############################################################

info "Eliminando contenedores parados..."
sudo docker container prune -f 2>/dev/null || true

info "Eliminando volúmenes no usados..."
sudo docker volume prune -f 2>/dev/null || true

info "Eliminando redes no usadas..."
sudo docker network prune -f 2>/dev/null || true

info "Limpiando caché de build..."
sudo docker builder prune -af 2>/dev/null || true


#############################################################
##### 4. Borrar proyecto instalado en /opt/carniceria-template
#############################################################

if [[ -d "/opt/carniceria-template" ]]; then
    info "Eliminando /opt/carniceria-template..."
    sudo rm -rf /opt/carniceria-template
fi

# Compatibilidad con instalaciones antiguas (nombre anterior)
if [[ -d "/opt/carniceria" ]]; then
    warn "Encontrada instalación antigua en /opt/carniceria — eliminando..."
    sudo rm -rf /opt/carniceria
fi


#############################################################
##### 5. Borrar .env en el directorio actual
#############################################################

if [[ -f "./.env" ]]; then
    info "Eliminando .env local..."
    rm -f ./.env
fi


#############################################################
##### 6. Borrar carpetas clonadas del proyecto en $HOME
#############################################################

for dir in \
    "$HOME/carniceria-template" \
    "$HOME/carniceria" \
    "$HOME/carniceria_arroba/carniceria-template" \
    "$HOME/carniceria_arroba/carniceria"
do
    if [[ -d "$dir" ]]; then
        info "Eliminando carpeta ${dir}..."
        rm -rf "$dir"
    fi
done


#############################################################
##### 7. Borrar restos de instalaciones anteriores en $HOME
#############################################################

info "Buscando restos de instalaciones previas en \$HOME..."
find "$HOME" -maxdepth 3 -type d -name "carniceria*" -exec rm -rf {} + 2>/dev/null || true


#############################################################
##### 8. Confirmación final
#############################################################

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Limpieza completada correctamente            ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo "Todo lo relacionado con el proyecto ha sido eliminado."
echo ""
