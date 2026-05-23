import { NextRequest, NextResponse } from 'next/server';
import { getEmpresa, getConversacion, updateConversacion, insertMensaje, getGlobalLLMConfig, Empresa, Conversacion } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const maxDuration = 30;

interface MessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  let conversacionId: string | undefined;
  let empresaId: string | undefined;
  let empresa: Empresa | null = null;
  let conversacion: Conversacion | null = null;
  let ultimoMensajeUsuario: MessagePayload | null = null;
  let messages: MessagePayload[] = [];
  let previewInstructions: string | undefined;

  try {
    const body = await req.json();
    messages = body.messages || [];
    conversacionId = body.conversacionId;
    empresaId = body.empresaId;
    previewInstructions = body.previewInstructions;

    if (!conversacionId || !empresaId) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (conversacionId, empresaId).' }, { status: 400 });
    }

    // 1. Obtener la información de la empresa y la conversación
    empresa = await getEmpresa(empresaId);
    conversacion = await getConversacion(conversacionId);

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    }
    if (!conversacion) {
      return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });
    }

    // Guardar el último mensaje del usuario en la base de datos
    ultimoMensajeUsuario = messages[messages.length - 1];
    if (ultimoMensajeUsuario && ultimoMensajeUsuario.role === 'user') {
      await insertMensaje(conversacionId, 'user', ultimoMensajeUsuario.content);
    }

    // 2. Cargar la configuración global de IA
    const llmConfig = await getGlobalLLMConfig();
    const apiKey = decrypt(llmConfig.api_key_encriptada);

    const esApiKeySimulada = !apiKey || apiKey.includes('mockapi-key') || apiKey === '';

    // 3. SYSTEM PROMPT ESTRICTO (Filtro anti-alucinaciones y flujo de recolección de datos)
    const systemPrompt = `
Eres un Agente de IA Conversacional experto y profesional.
Tu objetivo es atender a los clientes del negocio local "${empresa.nombre}".

PERSONALIDAD E INSTRUCCIONES DE COMPORTAMIENTO:
${previewInstructions || empresa.instrucciones_bot || ''}

INFORMACIÓN EXPLÍCITA DEL NEGOCIO (Tu único contexto y base de conocimiento):
=== INICIO DE INFORMACIÓN DEL NEGOCIO ===
${empresa.informacion_negocio || 'No hay información provista para este negocio.'}
=== FIN DE INFORMACIÓN DEL NEGOCIO ===
${empresa.catalogo_imagen_url ? `
MENÚ Y CATÁLOGO DE PRODUCTOS:
- La empresa cuenta con una imagen de su menú, catálogo o lista de productos en la siguiente dirección URL: ${empresa.catalogo_imagen_url}
- Si el usuario pregunta por el menú, catálogo, lista de productos, precios, carta, productos o temas relacionados, debes responder a su consulta e incluir OBLIGATORIAMENTE la siguiente sintaxis de Markdown exactamente al final de tu mensaje para mostrar la imagen: \`![Menú / Catálogo de Productos](${empresa.catalogo_imagen_url})\`
- IMPORTANTE: Escribe la sintaxis de imagen completa en una sola línea. No dejes espacios ni añadas saltos de línea entre el corchete de cierre ']' y el paréntesis de apertura '(' (ej. NO escribas '![Alt]\\n(URL)' ni '![Alt] (URL)'). Debe ser continuo: '![Alt](URL)'.
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

- Si el Nombre o el WhatsApp no están registrados:
  * Debes solicitar amablemente y de manera natural el Nombre y el WhatsApp del cliente antes de dar cotizaciones detalladas, agendar citas o concretar ventas.
  * Por ejemplo: "¡Hola! Con gusto te doy la información. ¿Me podrías regalar tu Nombre y un número de WhatsApp para poder contactarte y agendar?"
  * Si el cliente proporciona sus datos (ej. "Me llamo Juan y mi whatsapp es 5512345678"), debes invocar la herramienta 'guardarDatosCliente' inmediatamente con los parámetros exactos: 'nombre' (el nombre del cliente) y 'whatsapp' (el celular o whatsapp) para registrarlos en la base de datos.
  * Una vez que la herramienta se ejecute exitosamente, confirma que registraste los datos y continúa respondiendo su consulta original.
`;

    // 4. MODO SIMULADO / FALLBACK (Si no hay API key real configurada)
    if (esApiKeySimulada) {
      console.log('API Key real no configurada. Ejecutando simulación de chatbot inteligente.');
      
      const respuestaSimulada = await generarRespuestaSimulada(
        ultimoMensajeUsuario?.content || '', 
        conversacion, 
        empresa, 
        conversacionId
      );

      // Guardar el mensaje del asistente en la BD
      await insertMensaje(conversacionId, 'assistant', respuestaSimulada);

      // Crear un stream de texto simulado
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const palabras = respuestaSimulada.split(' ');
          for (const palabra of palabras) {
            controller.enqueue(encoder.encode(palabra + ' '));
            await new Promise((resolve) => setTimeout(resolve, 80)); // Simula velocidad de escritura
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    // 5. MODO PRODUCCIÓN (Usando Vercel AI SDK)
    let aiProvider;
    if (llmConfig.proveedor === 'openai') {
      aiProvider = createOpenAI({ apiKey });
    } else if (llmConfig.proveedor === 'anthropic') {
      aiProvider = createAnthropic({ apiKey });
    } else if (llmConfig.proveedor === 'google') {
      aiProvider = createGoogleGenerativeAI({ apiKey });
    } else {
      // Por defecto fallback a OpenAI
      aiProvider = createOpenAI({ apiKey });
    }

    const defaultModel = llmConfig.proveedor === 'google' ? 'gemini-3.1-flash-lite' : 'gpt-4o-mini';
    const modelInstance = aiProvider(llmConfig.modelo_nombre || defaultModel);

    const result = streamText({
      model: modelInstance,
      messages: messages,
      system: systemPrompt,
      temperature: llmConfig.temperatura || 0.3,
      stopWhen: stepCountIs(5),
      tools: {
        guardarDatosCliente: tool({
          description: 'Registra el nombre y el WhatsApp del cliente en la base de datos de la conversación.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              nombre: { type: 'string', description: 'El nombre del cliente' },
              whatsapp: { type: 'string', description: 'El número de celular o WhatsApp del cliente' },
            },
            required: ['nombre', 'whatsapp'],
          }),
          execute: async (args: { nombre: string; whatsapp: string }) => {
            console.log(`[Tool Call] Raw args received:`, JSON.stringify(args));
            let { nombre, whatsapp } = args || {};
            
            // Fallback: si los parámetros vinieron vacíos del LLM, los extraemos por Regex de los mensajes
            if (!nombre || !whatsapp) {
              console.log('[Tool Call] Parámetros vacíos o incompletos. Aplicando extracción por expresión regular de los mensajes de usuario.');
              const mensajesUsuario = messages.filter((m) => m.role === 'user');
              const ultimoMsg = mensajesUsuario[mensajesUsuario.length - 1]?.content || '';
              
              if (!whatsapp) {
                const phoneRegex = /(\+?\d{8,15})/;
                const matchPhone = ultimoMsg.match(phoneRegex);
                if (matchPhone) {
                  whatsapp = matchPhone[0];
                }
              }
              
              if (!nombre) {
                const nameRegex = /(?:mi nombre es|me llamo|soy|llamo|nombre:|nombre es)\s+([a-zA-Záéíóúñ\s]+?)(?:\s+y\s+|\s+mi\s+|\s+con\s+|\.|\,|$)/i;
                const matchName = ultimoMsg.match(nameRegex);
                if (matchName && matchName[1]) {
                  nombre = matchName[1].trim();
                } else {
                  nombre = 'Cliente';
                }
              }
            }

            console.log(`[Tool Call] Guardando datos del cliente final: nombre="${nombre}", whatsapp="${whatsapp}"`);
            
            if (nombre && whatsapp) {
              await updateConversacion(conversacionId!, {
                cliente_nombre: nombre,
                cliente_whatsapp: whatsapp,
              });
              return { success: true, message: `Datos de ${nombre} (WhatsApp: ${whatsapp}) guardados correctamente.` };
            }
            return { success: false, message: 'No se pudieron extraer ni guardar los datos del cliente.' };
          },
        }),
      },
      onFinish: async (event) => {
        // Al terminar de generar con éxito, guardar la respuesta del asistente en la BD
        if (event.text) {
          await insertMensaje(conversacionId!, 'assistant', event.text);
        }
      }
    });

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        let hasText = false;
        let hasError = false;

        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              hasText = true;
              controller.enqueue(encoder.encode(part.text));
            } else if (part.type === 'error') {
              console.warn('[API Route /api/chat] Error detectado en el stream de la API, activando fallback simulado:', part.error);
              hasError = true;

              const respuestaSimulada = await generarRespuestaSimulada(
                ultimoMensajeUsuario?.content || '',
                conversacion!,
                empresa!,
                conversacionId!
              );

              // Guardar la respuesta simulada en la BD
              await insertMensaje(conversacionId!, 'assistant', respuestaSimulada);

              // Emitir la respuesta simulada
              const palabras = respuestaSimulada.split(' ');
              for (const palabra of palabras) {
                controller.enqueue(encoder.encode(palabra + ' '));
                await new Promise((resolve) => setTimeout(resolve, 80));
              }
              break;
            }
          }

          // Caso borde: Si no hubo texto ni errores pero se registraron datos de lead en este paso,
          // podemos dar una respuesta de confirmación si el stream terminó vacío.
          if (!hasText && !hasError) {
            const updatedConv = await getConversacion(conversacionId!);
            if (updatedConv && updatedConv.cliente_nombre && updatedConv.cliente_whatsapp) {
              const confirmacion = `¡Perfecto, ${updatedConv.cliente_nombre}! He guardado tus datos de contacto (${updatedConv.cliente_whatsapp}). ¿En qué más puedo ayudarte hoy?`;
              await insertMensaje(conversacionId!, 'assistant', confirmacion);
              controller.enqueue(encoder.encode(confirmacion));
            }
          }
        } catch (streamError) {
          console.error('[API Route /api/chat] Error de lectura del stream (activando fallback):', streamError);
          if (!hasText && conversacion && empresa) {
            const respuestaSimulada = await generarRespuestaSimulada(
              ultimoMensajeUsuario?.content || '',
              conversacion,
              empresa,
              conversacionId!
            );
            await insertMensaje(conversacionId!, 'assistant', respuestaSimulada);
            controller.enqueue(encoder.encode(respuestaSimulada));
          }
        } finally {
          controller.close();
        }
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    const errObj = error as Error;
    console.error('Error en API Route /api/chat (intentando fallback simulado):', error);
    
    try {
      if (conversacionId && empresaId) {
        // Asegurarse de tener los datos de la empresa y la conversación cargados
        if (!empresa) {
          empresa = await getEmpresa(empresaId);
        }
        if (!conversacion) {
          conversacion = await getConversacion(conversacionId);
        }
        
        if (empresa && conversacion) {
          console.log(`[Chat Fallback] Generando respuesta simulada por fallo en LLM: ${errObj.message}`);
          
          const respuestaSimulada = await generarRespuestaSimulada(
            ultimoMensajeUsuario?.content || '',
            conversacion,
            empresa,
            conversacionId!
          );
          
          // Guardar el mensaje del asistente en la BD
          await insertMensaje(conversacionId!, 'assistant', respuestaSimulada);
          
          // Crear un stream de texto simulado
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const palabras = respuestaSimulada.split(' ');
              for (const palabra of palabras) {
                controller.enqueue(encoder.encode(palabra + ' '));
                await new Promise((resolve) => setTimeout(resolve, 80)); // Simula velocidad de escritura
              }
              controller.close();
            },
          });
          
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
        }
      }
    } catch (fallbackError) {
      console.error('Error crítico al ejecutar el fallback simulado del chatbot:', fallbackError);
    }
    
    return NextResponse.json({ 
      error: 'Ocurrió un error interno en el servidor.', 
      details: errObj.message 
    }, { status: 500 });
  }
}

// ----------------------------------------------------
// SIMULADOR DE RESPUESTAS INTELIGENTES (FALLBACK LOCAL)
// ----------------------------------------------------
async function generarRespuestaSimulada(
  mensajeUsuario: string, 
  conversacion: Conversacion, 
  empresa: Empresa, 
  conversacionId: string
): Promise<string> {
  const msgLower = mensajeUsuario.toLowerCase();
  
  // 1. Extraer nombre y whatsapp con regex simple en la simulación
  const whatsappRegex = /(\+?\d{8,15})/;
  const matchWhatsapp = msgLower.match(whatsappRegex);
  
  let nombreExtraido = '';
  let whatsappExtraido = '';

  if (matchWhatsapp) {
    whatsappExtraido = matchWhatsapp[0];
    // Intentar deducir nombre si dice "mi nombre es X", "me llamo X", "soy X"
    const nombreRegex = /(?:mi nombre es|me llamo|soy|llamo)\s+([a-zA-Záéíóúñ]+)/i;
    const matchNombre = mensajeUsuario.match(nombreRegex);
    if (matchNombre && matchNombre[1]) {
      nombreExtraido = matchNombre[1];
    } else {
      nombreExtraido = 'Cliente';
    }
  }

  // Guardar en la base de datos si se detectan datos
  if (whatsappExtraido) {
    const nuevoNombre = conversacion.cliente_nombre || nombreExtraido || 'Cliente';
    const nuevoWhatsapp = conversacion.cliente_whatsapp || whatsappExtraido;
    await updateConversacion(conversacionId, {
      cliente_nombre: nuevoNombre,
      cliente_whatsapp: nuevoWhatsapp
    });
    conversacion.cliente_nombre = nuevoNombre;
    conversacion.cliente_whatsapp = nuevoWhatsapp;
  }

  // 2. Verificar flujo de recolección obligatorio
  const tieneNombre = !!conversacion.cliente_nombre;
  const tieneWhatsapp = !!conversacion.cliente_whatsapp;

  // Si no se han proporcionado los datos, pedir
  if (!tieneNombre || !tieneWhatsapp) {
    if (whatsappExtraido) {
      // Si nos dio whatsapp pero no nombre
      return `¡Muchas gracias por tu WhatsApp! Para completar tu registro y poder darte el servicio, ¿me podrías indicar tu Nombre por favor?`;
    }
    // Saludo inicial y petición
    const botInstrucciones = empresa.instrucciones_bot || '';
    const saludoPersonalizado = botInstrucciones.includes('Qué onda') 
      ? '¡Qué onda! Bienvenido.' 
      : '¡Hola! Bienvenido.';
      
    return `${saludoPersonalizado} Con gusto te proporciono toda la información que necesites. Para darte cotizaciones detalladas y poder agendar una cita, ¿me podrías regalar tu Nombre y número de WhatsApp por favor?`;
  }

  // 3. Respuestas basadas en contexto explícito (Filtro anti-alucinación simulado)
  
  // Comprobar si pregunta algo fuera de contexto
  const esPreguntaFueraDeContexto = 
    msgLower.includes('receta') || 
    msgLower.includes('cocinar') || 
    msgLower.includes('fútbol') || 
    msgLower.includes('politica') || 
    msgLower.includes('clima') ||
    msgLower.includes('programar') ||
    (msgLower.includes('cómo haces') && !msgLower.includes('masaje') && !msgLower.includes('taco'));

  if (esPreguntaFueraDeContexto) {
    return `Lo lamento, no cuento con esa información en este momento. Permíteme tomar tus datos y un asesor humano se comunicará contigo a la brevedad.`;
  }

  // Buscar respuestas relevantes dentro de la información comercial
  if (msgLower.includes('precio') || msgLower.includes('costo') || msgLower.includes('cuanto cuesta') || msgLower.includes('servicios') || msgLower.includes('menu') || msgLower.includes('carta') || msgLower.includes('catalogo') || msgLower.includes('producto') || msgLower.includes('lista')) {
    let respuesta = '';
    if (empresa.id === 'spa-123' || empresa.nombre.toLowerCase().includes('spa')) {
      respuesta = `¡Claro, ${conversacion.cliente_nombre}! Aquí tienes nuestros servicios y precios:\n🌸 Masaje Relajante Completo (60 min) - $500 MXN.\n🧘 Facial Hidratante Profundo (45 min) - $650 MXN.\n🍃 Circuito de Termas y Jacuzzi (120 min) - $800 MXN.\n\n¿Te gustaría agendar alguno de estos servicios hoy?`;
    } else if (empresa.id === 'tacos-456' || empresa.nombre.toLowerCase().includes('taco')) {
      respuesta = `¡Claro que sí, compadre! Aquí está el menú:\n🌮 Tacos al Pastor: $20 c/u.\n🥩 Tacos de Bistec: $25 c/u.\n🧀 Gringas de Pastor: $60 c/u.\n🥤 Aguas Frescas (Horchata y Jamaica) / Refrescos: $30 c/u.\n\n¿De qué te vamos a preparar y cuántos te mandamos?`;
    } else {
      respuesta = `¡Hola! Con gusto te puedo dar información sobre nuestros productos y servicios.`;
    }

    if (empresa.catalogo_imagen_url) {
      respuesta += `\n\nAquí tienes nuestro Menú / Catálogo de Productos:\n![Menú / Catálogo de Productos](${empresa.catalogo_imagen_url})`;
    }
    return respuesta;
  }

  if (msgLower.includes('horario') || msgLower.includes('cuando abren') || msgLower.includes('abierto') || msgLower.includes('dias')) {
    if (empresa.id === 'spa-123' || empresa.nombre.toLowerCase().includes('spa')) {
      return `Nuestro horario en Spa Zen Relax es de Lunes a Sábado de 9:00 AM a 8:00 PM. Los domingos permanecemos cerrados para recargar energías. 🍃 ¿Qué día te gustaría visitarnos?`;
    } else if (empresa.id === 'tacos-456' || empresa.nombre.toLowerCase().includes('taco')) {
      return `¡Te atendemos de Martes a Domingo desde las 6:00 PM hasta las 2:00 AM! Los lunes descansamos para comprar los ingredientes frescos. 🌮`;
    }
  }

  if (msgLower.includes('direccion') || msgLower.includes('donde estan') || msgLower.includes('ubicacion') || msgLower.includes('donde queda') || msgLower.includes('como llegar')) {
    if (empresa.id === 'spa-123' || empresa.nombre.toLowerCase().includes('spa')) {
      return `Nos encontramos en Av. de la Armonía 456, Col. Jardines, Ciudad de México. 🌸 Es un lugar muy tranquilo y de fácil acceso.`;
    } else if (empresa.id === 'tacos-456' || empresa.nombre.toLowerCase().includes('taco')) {
      return `¡Estamos ubicados en Calle del Hambre 789, Monterrey! Déjate guiar por el olor al trompo al pastor. ¡Aquí te esperamos! 🌮`;
    }
  }

  if (msgLower.includes('reservar') || msgLower.includes('cita') || msgLower.includes('agendar') || msgLower.includes('pedido')) {
    if (empresa.id === 'spa-123' || empresa.nombre.toLowerCase().includes('spa')) {
      return `Excelente elección, ${conversacion.cliente_nombre}. Para confirmar tu reservación solicitamos un anticipo de $200 MXN que se descontará de tu total. Te acabo de enviar los datos de pago al WhatsApp ${conversacion.cliente_whatsapp}. ¿Qué servicio y a qué hora te gustaría agendar?`;
    } else if (empresa.id === 'tacos-456' || empresa.nombre.toLowerCase().includes('taco')) {
      return `¡Perfecto! Ya tengo tu WhatsApp: ${conversacion.cliente_whatsapp}. En breve te enviaremos la confirmación del pedido y el total con el costo de envío a tu número. ¿Qué vas a ordenar hoy?`;
    }
  }

  // Respuesta por defecto adaptada a la personalidad
  const botInstruccionesDesp = empresa.instrucciones_bot || '';
  const despedidaSimulada = (botInstruccionesDesp.includes('Qué onda') || empresa.nombre.toLowerCase().includes('taco'))
    ? `¡Excelente, ${conversacion.cliente_nombre}! Dime, ¿en qué más te puedo ayudar sobre el menú de tacos o el servicio a domicilio? 🌮`
    : `Entendido, ${conversacion.cliente_nombre}. Recuerda que estoy aquí para responder tus dudas sobre nuestros masajes, faciales o el circuito de hidroterapia en Spa Zen Relax. 🧘`;

  return despedidaSimulada;
}
