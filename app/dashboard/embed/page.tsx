'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button } from '@/components/UI';
import { Code2, Copy, CheckCircle, ExternalLink, Smartphone, Monitor, Zap } from 'lucide-react';
import { getEmpresas, getEmpresa, createEmpresa } from '@/lib/db';

export default function EmbedPage() {
  const [empresaId, setEmpresaId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'script' | 'iframe'>('script');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      // Usar la URL de producción para garantizar que la integración externa no dependa de URLs de vista previa
      setBaseUrl('https://chatbot-tau-jet-49.vercel.app');
    }, 0);

    async function loadEmpresa() {
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

        if (activeId) {
          const emp = await getEmpresa(activeId);
          if (emp) {
            setEmpresaId(activeId);
          } else {
            setEmpresaId('');
          }
        } else {
          setEmpresaId('');
        }
      } catch (err) {
        console.error('Error en loadEmpresa:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadEmpresa();

    const handleChange = () => loadEmpresa();
    window.addEventListener('active_company_changed', handleChange);
    return () => window.removeEventListener('active_company_changed', handleChange);
  }, []);

  const embedUrl = empresaId ? `${baseUrl}/embed/${empresaId}` : '';
  
  const scriptCode = empresaId
    ? `<!-- AgentSaaS Chatbot Widget (Recomendado) -->
<script>
  (function() {
    var empresaId = "${empresaId}";
    var baseUrl = "${baseUrl || 'https://tu-dominio.com'}";
    var id = "agentsaas-widget-" + empresaId;
    if (document.getElementById(id)) return;

    var iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.src = baseUrl + '/embed/' + empresaId;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.width = '80px';
    iframe.style.height = '80px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    iframe.style.background = 'transparent';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('allow', 'microphone');
    iframe.setAttribute('title', 'Chat de soporte');
    
    document.body.appendChild(iframe);

    window.addEventListener('message', function(event) {
      if (event.origin !== baseUrl && event.origin.indexOf('chatbot-tau-jet-49.vercel.app') === -1) return;
      if (event.data === 'chat-open') {
        if (window.innerWidth < 640) {
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.bottom = '0';
          iframe.style.right = '0';
        } else {
          iframe.style.width = '400px';
          iframe.style.height = '620px';
          iframe.style.bottom = '20px';
          iframe.style.right = '20px';
        }
      } else if (event.data === 'chat-close') {
        iframe.style.width = '80px';
        iframe.style.height = '80px';
        iframe.style.bottom = '20px';
        iframe.style.right = '20px';
      }
    });
  })();
</script>
<!-- Fin AgentSaaS Widget -->`
    : '<!-- Cargando... -->';

  const iframeCode = empresaId
    ? `<!-- AgentSaaS Chatbot Widget (Estático) -->
<iframe
  src="${embedUrl}"
  style="position:fixed;bottom:20px;right:20px;width:400px;height:620px;border:none;z-index:999999;background:transparent;"
  allowtransparency="true"
  allow="microphone"
  title="Chat de soporte"
></iframe>
<!-- Fin AgentSaaS Widget -->`
    : '<!-- Cargando... -->';

  const handleCopyScript = async () => {
    await navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyIframe = async () => {
    await navigator.clipboard.writeText(iframeCode);
    setCopiedIframe(true);
    setTimeout(() => setCopiedIframe(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Cargando integración...</p>
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Integrar en tu Sitio Web</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Copia el código y pégalo en el HTML de tu sitio web. El chatbot aparecerá automáticamente.
          </p>
        </div>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sin Empresa Asignada</h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                No se puede generar el código de integración porque tu usuario no tiene una empresa asignada.
                Por favor, solicita a tu administrador que asocie tu cuenta a una empresa.
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
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Integrar en tu Sitio Web</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Copia el código y pégalo en el HTML de tu sitio web. El chatbot aparecerá automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left — Code */}
        <div className="space-y-4">
          {/* Step 1 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-zinc-950 font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Copia el código del widget</h2>
                    <p className="text-xs text-zinc-500">Selecciona el método de integración</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                <button
                  onClick={() => setActiveTab('script')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'script'
                      ? 'bg-yellow-400 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🚀 Script Inteligente (Recomendado)
                </button>
                <button
                  onClick={() => setActiveTab('iframe')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'iframe'
                      ? 'bg-yellow-400 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  📦 Iframe Estático
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeTab === 'script' ? (
                <>
                  <div className="relative">
                    <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-[10px] text-zinc-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
                      {scriptCode}
                    </pre>
                    <button
                      onClick={handleCopyScript}
                      className={`absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        copiedScript
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {copiedScript ? (
                        <><CheckCircle className="w-3 h-3" />Copiado!</>
                      ) : (
                        <><Copy className="w-3 h-3" />Copiar</>
                      )}
                    </button>
                  </div>
                  
                  <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-400 leading-relaxed">
                    💡 <strong>¿Por qué usar el script?</strong> Ajusta dinámicamente el tamaño de la ventana de chat y evita bloquear las interacciones o clics en el fondo de tu sitio web cuando el chat está cerrado.
                  </div>

                  <Button onClick={handleCopyScript} variant="primary" className="w-full" size="sm">
                    <Copy className="w-4 h-4" />
                    {copiedScript ? '¡Código copiado!' : 'Copiar Script Inteligente'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="relative">
                    <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-[10px] text-zinc-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
                      {iframeCode}
                    </pre>
                    <button
                      onClick={handleCopyIframe}
                      className={`absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        copiedIframe
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {copiedIframe ? (
                        <><CheckCircle className="w-3 h-3" />Copiado!</>
                      ) : (
                        <><Copy className="w-3 h-3" />Copiar</>
                      )}
                    </button>
                  </div>

                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-400 leading-relaxed">
                    ⚠️ <strong>Nota:</strong> El iframe estático tiene un tamaño fijo de 400x620px. Puede impedir hacer clic en los elementos que queden detrás de él en la esquina inferior derecha de tu sitio web, incluso si el chat está cerrado.
                  </div>

                  <Button onClick={handleCopyIframe} variant="primary" className="w-full" size="sm">
                    <Copy className="w-4 h-4" />
                    {copiedIframe ? '¡Código copiado!' : 'Copiar Iframe Estático'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-zinc-950 font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Pégalo antes de <code className="text-yellow-400">&lt;/body&gt;</code></h2>
                  <p className="text-xs text-zinc-500">En cualquier página de tu sitio web</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-400 leading-relaxed">
                <div className="text-zinc-600">&lt;!-- Tu sitio web --&gt;</div>
                <div className="text-zinc-400 mt-1">&lt;html&gt;</div>
                <div className="text-zinc-400 ml-2">&lt;body&gt;</div>
                <div className="text-zinc-600 ml-4">... tu contenido ...</div>
                <div className="ml-4 mt-2">
                  <span className="text-yellow-400/80">&lt;!-- Pega el código aquí --&gt;</span>
                </div>
                <div className="text-zinc-400 ml-2">&lt;/body&gt;</div>
                <div className="text-zinc-400">&lt;/html&gt;</div>
              </div>
            </CardContent>
          </Card>

          {/* Direct link */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">URL directa del chat</h2>
                  <p className="text-xs text-zinc-500">Para abrir o compartir el chat solo</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-400 truncate">
                  {embedUrl || 'Cargando...'}
                </div>
                {embedUrl && (
                  <a
                    href={embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 text-zinc-300 transition-colors shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-300">Vista previa del widget</p>
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  previewMode === 'desktop' ? 'bg-yellow-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Monitor className="w-3 h-3" /> Escritorio
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  previewMode === 'mobile' ? 'bg-yellow-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Smartphone className="w-3 h-3" /> Móvil
              </button>
            </div>
          </div>

          {/* Browser mockup */}
          <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 ${
            previewMode === 'mobile' ? 'max-w-[320px] mx-auto' : 'w-full'
          }`}>
            {/* Browser chrome */}
            <div className="bg-zinc-950 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-700" />
                <span className="w-2 h-2 rounded-full bg-zinc-700" />
                <span className="w-2 h-2 rounded-full bg-zinc-700" />
              </div>
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-[10px] font-mono text-zinc-600 truncate text-center max-w-[60%] mx-auto">
                https://tusitio.com
              </div>
            </div>

            {/* Site simulation */}
            <div className="relative h-72 bg-zinc-950 p-4 overflow-hidden">
              {/* Mock page content */}
              <div className="space-y-3">
                <div className="h-8 bg-zinc-800 rounded-lg w-3/4" />
                <div className="h-3 bg-zinc-800/60 rounded w-full" />
                <div className="h-3 bg-zinc-800/60 rounded w-4/5" />
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-800/40 rounded-lg" />)}
                </div>
              </div>

              {/* Widget preview (static visual) */}
              {embedUrl && (
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  title="Widget preview"
                  style={{ background: 'transparent' }}
                />
              )}

              {/* Floating button mock */}
              {!embedUrl && (
                <div className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg">
                  <Code2 className="w-4 h-4 text-zinc-950" />
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 text-center">
            El botón flotante aparecerá en la esquina inferior derecha de tu sitio.
          </p>
        </div>
      </div>
    </div>
  );
}
