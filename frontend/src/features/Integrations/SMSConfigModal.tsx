import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY, Z_INDEX } from "../../components/Shared/constants";
import { mikroService } from "../../services/mikroService";

interface SMSConfigModalProps {
     isOpen: boolean;
     onClose: () => void;
     onSave: (config: SMSConfig) => void;
     initialConfig?: SMSConfig;
}

export interface SMSConfig {
     provider: string;
     apiKey: string;
     secretKey: string;
     senderName: string;
}

const defaultConfig: SMSConfig = {
     provider: "ILETI_MERKEZI",
     apiKey: "",
     secretKey: "",
     senderName: "OPTIPLAN",
};

export function SMSConfigModal({ isOpen, onClose, onSave, initialConfig }: SMSConfigModalProps) {
     const modalRef = useRef<HTMLDivElement>(null);
     const [config, setConfig] = useState<SMSConfig>(initialConfig || defaultConfig);
     const [saving, setSaving] = useState(false);
     const [errorMsg, setErrorMsg] = useState<string | null>(null);

     const handleChange = useCallback((field: keyof SMSConfig, value: string) => {
          setConfig(prev => ({ ...prev, [field]: value }));
          setErrorMsg(null);
     }, []);

     const handleSave = useCallback(async () => {
          setSaving(true);
          setErrorMsg(null);
          try {
               await mikroService.updateSettings({
                    integration_type: "SMS",
                    settings: {
                         provider: config.provider,
                         api_key: config.apiKey,
                         secret_key: config.secretKey,
                         sender_name: config.senderName,
                    },
                    is_active: true
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
               style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: Z_INDEX.modal, padding: 24 }}
               onClick={onClose} role="presentation" aria-hidden="true"
          >
               <Card ref={modalRef}
                    style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto" }}
                    onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="config-modal-title"
               >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
                         <div>
                              <h2 id="config-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
                                   SMS Gateway Yap\u0131land\u0131rmas\u0131
                              </h2>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
                                   M\u00FC\u015Fteri bildirimleri i\u00E7in SMS entegrasyonu
                              </p>
                         </div>
                         <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: RADIUS.md, color: COLORS.muted }}>
                              <X size={20} />
                         </button>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Sa\u011Flay\u0131c\u0131 (Provider)
                              </label>
                              <select value={config.provider} onChange={(e) => handleChange("provider", e.target.value)}
                                   style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, background: COLORS.bg.surface, color: COLORS.text, cursor: "pointer" }}
                              >
                                   <option value="ILETI_MERKEZI">\u0130leti Merkezi</option>
                                   <option value="NETGSM">NetGSM</option>
                                   <option value="TWILIO">Twilio</option>
                              </select>
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   API Anahtar\u0131 <span style={{ color: COLORS.danger }}>*</span>
                              </label>
                              <input type="text" value={config.apiKey} onChange={(e) => handleChange("apiKey", e.target.value)} placeholder="API Key"
                                   style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }}
                              />
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Gizli Anahtar (Secret) <span style={{ color: COLORS.danger }}>*</span>
                              </label>
                              <input type="password" value={config.secretKey} onChange={(e) => handleChange("secretKey", e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                                   style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }}
                              />
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   G\u00F6nderici Ad\u0131 (Ba\u015Fl\u0131k)
                              </label>
                              <input type="text" value={config.senderName} onChange={(e) => handleChange("senderName", e.target.value)} placeholder="OPTIPLAN"
                                   style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }}
                              />
                         </div>

                         {errorMsg && (
                              <div style={{ padding: 12, borderRadius: RADIUS.md, background: `${COLORS.danger}15`, border: `1px solid ${COLORS.danger}30`, fontSize: 13, fontWeight: 500, color: COLORS.danger }}>
                                   [HATA] {errorMsg}
                              </div>
                         )}

                         <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                              <div style={{ flex: 1 }} />
                              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>\u0130ptal</Button>
                              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !config.apiKey || !config.secretKey}>
                                   {saving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                         </div>
                    </div>
               </Card>
          </div>
     );
}
