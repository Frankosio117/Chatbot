import { NextRequest, NextResponse } from 'next/server';
import { getEmpresa, getGlobalLLMConfig, insertMensaje, getMensajes } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const maxDuration = 30;

// 1. GET: VERIFICACIÓN DEL WEBHOOK CON META DEVELOPERS
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Token de verificación global. Puede ser configurado como env o usar un fallback
  const GLOBAL_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'chatbot_whatsapp_verify_token';

  if (mode && token) {
    if (mode === 'subscribe') {
      // Caso 1: Coincide con el token de verificación global
      if (token === GLOBAL_VERIFY_TOKEN) {
        console.log('[WhatsApp Webhook] Verificado con éxito (token global).');
        return new Response(challenge, { status: 200 });
      }

      // Caso 2: Buscar en la base de datos si alguna empresa tiene este verify token
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('empresas')
            .select('id')
            .eq('whatsapp_verify_token', token)
            .limit(1);

          if (!error && data && data.length > 0) {
            console.log('[WhatsApp Webhook] Verificado con éxito (token de empresa).');
            return new Response(challenge, { status: 200 });
          } else if (error) {
            console.error('[WhatsApp Webhook] Error querying verify token:', error);
          }
        }
      } catch (err: any) {
        console.error('[WhatsApp Webhook] Error al validar verify_token en base de datos:', err.message);
      }
    }
  }
  
  console.warn('[WhatsApp Webhook] Intento de verificación fallido.');
  return new Response('No autorizado', { status: 403 });
}

// 2. POST: RECEPCIÓN Y RESPUESTA DE MENSAJES DE WHATSAPP
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validar estructura de payload de Meta Cloud API
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    // Ignorar si no es un mensaje (ej. notificaciones de estatus entregado/leído)
    if (!message) {
      return NextResponse.json({ status: 'ignored' });
    }

    const phoneId = value?.metadata?.phone_number_id; // ID del número que recibe
    const clientPhone = message?.from; // Número del cliente
    const messageText = message?.text?.body || ''; // Contenido de texto
    const profileName = value?.contacts?.[0]?.profile?.name || 'Cliente de WhatsApp';

    if (!phoneId || !clientPhone || !messageText) {
      return NextResponse.json({ status: 'missing_data' });
    }

    console.log(`[WhatsApp Webhook] Mensaje recibido de ${clientPhone} para phoneId ${phoneId}: "${messageText}"`);

    // 1. Buscar a la empresa por su whatsapp_phone_id
    if (!supabase) {
      throw new Error('Supabase no está configurado');
    }

    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('*')
      .eq('whatsapp_phone_id', phoneId)
      .maybeSingle();

    if (empErr || !empresa) {
      console.error(`[WhatsApp Webhook] Empresa no encontrada para whatsapp_phone_id: ${phoneId}`, empErr);
      return NextResponse.json({ error: 'Empresa no configurada para este número' }, { status: 200 }); 
      // Respondemos 200 para que Meta no reintente el webhook con errores indefinidamente
    }

    // 2. Buscar o crear la conversación para este cliente
    let { data: conversacion, error: convErr } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('cliente_whatsapp', clientPhone)
      .maybeSingle();

    if (convErr || !conversacion) {
      const { data: newConv, error: createErr } = await supabase
        .from('conversaciones')
        .insert([{
          empresa_id: empresa.id,
          cliente_nombre: profileName,
          cliente_whatsapp: clientPhone
        }])
        .select()
        .single();
      
      if (createErr) throw createErr;
      conversacion = newConv;
    } else if (!conversacion.cliente_nombre || conversacion.cliente_nombre === 'Cliente de WhatsApp') {
      // Actualizar el nombre si no estaba registrado o era el por defecto
      const { data: updatedConv } = await supabase
        .from('conversaciones')
        .update({ cliente_nombre: profileName })
        .eq('id', conversacion.id)
        .select()
        .single();
      if (updatedConv) conversacion = updatedConv;
    }

    // 3. Guardar el mensaje entrante del usuario en la base de datos
    await insertMensaje(conversacion.id, 'user', messageText);

    // 4. Obtener todo el historial de la conversación ordenado por fecha
    const mensajesHistorial = await getMensajes(conversacion.id);

    // 5. Cargar configuración de IA y API Keys
    const llmConfig = await getGlobalLLMConfig();
    const apiKey = decrypt(llmConfig.api_key_encriptada);
    const esApiKeySimulada = !apiKey || apiKey.includes('mockapi-key') || apiKey === '';

    let respuestaTexto = '';

    // 6. Preparar el System Prompt con las directivas de catálogo/menú
    const systemPrompt = `
Eres un Agente de IA Conversacional experto y profesional.
Tu objetivo es atender a los clientes del negocio local "${empresa.nombre}".

PERSONALIDAD E INSTRUCCIONES DE COMPORTAMIENTO:
${empresa.instrucciones_bot || 'Eres un asistente servicial.'}

INFORMACIÓN EXPLÍCITA DEL NEGOCIO (Tu único contexto y base de conocimiento):
=== INICIO DE INFORMACIÓN DEL NEGOCIO ===
${empresa.informacion_negocio || 'No hay información provista para este negocio.'}
=== FIN DE INFORMACIÓN DEL NEGOCIO ===
${empresa.catalogo_imagen_url ? `
MENÚ Y CATÁLOGO DE PRODUCTOS:
- La empresa cuenta con una imagen de su menú, catálogo o lista de productos en la siguiente dirección URL: ${empresa.catalogo_imagen_url}
- Si el usuario pregunta por el menú, catálogo, lista de productos, precios, carta, productos o temas relacionados, debes responder a su consulta e incluir OBLIGATORIAMENTE la siguiente sintaxis de Markdown exactamente al final de tu mensaje para mostrar la imagen: \`![Menú / Catálogo de Productos](${empresa.catalogo_imagen_url})\`
- IMPORTANTE: Escribe la sintaxis de imagen completa en una sola línea. No dejes espacios ni añadas saltos de línea entre el corchete de cierre ']' y el paréntesis de apertura '(' (ej. NO escribas '![Alt]\n(URL)' ni '![Alt] (URL)'). Debe ser continuo: '![Alt](URL)'.
- No inventes otros enlaces de imagen ni cambies esta sintaxis de Markdown.
` : ''}

FILTRO ESTRICTO ANTI-ALUCINACIONES:
1. Solo debes responder preguntas utilizando la información explícita provista arriba.
2. Si el cliente pregunta algo que NO está detallado en la información del negocio (por ejemplo, preguntas generales, de cocina, de fútbol, o servicios no listados), debes responder exactamente con empatía y tacto:
   "Lo lamento, no cuento con esa información en este momento. Permíteme tomar tus datos y un asesor humano se comunicará contigo a la brevedad."
3. No inventes precios, horarios, ubicaciones ni servicios. Si no está en el contexto, NO EXISTE para ti.

FLUJO DE CONVERSACIÓN OBLIGATORIO:
- Estado actual del cliente en la conversación:
  * Nombre guardado: ${conversacion.cliente_nombre || 'No registrado'}
  * WhatsApp guardado: ${conversacion.cliente_whatsapp || 'No registrado'}
`;

    // 7. Generar Respuesta (Simulador o API Gemini de producción)
    if (esApiKeySimulada) {
      respuestaTexto = await generarRespuestaSimuladaLocal(messageText, conversacion, empresa);
    } else {
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

      const defaultModel = llmConfig.proveedor === 'google' ? 'gemini-3.1-flash-lite' : 'gpt-4o-mini';
      const modelInstance = aiProvider(llmConfig.modelo_nombre || defaultModel);

      const formattedMessages = mensajesHistorial.map((m) => ({
        role: m.rol,
        content: m.contenido
      }));

      const { text } = await generateText({
        model: modelInstance,
        system: systemPrompt,
        messages: formattedMessages,
        temperature: llmConfig.temperatura || 0.3
      });

      respuestaTexto = text;
    }

    // 8. Guardar la respuesta del bot en la base de datos
    await insertMensaje(conversacion.id, 'assistant', respuestaTexto);

    // 9. Desencriptar el Token de acceso de WhatsApp de la empresa y responder físicamente a Meta
    if (empresa.whatsapp_token) {
      const whatsappAccessToken = decrypt(empresa.whatsapp_token);
      await enviarRespuestaWhatsApp(phoneId, clientPhone, respuestaTexto, whatsappAccessToken);
      console.log(`[WhatsApp Webhook] Mensaje enviado a ${clientPhone} exitosamente.`);
    } else {
      console.warn(`[WhatsApp Webhook] Empresa "${empresa.nombre}" no tiene configurado whatsapp_token.`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error procesando webhook:', error);
    return NextResponse.json({ 
      error: 'Error interno en el servidor.',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

// FUNCIÓN AUXILIAR DE ENVÍO DE MENSAJES (Meta Graph API)
async function enviarRespuestaWhatsApp(phoneId: string, toPhone: string, text: string, token: string) {
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  
  // Normalizar el número para México y Argentina (eliminar prefijo de red móvil '1' en MX y '9' en AR)
  let cleanPhone = toPhone.replace(/\D/g, '');
  if (cleanPhone.startsWith('521') && cleanPhone.length === 13) {
    cleanPhone = '52' + cleanPhone.substring(3);
  } else if (cleanPhone.startsWith('549') && cleanPhone.length === 13) {
    cleanPhone = '54' + cleanPhone.substring(3);
  }

  // Si la respuesta del bot contiene el tag markdown de imagen, podemos enviar un mensaje de texto.
  // WhatsApp Cloud API no renderiza imágenes de markdown inline. Sin embargo, para hacerlo
  // interactivo y premium, si el mensaje del bot tiene la sintaxis de imagen, podemos extraer la URL
  // y enviarle al usuario un mensaje de tipo 'image' nativo de WhatsApp, además del mensaje de texto original.
  
  const imgRegex = /!\[([\s\S]*?)\]\s*\(([\s\S]*?)\)/;
  const match = text.match(imgRegex);

  let textToSend = text;
  let imageUrlToSend = '';

  if (match) {
    // Extraemos la URL de la imagen y removemos el tag markdown del texto para que no se vea feo en WhatsApp
    imageUrlToSend = match[2].trim().replace(/\s+/g, '');
    textToSend = text.replace(imgRegex, '').trim();
  }

  // 1. Enviar el mensaje de texto principal
  if (textToSend) {
    const textPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { body: textToSend }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(textPayload)
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[WhatsApp Webhook] Error al enviar mensaje de texto a Meta:', JSON.stringify(err));
      // Logueamos el error pero no lanzamos excepción para que la petición responda 200 y Meta no reintente
    }
  }

  // 2. Enviar la imagen nativa de catálogo si existía en la respuesta
  if (imageUrlToSend) {
    const imagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'image',
      image: {
        link: imageUrlToSend,
        caption: 'Menú / Catálogo de Productos'
      }
    };

    const resImg = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(imagePayload)
    });

    if (!resImg.ok) {
      const err = await resImg.json();
      console.error('[WhatsApp Webhook] Error al enviar imagen a Meta:', JSON.stringify(err));
    }
  }
}

// RESPUESTAS SIMULADAS LOCALES PARA TESTING / DESARROLLO
async function generarRespuestaSimuladaLocal(mensajeUsuario: string, conversacion: any, empresa: any): Promise<string> {
  const msgLower = mensajeUsuario.toLowerCase();

  // Comprobar si pregunta algo fuera de contexto
  const esPreguntaFueraDeContexto = 
    msgLower.includes('receta') || 
    msgLower.includes('cocinar') || 
    msgLower.includes('fútbol') || 
    msgLower.includes('politica') || 
    msgLower.includes('clima') ||
    msgLower.includes('programar');

  if (esPreguntaFueraDeContexto) {
    return `Lo lamento, no cuento con esa información en este momento. Permíteme tomar tus datos y un asesor humano se comunicará contigo a la brevedad.`;
  }

  // Respuestas del catálogo
  if (msgLower.includes('precio') || msgLower.includes('costo') || msgLower.includes('cuanto cuesta') || msgLower.includes('servicios') || msgLower.includes('menu') || msgLower.includes('carta') || msgLower.includes('catalogo') || msgLower.includes('producto')) {
    let resp = `¡Hola ${conversacion.cliente_nombre}! Con gusto te comparto la información de nuestros servicios y productos.\n\n`;
    
    if (empresa.nombre.toLowerCase().includes('spa')) {
      resp += `🌸 Masaje Relajante - $500 MXN\n🧘 Facial Hidratante - $650 MXN\n\n¿Te gustaría reservar una cita?`;
    } else if (empresa.nombre.toLowerCase().includes('taco') || empresa.nombre.toLowerCase().includes('pasteler')) {
      resp += `🍰 Pasteles artesanales de chocolate, fresas y vainilla.\n🍪 Galletas decoradas y repostería fina.\n\n¿Deseas realizar algún pedido?`;
    } else {
      resp += `Contamos con una amplia variedad de productos de excelente calidad.`;
    }

    if (empresa.catalogo_imagen_url) {
      resp += `\n\n![Menú / Catálogo de Productos](${empresa.catalogo_imagen_url})`;
    }
    return resp;
  }

  if (msgLower.includes('horario') || msgLower.includes('dias') || msgLower.includes('abierto')) {
    return `Te atendemos con gusto de Lunes a Sábado de 9:00 AM a 8:00 PM. ¡Te esperamos!`;
  }

  if (msgLower.includes('ubicacion') || msgLower.includes('donde estan') || msgLower.includes('direccion')) {
    return `Nos encontramos ubicados en la zona central de la ciudad. Hacemos envíos a domicilio también.`;
  }

  return `¡Hola ${conversacion.cliente_nombre}! Gracias por comunicarte con ${empresa.nombre}. ¿En qué te puedo ayudar hoy?`;
}
