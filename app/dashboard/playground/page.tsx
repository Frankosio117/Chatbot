'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Textarea } from '@/components/UI';
import { Bot, Play, RefreshCcw, Save, HelpCircle } from 'lucide-react';
import { getEmpresa, updateEmpresa, getEmpresas, createEmpresa } from '@/lib/db';
import ChatWidget from '@/components/ChatWidget';

export default function PlaygroundPage() {
  const [empresaId, setEmpresaId] = useState<string>('');
  const [nombre, setNombre] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [temperature, setTemperature] = useState(0.3);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [key, setKey] = useState(0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getEmpresas();
      let activeId = sessionStorage.getItem('saas_active_empresa_id') || '';
      
      const isValid = activeId && list.some((e) => e.id === activeId);

      if (!isValid) {
        if (list.length > 0) {
          activeId = list[0].id;
          sessionStorage.setItem('saas_active_empresa_id', activeId);
        } else {
          try {
            const newEmp = await createEmpresa('Mi Empresa');
            activeId = newEmp.id;
            sessionStorage.setItem('saas_active_empresa_id', activeId);
          } catch (err) {
            console.error('Error al inicializar empresa por defecto:', err);
            activeId = '';
            sessionStorage.removeItem('saas_active_empresa_id');
          }
        }
      }

      setEmpresaId(activeId);
      if (activeId) {
        const emp = await getEmpresa(activeId);
        if (emp) {
          setNombre(emp.nombre || '');
          setInstrucciones(emp.instrucciones_bot || '');
        } else {
          setEmpresaId('');
        }
      }
    } catch (err) {
      console.error('Error en loadData:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      loadData();
    }, 0);
    const handleChange = () => {
      setTimeout(() => {
        loadData();
        setKey((p) => p + 1);
      }, 0);
    };
    window.addEventListener('active_company_changed', handleChange);
    return () => window.removeEventListener('active_company_changed', handleChange);
  }, [loadData]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;
    setIsSaving(true);
    try {
      await updateEmpresa(empresaId, {
        instrucciones_bot: instrucciones,
      });
      setKey((p) => p + 1);
    } catch (err) {
      console.error('Error al aplicar cambios:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Cargando playground...</p>
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Playground del Agente</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Ajusta las instrucciones y prueba el chatbot en vivo.
            </p>
          </div>
        </div>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sin Empresa Asignada</h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                No puedes probar el chatbot porque tu usuario no tiene una empresa asignada.
                Por favor, solicita a tu administrador que asocie tu cuenta a una empresa.
              </p>
            </div>
            <Button onClick={loadData} variant="ghost" size="sm" className="mt-2 border border-zinc-800 hover:bg-zinc-900">
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Playground del Agente</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Ajusta las instrucciones y prueba el chatbot en vivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Simulador Activo
          </span>
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT — Controls */}
        <Card className="flex flex-col" style={{ height: '760px' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-yellow-400 shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-bold text-white">Ajustes del Agente</h2>
              </div>
              <Button
                onClick={() => setKey((p) => p + 1)}
                variant="ghost"
                size="sm"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Reiniciar Chat
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto space-y-5">
            <form onSubmit={handleApply} className="space-y-5">
              <Textarea
                label="Instrucciones del Bot (Personalidad)"
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                placeholder="Ej. Eres un asistente amable del negocio..."
                rows={15}
                required
              />

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Temperatura
                  </label>
                  <span className="text-xs font-mono font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded-lg">
                    {temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-yellow-400"
                />
                <p className="text-[11px] text-zinc-600">
                  Valores bajos (0.1–0.3) dan respuestas más precisas y evitan alucinaciones.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isSaving}
              >
                <Save className="w-4 h-4" />
                Aplicar y Probar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* RIGHT — Preview */}
        <div className="flex flex-col" style={{ height: '760px' }}>

          {/* Browser chrome */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            {/* URL bar */}
            <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3 shrink-0">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
              </div>
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1 text-center text-xs font-mono text-zinc-600 truncate max-w-[70%] mx-auto">
                https://www.{nombre.toLowerCase().replace(/\s+/g, '-') || 'minegocio'}.com
              </div>
              <Play className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
            </div>

            {/* Simulated website */}
            <div className="flex-1 bg-zinc-950 overflow-y-auto p-5 relative">
              <div className="space-y-4">
                {/* Mock hero */}
                <div className="text-center py-8 px-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-yellow-400/10 text-yellow-400 border border-yellow-400/15 mb-3">
                    ✦ Sitio Web del Negocio
                  </div>
                  <h2 className="text-lg font-bold text-white">{nombre || 'Nombre del Negocio'}</h2>
                  <p className="text-xs text-zinc-500 mt-2 max-w-[250px] mx-auto leading-relaxed">
                    Bienvenido. Chatea con nuestro asistente en el botón inferior derecho.
                  </p>
                </div>

                {/* Mock services */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Servicios</p>
                  <div className="space-y-2">
                    {['Servicio 1', 'Servicio 2', 'Servicio 3'].map((s, i) => (
                      <div key={i} className="p-3 border border-zinc-800 rounded-lg flex justify-between items-center">
                        <span className="text-xs font-medium text-zinc-300">{s}</span>
                        <span className="text-xs text-zinc-600">Consultar</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ChatWidget inside preview */}
              <ChatWidget key={key} empresaId={empresaId} />
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-600 shrink-0">
              <span>Prueba el botón flotante en la esquina inferior derecha ↘</span>
              <HelpCircle className="w-3.5 h-3.5 text-zinc-700" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
