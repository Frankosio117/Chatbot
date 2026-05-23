'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Input, Textarea } from '@/components/UI';
import {
  Building2, FileText, Upload, Save, CheckCircle, XCircle,
  RefreshCcw, Sparkles, Palette, Bot, Image as ImageIcon, Loader2
} from 'lucide-react';
import { getEmpresa, getEmpresas, createEmpresa } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const [empresaId, setEmpresaId] = useState<string>('');
  const [nombre, setNombre] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [infoNegocio, setInfoNegocio] = useState('');
  const [infoAdicional, setInfoAdicional] = useState('');

  // Bot identity
  const [botNombre, setBotNombre] = useState('Asistente Virtual');
  const [botAvatarUrl, setBotAvatarUrl] = useState('');
  const [botColorPrimario, setBotColorPrimario] = useState('#facc15');
  const [botColorSecundario, setBotColorSecundario] = useState('#09090b');
  // Catalog
  const [catalogoUrl, setCatalogoUrl] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCatalogo, setIsUploadingCatalogo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const catalogoInputRef = useRef<HTMLInputElement>(null);

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
          setLogoUrl(emp.logo_url || '');
          setInstrucciones(emp.instrucciones_bot || '');
          setInfoNegocio(emp.informacion_negocio || '');
          setBotNombre(emp.bot_nombre || 'Asistente Virtual');
          setBotAvatarUrl(emp.bot_avatar_url || '');
          setBotColorPrimario(emp.bot_color_primario || '#facc15');
          setBotColorSecundario(emp.bot_color_secundario || '#09090b');
          setCatalogoUrl(emp.catalogo_imagen_url || '');

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
            nombre,
            logo_url: logoUrl,
            instrucciones_bot: instrucciones,
            informacion_negocio: infoNegocio,
            bot_nombre: botNombre,
            bot_avatar_url: botAvatarUrl,
            bot_color_primario: botColorPrimario,
            bot_color_secundario: botColorSecundario,
            catalogo_imagen_url: catalogoUrl,

          }
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar');
      }

      const resData = await response.json();
      if (resData.success) {
        showMsg('success', 'Configuración guardada correctamente.');
        window.dispatchEvent(new Event('company_settings_saved'));
      } else {
        throw new Error('No se pudo actualizar.');
      }
    } catch {
      showMsg('error', 'Error al guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddInfoAdicional = () => {
    if (!infoAdicional.trim()) return;

    const fechaStr = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const divider = '\n\n=========================================\n' +
                    `INFORMACIÓN ADICIONAL (${fechaStr})\n` +
                    '=========================================\n';

    setInfoNegocio((prev) => {
      const base = prev.trim();
      return base ? `${base}${divider}${infoAdicional.trim()}` : infoAdicional.trim();
    });

    setInfoAdicional('');
    showMsg('success', 'Información adicional agregada. Guarda los cambios para aplicar permanentemente.');
  };



  // Upload image to Supabase Storage
  const uploadImage = async (file: File, folder: 'avatar' | 'catalogo'): Promise<string | null> => {
    if (!supabase) return null;
    const ext = file.name.split('.').pop();
    const path = `${empresaId}/${folder}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('empresa-assets')
      .upload(path, file, { upsert: true });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('empresa-assets')
      .getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadImage(file, 'avatar');
      if (url) {
        setBotAvatarUrl(url);
        showMsg('success', 'Foto del bot subida. Guarda los cambios para aplicarla.');
      }
    } catch {
      showMsg('error', 'Error al subir la imagen. Verifica que el bucket "empresa-assets" existe en Supabase Storage.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleCatalogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;
    setIsUploadingCatalogo(true);
    try {
      const url = await uploadImage(file, 'catalogo');
      if (url) {
        setCatalogoUrl(url);
        showMsg('success', 'Imagen del catálogo subida. Guarda los cambios para aplicarla.');
      }
    } catch {
      showMsg('error', 'Error al subir la imagen. Verifica que el bucket "empresa-assets" existe en Supabase Storage.');
    } finally {
      setIsUploadingCatalogo(false);
      if (catalogoInputRef.current) catalogoInputRef.current.value = '';
    }
  };

  const handleInfoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'md') {
      showMsg('error', 'Solo se aceptan archivos .txt o .md');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setInfoNegocio((prev) => prev + (prev.trim() ? '\n\n--- TEXTO IMPORTADO ---\n' : '') + text);
        showMsg('success', `Archivo "${file.name}" importado.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Cargando configuración...</p>
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Configuración del Bot</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Define la identidad, instrucciones y base de conocimiento de tu agente.
            </p>
          </div>
          <Button onClick={loadEmpresaData} variant="ghost" size="sm">
            <RefreshCcw className="w-3.5 h-3.5" /> Recargar
          </Button>
        </div>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sin Empresa Asignada</h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                Tu usuario no está asociado a ninguna empresa en la plataforma.
                Por favor, solicita a un administrador que asocie tu cuenta a una empresa.
              </p>
            </div>
            <Button onClick={loadEmpresaData} variant="ghost" size="sm" className="mt-2 border border-zinc-800 hover:bg-zinc-900">
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Reintentar
            </Button>
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Configuración del Bot</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Define la identidad, instrucciones y base de conocimiento de tu agente.
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

          {/* ── IDENTIDAD DEL NEGOCIO ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-yellow-400 shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Identidad del Negocio</h2>
                  <p className="text-xs text-zinc-500">Nombre, logo y datos básicos</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nombre de la Empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Spa Relax" required />
                <Input label="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://ejemplo.com/logo.png" helperText="URL pública de tu imagen de logo." />
              </div>
            </CardContent>
          </Card>

          {/* ── IDENTIDAD VISUAL DEL BOT ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-yellow-400 shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Identidad Visual del Bot</h2>
                  <p className="text-xs text-zinc-500">Nombre, foto y colores de marca</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* Bot name + avatar */}
              <div className="flex items-center gap-4">
                {/* Avatar preview */}
                <div className="shrink-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-zinc-700 flex items-center justify-center bg-zinc-950 relative">
                    {botAvatarUrl ? (
                      <img src={botAvatarUrl} alt="Bot avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="w-7 h-7 text-zinc-600" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="mt-1.5 w-full text-[10px] font-semibold text-zinc-500 hover:text-yellow-400 transition-colors text-center flex items-center justify-center gap-1"
                  >
                    {isUploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {isUploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </div>

                <div className="flex-1 space-y-3">
                  <Input
                    label="Nombre del Bot"
                    value={botNombre}
                    onChange={(e) => setBotNombre(e.target.value)}
                    placeholder="Ej. Asistente Virtual, Luna, Max..."
                    helperText="Con este nombre se presentará el chatbot."
                  />
                  {botAvatarUrl && (
                    <button type="button" onClick={() => setBotAvatarUrl('')} className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors">
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>

              {/* Color pickers */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-3.5 h-3.5 text-zinc-500" />
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Colores del Chat</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Color Principal (botón y burbujas)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={botColorPrimario}
                          onChange={(e) => setBotColorPrimario(e.target.value)}
                          className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-zinc-200">{botColorPrimario}</p>
                        <div className="h-2 w-28 rounded-full mt-1" style={{ background: botColorPrimario }} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Color de Fondo del Chat
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={botColorSecundario}
                          onChange={(e) => setBotColorSecundario(e.target.value)}
                          className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent p-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-zinc-200">{botColorSecundario}</p>
                        <div className="h-2 w-28 rounded-full mt-1" style={{ background: botColorSecundario }} />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Live preview mini */}
                <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <p className="text-[10px] text-zinc-600 mb-2 uppercase tracking-wider font-semibold">Vista previa del botón flotante</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md" style={{ background: botColorPrimario }}>
                      <MessageSquareIcon color={botColorPrimario} />
                    </div>
                    <div className="flex-1 h-2 rounded-full" style={{ background: botColorSecundario, border: '1px solid rgba(255,255,255,0.1)' }} />
                    <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ background: botColorPrimario, color: getContrast(botColorPrimario) }}>
                      IA
                    </div>
                  </div>
                </div>
              </div>

              {/* Bot personality */}
              <Textarea
                label="Instrucciones del Bot (Personalidad)"
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                placeholder="Ej. Eres un asistente alegre y servicial de la empresa..."
                rows={4}
                helperText="Define el tono, saludo y rasgos de personalidad del agente."
                required
              />
            </CardContent>
          </Card>

          {/* ── BASE DE CONOCIMIENTO ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-yellow-400 shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Base de Conocimiento</h2>
                  <p className="text-xs text-zinc-500">Información que usará el bot para responder</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Catalogo upload */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-yellow-400" />
                  <p className="text-xs font-semibold text-zinc-300">Menú / Catálogo / Lista de Productos</p>
                </div>
                <p className="text-[11px] text-zinc-500">Sube una imagen de tu menú o catálogo. El bot puede referenciarla cuando el cliente pregunte por productos.</p>
                
                {catalogoUrl ? (
                  <div className="relative group">
                    <img src={catalogoUrl} alt="Catálogo" className="w-full max-h-40 object-cover rounded-lg border border-zinc-700" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => catalogoInputRef.current?.click()}
                        disabled={isUploadingCatalogo}
                        className="px-3 py-1.5 bg-yellow-400 text-zinc-950 rounded-lg text-xs font-semibold"
                      >
                        {isUploadingCatalogo ? 'Subiendo...' : 'Cambiar imagen'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCatalogoUrl('')}
                        className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-semibold"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => catalogoInputRef.current?.click()}
                    disabled={isUploadingCatalogo}
                    className="w-full py-6 border-2 border-dashed border-zinc-700 hover:border-yellow-400/50 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors group"
                  >
                    {isUploadingCatalogo ? (
                      <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 text-zinc-600 group-hover:text-yellow-400 transition-colors" />
                    )}
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      {isUploadingCatalogo ? 'Subiendo imagen...' : 'Haz click para subir imagen del catálogo'}
                    </span>
                  </button>
                )}
                <input ref={catalogoInputRef} type="file" accept="image/*" onChange={handleCatalogoUpload} className="hidden" />
              </div>

              {/* Text import */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div>
                  <p className="text-xs font-semibold text-zinc-300">Importar texto desde archivo</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Sube archivos .txt o .md para añadir contenido.</p>
                </div>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg transition-colors shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  Seleccionar Archivo
                  <input type="file" accept=".txt,.md" onChange={handleInfoFileUpload} className="hidden" />
                </label>
              </div>

              {/* Agregar información adicional */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <div className="space-y-0.5">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Agregar Información Adicional
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Anexa información rápida al final de la base de conocimiento sin tener que desplazarte por todo el documento.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1">
                    <Textarea
                      value={infoAdicional}
                      onChange={(e) => setInfoAdicional(e.target.value)}
                      placeholder="Ej: Nuevo servicio a domicilio los domingos de 10:00 AM a 2:00 PM."
                      rows={2}
                      className="min-h-[60px]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleAddInfoAdicional}
                    disabled={!infoAdicional.trim()}
                    className="sm:self-end px-5 py-2.5 h-[42px] shrink-0"
                  >
                    Agregar
                  </Button>
                </div>
              </div>

              <Textarea
                label="Información del Negocio (Texto base)"
                value={infoNegocio}
                onChange={(e) => setInfoNegocio(e.target.value)}
                placeholder="Servicios, precios, horarios, políticas, ubicación..."
                rows={14}
                helperText="IMPORTANTE: El bot usará ÚNICAMENTE esta información. Si no está aquí, no lo inventará."
                required
              />
            </CardContent>
          </Card>


        </div>

        {/* Right — Save Panel */}
        <div className="space-y-5">
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-bold text-white">Guardar Cambios</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Guarda tu configuración antes de probar el bot en el Playground.
              </p>
              <div className="h-px bg-zinc-800" />
              
              {/* Color preview badge */}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full" style={{ background: botColorPrimario }} />
                <div className="w-5 h-5 rounded-full border border-zinc-700" style={{ background: botColorSecundario }} />
                <span className="text-[11px] text-zinc-500 ml-1 truncate">{botNombre}</span>
              </div>
              
              <Button type="submit" variant="primary" className="w-full" isLoading={isSaving}>
                <Save className="w-4 h-4" />
                Guardar Configuración
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

// Mini helper components
function MessageSquareIcon({ color }: { color: string }) {
  const contrast = getContrast(color);
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={contrast} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function getContrast(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '#000000';
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#09090b' : '#f4f4f5';
}
