/**
 * AI Chatbot Assistant Component
 * Fabrika asistanı - doğal dil ile sorgulama ve işlem yapma
 */

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, Loader2 } from 'lucide-react';
import { COLORS, RADIUS, TYPOGRAPHY, SHADOWS } from '../Shared/constants';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  loading?: boolean;
  actions?: { label: string; onClick: () => void }[];
}

interface AIChatbotProps {
  onNavigate?: (page: string) => void;
}

const QUICK_PROMPTS = [
  'Bugün kaç sipariş var?',
  'Geciken siparişleri göster',
  'İstasyon durumları ne?',
  'Düşük stokları listele',
  'Kapasite durumu nasıl?',
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Merhaba! 👋 Ben Optiplan360 AI Asistanınız. Size nasıl yardımcı olabilirim?\n\nSipariş durumu, stok bilgisi, üretim kapasitesi ve daha fazlası hakkında sorularınızı sorabilirsiniz.',
  timestamp: new Date(),
};

// Simulated AI responses
const getAIResponse = async (query: string): Promise<string> => {
  const q = query.toLowerCase();

  if (q.includes('sipariş') && (q.includes('bugün') || q.includes('kaç'))) {
    return '[Siparis Ozeti] **Bugunku Siparis Ozeti:**\n\n- Yeni gelen: 12 siparis\n- Uretimde: 8 siparis\n- Tamamlanan: 5 siparis\n- Geciken: 2 siparis\n\nToplam siparis degeri: TL45.200';
  }

  if (q.includes('gecik') || q.includes('gecikmeli')) {
    return '[Uyari] **Geciken Siparisler (2 adet):**\n\n1. **SP-2024-0142** - Yilmaz Mobilya\n   Gecikme: 2 gun | Neden: Malzeme bekleniyor\n\n2. **SP-2024-0148** - Demir Ticaret\n   Gecikme: 1 gun | Neden: Istasyon arizasi\n\n> Oneri: Istasyon 3\'u yedek istasyonla degistirmenizi oneriyorum.';
  }

  if (q.includes('istasyon') || q.includes('station')) {
    return '[Istasyon] **Istasyon Durumlari:**\n\n- IST-01: [Aktif] (45 dk calisiyor)\n- IST-02: [Aktif] (12 dk calisiyor)\n- IST-03: [Arizali] (3 saat once durdu)\n- IST-04: [Bekleme] (Manuel mod)\n\nAktif kapasite: %75';
  }

  if (q.includes('stok') || q.includes('düşük')) {
    return '[Stok] **Dusuk Stok Uyarilari:**\n\n- MDF 18mm Beyaz: 12 levha kaldi (esik: 20)\n- Mese Kaplama: 8 m2 kaldi (esik: 15)\n- Mentese 35mm: 45 adet kaldi (esik: 100)\n\nTedarikçiye otomatik siparis gondermemi ister misiniz?';
  }

  if (q.includes('kapasite') || q.includes('verimlilik')) {
    return '[Kapasite] **Kapasite Analizi:**\n\n- Gunluk kapasite: 52 siparis\n- Bugunku yuk: 45 siparis (%87)\n- Tahmini tamamlanma: 18:30\n\nZaman dilimi analizi:\n- 08:00-12:00: %88 (Normal)\n- 12:00-16:00: %107 (Asim!)\n- 16:00-20:00: %72 (Rahat)\n\n> Ogleden sonra 2 ek istasyon acmanizi oneriyorum.';
  }

  if (q.includes('rapor') || q.includes('özet')) {
    return '[Rapor] **Gunluk Ozet Raporu:**\n\n- Tamamlanan: 18 siparis (TL32.400)\n- Devam eden: 23 siparis\n- Sevkiyat: 12 paket\n- Tahsilat: TL28.750\n\nVerimlilik: %91 (Gecen hafta: %87)\nSLA uyumu: %96';
  }

  return 'Sorunuzu anladim. Su an icin bu konuda detayli bilgi saglayamiyorum, ancak ilgili sayfaya yonlendirebilirim.\n\n> Sunlari sorabilirsiniz:\n- Siparis durumu\n- Istasyon bilgileri\n- Stok uyarilari\n- Kapasite analizi\n- Gunluk rapor';
};

export const AIChatbot = ({ onNavigate: _onNavigate }: AIChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simulated delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const response = await getAIResponse(messageText);
    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // FAB button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${COLORS.primary.DEFAULT}, #8b5cf6)`,
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          boxShadow: `0 8px 32px ${COLORS.primary.DEFAULT}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          animation: 'pop-in 0.3s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        aria-label="AI Asistan"
        title="AI Asistan"
      >
        <Bot size={24} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: isMinimized ? 300 : 400,
        height: isMinimized ? 56 : 560,
        borderRadius: RADIUS.xl,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.bg.main,
        boxShadow: SHADOWS.xl,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1000,
        transition: 'all 0.3s ease',
        animation: 'scale-in 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: `linear-gradient(135deg, ${COLORS.primary.DEFAULT}, #8b5cf6)`,
          color: 'white',
          cursor: 'pointer',
        }}
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <Sparkles size={18} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>AI Asistan</span>
          <span style={{ fontSize: 10, opacity: 0.8, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 10 }}>Beta</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}
          aria-label={isMinimized ? 'Genişlet' : 'Küçült'}
        >
          {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
        <button
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}
          aria-label="Kapat"
        >
          <X size={16} />
        </button>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'fade-in-up 0.2s ease',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: RADIUS.lg,
                    background: msg.role === 'user'
                      ? `linear-gradient(135deg, ${COLORS.primary.DEFAULT}, ${COLORS.primary[600]})`
                      : COLORS.bg.surface,
                    color: msg.role === 'user' ? 'white' : COLORS.text,
                    fontSize: 13,
                    lineHeight: 1.6,
                    border: msg.role === 'assistant' ? `1px solid ${COLORS.border}` : 'none',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.muted, fontSize: 13, padding: '8px 0' }}>
                <Loader2 size={16} className="anim-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Düşünüyor...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: `1px solid ${COLORS.border}`,
                    background: 'transparent',
                    color: COLORS.primary.DEFAULT,
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${COLORS.primary.DEFAULT}15`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderTop: `1px solid ${COLORS.border}`,
              background: COLORS.bg.surface,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Bir soru sorun..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: COLORS.bg.main,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.md,
                padding: '10px 14px',
                color: COLORS.text,
                fontSize: 13,
                outline: 'none',
                fontFamily: TYPOGRAPHY.fontFamily.base,
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              style={{
                width: 40,
                height: 40,
                borderRadius: RADIUS.md,
                background: input.trim() ? COLORS.primary.DEFAULT : COLORS.bg.main,
                border: 'none',
                color: 'white',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                opacity: input.trim() ? 1 : 0.5,
              }}
              aria-label="Gönder"
            >
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChatbot;
