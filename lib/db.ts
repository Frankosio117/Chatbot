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
    const fallbackModel = process.env.DEFAULT_LLM_MODEL || (fallbackProvider === 'google' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
    
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
