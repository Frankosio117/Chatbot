'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Input } from '@/components/UI';
import {
  MessageCircle, Copy, Check, Sparkles, RefreshCcw, Save, CheckCircle, XCircle,
  HelpCircle, ShieldCheck, Settings, Key
} from 'lucide-react';
import { getEmpresa, getEmpresas, createEmpresa } from '@/lib/db';

export default function WhatsAppPage() {
  const [empresaId, setEmpresaId] = useState<string>('');
  const [nombre, setNombre] = useState('');
  
  // WhatsApp Integration states
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadEmpresaData = useCallback(async () => {
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
          setWhatsappToken(emp.whatsapp_token ? '••••••••••••••••' : '');
          setWhatsappPhoneId(emp.whatsapp_phone_id || '');
          setWhatsappVerifyToken(emp.whatsapp_verify_token || '');
        } else {
          setEmpresaId('');
        }
      }
    } catch (err) {
      console.error('Error en loadEmpresaData:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      loadEmpresaData();
    }, 0);
    const handleChange = () => {
      setTimeout(() => {
        loadEmpresaData();
      }, 0);
    };
    window.addEventListener('active_company_changed', handleChange);
    return () => window.removeEventListener('active_company_changed', handleChange);
  }, [loadEmpresaData]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          updates: {
            whatsapp_token: whatsappToken,
            whatsapp_phone_id: whatsappPhoneId,
            whatsapp_verify_token: whatsappVerifyToken
          }
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar');
      }

      const resData = await response.json();
      if (resData.success) {
        showMsg('success', 'Configuración de WhatsApp guardada correctamente.');
      } else {
        throw new Error('No se pudo actualizar.');
      }
    } catch {
      showMsg('error', 'Error al guardar la configuración de WhatsApp.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateVerifyToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWhatsappVerifyToken(result);
    showMsg('success', 'Token de verificación generado. Recuerda guardar los cambios para aplicarlo.');
  };

  const handleCopyWebhook = () => {
    const url = `${window.location.origin}/api/webhooks/whatsapp`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Cargando configuración de WhatsApp...</p>
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Integración con WhatsApp</h1>
          <p className="text-sm text-zinc-500 mt-1">Vincula tu número de WhatsApp con la IA.</p>
        </div>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sin Empresa Asignada</h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                Tu usuario no está asociado a ninguna empresa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Configuración de WhatsApp</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Conecta tu chatbot a la API oficial de WhatsApp Cloud para automatizar tus chats.
          </p>
        </div>
        <Button onClick={loadEmpresaData} variant="ghost" size="sm">
          <RefreshCcw className="w-3.5 h-3.5" /> Recargar
        </Button>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-sm border flex items-center gap-2.5 animate-fade-in ${
          message.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Main Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/15 flex items-center justify-center text-green-400 shrink-0">
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Credenciales de Meta Cloud API</h2>
                  <p className="text-xs text-zinc-500">Configura la identidad del número que gestionará tu bot</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* Webhook Info */}
              <div className="p-4 bg-zinc-950/50 border border-zinc-800/80 rounded-xl space-y-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-300">URL del Webhook de WhatsApp</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Registra esta URL de Webhook en la sección de WhatsApp de tu panel de Meta Developers:
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : 'https://.../api/webhooks/whatsapp'}
                    className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-400 focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyWebhook}
                    className="px-4 py-2.5 text-xs h-[42px] shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-green-400 animate-fade-in" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedWebhook ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>

              {/* Phone ID */}
              <Input
                label="Phone Number ID (ID de Teléfono)"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
                placeholder="Ej: 104845582967119"
                helperText="ID numérico asignado por Meta a tu número de teléfono configurado."
              />
              
              {/* Verify Token - On its own row to ensure clean layout without clipping */}
              <div className="w-full space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Verify Token (Token de Verificación)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={whatsappVerifyToken}
                    onChange={(e) => setWhatsappVerifyToken(e.target.value)}
                    placeholder="Ej: mi_verify_token_secreto_123"
                    className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-yellow-400 focus:ring-yellow-400/10 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 transition-all duration-150 focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateVerifyToken}
                    className="px-4 py-2.5 text-xs h-[42px] shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Generar Token
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-500">Configura este mismo token en el webhook de Meta Developers para validar el enlace.</p>
              </div>

              {/* Permanent Access Token */}
              <Input
                label="Permanent Access Token (Token de Acceso)"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                placeholder="Escribe el Token de acceso permanente de Meta..."
                helperText="Token seguro generado en tu Business Manager con permisos de WhatsApp."
                type="password"
              />
            </CardContent>
          </Card>

          {/* Quick Guide */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-yellow-400 shrink-0">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Guía de Configuración Rápida</h2>
                  <p className="text-xs text-zinc-500">Sigue estos pasos en tu cuenta de Meta Developers</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-zinc-400 leading-relaxed">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-200 shrink-0 text-[10px]">1</div>
                <p>Crea una App del tipo <strong>Business</strong> o <strong>Otros</strong> en tu consola de Meta Developers y añade el producto <strong>WhatsApp</strong>.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-200 shrink-0 text-[10px]">2</div>
                <p>Copia la <strong>URL del Webhook</strong> de arriba y genera un <strong>Verify Token</strong>. Colócalos en la sección de Webhooks de Meta y haz clic en <i>Verificar y guardar</i>.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-200 shrink-0 text-[10px]">3</div>
                <p>En Meta, suscríbete al campo <strong>messages</strong> (dentro del webhook de WhatsApp) para que nuestro bot pueda recibir tus chats.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-200 shrink-0 text-[10px]">4</div>
                <p>Copia el <strong>Phone Number ID</strong> y pégalo arriba. Genera un <strong>Token de Acceso Permanente</strong> (System User) en tu Business Manager y colócalo en el campo del token.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Save Panel */}
        <div className="space-y-5">
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <h3 className="text-sm font-bold text-white">Seguridad y Datos</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Tu Token de Acceso se almacena de forma <strong>encriptada con cifrado AES-256-GCM</strong> utilizando una clave de seguridad privada del lado del servidor.
              </p>
              <div className="h-px bg-zinc-800" />
              
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Building2Icon className="w-4 h-4 text-zinc-500" />
                <span className="truncate">Empresa: {nombre}</span>
              </div>
              
              <Button type="submit" variant="primary" className="w-full" isLoading={isSaving}>
                <Save className="w-4 h-4" />
                Guardar Conexión
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Building2Icon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
