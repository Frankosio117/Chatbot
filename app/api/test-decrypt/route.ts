import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' });
    }

    const { data: c, error: err } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', '385b19ae-0c08-4760-8c53-4a733d058550') // Plasmarq
      .single();

    if (err || !c) {
      return NextResponse.json({ error: 'Company not found', details: err?.message });
    }

    let decrypted = '';
    let decryptionSuccess = false;
    let decryptionError = '';

    try {
      decrypted = decrypt(c.whatsapp_token || '');
      if (decrypted === c.whatsapp_token) {
        decryptionSuccess = false;
        decryptionError = 'Decryption returned raw encrypted text (failed)';
      } else {
        decryptionSuccess = true;
      }
    } catch (e: any) {
      decryptionSuccess = false;
      decryptionError = e.message;
    }

    let metaResponseStatus = null;
    let metaResponseBody = null;
    let metaFetchError = null;

    if (decryptionSuccess && decrypted) {
      const phoneId = c.whatsapp_phone_id;
      const toPhone = '529613008003'; // Use the normalized user's phone number without the mobile prefix '1'
      const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'text',
        text: { body: 'Mensaje de diagnóstico desde el endpoint test-decrypt' }
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decrypted}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        metaResponseStatus = res.status;
        metaResponseBody = await res.json();
      } catch (e: any) {
        metaFetchError = e.message;
      }
    }

    return NextResponse.json({
      companyName: c.nombre,
      hasToken: !!c.whatsapp_token,
      decryptionSuccess,
      decryptionError,
      decryptedLength: decrypted ? decrypted.length : 0,
      decryptedStart: decrypted ? decrypted.substring(0, 15) : null,
      metaResponseStatus,
      metaResponseBody,
      metaFetchError,
      envKeyExists: !!process.env.ENCRYPTION_KEY,
      envKeyFallbackUsed: !process.env.ENCRYPTION_KEY
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Outer error', message: error.message });
  }
}
