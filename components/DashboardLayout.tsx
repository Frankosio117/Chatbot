'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Settings, Play, Zap, Building2, Menu, X, LogOut, ChevronDown, Users2, Code2, MessageCircle } from 'lucide-react';
import { getEmpresas } from '@/lib/db';
import { signOut, getCurrentUser } from '@/lib/auth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  const [activeEmpresaId, setActiveEmpresaId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    async function init() {
      // Load user info
      const user = await getCurrentUser();
      if (user) setUserEmail(user.email || '');
      
      // Load companies
      const list = await getEmpresas();
      setEmpresas(list);
      const savedId = sessionStorage.getItem('saas_active_empresa_id');
      if (savedId && list.some((e) => e.id === savedId)) {
        setActiveEmpresaId(savedId);
      } else if (list.length > 0) {
        setActiveEmpresaId(list[0].id);
        sessionStorage.setItem('saas_active_empresa_id', list[0].id);
        window.dispatchEvent(new Event('active_company_changed'));
        router.refresh();
      } else {
        setActiveEmpresaId('');
        sessionStorage.removeItem('saas_active_empresa_id');
        window.dispatchEvent(new Event('active_company_changed'));
      }
    }
    init();
  }, []);

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setActiveEmpresaId(newId);
    sessionStorage.setItem('saas_active_empresa_id', newId);
    window.dispatchEvent(new Event('active_company_changed'));
    router.refresh();
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const activeEmpresa = empresas.find((e) => e.id === activeEmpresaId);

  const navItems = [
    { name: 'Configuración Bot', href: '/dashboard/settings', icon: Settings },
    { name: 'Integración WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle },
    { name: 'Playground', href: '/dashboard/playground', icon: Play },
    { name: 'Leads', href: '/dashboard/leads', icon: Users2 },
    { name: 'Integrar en mi Web', href: '/dashboard/embed', icon: Code2 },
  ];

  const userInitials = userEmail ? userEmail[0].toUpperCase() : 'U';

  const renderSidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-800 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center shadow-md shadow-yellow-400/20 shrink-0">
          <Zap className="w-4 h-4 text-zinc-950" strokeWidth={2.5} />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight text-white">AgentSaaS</span>
          <span className="block text-[10px] text-zinc-500 -mt-0.5 font-medium">Chatbots · IA</span>
        </div>
      </div>

      {/* Company Switcher */}
      <div className="p-4 border-b border-zinc-800 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
          <Building2 className="w-3 h-3" />
          Empresa activa
        </p>
        <div className="relative">
          <select
            value={activeEmpresaId}
            onChange={handleCompanyChange}
            className="w-full appearance-none bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-yellow-400 rounded-lg text-xs py-2 px-3 pr-8 font-medium text-zinc-100 focus:outline-none focus:ring-2 focus:ring-yellow-400/10 cursor-pointer transition-colors"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id} style={{ background: '#141414', color: '#f4f4f5' }}>
                {emp.nombre}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-3 pt-1 pb-2">
          Panel de control
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/15'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent'
              }`}
            >
              <item.icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-yellow-400' : 'text-zinc-500 group-hover:text-zinc-300'
                }`}
              />
              {item.name}
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer — User Info */}
      <div className="p-4 border-t border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-400 font-bold text-xs shrink-0">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-xs font-semibold text-zinc-100 truncate">
              {activeEmpresa?.nombre || 'Empresa'}
            </span>
            <span className="block text-[10px] text-zinc-500 truncate">{userEmail}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-zinc-600 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row text-zinc-100 font-sans">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-60 bg-zinc-950 border-r border-zinc-800 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden h-14 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 z-40 shrink-0 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-yellow-400 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-zinc-950" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sm text-white">AgentSaaS</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* MOBILE DRAWER */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        >
          <aside
            className="w-60 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
