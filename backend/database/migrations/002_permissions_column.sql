-- Migración 002: columna permissions para permisos granulares de ventas
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT NULL
  AFTER active;
