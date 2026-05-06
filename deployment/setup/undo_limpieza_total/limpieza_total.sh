#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "=== Carniceria Artesanal — Full Cleanup ==="
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
    info "Stopping project containers (${PROJECT_DIR})..."
    sudo docker compose -f "$PROJECT_DIR/docker-compose.yml" down --volumes --remove-orphans 2>/dev/null || true
elif [[ -f "$LOCAL_COMPOSE" ]]; then
    info "Stopping project containers (current directory)..."
    sudo docker compose -f "$LOCAL_COMPOSE" down --volumes --remove-orphans 2>/dev/null || true
else
    warn "docker-compose.yml not found. Skipping container shutdown."
fi


#############################################################
##### 2. Remove project images
#############################################################

info "Removing project images (carniceria-template)..."
sudo docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
    | grep -i "carniceria" \
    | awk '{print $2}' \
    | xargs -r sudo docker rmi -f 2>/dev/null || true


#############################################################
##### 3. Prune orphaned Docker resources
#############################################################

info "Removing stopped containers..."
sudo docker container prune -f 2>/dev/null || true

info "Removing unused volumes..."
sudo docker volume prune -f 2>/dev/null || true

info "Removing unused networks..."
sudo docker network prune -f 2>/dev/null || true

info "Clearing build cache..."
sudo docker builder prune -af 2>/dev/null || true


#############################################################
##### 4. Remove installed project at /opt/carniceria-template
#############################################################

if [[ -d "/opt/carniceria-template" ]]; then
    info "Removing /opt/carniceria-template..."
    sudo rm -rf /opt/carniceria-template
fi

# Backwards compatibility with old install path
if [[ -d "/opt/carniceria" ]]; then
    warn "Found old installation at /opt/carniceria — removing..."
    sudo rm -rf /opt/carniceria
fi


#############################################################
##### 5. Remove local .env file
#############################################################

if [[ -f "./.env" ]]; then
    info "Removing local .env..."
    rm -f ./.env
fi


#############################################################
##### 6. Remove cloned project folders in $HOME
#############################################################

for dir in \
    "$HOME/carniceria-template" \
    "$HOME/carniceria" \
    "$HOME/carniceria_arroba/carniceria-template" \
    "$HOME/carniceria_arroba/carniceria"
do
    if [[ -d "$dir" ]]; then
        info "Removing folder ${dir}..."
        rm -rf "$dir"
    fi
done


#############################################################
##### 7. Remove leftover installation folders in $HOME
#############################################################

info "Searching for leftover installation folders in \$HOME..."
find "$HOME" -maxdepth 3 -type d -name "carniceria*" -exec rm -rf {} + 2>/dev/null || true


#############################################################
##### 8. Done
#############################################################

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Cleanup complete                             ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo "Everything related to the project has been removed."
echo ""
