-- ============================================================
-- MIGRATION: Nuevas columnas para features de panel de usuario
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Columnas nuevas en la tabla 'empresas'
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS bot_nombre TEXT DEFAULT 'Asistente Virtual';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS bot_avatar_url TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS bot_color_primario TEXT DEFAULT '#facc15';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS bot_color_secundario TEXT DEFAULT '#09090b';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS catalogo_imagen_url TEXT;

-- 2. Columna de highlights en 'conversaciones'
-- Guarda un JSON con los bullets generados por IA
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS highlights JSONB;

-- 3. Corrección de política RLS para perfiles (evitar recursión infinita)
DROP POLICY IF EXISTS "Super Admins tienen control total sobre perfiles" ON perfiles;
CREATE POLICY "Super Admins tienen control total sobre perfiles" ON perfiles
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'rol') = 'super_admin'
    );


-- 3. Crear bucket de Storage para activos de empresas (ejecutar desde Dashboard o API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('empresa-assets', 'empresa-assets', true);

-- 4. Políticas de Storage para 'empresa-assets'
-- Lectura pública de activos
DROP POLICY IF EXISTS "Activos de empresa son públicos" ON storage.objects;
CREATE POLICY "Activos de empresa son públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'empresa-assets');

-- Subida de activos (Insert)
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir activos" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden subir activos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'empresa-assets' AND auth.role() = 'authenticated');

-- Modificación de activos (Update - Requerido para upsert)
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar activos" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden actualizar activos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'empresa-assets' AND auth.role() = 'authenticated');

