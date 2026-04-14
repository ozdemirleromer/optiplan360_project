import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY, Z_INDEX } from "../../components/Shared/constants";
import { adminService } from "../../services/adminService";

interface AIConfigModalProps {
     isOpen: boolean;
     onClose: () => void;
     onSave: (config: AIConfig) => void;
     initialConfig?: AIConfig;
}

export interface AIConfig {
     provider: string;
     apiKey: string;
     model: string;
     temperature: number;
     maxTokens: number;
}

const defaultConfig: AIConfig = {
     provider: "openai",
     apiKey: "",
     model: "gpt-4o",
     temperature: 0.7,
     maxTokens: 1000,
};

export function AIConfigModal({ isOpen, onClose, onSave, initialConfig }: AIConfigModalProps) {
     const modalRef = useRef<HTMLDivElement>(null);
     const [config, setConfig] = useState<AIConfig>(initialConfig || defaultConfig);
     const [saving, setSaving] = useState(false);
     const [errorMsg, setErrorMsg] = useState<string | null>(null);

     const handleChange = useCallback((field: keyof AIConfig, value: string | number) => {
          setConfig(prev => ({ ...prev, [field]: value }));
          setErrorMsg(null);
     }, []);

     const handleSave = useCallback(async () => {
          setSaving(true);
          setErrorMsg(null);
          try {
               await adminService.updateAIConfig({
                    provider: config.provider,
                    api_key: config.apiKey,
                    model: config.model,
                    temperature: config.temperature,
                    max_tokens: config.maxTokens,
                    enabled: true
               });
               onSave(config);
               onClose();
          } catch (error) {
               setErrorMsg(error instanceof Error ? error.message : "Kaydetme ba\u015Far\u0131s\u0131z");
          } finally {
               setSaving(false);
          }
     }, [config, onSave, onClose]);

     useEffect(() => {
          if (!isOpen) return;
          const prevFocus = document.activeElement as HTMLElement;
          const focusable = modalRef.current?.querySelectorAll(
               'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const first = focusable?.[0] as HTMLElement;
          setTimeout(() => first?.focus(), 0);
          const handleKeyDown = (e: KeyboardEvent) => {
               if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
               if (e.key !== "Tab" || !focusable?.length) return;
               const last = focusable[focusable.length - 1] as HTMLElement;
               if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
               else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          };
          document.addEventListener("keydown", handleKeyDown);
          return () => { document.removeEventListener("keydown", handleKeyDown); prevFocus?.focus(); };
     }, [isOpen, onClose]);

     if (!isOpen) return null;

     return (
          <div
               style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: Z_INDEX.modal,
                    padding: 24,
               }}
               onClick={onClose}
               role="presentation"
               aria-hidden="true"
          >
               <Card
                    ref={modalRef}
                    style={{
                         width: "100%",
                         maxWidth: 480,
                         maxHeight: "90vh",
                         overflow: "auto",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="config-modal-title"
               >
                    <div
                         style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 20,
                              paddingBottom: 16,
                              borderBottom: `1px solid ${COLORS.border}`,
                         }}
                    >
                         <div>
                              <h2 id="config-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
                                   Yapay Zeka (AI) Yap\u0131land\u0131rmas\u0131
                              </h2>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
                                   Analiz ve Darbo\u011Faz Motoru AI Ayarlar\u0131
                              </p>
                         </div>
                         <button type="button"
                              onClick={onClose}
                              aria-label="Kapat"
                              style={{
                                   background: "none",
                                   border: "none",
                                   cursor: "pointer",
                                   padding: 8,
                                   borderRadius: RADIUS.md,
                                   color: COLORS.muted,
                              }}
                         >
                              <X size={20} />
                         </button>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                         {/* Provider */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Sa\u011Flay\u0131c\u0131
                              </label>
                              <select
                                   value={config.provider}
                                   onChange={(e) => handleChange("provider", e.target.value)}
                                   style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: RADIUS.md,
                                        border: `1px solid ${COLORS.border}`,
                                        fontSize: 14,
                                        fontFamily: TYPOGRAPHY.fontFamily.base,
                                        background: COLORS.bg.surface,
                                        color: COLORS.text,
                                        cursor: "pointer",
                                   }}
                              >
                                   <option value="openai">OpenAI (ChatGPT)</option>
                                   <option value="anthropic">Anthropic (Claude)</option>
                                   <option value="custom">\u00D6zel API</option>
                              </select>
                         </div>

                         {/* Model */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Varsay\u0131lan Model <span style={{ color: COLORS.danger }}>*</span>
                              </label>
                              <input
                                   type="text"
                                   value={config.model}
                                   onChange={(e) => handleChange("model", e.target.value)}
                                   placeholder="gpt-4o veya claude-3-opus"
                                   style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: RADIUS.md,
                                        border: `1px solid ${COLORS.border}`,
                                        fontSize: 14,
                                        fontFamily: TYPOGRAPHY.fontFamily.base,
                                   }}
                              />
                         </div>

                         {/* API Key */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   API Anahtar\u0131 <span style={{ color: COLORS.danger }}>*</span>
                              </label>
                              <input
                                   type="password"
                                   value={config.apiKey}
                                   onChange={(e) => handleChange("apiKey", e.target.value)}
                                   placeholder="sk-..."
                                   style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: RADIUS.md,
                                        border: `1px solid ${COLORS.border}`,
                                        fontSize: 14,
                                        fontFamily: TYPOGRAPHY.fontFamily.base,
                                   }}
                              />
                         </div>

                         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              {/* Temperature */}
                              <div>
                                   <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                        Temperature (0 - 2)
                                   </label>
                                   <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        value={config.temperature}
                                        onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0)}
                                        style={{
                                             width: "100%",
                                             padding: "10px 12px",
                                             borderRadius: RADIUS.md,
                                             border: `1px solid ${COLORS.border}`,
                                             fontSize: 14,
                                             fontFamily: TYPOGRAPHY.fontFamily.base,
                                        }}
                                   />
                              </div>

                              {/* Max Tokens */}
                              <div>
                                   <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                        Max Token
                                   </label>
                                   <input
                                        type="number"
                                        min="100"
                                        step="100"
                                        value={config.maxTokens}
                                        onChange={(e) => handleChange("maxTokens", parseInt(e.target.value) || 1000)}
                                        style={{
                                             width: "100%",
                                             padding: "10px 12px",
                                             borderRadius: RADIUS.md,
                                             border: `1px solid ${COLORS.border}`,
                                             fontSize: 14,
                                             fontFamily: TYPOGRAPHY.fontFamily.base,
                                        }}
                                   />
                              </div>
                         </div>

                         {errorMsg && (
                              <div
                                   style={{
                                        padding: 12,
                                        borderRadius: RADIUS.md,
                                        background: `${COLORS.danger}15`,
                                        border: `1px solid ${COLORS.danger}30`,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: COLORS.danger,
                                   }}
                              >
                                   [HATA] {errorMsg}
                              </div>
                         )}

                         <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                              <div style={{ flex: 1 }} />
                              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                                   \u0130ptal
                              </Button>
                              <Button
                                   variant="primary"
                                   size="sm"
                                   onClick={handleSave}
                                   disabled={saving || !config.apiKey || !config.model}
                              >
                                   {saving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                         </div>
                    </div>
               </Card>
          </div>
     );
}
