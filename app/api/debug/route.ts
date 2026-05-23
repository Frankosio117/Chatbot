import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  let role = 'unknown';
  try {
    if (key) {
      const payloadPart = key.split('.')[1];
      if (payloadPart) {
        const payload = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
        role = payload.role || 'unknown';
      }
    }
  } catch (err) {
    role = 'error-decoding';
  }

  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not-set',
    supabaseKeyRole: role
  });
}
