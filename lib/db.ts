import { supabase } from './supabase';
import { encrypt } from './crypto';

// ----------------------------------------------------
// MODELOS DE DATOS DE LA BASE DE DATOS
// ----------------------------------------------------

export interface Empresa {
  id: string;
  nombre: string;
  logo_url: string;
  informacion_negocio: string;
  instrucciones_bot: string;
  fecha_creacion: string;
  // Nuevos campos de identidad visual del bot
  bot_nombre?: string;
  bot_avatar_url?: string;
  bot_color_primario?: string;
  bot_color_secundario?: string;
  catalogo_imagen_url?: string;
  // WhatsApp Integration
  whatsapp_token?: string;
  whatsapp_phone_id?: string;
  whatsapp_verify_token?: string;
}

export interface Perfil {
  id: string;
  email: string;
  rol: 'super_admin' | 'user';
  fecha_creacion: string;
}

export interface UsuarioEmpresa {
  id: string;
  user_id: string;
  empresa_id: string;
}

export interface Conversacion {
  id: string;
  empresa_id: string;
  cliente_nombre: string | null;
  cliente_whatsapp: string | null;
  fecha_inicio: string;
  highlights?: { tipo: string; texto: string }[] | null;
}

export interface Mensaje {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  fecha: string;
}

export interface ConfigLLM {
  id: string;
  proveedor: 'openai' | 'anthropic' | 'deepseek' | 'google';
  modelo_nombre: string;
  api_key_encriptada: string;
  temperatura: number;
  activo: boolean;
}

// Helper para validar e inicializar el cliente de Supabase
function getSupabase() {
  if (!supabase) {
    throw new Error('El cliente de Supabase no está configurado. Verifica tus variables de entorno.');
  }
  return supabase;
}

// ----------------------------------------------------
// FUNCIONES DE PRODUCCIÓN DE BASE DE DATOS (Supabase Directo)
// ----------------------------------------------------

export async function getEmpresa(id: string): Promise<Empresa | null> {
  const { data, error } = await getSupabase()
    .from('empresas')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Error fetching empresa:', error);
    return null;
  }
  return data;
}

export async function getEmpresas(): Promise<Empresa[]> {
  const { data, error } = await getSupabase()
    .from('empresas')
    .select('*')
    .order('fecha_creacion', { ascending: false });
  if (error) {
    console.error('Error fetching empresas:', error);
    return [];
  }
  return data || [];
}

export async function createEmpresa(nombre: string): Promise<Empresa> {
  const { data, error } = await getSupabase()
    .from('empresas')
    .insert([{ nombre, informacion_negocio: '', instrucciones_bot: 'Eres un bot servicial.' }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmpresa(id: string, updates: Partial<Omit<Empresa, 'id' | 'fecha_creacion'>>): Promise<Empresa | null> {
  const { data, error } = await getSupabase()
    .from('empresas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Error updating empresa:', error);
    return null;
  }
  return data;
}

export async function getConversacion(id: string): Promise<Conversacion | null> {
  const { data, error } = await getSupabase()
    .from('conversaciones')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Error fetching conversacion:', error);
    return null;
  }
  return data;
}

export async function getConversacionesPorEmpresa(empresaId: string): Promise<Conversacion[]> {
  const { data, error } = await getSupabase()
    .from('conversaciones')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('fecha_inicio', { ascending: false });
  if (error) {
    console.error('Error fetching conversaciones:', error);
    return [];
  }
  return data || [];
}

export async function createConversacion(empresaId: string, clienteNombre?: string, clienteWhatsapp?: string): Promise<Conversacion> {
  const { data, error } = await getSupabase()
    .from('conversaciones')
    .insert([{
      empresa_id: empresaId,
      cliente_nombre: clienteNombre || null,
      cliente_whatsapp: clienteWhatsapp || null
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateConversacion(id: string, updates: Partial<Omit<Conversacion, 'id' | 'empresa_id' | 'fecha_inicio'>>): Promise<Conversacion | null> {
  const { data, error } = await getSupabase()
    .from('conversaciones')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Error updating conversacion:', error);
    return null;
  }
  return data;
}

export async function getMensajes(conversacionId: string): Promise<Mensaje[]> {
  const { data, error } = await getSupabase()
    .from('mensajes')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .order('fecha', { ascending: true });
  if (error) {
    console.error('Error fetching mensajes:', error);
    return [];
  }
  return data || [];
}

export async function insertMensaje(conversacionId: string, rol: 'user' | 'assistant', contenido: string): Promise<Mensaje> {
  const { data, error } = await getSupabase()
    .from('mensajes')
    .insert([{ conversacion_id: conversacionId, rol, contenido }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getGlobalLLMConfig(): Promise<ConfigLLM> {
  const { data, error } = await getSupabase()
    .from('configuracion_global_llm')
    .select('*')
    .eq('activo', true)
    .limit(1);

  if (error || !data || data.length === 0) {
    console.warn('No active global LLM configuration found in database. Initializing with environment variables.');
    const fallbackApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
    const fallbackProvider = (process.env.DEFAULT_LLM_PROVIDER as 'openai' | 'anthropic' | 'deepseek' | 'google') || 'google';
    const fallbackModel = process.env.DEFAULT_LLM_MODEL || (fallbackProvider === 'google' ? 'gemini-3.1-flash-lite' : 'gpt-4o-mini');
    
    const newConfig = {
      proveedor: fallbackProvider,
      modelo_nombre: fallbackModel,
      api_key_encriptada: encrypt(fallbackApiKey),
      temperatura: 0.3,
      activo: true
    };

    const { data: insertedData, error: insertError } = await getSupabase()
      .from('configuracion_global_llm')
      .insert([newConfig])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting default LLM config into DB:', insertError);
      return {
        id: 'global-fallback',
        ...newConfig
      };
    }

    return insertedData;
  }
  
  return data[0];
}

export async function updateGlobalLLMConfig(updates: Partial<Omit<ConfigLLM, 'id'>>): Promise<ConfigLLM> {
  const activeConfig = await getGlobalLLMConfig();
  const { data, error } = await getSupabase()
    .from('configuracion_global_llm')
    .update(updates)
    .eq('id', activeConfig.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Helpers para paneles administrativos
export async function getPerfiles(): Promise<Perfil[]> {
  const { data, error } = await getSupabase()
    .from('perfiles')
    .select('*');
  if (error) {
    console.error('Error fetching perfiles:', error);
    return [];
  }
  return data || [];
}

export async function getUsuariosEmpresa(): Promise<UsuarioEmpresa[]> {
  const { data, error } = await getSupabase()
    .from('usuarios_empresa')
    .select('*');
  if (error) {
    console.error('Error fetching usuarios_empresa:', error);
    return [];
  }
  return data || [];
}

export async function vincularUsuarioEmpresa(userId: string, empresaId: string): Promise<UsuarioEmpresa> {
  const { data, error } = await getSupabase()
    .from('usuarios_empresa')
    .insert([{ user_id: userId, empresa_id: empresaId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getEmpresaPorUsuario(userId: string): Promise<Empresa | null> {
  const { data, error } = await getSupabase()
    .from('usuarios_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return getEmpresa(data.empresa_id);
}

export async function getTotalMensajesCount(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('mensajes')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Error counting messages:', error);
    return 0;
  }
  return count || 0;
}

export async function getMensajesCountPorEmpresas(): Promise<Record<string, number>> {
  const { data, error } = await getSupabase()
    .from('conversaciones')
    .select('empresa_id, mensajes(id)');
    
  if (error || !data) {
    console.error('Error fetching message counts:', error);
    return {};
  }
  
  const counts: Record<string, number> = {};
  data.forEach((conv: any) => {
    const empId = conv.empresa_id;
    const msgCount = conv.mensajes ? conv.mensajes.length : 0;
    counts[empId] = (counts[empId] || 0) + msgCount;
  });
  
  return counts;
}

export async function getMetricsPorEmpresa(empresaId: string) {
  const supabaseClient = getSupabase();
  
  // 1. Total Conversaciones
  const { count: totalConvs, error: convError } = await supabaseClient
    .from('conversaciones')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId);
    
  if (convError) console.error('Error fetching total conversations:', convError);

  // 2. Total Leads (conversations with name or phone registered - aligning with leads page logic)
  const { count: totalLeads, error: leadError } = await supabaseClient
    .from('conversaciones')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .or('cliente_nombre.not.is.null,cliente_whatsapp.not.is.null');

  if (leadError) console.error('Error fetching total leads:', leadError);

  // Helper local para formatear fechas de manera determinista en español (evita desajustes por locale del navegador)
  const formatDateKey = (date: Date): string => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  // 3. Total Mensajes
  const { data: convs } = await supabaseClient
    .from('conversaciones')
    .select('id')
    .eq('empresa_id', empresaId);

  let totalMsgs = 0;
  let mensajesPorDia: { fecha: string; count: number }[] = [];
  let conversacionesPorDia: { fecha: string; count: number }[] = [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (convs && convs.length > 0) {
    const ids = convs.map((c) => c.id);

    // Get total messages count
    const { count: msgCount, error: msgError } = await supabaseClient
      .from('mensajes')
      .select('*', { count: 'exact', head: true })
      .in('conversacion_id', ids);

    if (!msgError && msgCount !== null) {
      totalMsgs = msgCount;
    }

    // Get messages for last 7 days to group them
    const { data: msgsData } = await supabaseClient
      .from('mensajes')
      .select('fecha')
      .in('conversacion_id', ids)
      .gte('fecha', sevenDaysAgo.toISOString());

    if (msgsData) {
      const msgGroups: Record<string, number> = {};
      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        msgGroups[formatDateKey(d)] = 0;
      }

      msgsData.forEach((m) => {
        const dateStr = formatDateKey(new Date(m.fecha));
        if (msgGroups[dateStr] !== undefined) {
          msgGroups[dateStr]++;
        }
      });

      mensajesPorDia = Object.entries(msgGroups).map(([fecha, count]) => ({ fecha, count }));
    }
  }

  // Get conversations for last 7 days
  const { data: convsData } = await supabaseClient
    .from('conversaciones')
    .select('fecha_inicio')
    .eq('empresa_id', empresaId)
    .gte('fecha_inicio', sevenDaysAgo.toISOString());

  const convGroups: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    convGroups[formatDateKey(d)] = 0;
  }

  if (convsData) {
    convsData.forEach((c) => {
      const dateStr = formatDateKey(new Date(c.fecha_inicio));
      if (convGroups[dateStr] !== undefined) {
        convGroups[dateStr]++;
      }
    });
  }
  conversacionesPorDia = Object.entries(convGroups).map(([fecha, count]) => ({ fecha, count }));

  return {
    totalConversaciones: totalConvs || 0,
    totalLeads: totalLeads || 0,
    totalMensajes: totalMsgs,
    mensajesPorDia,
    conversacionesPorDia,
  };
}
