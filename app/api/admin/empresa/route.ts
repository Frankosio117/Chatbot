import { NextRequest, NextResponse } from 'next/server';
import { updateEmpresa } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const { empresaId, updates } = await req.json();

    if (!empresaId || !updates) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (empresaId, updates).' }, { status: 400 });
    }

    const finalUpdates = { ...updates };

    // Encriptar el whatsapp_token en el servidor si es nuevo
    if (finalUpdates.whatsapp_token && finalUpdates.whatsapp_token.trim() !== '' && finalUpdates.whatsapp_token !== '••••••••••••••••') {
      finalUpdates.whatsapp_token = encrypt(finalUpdates.whatsapp_token.trim());
      console.log(`[API Route /api/admin/empresa] Encriptando WhatsApp token en el servidor.`);
    } else if (finalUpdates.whatsapp_token === '••••••••••••••••') {
      // Si es el placeholder, no se modifica
      delete finalUpdates.whatsapp_token;
    } else if (finalUpdates.whatsapp_token === '') {
      finalUpdates.whatsapp_token = null;
    }

    const updated = await updateEmpresa(empresaId, finalUpdates);

    if (!updated) {
      return NextResponse.json({ error: 'No se pudo actualizar la empresa.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error en API Route /api/admin/empresa:', error);
    return NextResponse.json({ error: 'Error interno del servidor.', details: error.message }, { status: 500 });
  }
}
