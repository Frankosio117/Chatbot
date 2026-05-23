'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button } from '@/components/UI';
import {
  Users2, Phone, Calendar, ChevronRight, Loader2,
  Tag, ShoppingCart, MessageSquare, AlertCircle, Star, HelpCircle, Inbox, RefreshCcw
} from 'lucide-react';
import { getConversacionesPorEmpresa, getEmpresas, createEmpresa, getEmpresa } from '@/lib/db';

interface Highlight {
  tipo: 'cotizacion' | 'producto' | 'reserva' | 'queja' | 'consulta' | 'interes' | 'otro' | 'info';
  texto: string;
}

interface Lead {
  id: string;
  cliente_nombre: string | null;
  cliente_whatsapp: string | null;
  fecha_inicio: string;
  highlights: Highlight[] | null;
  _loadingHighlights?: boolean;
}

const HIGHLIGHT_ICONS: Record<string, React.ElementType> = {
  cotizacion: ShoppingCart,
  producto: Tag,
  reserva: Calendar,
  queja: AlertCircle,
  consulta: HelpCircle,
  interes: Star,
  otro: MessageSquare,
  info: MessageSquare,
};

const HIGHLIGHT_COLORS: Record<string, string> = {
  cotizacion: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  producto: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  reserva: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  queja: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  consulta: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  interes: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  otro: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  info: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [empresaId, setEmpresaId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const refreshHighlightsForLead = useCallback(async (leadId: string, silent = false) => {
    if (!silent) {
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, _loadingHighlights: true } : l));
      setSelectedLead((prev) => prev?.id === leadId ? { ...prev, _loadingHighlights: true } : prev);
    }
    
    try {
      const res = await fetch('/api/leads/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacionId: leadId }),
      });
      
      if (res.ok) {
        const { highlights } = await res.json();
        setLeads((prev) => prev.map((l) =>
          l.id === leadId ? { ...l, highlights, _loadingHighlights: false } : l
        ));
        setSelectedLead((prev) => prev?.id === leadId ? { ...prev, highlights, _loadingHighlights: false } : prev);
      } else {
        setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, _loadingHighlights: false } : l));
        setSelectedLead((prev) => prev?.id === leadId ? { ...prev, _loadingHighlights: false } : prev);
      }
    } catch {
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, _loadingHighlights: false } : l));
      setSelectedLead((prev) => prev?.id === leadId ? { ...prev, _loadingHighlights: false } : prev);
    }
  }, []);

  const autoGenerateHighlights = useCallback(async (leadsData: Lead[]) => {
    const withoutHighlights = leadsData.filter((l) => !l.highlights || l.highlights.length === 0);
    for (const lead of withoutHighlights) {
      await refreshHighlightsForLead(lead.id, true);
    }
  }, [refreshHighlightsForLead]);

  const loadLeads = useCallback(async () => {
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
          const convs = await getConversacionesPorEmpresa(activeId);
          // Only show conversations with a name or whatsapp (real leads)
          const leadsData: Lead[] = convs
            .filter((c) => c.cliente_nombre || c.cliente_whatsapp)
            .map((c) => {
              let parsedHighlights: Highlight[] | null = null;
              if (c.highlights) {
                if (Array.isArray(c.highlights)) {
                  parsedHighlights = c.highlights as Highlight[];
                } else if (typeof c.highlights === 'object' && 'items' in c.highlights) {
                  parsedHighlights = (c.highlights as any).items as Highlight[];
                }
              }
              return {
                id: c.id,
                cliente_nombre: c.cliente_nombre,
                cliente_whatsapp: c.cliente_whatsapp,
                fecha_inicio: c.fecha_inicio,
                highlights: parsedHighlights,
              };
            });
          setLeads(leadsData);
          autoGenerateHighlights(leadsData);
        } else {
          setEmpresaId('');
          setLeads([]);
        }
      } else {
        setLeads([]);
      }
    } catch (err) {
      console.error('Error en loadLeads:', err);
    } finally {
      setIsLoading(false);
    }
  }, [autoGenerateHighlights]);

  useEffect(() => {
    setTimeout(() => {
      loadLeads();
    }, 0);
    const handleChange = () => {
      setTimeout(() => {
        loadLeads();
      }, 0);
    };
    window.addEventListener('active_company_changed', handleChange);
    return () => window.removeEventListener('active_company_changed', handleChange);
  }, [loadLeads]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Cargando leads...</p>
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Leads</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Clientes que interactuaron con tu chatbot. Los highlights son generados con IA.
            </p>
          </div>
        </div>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sin Empresa Asignada</h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                No hay leads disponibles porque tu usuario no tiene una empresa asignada.
                Por favor, solicita a tu administrador que asocie tu cuenta a una empresa.
              </p>
            </div>
            <Button onClick={loadLeads} variant="ghost" size="sm" className="mt-2 border border-zinc-800 hover:bg-zinc-900">
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Leads</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Clientes que interactuaron con tu chatbot. Los highlights son generados con IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
            <Users2 className="w-3.5 h-3.5" />
            {leads.length} leads
          </span>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-zinc-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-300">Aún no tienes leads</p>
            <p className="text-xs text-zinc-600 mt-1">
              Los leads aparecerán aquí cuando los clientes compartan su nombre y WhatsApp en el chat.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Lead list */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">
              Lista de Leads ({leads.length})
            </p>
            {leads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => {
                  setSelectedLead(lead);
                  refreshHighlightsForLead(lead.id);
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
                  selectedLead?.id === lead.id
                    ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        selectedLead?.id === lead.id ? 'bg-yellow-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {(lead.cliente_nombre?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{lead.cliente_nombre || 'Sin nombre'}</p>
                        {lead.cliente_whatsapp && (
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            {lead.cliente_whatsapp}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1.5 ml-9">{formatDate(lead.fecha_inicio)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {lead._loadingHighlights ? (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-600 animate-spin" />
                    ) : lead.highlights && lead.highlights.length > 0 ? (
                      <span className="text-[9px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/15 px-1.5 py-0.5 rounded-full uppercase">
                        {lead.highlights.length} insights
                      </span>
                    ) : null}
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Lead detail */}
          <div className="lg:col-span-3">
            {selectedLead ? (
              <Card className="sticky top-6">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-zinc-950 font-bold shrink-0">
                      {(selectedLead.cliente_nombre?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">{selectedLead.cliente_nombre || 'Sin nombre'}</h2>
                      <div className="flex items-center gap-3 mt-0.5">
                        {selectedLead.cliente_whatsapp && (
                          <p className="text-xs text-zinc-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {selectedLead.cliente_whatsapp}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(selectedLead.fecha_inicio)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-yellow-400" />
                      Aspectos destacados de la conversación
                    </p>

                    {selectedLead._loadingHighlights ? (
                      <div className="flex items-center gap-2 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                        <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                        <p className="text-xs text-zinc-500">Analizando conversación con IA...</p>
                      </div>
                    ) : selectedLead.highlights && selectedLead.highlights.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLead.highlights.map((h, i) => {
                          const Icon = HIGHLIGHT_ICONS[h.tipo] || MessageSquare;
                          const colorClass = HIGHLIGHT_COLORS[h.tipo] || HIGHLIGHT_COLORS.otro;
                          return (
                            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${colorClass}`}>
                              <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold uppercase text-[9px] tracking-wider opacity-70 block mb-0.5">
                                  {h.tipo}
                                </span>
                                {h.texto}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                        <p className="text-xs text-zinc-500">No hay highlights disponibles para esta conversación.</p>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp link */}
                  {selectedLead.cliente_whatsapp && (
                    <a
                      href={`https://wa.me/${selectedLead.cliente_whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-semibold transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Contactar por WhatsApp
                    </a>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Users2 className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500">Selecciona un lead para ver sus detalles</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
