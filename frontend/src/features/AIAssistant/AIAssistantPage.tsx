import { useState } from "react";
import {
  Bot,
  Send,
  Upload,
  FileText,
  Image,
  BarChart3,
  Search,
  Lightbulb,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { TopBar } from "../../components/Layout";
import { Button, Badge, Input, Select, COLORS, RADIUS } from "../../components/Shared";
import { apiRequest } from "../../services/apiClient";

// ── Tipler ──────────────────────────────────────────────────────────────────

type TabId = "chat" | "analysis" | "search" | "image" | "document";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

type Feedback = { type: "success" | "error"; text: string } | null;

// ── Sekmeler tanımı ──────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "chat",     label: "Sohbet",         icon: <Bot size={14} /> },
  { id: "analysis", label: "Analiz",          icon: <BarChart3 size={14} /> },
  { id: "search",   label: "Akıllı Arama",   icon: <Search size={14} /> },
  { id: "image",    label: "Görüntü Analizi", icon: <Image size={14} /> },
  { id: "document", label: "Doküman Analizi", icon: <FileText size={14} /> },
];

const ANALYSIS_OPTIONS = [
  { value: "general",   label: "Genel Durum" },
  { value: "orders",    label: "Sipariş Analizi" },
  { value: "customers", label: "Müşteri Analizi" },
  { value: "inventory", label: "Stok Analizi" },
];

const SEARCH_SCOPE_OPTIONS = [
  { value: "all",       label: "Tümü" },
  { value: "orders",    label: "Siparişler" },
  { value: "customers", label: "Müşteriler" },
  { value: "products",  label: "Ürünler" },
];

const DOC_TYPE_OPTIONS = [
  { value: "general",    label: "Genel" },
  { value: "invoice",    label: "Fatura" },
  { value: "contract",   label: "Sözleşme" },
  { value: "report",     label: "Rapor" },
  { value: "price_list", label: "Fiyat Listesi" },
];

// ── Yardımcı: kart stili ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: 20,
};

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback]   = useState<Feedback>(null);

  // Analysis
  const [analysisType, setAnalysisType] = useState("general");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState("all");

  // Image
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt]   = useState("");

  // Document
  const [docText, setDocText]   = useState("");
  const [docType, setDocType]   = useState("general");

  // ── Chat ──────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await apiRequest<{ response: string }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [...messages, userMsg],
          system_instruction: "Sen OptiPlan 360 AI asistanısın. Kullanıcıya profesyonel ve yardımcı ol.",
        }),
      });
      setMessages((p) => [
        ...p,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "AI yanıt üretilemedi" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Business analysis ────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      await apiRequest("/assistant/analyze-business-data", {
        method: "POST",
        body: JSON.stringify({ analysis_type: analysisType }),
      });
      setFeedback({ type: "success", text: "İş verileriniz başarıyla analiz edildi." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Analiz yapılamadı" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Smart search ─────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      await apiRequest("/assistant/smart-search", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery, search_scope: searchScope }),
      });
      setFeedback({ type: "success", text: "Arama tamamlandı." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Arama yapılamadı" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Image analysis ───────────────────────────────────────────────────────

  const handleImageAnalysis = async () => {
    if (!uploadedFile || !imagePrompt.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("prompt", imagePrompt);
      await apiRequest("/assistant/analyze-image", { method: "POST", body: formData });
      setFeedback({ type: "success", text: "Görüntü başarıyla analiz edildi." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Görüntü analizi yapılamadı" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Document analysis ────────────────────────────────────────────────────

  const handleDocAnalysis = async () => {
    if (!docText.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      await apiRequest("/assistant/analyze-document", {
        method: "POST",
        body: JSON.stringify({ document_text: docText, document_type: docType }),
      });
      setFeedback({ type: "success", text: "Doküman başarıyla analiz edildi." });
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Doküman analizi yapılamadı" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const feedbackBg =
    feedback?.type === "success"
      ? { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", color: COLORS.success.DEFAULT }
      : { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  color: COLORS.error.DEFAULT };

  return (
    <div className="electric-page">
      <TopBar
        title="AI Asistan"
        subtitle="Gemini AI destekli akıllı asistan"
        breadcrumbs={["Orkestrasyon", "AI Asistan"]}
      >
        <Badge variant="success">
          <CheckCircle size={12} style={{ marginRight: 4 }} />
          Aktif
        </Badge>
      </TopBar>

      <div className="app-page-container" style={{ display: "grid", gap: 16, alignContent: "start" }}>
        {/* Geri bildirim */}
        {feedback && (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            style={{
              border: `1px solid ${feedbackBg.border}`,
              background: feedbackBg.bg,
              color: feedbackBg.color,
              borderRadius: RADIUS.md,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {feedback.text}
          </div>
        )}

        {/* Sekme çubuğu */}
        <div
          style={{
            display: "flex",
            gap: 4,
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 0,
          }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: "none",
                  border: "none",
                  borderBottom: active ? `2px solid ${COLORS.primary.DEFAULT}` : "2px solid transparent",
                  color: active ? COLORS.primary.DEFAULT : COLORS.muted,
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Sohbet ── */}
        {activeTab === "chat" && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>AI Asistan Sohbet</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
              OptiPlan 360 hakkında sorular sorun, yardım isteyin veya fikir alın
            </div>
            {/* Mesaj alanı */}
            <div
              style={{
                height: 400,
                overflowY: "auto",
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.md,
                padding: 12,
                marginBottom: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {messages.length === 0 && (
                <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", marginTop: 80 }}>
                  Merhaba! Size nasıl yardımcı olabilirim?
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      borderRadius: RADIUS.lg,
                      padding: "8px 12px",
                      fontSize: 13,
                      background: msg.role === "user" ? COLORS.primary.DEFAULT : COLORS.bg.elevated,
                      color: msg.role === "user" ? "#fff" : COLORS.text,
                    }}
                  >
                    <div>{msg.content}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                      {new Date(msg.timestamp).toLocaleTimeString("tr-TR")}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: COLORS.bg.elevated, borderRadius: RADIUS.lg, padding: "8px 12px" }}>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                </div>
              )}
            </div>
            {/* Input satırı */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  onFocus={undefined}
                />
              </div>
              <Button
                icon={<Send size={14} />}
                onClick={() => void handleSend()}
                disabled={isLoading || !input.trim()}
                loading={isLoading}
              >
                Gönder
              </Button>
            </div>
          </div>
        )}

        {/* ── Analiz ── */}
        {activeTab === "analysis" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                <BarChart3 size={16} />
                İş Veri Analizi
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
                OptiPlan 360 verilerinizi AI ile analiz edin
              </div>
              <div style={{ marginBottom: 12 }}>
                <Select
                  value={analysisType}
                  onChange={(v) => setAnalysisType(String(v))}
                  options={ANALYSIS_OPTIONS}
                  label="Analiz Tipi"
                />
              </div>
              <Button
                icon={isLoading ? <Loader2 size={14} /> : <BarChart3 size={14} />}
                onClick={() => void handleAnalyze()}
                disabled={isLoading}
                loading={isLoading}
                fullWidth
              >
                Analiz Et
              </Button>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                <Lightbulb size={16} />
                Kişiselleştirilmiş Öneriler
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
                Size özel öneriler ve ipuçları alın
              </div>
              <Button
                icon={isLoading ? <Loader2 size={14} /> : <Lightbulb size={14} />}
                onClick={() => void handleAnalyze()}
                disabled={isLoading}
                loading={isLoading}
                fullWidth
              >
                Öneriler Al
              </Button>
            </div>
          </div>
        )}

        {/* ── Akıllı Arama ── */}
        {activeTab === "search" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              <Search size={16} />
              Akıllı Arama
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
              OptiPlan 360 verilerinde akıllı arama yapın
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end" }}>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Aramak istediğiniz kelimeyi yazın..."
              />
              <Select
                value={searchScope}
                onChange={(v) => setSearchScope(String(v))}
                options={SEARCH_SCOPE_OPTIONS}
                ariaLabel="Arama kapsamı"
                containerStyle={{ minWidth: 140 }}
              />
              <Button
                icon={isLoading ? <Loader2 size={14} /> : <Search size={14} />}
                onClick={() => void handleSearch()}
                disabled={isLoading || !searchQuery.trim()}
                loading={isLoading}
              >
                Ara
              </Button>
            </div>
          </div>
        )}

        {/* ── Görüntü Analizi ── */}
        {activeTab === "image" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              <Image size={16} />
              Görüntü Analizi
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
              Görüntüleri AI ile analiz edin
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Görüntü Dosyası</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: RADIUS.md,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    color: COLORS.text,
                    fontSize: 13,
                  }}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Analiz Talimatı</div>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Bu görüntü hakkında ne öğrenmek istiyorsunuz?"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: RADIUS.md,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    color: COLORS.text,
                    fontSize: 13,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <Button
                icon={isLoading ? <Loader2 size={14} /> : <Upload size={14} />}
                onClick={() => void handleImageAnalysis()}
                disabled={isLoading || !uploadedFile || !imagePrompt.trim()}
                loading={isLoading}
              >
                Görüntüyü Analiz Et
              </Button>
            </div>
          </div>
        )}

        {/* ── Doküman Analizi ── */}
        {activeTab === "document" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              <FileText size={16} />
              Doküman Analizi
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
              Fatura, sözleşme, rapor gibi dokümanları analiz edin
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Doküman Metni</div>
                <textarea
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                  placeholder="Analiz edilecek doküman metnini buraya yapıştırın..."
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: RADIUS.md,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    color: COLORS.text,
                    fontSize: 13,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <Select
                value={docType}
                onChange={(v) => setDocType(String(v))}
                options={DOC_TYPE_OPTIONS}
                label="Doküman Tipi"
              />
              <Button
                icon={isLoading ? <Loader2 size={14} /> : <FileText size={14} />}
                onClick={() => void handleDocAnalysis()}
                disabled={isLoading || !docText.trim()}
                loading={isLoading}
              >
                Dokümanı Analiz Et
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Loader spinner CSS */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
