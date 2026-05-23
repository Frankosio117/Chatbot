import React from 'react';
import Link from 'next/link';
import { Zap, Bot, Settings, Play, ArrowRight, ShieldCheck } from 'lucide-react';
import ChatWidget from '@/components/ChatWidget';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-yellow-400 selection:text-zinc-950">

      {/* ── NAVBAR ── */}
      <header className="max-w-5xl w-full mx-auto px-6 h-16 flex items-center justify-between border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center shadow-md shadow-yellow-400/20 shrink-0">
            <Zap className="w-4 h-4 text-zinc-950" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">AgentSaaS</span>
            <span className="block text-[9px] text-zinc-500 -mt-0.5 font-medium tracking-wider uppercase">Local Business AI</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="px-4 py-2 text-xs font-semibold bg-yellow-400 hover:bg-yellow-300 text-zinc-950 rounded-xl transition-all duration-200 shadow-md shadow-yellow-400/10 flex items-center gap-1.5"
          >
            Ir al Panel <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-6 py-16 md:py-24 flex flex-col items-center justify-center relative overflow-hidden">

        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-yellow-400/4 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-yellow-400/3 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center max-w-3xl space-y-6 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 uppercase tracking-wider">
            <Bot className="w-3.5 h-3.5" /> Agentes Conversacionales · Gemini AI
          </span>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-[1.05]">
            Chatbots de IA para{' '}
            <span className="text-yellow-400">Negocios Locales</span>
            <br />
            <span className="text-zinc-400 font-bold text-3xl md:text-4xl">sin alucinaciones.</span>
          </h1>

          <p className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Diseña la base de conocimiento de tu negocio, personaliza el tono de voz del agente y captura leads de forma 100% automatizada.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard/settings"
              className="px-6 py-3 text-sm font-bold bg-yellow-400 hover:bg-yellow-300 text-zinc-950 rounded-2xl transition-all duration-200 shadow-lg shadow-yellow-400/15 flex items-center gap-2 hover:-translate-y-0.5"
            >
              <Settings className="w-4 h-4" /> Configurar mi Bot
            </Link>
            <Link
              href="/dashboard/playground"
              className="px-6 py-3 text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 rounded-2xl transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4" /> Ver Demo
            </Link>
          </div>
        </div>

        {/* ── FEATURE CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl w-full mt-16 relative z-10">

          <Link href="/dashboard/settings" className="group">
            <div className="h-full bg-zinc-900 border border-zinc-800 group-hover:border-yellow-400/30 rounded-2xl p-6 transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400 group-hover:text-zinc-950 transition-all duration-300 mb-4">
                <Settings className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Ajustes del Bot</h3>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                Actualiza la base de conocimiento, cambia el tono de voz y sube archivos de texto para el agente.
              </p>
              <div className="mt-5 flex items-center text-xs font-semibold text-yellow-400/60 group-hover:text-yellow-400 transition-colors">
                Configurar <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          <Link href="/dashboard/playground" className="group">
            <div className="h-full bg-zinc-900 border border-zinc-800 group-hover:border-yellow-400/30 rounded-2xl p-6 transition-all duration-300 group-hover:-translate-y-1">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-400 group-hover:text-zinc-950 transition-all duration-300 mb-4">
                <Play className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Playground de Pruebas</h3>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                Prueba el chatbot en vivo y verifica que responde correctamente según tu base de conocimiento.
              </p>
              <div className="mt-5 flex items-center text-xs font-semibold text-yellow-400/60 group-hover:text-yellow-400 transition-colors">
                Probar Agente <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="py-6 border-t border-zinc-800 text-zinc-600 text-xs shrink-0">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 AgentSaaS · Next.js · Supabase · Gemini AI</p>
          <div className="flex items-center gap-1.5 text-zinc-600">
            <ShieldCheck className="w-3.5 h-3.5 text-yellow-400/60" />
            <span>Multi-Tenant · RLS Seguro</span>
          </div>
        </div>
      </footer>

      {/* ChatWidget flotante demo */}
      <ChatWidget empresaId="spa-123" />
    </div>
  );
}
