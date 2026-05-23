'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Zap, RefreshCw, CheckCircle } from 'lucide-react';
import { getConversacion, getMensajes, createConversacion, getEmpresa, getEmpresas, createEmpresa } from '@/lib/db';

interface ChatWidgetProps {
  empresaId: string;
  previewInstructions?: string;
  // Override colors for playground preview
  overrideColorPrimario?: string;
  overrideColorSecundario?: string;
  absolutePosition?: boolean;
}

interface Message {
  id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  fecha: string;
}

interface EmpresaConfig {
  bot_nombre?: string;
  bot_avatar_url?: string;
  bot_color_primario?: string;
  bot_color_secundario?: string;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0,0,0';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

// Decide text color (black or white) based on background luminance
function getContrastColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '#000000';
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#09090b' : '#f4f4f5';
}

export default function ChatWidget({
  empresaId,
  previewInstructions,
  overrideColorPrimario,
  overrideColorSecundario,
  absolutePosition,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    setIsIframe(inIframe);
    if (inIframe) {
      window.parent.postMessage('chat-close', '*');
    }
  }, []);

  const handleToggleOpen = (newOpen: boolean) => {
    setIsOpen(newOpen);
    if (typeof window !== 'undefined') {
      window.parent.postMessage(newOpen ? 'chat-open' : 'chat-close', '*');
    }
  };
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [resolvedEmpresaId, setResolvedEmpresaId] = useState<string | null>(null);
  const [cliente, setCliente] = useState<{ nombre: string | null; whatsapp: string | null }>({
    nombre: null,
    whatsapp: null,
  });
  const [config, setConfig] = useState<EmpresaConfig>({
    bot_nombre: 'Asistente Virtual',
    bot_avatar_url: undefined,
    bot_color_primario: '#facc15',
    bot_color_secundario: '#09090b',
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function initChat() {
      if (!empresaId) return;
      let targetId = empresaId;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(empresaId)) {
        const list = await getEmpresas();
        if (list.length > 0) {
          targetId = list[0].id;
        } else {
          try {
            const newEmp = await createEmpresa('Mi Empresa');
            targetId = newEmp.id;
          } catch { return; }
        }
      }

      setResolvedEmpresaId(targetId);

      // Load empresa config (bot name, colors, avatar)
      try {
        const emp = await getEmpresa(targetId);
        if (emp) {
          setConfig({
            bot_nombre: emp.bot_nombre || 'Asistente Virtual',
            bot_avatar_url: emp.bot_avatar_url || undefined,
            bot_color_primario: emp.bot_color_primario || '#facc15',
            bot_color_secundario: emp.bot_color_secundario || '#09090b',
          });
        }
      } catch { /* use defaults */ }

      const storageKey = `saas_chat_conv_${targetId}`;
      const activeId = sessionStorage.getItem(storageKey);

      if (activeId) {
        const conv = await getConversacion(activeId);
        if (conv) {
          setConversacionId(activeId);
          setCliente({ nombre: conv.cliente_nombre, whatsapp: conv.cliente_whatsapp });
          const msgs = await getMensajes(activeId);
          setMessages(msgs);
          return;
        }
      }

      const newConv = await createConversacion(targetId);
      sessionStorage.setItem(storageKey, newConv.id);
      setConversacionId(newConv.id);
      setCliente({ nombre: null, whatsapp: null });
      setMessages([]);
    }
    initChat();
  }, [empresaId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleRestart = async () => {
    const empId = resolvedEmpresaId || empresaId;
    if (!empId) return;
    if (confirm('¿Reiniciar la conversación? Se perderá el historial actual.')) {
      setIsLoading(true);
      const newConv = await createConversacion(empId);
      sessionStorage.setItem(`saas_chat_conv_${empId}`, newConv.id);
      setConversacionId(newConv.id);
      setCliente({ nombre: null, whatsapp: null });
      setMessages([]);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const empId = resolvedEmpresaId || empresaId;
    if (!input.trim() || !conversacionId || !empId || isLoading) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    const tempUserMsg: Message = {
      id: 'temp-user-' + Date.now(),
      rol: 'user',
      contenido: userText,
      fecha: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, tempUserMsg].map((m) => ({ role: m.rol, content: m.contenido })),
          conversacionId,
          empresaId: empId,
          previewInstructions,
        }),
      });

      if (!response.ok) throw new Error('Error al conectar.');

      const assistantMsgId = 'assistant-' + Date.now();
      setMessages((prev) => [...prev, { id: assistantMsgId, rol: 'assistant', contenido: '', fecha: new Date().toISOString() }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value);
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, contenido: assistantText } : msg))
          );
        }
      }

      const updatedConv = await getConversacion(conversacionId);
      if (updatedConv) setCliente({ nombre: updatedConv.cliente_nombre, whatsapp: updatedConv.cliente_whatsapp });
    } catch {
      setMessages((prev) => [...prev, {
        id: 'error-' + Date.now(), rol: 'assistant',
        contenido: 'Lo siento, ocurrió un error. Por favor intenta de nuevo.',
        fecha: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Resolved colors (overrides take precedence for playground)
  const primaryColor = overrideColorPrimario || config.bot_color_primario || '#facc15';
  const secondaryColor = overrideColorSecundario || config.bot_color_secundario || '#09090b';
  const primaryContrast = getContrastColor(primaryColor);
  const botName = config.bot_nombre || 'Asistente Virtual';

  const renderMessageContent = (text: string) => {
    // Regex for matching markdown images, allowing spaces/newlines between ] and (
    const imgRegex = /!\[([\s\S]*?)\]\s*\(([\s\S]*?)\)/g;
    
    if (!text.match(imgRegex)) {
      return <p className="whitespace-pre-line">{text}</p>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    imgRegex.lastIndex = 0;

    while ((match = imgRegex.exec(text)) !== null) {
      const textPart = text.substring(lastIndex, match.index);
      if (textPart) {
        parts.push(
          <span key={`txt-${lastIndex}`} className="whitespace-pre-line">
            {textPart}
          </span>
        );
      }

      const alt = match[1].trim();
      const url = match[2].trim().replace(/\s+/g, '');
      parts.push(
        <div key={`img-${match.index}`} className="my-2 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/50 shadow-inner group relative">
          <img 
            src={url} 
            alt={alt} 
            className="w-full max-h-56 object-cover cursor-pointer hover:opacity-90 transition-all duration-200" 
            onClick={() => window.open(url, '_blank')} 
          />
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-[10px] text-zinc-300 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
            Click para ver en grande
          </div>
        </div>
      );

      lastIndex = imgRegex.lastIndex;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push(
        <span key={`txt-${lastIndex}`} className="whitespace-pre-line">
          {remainingText}
        </span>
      );
    }

    return <div className="space-y-1">{parts}</div>;
  };

  const containerClass = absolutePosition
    ? "absolute bottom-0 right-0 w-full h-full flex flex-col items-end justify-end sm:p-2 p-0 pointer-events-none font-sans"
    : isIframe
      ? "fixed bottom-0 right-0 w-full h-full flex flex-col items-end justify-end sm:p-2 p-0 pointer-events-none font-sans"
      : "fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end sm:p-0 p-0 pointer-events-none sm:pointer-events-auto font-sans";

  return (
    <div className={containerClass}>

      {/* Chat Window */}
      {isOpen && (
        <div
          className="w-full sm:w-[400px] h-full sm:h-[540px] sm:mb-3 border-0 sm:border border-zinc-800/80 rounded-none sm:rounded-2xl shadow-none sm:shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-scale-in pointer-events-auto"
          style={{ background: secondaryColor }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0 border-b"
            style={{
              background: primaryColor,
              borderColor: `rgba(${hexToRgb(primaryColor)}, 0.2)`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                {config.bot_avatar_url ? (
                  <img
                    src={config.bot_avatar_url}
                    alt={botName}
                    className="w-8 h-8 rounded-full object-cover border-2"
                    style={{ borderColor: `rgba(${hexToRgb(primaryContrast)}, 0.2)` }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: `rgba(${hexToRgb(primaryContrast)}, 0.15)` }}
                  >
                    <Zap className="w-4 h-4" style={{ color: primaryContrast }} />
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border border-white" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: primaryContrast }}>{botName}</p>
                <p className="text-[10px] opacity-70" style={{ color: primaryContrast }}>Online · IA Agéntica</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleRestart} className="p-1.5 rounded-lg transition-colors opacity-70 hover:opacity-100" style={{ color: primaryContrast }}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleToggleOpen(false)} className="p-1.5 rounded-lg transition-colors opacity-70 hover:opacity-100" style={{ color: primaryContrast }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Lead data banner */}
          {(cliente.nombre || cliente.whatsapp) && (
            <div className="px-4 py-2 border-b border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-1.5 animate-fade-in shrink-0"
              style={{ background: 'rgba(16,185,129,0.06)' }}>
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Lead: <strong className="text-white">{cliente.nombre || 'Cliente'}</strong>
                {cliente.whatsapp && ` · ${cliente.whatsapp}`}
              </span>
              <span className="ml-auto text-[9px] font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-500 uppercase">
                Guardado
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3">
                {config.bot_avatar_url ? (
                  <img src={config.bot_avatar_url} alt={botName} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${primaryColor}20`, border: `1px solid ${primaryColor}30` }}>
                    <Zap className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-200">¡Hola! Soy {botName}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Escríbeme para comenzar. Pediré tu nombre y WhatsApp para ayudarte mejor.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.rol === 'user';
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mb-0.5 overflow-hidden"
                        style={{ background: `${primaryColor}20`, color: primaryColor, border: `1px solid ${primaryColor}30` }}>
                        {config.bot_avatar_url ? (
                          <img src={config.bot_avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : 'IA'}
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                      style={isUser
                        ? { background: primaryColor, color: primaryContrast }
                        : { background: 'rgba(255,255,255,0.07)', color: '#f4f4f5', border: '1px solid rgba(255,255,255,0.1)' }
                      }
                    >
                      {renderMessageContent(msg.contenido)}
                      <span className="block text-[9px] mt-1.5 font-mono opacity-50 text-right">
                        {new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {isUser && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mb-0.5"
                        style={{ background: `${primaryColor}20`, color: primaryColor, border: `1px solid ${primaryColor}30` }}>
                        Tú
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isLoading && messages[messages.length - 1]?.rol === 'user' && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden"
                  style={{ background: `${primaryColor}20`, color: primaryColor, border: `1px solid ${primaryColor}30` }}>
                  {config.bot_avatar_url ? <img src={config.bot_avatar_url} alt="" className="w-full h-full object-cover" /> : 'IA'}
                </div>
                <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-1.5 h-1.5 rounded-full animate-typing-dot"
                        style={{ background: primaryColor, animationDelay: `${delay}ms`, opacity: 0.6 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 flex gap-2 items-center shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="flex-1 px-3.5 py-2 rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.1)` }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shrink-0"
              style={{ background: primaryColor, color: primaryContrast }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => handleToggleOpen(!isOpen)}
        className={`${
          isOpen ? 'hidden sm:flex' : 'flex'
        } rounded-full items-center justify-center shadow-xl active:scale-95 hover:scale-105 transition-all duration-200 animate-pulse-glow pointer-events-auto`}
        style={{
          width: '52px', height: '52px',
          background: primaryColor,
          color: primaryContrast,
          boxShadow: `0 8px 32px rgba(${hexToRgb(primaryColor)}, 0.35)`,
        }}
      >
        {isOpen
          ? <X className="w-5 h-5" strokeWidth={2.5} />
          : <MessageSquare className="w-5 h-5" strokeWidth={2.5} />
        }
      </button>
    </div>
  );
}
