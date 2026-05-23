'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Badge } from '@/components/UI';
import { MessageSquare, Users, TrendingUp, Zap, HelpCircle, Code2, MessageCircle, Play, ArrowRight, Activity, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';
import { getEmpresas, getEmpresa, getMetricsPorEmpresa, createEmpresa } from '@/lib/db';
import Link from 'next/link';

interface DashboardMetrics {
  totalConversaciones: number;
  totalLeads: number;
  totalMensajes: number;
  mensajesPorDia: { fecha: string; count: number }[];
  conversacionesPorDia: { fecha: string; count: number }[];
}

export default function DashboardPage() {
  const [empresaId, setEmpresaId] = useState<string>('');
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          setEmpresaNombre(emp.nombre);
          setWhatsappConfigured(!!(emp.whatsapp_phone_id && emp.whatsapp_token));
          const data = await getMetricsPorEmpresa(activeId);
          setMetrics(data);
        }
      }
    } catch (err) {
      console.error('Error cargando métricas de dashboard:', err);
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
      }, 0);
    };

    window.addEventListener('active_company_changed', handleChange);
    return () => window.removeEventListener('active_company_changed', handleChange);
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Cargando métricas de rendimiento...</p>
      </div>
    );
  }

  if (!empresaId || !metrics) {
    return (
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Sin Empresa Activa</h3>
            <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
              Asocia tu cuenta a una empresa o selecciona una empresa del menú para poder visualizar el rendimiento del chatbot.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const conversionRate = metrics.totalConversaciones > 0
    ? ((metrics.totalLeads / metrics.totalConversaciones) * 100).toFixed(1)
    : '0.0';

  const maxMessages = Math.max(...metrics.mensajesPorDia.map(d => d.count), 1);
  const maxConvs = Math.max(...metrics.conversacionesPorDia.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Rendimiento General</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Visualiza el impacto de tu chatbot de Inteligencia Artificial para el negocio <strong className="text-zinc-300">{empresaNombre}</strong>.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Messages */}
        <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Mensajes Consumidos</span>
            <div className="p-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/15">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.totalMensajes}</span>
            <span className="block text-[10px] text-zinc-500 mt-1">Volumen consumido de tu cuota mensual</span>
          </div>
        </Card>

        {/* Conversations */}
        <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Chats Iniciados</span>
            <div className="p-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/15">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.totalConversaciones}</span>
            <span className="block text-[10px] text-zinc-500 mt-1">Sesiones de chat iniciadas por clientes</span>
          </div>
        </Card>

        {/* Leads */}
        <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Leads Registrados</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.totalLeads}</span>
            <span className="block text-[10px] text-zinc-500 mt-1">Clientes que dejaron nombre o WhatsApp</span>
          </div>
        </Card>

        {/* Conversion Rate */}
        <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Conversión a Leads</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white tracking-tight">{conversionRate}%</span>
            <span className="block text-[10px] text-zinc-500 mt-1">Porcentaje de visitantes convertidos</span>
          </div>
        </Card>
      </div>

      {/* Activity Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Messages Chart */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-bold text-white">Actividad de Mensajes</h3>
            </div>
            <p className="text-[11px] text-zinc-500">Tendencia del número de mensajes procesados por día en los últimos 7 días.</p>
          </CardHeader>
          <CardContent>
            {metrics.mensajesPorDia.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-zinc-650">Sin registros recientes</div>
            ) : (
              <div className="flex items-end justify-between h-40 pt-6 px-1 border-b border-zinc-800/80 relative">
                {metrics.mensajesPorDia.map((item, idx) => {
                  const heightPercent = Math.min((item.count / maxMessages) * 100, 100);
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 group w-full relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-250 bg-yellow-400 text-zinc-950 font-bold font-mono text-[9px] px-2 py-0.5 rounded-md absolute -top-8 select-none pointer-events-none z-10 whitespace-nowrap shadow-md">
                        {item.count} msgs
                      </div>
                      {/* Bar */}
                      <div 
                        className="w-6 sm:w-8 rounded-t bg-yellow-400/10 group-hover:bg-yellow-400/60 transition-all duration-300 relative border-t border-yellow-400/25 group-hover:border-yellow-400 cursor-pointer shadow-inner shadow-yellow-450/10"
                        style={{ height: `${Math.max(heightPercent, 4)}%` }}
                      />
                      {/* Date label */}
                      <span className="text-[9px] text-zinc-600 group-hover:text-zinc-300 font-mono transition-colors">
                        {item.fecha}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversations Chart */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Nuevas Conversaciones</h3>
            </div>
            <p className="text-[11px] text-zinc-500">Tendencia de nuevos clientes que abrieron el chat en los últimos 7 días.</p>
          </CardHeader>
          <CardContent>
            {metrics.conversacionesPorDia.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-zinc-650">Sin registros recientes</div>
            ) : (
              <div className="flex items-end justify-between h-40 pt-6 px-1 border-b border-zinc-800/80 relative">
                {metrics.conversacionesPorDia.map((item, idx) => {
                  const heightPercent = Math.min((item.count / maxConvs) * 100, 100);
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 group w-full relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-250 bg-indigo-500 text-zinc-100 font-bold font-mono text-[9px] px-2 py-0.5 rounded-md absolute -top-8 select-none pointer-events-none z-10 whitespace-nowrap shadow-md">
                        {item.count} chats
                      </div>
                      {/* Bar */}
                      <div 
                        className="w-6 sm:w-8 rounded-t bg-indigo-500/10 group-hover:bg-indigo-500/60 transition-all duration-300 relative border-t border-indigo-500/25 group-hover:border-indigo-500 cursor-pointer shadow-inner shadow-indigo-450/10"
                        style={{ height: `${Math.max(heightPercent, 4)}%` }}
                      />
                      {/* Date label */}
                      <span className="text-[9px] text-zinc-600 group-hover:text-zinc-300 font-mono transition-colors">
                        {item.fecha}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Integration Channels & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active channels checker */}
        <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Canales de Integración Activos
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Monitorea los canales de comunicación integrados para responder preguntas y capturar prospectos de forma automatizada.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Widget Web */}
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold text-zinc-200">Widget Web (Iframe)</span>
                </div>
                <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed">Chatbot insertado en tu sitio web corporativo.</p>
              </div>
              <Badge variant="emerald">Activo</Badge>
            </div>

            {/* WhatsApp */}
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">WhatsApp Oficial</span>
                </div>
                <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed">Sincronizado con tu número comercial de Meta Cloud API.</p>
              </div>
              {whatsappConfigured ? (
                <Badge variant="emerald">Activo</Badge>
              ) : (
                <Badge variant="zinc">No configurado</Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Quick actions panel */}
        <Card className="bg-zinc-900 border-zinc-800 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Accesos Rápidos
          </h3>
          <p className="text-xs text-zinc-400">
            Realiza ajustes en el prompt, configura webhooks o revisa leads de inmediato:
          </p>

          <div className="flex flex-col gap-2 pt-1.5">
            <Link href="/dashboard/playground">
              <button className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60 hover:border-zinc-700 text-left text-xs font-semibold text-zinc-200 flex items-center justify-between group transition-all">
                <span className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-yellow-400" /> Probar en Playground
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-350 transition-colors" />
              </button>
            </Link>

            <Link href="/dashboard/leads">
              <button className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60 hover:border-zinc-700 text-left text-xs font-semibold text-zinc-200 flex items-center justify-between group transition-all">
                <span className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> Gestionar Leads
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-350 transition-colors" />
              </button>
            </Link>

            <Link href="/dashboard/embed">
              <button className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60 hover:border-zinc-700 text-left text-xs font-semibold text-zinc-200 flex items-center justify-between group transition-all">
                <span className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-yellow-400" /> Obtener Iframe de Web
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-350 transition-colors" />
              </button>
            </Link>

            <Link href="/dashboard/whatsapp">
              <button className="w-full p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60 hover:border-zinc-700 text-left text-xs font-semibold text-zinc-200 flex items-center justify-between group transition-all">
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> Ajustar WhatsApp API
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-350 transition-colors" />
              </button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
