import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return supabaseResponse;
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            try {
              return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
            } catch (err) {
              console.error('Middleware: Error in cookies.getAll:', err);
              return [];
            }
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value }) => {
                try {
                  request.cookies.set(name, value);
                } catch (err) {
                  // request.cookies.set no es soportado en algunas versiones de Next.js
                }
              });
              supabaseResponse = NextResponse.next({
                request,
              });
              cookiesToSet.forEach(({ name, value, options }) => {
                try {
                  supabaseResponse.cookies.set(name, value, options);
                } catch (err) {
                  console.error('Middleware: Error setting cookie on response:', err);
                }
              });
            } catch (err) {
              console.error('Middleware: Error in cookies.setAll:', err);
            }
          },
        },
      }
    );

    // Obtener el usuario autenticado de forma segura
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('Middleware: Error al obtener usuario:', userError.message);
    }

    const pathname = request.nextUrl.pathname;

    // 1. Proteger rutas del Dashboard y Super Admin
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/super-admin')) {
      if (!user) {
        // No hay sesión activa, redirigir al login
        const url = new URL('/login', request.url);
        return NextResponse.redirect(url);
      }

      // Si intenta entrar a /super-admin, verificar que su rol sea super_admin
      if (pathname.startsWith('/super-admin')) {
        const { data: perfil, error: perfilError } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .single();

        if (perfilError || perfil?.rol !== 'super_admin') {
          console.warn('Middleware: Acceso denegado a super-admin:', perfilError?.message);
          // No es super_admin, redirigir al dashboard de usuario
          const url = new URL('/dashboard/settings', request.url);
          return NextResponse.redirect(url);
        }
      }
    }

    // 2. Redirección si ya está autenticado e intenta ir a /login
    if (pathname === '/login' && user) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (perfil?.rol === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/dashboard/settings', request.url));
      }
    }
  } catch (err) {
    console.error('Middleware: Error crítico no controlado:', err);
    // En caso de fallo total, forzar redirección a login en rutas protegidas por seguridad
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/super-admin')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - embed (public chat embeds)
     * - api/chat (public chatbot API)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|embed|api/chat|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
