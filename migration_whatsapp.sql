-- ============================================================
-- MIGRATION: Columnas para la integración oficial de WhatsApp
-- Ejecutar este script en el SQL Editor de tu Dashboard de Supabase
-- ============================================================

-- Agregar columnas en la tabla 'empresas'
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS whatsapp_token TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS whatsapp_phone_id TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS whatsapp_verify_token TEXT;
