-- Migración 001 — Índices de rendimiento
-- Fecha: 2026-06-30
-- Aplicar en instalaciones existentes que ya tienen el schema creado.
--
-- Cómo ejecutar (Docker):
--   docker compose exec db mariadb -u carniceria -p"$DB_PASSWORD" carniceria_db < backend/database/migrations/001_add_indexes.sql
--
-- Cómo ejecutar (PM2 / bare metal):
--   mariadb -u carniceria -p carniceria_db < backend/database/migrations/001_add_indexes.sql
--
-- IF NOT EXISTS hace que sea seguro re-ejecutar sin errores.
-- Nota: orders.user_id ya tiene índice implícito por la FK — no se duplica.

USE carniceria_db;

CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_promos_active     ON promotions(active, starts_at, ends_at);
