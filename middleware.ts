import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Obtener el usuario autenticado de forma segura
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (perfil?.rol !== 'super_admin') {
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
