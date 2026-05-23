import { supabase } from './supabase';

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getUserRole(): Promise<'super_admin' | 'user' | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  
  return (data?.rol as 'super_admin' | 'user') || 'user';
}
