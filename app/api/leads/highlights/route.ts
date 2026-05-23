import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { decrypt } from '@/lib/crypto';

interface HighlightItem {
  tipo: string;
  texto: string;
}

// Heurísticas locales para generar highlights en caso de falla de la API de IA o cuotas excedidas
function generarHighlightsSimulados(mensajes: { rol: string; contenido: string }[]): HighlightItem[] {
  const highlights: HighlightItem[] = [];
  
  const clientTexts = mensajes
    .filter(m => m.rol === 'user')
    .map(m => m.contenido.toLowerCase())
    .join(' ');
  
  const botTexts = mensajes
    .filter(m => m.rol === 'assistant')
    .map(m => m.contenido.toLowerCase())
    .join(' ');

  // 1. Cotizaciones y precios
  if (clientTexts.includes('precio') || clientTexts.includes('costo') || clientTexts.includes('cuanto') || clientTexts.includes('valor') || clientTexts.includes('tarifa') || clientTexts.includes('cuesta')) {
    highlights.push({
      tipo: 'cotizacion',
      texto: 'Consultó precios o tarifas de los servicios'
    });
  }

  // 2. Interés específico en productos/servicios
  if (clientTexts.includes('masaje') || clientTexts.includes('facial') || clientTexts.includes('termas') || clientTexts.includes('jacuzzi')) {
    highlights.push({
      tipo: 'producto',
      texto: 'Interés específico en masajes o servicios de spa'
    });
  } else if (clientTexts.includes('taco') || clientTexts.includes('pastor') || clientTexts.includes('bistec') || clientTexts.includes('gringa') || clientTexts.includes('menú') || clientTexts.includes('carta')) {
    highlights.push({
      tipo: 'producto',
      texto: 'Preguntó por el menú de tacos y especialidades'
    });
  } else if (clientTexts.includes('producto') || clientTexts.includes('servicio')) {
    highlights.push({
      tipo: 'producto',
      texto: 'Solicitó información de catálogo o servicios'
    });
  }

  // 3. Reservas, citas o pedidos
  if (clientTexts.includes('reserva') || clientTexts.includes('cita') || clientTexts.includes('agendar') || clientTexts.includes('turno') || clientTexts.includes('pedido') || clientTexts.includes('comprar')) {
    highlights.push({
      tipo: 'reserva',
      texto: 'Inició proceso de reserva o pedido'
    });
  }

  // 4. Datos de contacto
  const phoneRegex = /\d{8,15}/;
  if (phoneRegex.test(clientTexts) || botTexts.includes('guardado') || botTexts.includes('registrado') || botTexts.includes('gracias por tu whatsapp')) {
    highlights.push({
      tipo: 'interes',
      texto: 'Proporcionó su Nombre y WhatsApp de contacto'
    });
  }

  // 5. Quejas o reclamos
  if (clientTexts.includes('queja') || clientTexts.includes('problema') || clientTexts.includes('error') || clientTexts.includes('mal') || clientTexts.includes('tarde')) {
    highlights.push({
      tipo: 'queja',
      texto: 'Reportó un inconveniente o inconformidad'
    });
  }

  // Valores predeterminados si no se detectó nada
  if (highlights.length === 0) {
    highlights.push({
      tipo: 'consulta',
      texto: 'Realizó preguntas generales de información'
    });
    highlights.push({
      tipo: 'interes',
      texto: 'Mostró disposición a interactuar con el bot'
    });
  }

  return highlights.slice(0, 8);
}

export async function POST(req: NextRequest) {
  try {
    const { conversacionId } = await req.json();
    if (!conversacionId) {
      return NextResponse.json({ error: 'conversacionId requerido' }, { status: 400 });
    }

    // Use private service role to bypass RLS in production, fallback to public anon key for local compatibility
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get conversation
    const { data: conv, error: convError } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('id', conversacionId)
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    // Get messages
    const { data: mensajes } = await supabase
      .from('mensajes')
      .select('rol, contenido')
      .eq('conversacion_id', conversacionId)
      .order('fecha', { ascending: true });

    if (!mensajes || mensajes.length === 0) {
      return NextResponse.json({ highlights: [] });
    }

    const currentMsgCount = mensajes.length;

    // Check if the current highlights are up-to-date with the message count
    if (conv.highlights && typeof conv.highlights === 'object' && !Array.isArray(conv.highlights)) {
      const hObj = conv.highlights as any;
      if (hObj.last_analyzed_count === currentMsgCount && Array.isArray(hObj.items)) {
        return NextResponse.json({ highlights: hObj.items });
      }
    }

    // Get LLM config
    const { data: llmConfig } = await supabase
      .from('configuracion_global_llm')
      .select('*')
      .eq('activo', true)
      .limit(1)
      .single();

    if (!llmConfig) {
      const fallbackHighlights = generarHighlightsSimulados(mensajes);
      const highlightsPayload = {
        last_analyzed_count: currentMsgCount,
        items: fallbackHighlights
      };
      await supabase
        .from('conversaciones')
        .update({ highlights: highlightsPayload })
        .eq('id', conversacionId);
      return NextResponse.json({ highlights: fallbackHighlights });
    }

    const apiKey = await decrypt(llmConfig.api_key_encriptada);
    const esApiKeySimulada = !apiKey || apiKey.includes('mockapi-key') || apiKey === '';

    if (esApiKeySimulada) {
      const fallbackHighlights = generarHighlightsSimulados(mensajes);
      const highlightsPayload = {
        last_analyzed_count: currentMsgCount,
        items: fallbackHighlights
      };
      await supabase
        .from('conversaciones')
        .update({ highlights: highlightsPayload })
        .eq('id', conversacionId);
      return NextResponse.json({ highlights: fallbackHighlights });
    }

    let highlights: HighlightItem[] = [];

    try {
      // Build conversation transcript
      const transcript = mensajes
        .map((m: { rol: string; contenido: string }) => `${m.rol === 'user' ? 'Cliente' : 'Bot'}: ${m.contenido}`)
        .join('\n');

      // Initialize provider dynamically
      let aiProvider;
      if (llmConfig.proveedor === 'openai') {
        aiProvider = createOpenAI({ apiKey });
      } else if (llmConfig.proveedor === 'anthropic') {
        aiProvider = createAnthropic({ apiKey });
      } else if (llmConfig.proveedor === 'google') {
        aiProvider = createGoogleGenerativeAI({ apiKey });
      } else {
        aiProvider = createOpenAI({ apiKey });
      }

      const defaultModel = llmConfig.proveedor === 'google' ? 'gemini-1.5-flash' : 'gpt-4o-mini';
      const modelInstance = aiProvider(llmConfig.modelo_nombre || defaultModel);

      // Call LLM to generate highlights (up to 8)
      const { text } = await generateText({
        model: modelInstance,
        prompt: `Analiza esta conversación de chatbot de negocio y genera hasta 8 highlights clave en formato JSON (mínimo 3, máximo 8).

CONVERSACIÓN:
${transcript}

Responde ÚNICAMENTE con un array JSON válido. Cada elemento debe tener:
- "tipo": una de estas categorías: "cotizacion", "producto", "reserva", "queja", "consulta", "interes", "otro"
- "texto": descripción breve del aspecto destacado (máx 80 chars)

Ejemplo:
[
  {"tipo": "cotizacion", "texto": "Solicitó cotización para masaje de 60 min"},
  {"tipo": "producto", "texto": "Preguntó por tratamiento facial hidratante"},
  {"tipo": "interes", "texto": "Mostró interés en paquetes de pareja"}
]

Array JSON:`,
      });

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        highlights = JSON.parse(jsonMatch[0]) as HighlightItem[];
      } else {
        throw new Error('Formato JSON no encontrado en la respuesta del modelo.');
      }
    } catch (err) {
      console.warn('Fallo en la generación de highlights por IA. Usando fallback heurístico local. Detalle:', err);
      highlights = generarHighlightsSimulados(mensajes);
    }

    // Save highlights to DB in structured format (max 8 items)
    const finalHighlights = highlights.slice(0, 8);
    const highlightsPayload = {
      last_analyzed_count: currentMsgCount,
      items: finalHighlights
    };

    await supabase
      .from('conversaciones')
      .update({ highlights: highlightsPayload })
      .eq('id', conversacionId);

    return NextResponse.json({ highlights: finalHighlights });
  } catch (error) {
    const err = error as Error;
    console.error('Error general en endpoint de highlights:', err);
    return NextResponse.json(
      { error: err.message || 'Error al procesar los highlights' },
      { status: 500 }
    );
  }
}
