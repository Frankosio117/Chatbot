-- 1. ARQUITECTURA DE LA BASE DE DATOS (Esquema PostgreSQL para Supabase)
-- Este script define las tablas, claves foráneas, restricciones y políticas RLS para el micro-SaaS.

-- Habilitar la extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla: empresas
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    logo_url TEXT,
    informacion_negocio TEXT DEFAULT '',
    instrucciones_bot TEXT DEFAULT 'Eres un asistente servicial.',
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: perfiles (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('super_admin', 'user')),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: usuarios_empresa (vincula usuarios con sus empresas - multi-tenant)
CREATE TABLE IF NOT EXISTS usuarios_empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    UNIQUE(user_id, empresa_id)
);

-- Tabla: conversaciones (sesiones de chat de clientes finales)
CREATE TABLE IF NOT EXISTS conversaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_nombre TEXT,
    cliente_whatsapp TEXT,
    fecha_inicio TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: mensajes (mensajes individuales de las conversaciones)
CREATE TABLE IF NOT EXISTS mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('user', 'assistant')),
    contenido TEXT NOT NULL,
    fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: configuracion_global_llm (ajustes globales para la IA controlados por Super Admin)
CREATE TABLE IF NOT EXISTS configuracion_global_llm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor TEXT NOT NULL CHECK (proveedor IN ('openai', 'anthropic', 'deepseek', 'google')),
    modelo_nombre TEXT NOT NULL,
    api_key_encriptada TEXT NOT NULL,
    temperatura FLOAT NOT NULL DEFAULT 0.3 CHECK (temperatura >= 0.0 AND temperatura <= 2.0),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- ----------------------------------------------------
-- POLÍTICAS DE SEGURIDAD RLS (Row Level Security)
-- ----------------------------------------------------

-- Habilitar RLS en todas las tablas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_global_llm ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para 'perfiles'
CREATE POLICY "Permitir lectura de perfiles propios" ON perfiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Super Admins tienen control total sobre perfiles" ON perfiles
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'rol') = 'super_admin'
    );

-- 2. Políticas para 'empresas'
CREATE POLICY "Permitir lectura de empresas vinculadas al usuario" ON empresas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios_empresa
            WHERE usuarios_empresa.user_id = auth.uid() AND usuarios_empresa.empresa_id = empresas.id
        )
    );

CREATE POLICY "Permitir actualización de empresas vinculadas al usuario" ON empresas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios_empresa
            WHERE usuarios_empresa.user_id = auth.uid() AND usuarios_empresa.empresa_id = empresas.id
        )
    );

CREATE POLICY "Super Admins tienen control total sobre empresas" ON empresas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'super_admin'
        )
    );

-- 3. Políticas para 'usuarios_empresa'
CREATE POLICY "Permitir lectura de vinculaciones propias" ON usuarios_empresa
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super Admins tienen control total sobre usuarios_empresa" ON usuarios_empresa
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'super_admin'
        )
    );

-- 4. Políticas para 'conversaciones'
-- El chatbot (cliente anónimo) debe poder insertar conversaciones
CREATE POLICY "Permitir inserción pública de conversaciones" ON conversaciones
    FOR INSERT WITH CHECK (true);

-- Permitir leer conversaciones si el usuario pertenece a la empresa de la conversación
CREATE POLICY "Permitir lectura de conversaciones de la empresa vinculada" ON conversaciones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios_empresa
            WHERE usuarios_empresa.user_id = auth.uid() AND usuarios_empresa.empresa_id = conversaciones.empresa_id
        )
    );

CREATE POLICY "Permitir actualización de conversaciones por el cliente o la empresa" ON conversaciones
    FOR UPDATE USING (
        true -- Permite que el bot actualice nombre/whatsapp y que el panel administrativo lo lea/gestione
    );

CREATE POLICY "Super Admins tienen control total sobre conversaciones" ON conversaciones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'super_admin'
        )
    );

-- 5. Políticas para 'mensajes'
-- El chatbot debe poder insertar mensajes y leerlos
CREATE POLICY "Permitir inserción pública de mensajes" ON mensajes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir lectura de mensajes pública (por conversación)" ON mensajes
    FOR SELECT USING (true); -- El widget de chat necesita leer sus propios mensajes sin autenticación de usuario

CREATE POLICY "Super Admins tienen control total sobre mensajes" ON mensajes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'super_admin'
        )
    );

-- 6. Políticas para 'configuracion_global_llm'
-- Solo Super Admins pueden ver y modificar las API keys y configuraciones
CREATE POLICY "Super Admins tienen control total sobre configuraciones LLM" ON configuracion_global_llm
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'super_admin'
        )
    );

-- Permitir lectura parcial o interna (puede ser usada por funciones backend con bypass RLS)

-- ----------------------------------------------------
-- TRIGGERS Y FUNCIONES AUXILIARES
-- ----------------------------------------------------

-- Crear perfil de usuario automáticamente al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfiles (id, email, rol)
    VALUES (
        new.id,
        new.email,
        COALESCE((new.raw_user_meta_data->>'rol'), 'user') -- Por defecto es 'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
