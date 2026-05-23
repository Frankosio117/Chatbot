import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/login', req.url));
  return response;
}
