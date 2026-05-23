import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente de Supabase con privilegios administrativos
const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Usamos el service role key privado para mayor seguridad en producción.
  // Fallback a la clave pública anon en desarrollo local para compatibilidad.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; 
  
  if (!url || !serviceRoleKey) {
    throw new Error('Faltan variables de entorno de Supabase.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function POST(req: NextRequest) {
  try {
    const { email, password, rol, empresaId } = await req.json();

    if (!email || !password || !rol) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (email, password, rol).' }, { status: 400 });
    }

    if (rol !== 'super_admin' && rol !== 'user') {
      return NextResponse.json({ error: 'El rol provisto no es válido.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Crear el usuario en la sección de Auth de Supabase (confirmado automáticamente)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { rol }
    });

    if (createError) {
      console.error('Error en auth.admin.createUser:', createError);
      return NextResponse.json({ error: `Error de Supabase Auth: ${createError.message}` }, { status: 400 });
    }

    const newUserId = userData.user.id;

    // 2. Si se seleccionó una empresa, vincular al usuario en la tabla 'usuarios_empresa'
    // La fila en 'perfiles' es creada por el trigger postgres 'handle_new_user' sincrónicamente
    if (empresaId) {
      // Pequeña espera por si hay alguna carrera en el trigger, aunque es síncrono
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { error: linkError } = await supabaseAdmin
        .from('usuarios_empresa')
        .insert([{ user_id: newUserId, empresa_id: empresaId }]);

      if (linkError) {
        console.error('Error al vincular el usuario con la empresa:', linkError);
        return NextResponse.json({ 
          success: true, 
          userId: newUserId,
          warning: 'El usuario se creó correctamente, pero no se pudo asociar a la empresa. Asócialo manualmente en el selector de vinculaciones.',
          details: linkError.message 
        });
      }
    }

    return NextResponse.json({
      success: true,
      userId: newUserId,
      message: 'Usuario registrado exitosamente.'
    });

  } catch (error) {
    const err = error as Error;
    console.error('Error en API Route /api/admin/users:', err);
    return NextResponse.json({ error: 'Error interno del servidor.', details: err.message }, { status: 500 });
  }
}
