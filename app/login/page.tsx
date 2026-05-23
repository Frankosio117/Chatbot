'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { signIn, getUserRole } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await signIn(email.trim(), password.trim());
      
      // Obtener rol para redirigir correctamente
      const role = await getUserRole();
      
      if (role === 'super_admin') {
        router.push('/super-admin');
      } else {
        router.push('/dashboard/settings');
      }
    } catch (err) {
      const errorObj = err as Error;
      const msg = errorObj?.message || 'Error al iniciar sesión';
      if (msg.includes('Invalid login credentials')) {
        setError('Email o contraseña incorrectos.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Por favor confirma tu email antes de iniciar sesión.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-400/3 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center shadow-xl shadow-yellow-400/20 mb-4">
            <Zap className="w-6 h-6 text-zinc-950" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AgentSaaS</h1>
          <p className="text-sm text-zinc-500 mt-1">Inicia sesión en tu panel</p>
        </div>

        {/* Form card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl shadow-black/40">
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2 shadow-md shadow-yellow-400/10"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          ¿No tienes cuenta?{' '}
          <span className="text-yellow-400/70">Contacta a tu administrador.</span>
        </p>
      </div>
    </div>
  );
}
