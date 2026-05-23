import { NextRequest, NextResponse } from 'next/server';
import { updateGlobalLLMConfig, getGlobalLLMConfig, ConfigLLM } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const { proveedor, modelo_nombre, temperatura, api_key } = await req.json();

    if (!proveedor || !modelo_nombre || temperatura === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (proveedor, modelo_nombre, temperatura).' }, { status: 400 });
    }

    const updates: Partial<Omit<ConfigLLM, 'id'>> = {
      proveedor,
      modelo_nombre,
      temperatura: Number(temperatura),
    };

    // Si se envió una nueva API Key, se encripta en el servidor con process.env.ENCRYPTION_KEY
    if (api_key && api_key.trim() !== '') {
      updates.api_key_encriptada = encrypt(api_key.trim());
      console.log(`[API Route /api/admin/llm] Encrypting API Key on the server (length: ${api_key.trim().length})`);
    }

    const updatedConfig = await updateGlobalLLMConfig(updates);

    return NextResponse.json({
      success: true,
      message: 'Configuración de LLM actualizada correctamente.',
      config: {
        proveedor: updatedConfig.proveedor,
        modelo_nombre: updatedConfig.modelo_nombre,
        activo: updatedConfig.activo,
      }
    });

  } catch (error: any) {
    console.error('Error en API Route /api/admin/llm:', error);
    return NextResponse.json({ error: 'Error interno del servidor.', details: error.message }, { status: 500 });
  }
}
