'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Input, Select, Badge } from '@/components/UI';
import { Shield, Zap, Building2, Users, MessageSquare, Key, Save, Plus, ArrowRight, UserPlus, Home, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { 
  getEmpresas, 
  getPerfiles, 
  getUsuariosEmpresa, 
  createEmpresa, 
  vincularUsuarioEmpresa, 
  getGlobalLLMConfig, 
  updateGlobalLLMConfig, 
  getTotalMensajesCount,
  Empresa,
  Perfil,
  UsuarioEmpresa,
  ConfigLLM
} from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export default function SuperAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'resumen' | 'empresas' | 'usuarios' | 'llm'>('resumen');

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  // Datos del SaaS
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [vinculos, setVinculos] = useState<UsuarioEmpresa[]>([]);
  const [llmConfig, setLlmConfig] = useState<ConfigLLM | null>(null);
  
  // Contadores
  const [totalMensajes, setTotalMensajes] = useState(0);

  // Formulario Nueva Empresa
  const [nuevaEmpresaNombre, setNuevaEmpresaNombre] = useState('');
  
  // Formulario Vínculo Usuario-Empresa
  const [vinculoUserId, setVinculoUserId] = useState('');
  const [vinculoEmpresaId, setVinculoEmpresaId] = useState('');

  // Formulario Nuevo Usuario
  const [nuevoUsuarioEmail, setNuevoUsuarioEmail] = useState('');
  const [nuevoUsuarioPassword, setNuevoUsuarioPassword] = useState('');
  const [nuevoUsuarioRol, setNuevoUsuarioRol] = useState<'user' | 'super_admin'>('user');
  const [nuevoUsuarioEmpresaId, setNuevoUsuarioEmpresaId] = useState('');
  const [isCreatingUsuario, setIsCreatingUsuario] = useState(false);

  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [llmProveedor, setLlmProveedor] = useState<'openai' | 'anthropic' | 'deepseek' | 'google'>('openai');
  const [llmModelo, setLlmModelo] = useState('gpt-4o-mini');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmTemperatura, setLlmTemperatura] = useState(0.3);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLLM, setIsSavingLLM] = useState(false);
  const [isCreatingEmpresa, setIsCreatingEmpresa] = useState(false);
  const [isVincular, setIsVincular] = useState(false);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const emps = await getEmpresas();
      const usrs = await getPerfiles();
      const vincs = await getUsuariosEmpresa();
      const cfg = await getGlobalLLMConfig();

      setEmpresas(emps);
      setUsuarios(usrs);
      setVinculos(vincs);
      setLlmConfig(cfg);

      // Cargar formularios con valores activos
      if (cfg) {
        setLlmProveedor(cfg.proveedor);
        setLlmModelo(cfg.modelo_nombre);
        setLlmTemperatura(cfg.temperatura);
        setLlmApiKey(''); // No mostramos la API key real
      }

      // Obtener el conteo real de mensajes procesados desde Supabase
      const msgCount = await getTotalMensajesCount();
      setTotalMensajes(msgCount);

      // Inicializar selectors
      if (usrs.length > 0) setVinculoUserId(usrs[0].id);
      if (emps.length > 0) {
        setVinculoEmpresaId(emps[0].id);
        setNuevoUsuarioEmpresaId(emps[0].id);
      }

    } catch (error) {
      console.error('Error cargando super-admin:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      loadAllData();
    }, 0);
  }, [loadAllData]);

  // Cambiar modelo por defecto al cambiar de proveedor
  const handleProveedorChange = (val: 'openai' | 'anthropic' | 'deepseek' | 'google') => {
    setLlmProveedor(val);
    if (val === 'google') {
      setLlmModelo('gemini-3.1-flash-lite');
    } else if (val === 'openai') {
      setLlmModelo('gpt-4o-mini');
    } else if (val === 'anthropic') {
      setLlmModelo('claude-3-5-sonnet');
    } else if (val === 'deepseek') {
      setLlmModelo('deepseek-chat');
    }
  };


  // Guardar configuración del LLM
  const handleSaveLLM = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLLM(true);
    setAlertMsg(null);

    try {
      const updates: Partial<Omit<ConfigLLM, 'id'>> = {
        proveedor: llmProveedor,
        modelo_nombre: llmModelo,
        temperatura: Number(llmTemperatura)
      };

      // Si el Super Admin escribió una nueva API Key, la encriptamos antes de guardar
      if (llmApiKey.trim() !== '') {
        updates.api_key_encriptada = encrypt(llmApiKey.trim());
      }

      await updateGlobalLLMConfig(updates);
      setAlertMsg({ type: 'success', text: 'Configuración global del LLM actualizada correctamente.' });
      setLlmApiKey(''); // Limpiar campo
    } catch (err) {
      console.error('Error al guardar LLM:', err);
      setAlertMsg({ type: 'error', text: 'Ocurrió un error al guardar la configuración del LLM.' });
    } finally {
      setIsSavingLLM(false);
      setTimeout(() => setAlertMsg(null), 4000);
    }
  };

  // Dar de alta nueva empresa
  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaEmpresaNombre.trim()) return;

    setIsCreatingEmpresa(true);
    try {
      const newEmp = await createEmpresa(nuevaEmpresaNombre.trim());
      setEmpresas((prev) => [newEmp, ...prev]);
      setNuevaEmpresaNombre('');
      
      // Actualizar selectors
      if (!vinculoEmpresaId) setVinculoEmpresaId(newEmp.id);
      
      setAlertMsg({ type: 'success', text: `Empresa "${newEmp.nombre}" registrada correctamente.` });
    } catch (err) {
      console.error('Error al crear empresa:', err);
      setAlertMsg({ type: 'error', text: 'Error al registrar la empresa.' });
    } finally {
      setIsCreatingEmpresa(false);
      setTimeout(() => setAlertMsg(null), 4000);
    }
  };

  // Registrar nuevo usuario y vincular a empresa
  const handleCreateUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUsuarioEmail.trim() || !nuevoUsuarioPassword.trim()) return;

    setIsCreatingUsuario(true);
    setAlertMsg(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: nuevoUsuarioEmail.trim(),
          password: nuevoUsuarioPassword.trim(),
          rol: nuevoUsuarioRol,
          empresaId: nuevoUsuarioRol === 'user' ? nuevoUsuarioEmpresaId : undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al registrar el usuario');
      }

      if (result.warning) {
        setAlertMsg({ type: 'error', text: result.warning });
      } else {
        setAlertMsg({ type: 'success', text: `Usuario "${nuevoUsuarioEmail}" registrado exitosamente.` });
      }

      // Reset
      setNuevoUsuarioEmail('');
      setNuevoUsuarioPassword('');
      setNuevoUsuarioRol('user');
      
      // Recargar datos
      await loadAllData();

    } catch (err) {
      const errorObj = err as Error;
      console.error('Error al crear usuario:', errorObj);
      setAlertMsg({ type: 'error', text: errorObj.message || 'Error al registrar el usuario.' });
    } finally {
      setIsCreatingUsuario(false);
      setTimeout(() => setAlertMsg(null), 4000);
    }
  };

  // Vincular usuario administrador a empresa
  const handleVincularUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vinculoUserId || !vinculoEmpresaId) return;

    setIsVincular(true);
    try {
      // Verificar si ya existe el vínculo
      const yaExiste = vinculos.some(
        (v) => v.user_id === vinculoUserId && v.empresa_id === vinculoEmpresaId
      );

      if (yaExiste) {
        setAlertMsg({ type: 'error', text: 'Este usuario ya está vinculado a esa empresa.' });
        setIsVincular(false);
        return;
      }

      const newLink = await vincularUsuarioEmpresa(vinculoUserId, vinculoEmpresaId);
      setVinculos((prev) => [...prev, newLink]);
      setAlertMsg({ type: 'success', text: 'Usuario vinculado a la empresa correctamente.' });
    } catch (err) {
      console.error('Error al vincular usuario:', err);
      setAlertMsg({ type: 'error', text: 'Error al vincular el usuario.' });
    } finally {
      setIsVincular(false);
      setTimeout(() => setAlertMsg(null), 4000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Cargando Panel de Control...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center text-zinc-950 shadow-md shadow-yellow-400/20 shrink-0">
            <Shield className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Panel Super Admin</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Gestiona tenants, usuarios y configuración global del LLM.
            </p>
          </div>
        </div>
        
        {/* Navigation & Logout Buttons */}
        <div className="flex items-center gap-2.5">
          <Link href="/">
            <Button variant="ghost" size="sm" className="border border-zinc-800 hover:bg-zinc-900 text-zinc-300">
              <Home className="w-4 h-4 mr-1.5" />
              Ir al Inicio
            </Button>
          </Link>
          <Button 
            onClick={handleLogout}
            variant="ghost" 
            size="sm" 
            className="border border-rose-950 hover:bg-rose-950/20 text-rose-400 hover:text-rose-300"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {alertMsg && (
        <div
          className={`p-3.5 rounded-xl text-sm border flex items-center gap-2.5 animate-fade-in ${
            alertMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800 overflow-x-auto scrollbar-none gap-2 pb-px">
        {[
          { id: 'resumen', label: 'Resumen Global', icon: Shield },
          { id: 'empresas', label: 'Empresas / Tenants', icon: Building2 },
          { id: 'usuarios', label: 'Usuarios / Accesos', icon: Users },
          { id: 'llm', label: 'Configuración LLM', icon: Key },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all duration-200 shrink-0 -mb-[2px] rounded-t-xl ${
                isActive
                  ? 'border-yellow-400 text-yellow-400 bg-yellow-400/5 font-bold shadow-sm'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'resumen' && (
        <div className="space-y-6 animate-fade-in">
          {/* METRICAS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/15 text-yellow-400 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Empresas</span>
                <span className="text-xl font-bold text-white">{empresas.length}</span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/15 text-yellow-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Usuarios</span>
                <span className="text-xl font-bold text-white">{usuarios.length}</span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/15 text-yellow-400 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Mensajes</span>
                <span className="text-xl font-bold text-white">{totalMensajes}</span>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/15 text-yellow-400 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Proveedor IA</span>
                <span className="text-xs font-bold text-white capitalize flex items-center gap-1 mt-0.5">
                  {llmConfig?.proveedor} <Badge variant="yellow">{llmConfig?.modelo_nombre}</Badge>
                </span>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Estado del Sistema Global
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La plataforma AgentSaaS está operando con normalidad. Los chatbots integrados de todos los tenants se comunican directamente con el LLM centralizado utilizando las credenciales globales provistas.
              </p>
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Proveedor de IA Activo:</span>
                  <span className="font-semibold text-white capitalize">{llmConfig?.proveedor || 'No configurado'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Modelo Centralizado:</span>
                  <span className="font-semibold text-yellow-400">{llmConfig?.modelo_nombre || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Temperatura del Modelo:</span>
                  <span className="font-mono text-zinc-300">{llmConfig?.temperatura ?? '0.3'}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-yellow-400" />
                Accesos Directos Administrativos
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Utiliza las pestañas superiores para navegar o realiza operaciones comunes de forma inmediata desde aquí:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('empresas')}
                  className="p-3 text-left border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 rounded-xl transition-all"
                >
                  <span className="block text-xs font-bold text-white">Registrar Empresa</span>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Crear nuevos tenants</span>
                </button>
                <button
                  onClick={() => setActiveTab('usuarios')}
                  className="p-3 text-left border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 rounded-xl transition-all"
                >
                  <span className="block text-xs font-bold text-white">Nuevo Usuario</span>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Añadir administradores</span>
                </button>
                <button
                  onClick={() => setActiveTab('llm')}
                  className="p-3 text-left border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 rounded-xl transition-all"
                >
                  <span className="block text-xs font-bold text-white">Ajustar LLM</span>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Cambiar modelos o API Keys</span>
                </button>
                <button
                  onClick={() => setActiveTab('empresas')}
                  className="p-3 text-left border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 rounded-xl transition-all"
                >
                  <span className="block text-xs font-bold text-white">Vincular Cuentas</span>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Asociar usuario y empresa</span>
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'empresas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* COLUMNA IZQUIERDA: GESTIÓN DE CLIENTES / EMPRESAS (Ancho: 2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabla de Empresas */}
            <Card>
              <CardHeader>
                <h2 className="font-bold text-zinc-100">Empresas Registradas (Tenants)</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Listado general de negocios registrados en la plataforma.</p>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50 border-y border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      <th className="p-4">Nombre del Negocio</th>
                      <th className="p-4">ID / Referencia</th>
                      <th className="p-4">Administradores Vinculados</th>
                      <th className="p-4">Fecha Alta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-xs">
                    {empresas.map((emp) => {
                      const admins = vinculos
                        .filter((v) => v.empresa_id === emp.id)
                        .map((v) => {
                          const usr = usuarios.find((u) => u.id === v.user_id);
                          return usr ? usr.email : 'Usuario Desconocido';
                        });

                      return (
                        <tr key={emp.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4 font-bold text-zinc-100">{emp.nombre}</td>
                          <td className="p-4 font-mono text-[10px] text-zinc-500">{emp.id}</td>
                          <td className="p-4">
                            {admins.length === 0 ? (
                              <span className="text-[10px] text-rose-400 font-medium">Sin administrador</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {admins.map((email, idx) => (
                                  <Badge key={idx} variant="zinc">{email}</Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-zinc-450">
                            {new Date(emp.fecha_creacion).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Vinculación de Cuentas */}
            <Card>
              <CardHeader className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-100">Vincular Cuenta de Administrador</h3>
                  <p className="text-xs text-zinc-400">Asigna accesos de administración local a un usuario.</p>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVincularUsuario} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <Select
                      label="Seleccionar Usuario"
                      value={vinculoUserId}
                      onChange={(e) => setVinculoUserId(e.target.value)}
                      options={usuarios.map((u) => ({ value: u.id, label: `${u.email} (${u.rol})` }))}
                    />
                  </div>
                  <div className="hidden sm:flex items-center justify-center h-[42px] text-zinc-500 shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="flex-1 w-full">
                    <Select
                      label="Seleccionar Empresa"
                      value={vinculoEmpresaId}
                      onChange={(e) => setVinculoEmpresaId(e.target.value)}
                      options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full sm:w-auto h-[42px] px-5"
                    isLoading={isVincular}
                  >
                    Vincular
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* COLUMNA DERECHA: REGISTRO DE EMPRESA (Ancho: 1/3) */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-yellow-400" />
                <h3 className="font-bold text-sm text-zinc-100">Nueva Empresa</h3>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEmpresa} className="space-y-4">
                  <Input
                    label="Nombre de la Empresa"
                    value={nuevaEmpresaNombre}
                    onChange={(e) => setNuevaEmpresaNombre(e.target.value)}
                    placeholder="Ej. Spa Relax"
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    isLoading={isCreatingEmpresa}
                  >
                    Registrar Empresa
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'usuarios' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* COLUMNA IZQUIERDA: LISTADO DE USUARIOS (Ancho: 2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-bold text-zinc-100">Usuarios Registrados</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Listado de cuentas y roles configurados en la plataforma.</p>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50 border-y border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      <th className="p-4">Correo Electrónico</th>
                      <th className="p-4">Rol</th>
                      <th className="p-4">Empresa Asignada</th>
                      <th className="p-4">Fecha Creación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-xs">
                    {usuarios.map((usr) => {
                      const userLinkedEmps = vinculos
                        .filter((v) => v.user_id === usr.id)
                        .map((v) => {
                          const emp = empresas.find((e) => e.id === v.empresa_id);
                          return emp ? emp.nombre : 'Desconocido';
                        });

                      return (
                        <tr key={usr.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4 font-bold text-zinc-100">{usr.email}</td>
                          <td className="p-4">
                            <Badge variant={usr.rol === 'super_admin' ? 'yellow' : 'zinc'}>
                              {usr.rol === 'super_admin' ? 'Super Admin' : 'Admin Local'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            {usr.rol === 'super_admin' ? (
                              <span className="text-[10px] text-zinc-500 italic">Acceso Global</span>
                            ) : userLinkedEmps.length === 0 ? (
                              <span className="text-[10px] text-rose-400 font-medium">Sin vincular</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {userLinkedEmps.map((name, idx) => (
                                  <Badge key={idx} variant="indigo">{name}</Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-zinc-400">
                            {usr.fecha_creacion ? new Date(usr.fecha_creacion).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* COLUMNA DERECHA: REGISTRO DE USUARIO (Ancho: 1/3) */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-yellow-400" />
                <h3 className="font-bold text-sm text-zinc-100">Nuevo Usuario</h3>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUsuario} className="space-y-4">
                  <Input
                    label="Correo Electrónico"
                    type="email"
                    value={nuevoUsuarioEmail}
                    onChange={(e) => setNuevoUsuarioEmail(e.target.value)}
                    placeholder="ejemplo@negocio.com"
                    required
                  />
                  
                  <Input
                    label="Contraseña"
                    type="password"
                    value={nuevoUsuarioPassword}
                    onChange={(e) => setNuevoUsuarioPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                  />

                  <Select
                    label="Rol de Usuario"
                    value={nuevoUsuarioRol}
                    onChange={(e) => setNuevoUsuarioRol(e.target.value as 'user' | 'super_admin')}
                    options={[
                      { value: 'user', label: 'Administrador Local (User)' },
                      { value: 'super_admin', label: 'Super Administrador (Global)' }
                    ]}
                  />

                  {nuevoUsuarioRol === 'user' && (
                    <Select
                      label="Vincular a Empresa"
                      value={nuevoUsuarioEmpresaId}
                      onChange={(e) => setNuevoUsuarioEmpresaId(e.target.value)}
                      options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
                      helperText="El usuario tendrá permisos de acceso únicamente sobre esta empresa."
                    />
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    isLoading={isCreatingUsuario}
                  >
                    Registrar Usuario
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'llm' && (
        <div className="max-w-2xl mx-auto animate-fade-in">
          {/* Configuración del LLM Centralizado */}
          <Card>
            <CardHeader className="flex items-center gap-2.5 bg-zinc-950/40 border-b border-zinc-800">
              <Key className="w-4 h-4 text-yellow-400" />
              <div>
                <h3 className="font-bold text-sm text-zinc-100">LLM Centralizado</h3>
                <span className="text-[10px] text-zinc-400">Credenciales del SaaS global</span>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveLLM} className="space-y-4">
                <Select
                  label="Proveedor de IA"
                  value={llmProveedor}
                  onChange={(e) => handleProveedorChange(e.target.value as 'openai' | 'anthropic' | 'deepseek' | 'google')}
                  options={[
                    { value: 'openai', label: 'OpenAI (GPT Models)' },
                    { value: 'anthropic', label: 'Anthropic (Claude Models)' },
                    { value: 'deepseek', label: 'DeepSeek (Chat & Coder)' },
                    { value: 'google', label: 'Google AI Studio (Gemini)' }
                  ]}
                />

                <Input
                  label="Nombre del Modelo"
                  value={llmModelo}
                  onChange={(e) => setLlmModelo(e.target.value)}
                  placeholder="ej. gpt-4o-mini"
                  required
                />

                <Input
                  label="API Key Centralizada"
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  helperText="Deja en blanco para conservar la API Key actual."
                />

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-medium text-zinc-400">Temperatura</label>
                    <span className="font-mono text-yellow-400 font-semibold">{llmTemperatura}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={llmTemperatura}
                    onChange={(e) => setLlmTemperatura(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-yellow-400"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full flex items-center justify-center gap-2 mt-2"
                  isLoading={isSavingLLM}
                >
                  <Save className="w-4 h-4" />
                  Guardar Configuración
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}

// Icono auxiliar no importado en UI
function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
