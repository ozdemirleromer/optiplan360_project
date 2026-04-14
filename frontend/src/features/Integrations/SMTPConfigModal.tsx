import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY, Z_INDEX } from "../../components/Shared/constants";
import { mikroService } from "../../services/mikroService";

interface SMTPConfigModalProps {
     isOpen: boolean;
     onClose: () => void;
     onSave: (config: SMTPConfig) => void;
     initialConfig?: SMTPConfig;
}

export interface SMTPConfig {
     host: string;
     port: number;
     username: string;
     password: string;
     useTls: boolean;
     senderName: string;
}

const defaultConfig: SMTPConfig = {
     host: "",
     port: 587,
     username: "",
     password: "",
     useTls: true,
     senderName: "OptiPlan",
};

export function SMTPConfigModal({ isOpen, onClose, onSave, initialConfig }: SMTPConfigModalProps) {
     const modalRef = useRef<HTMLDivElement>(null);
     const [config, setConfig] = useState<SMTPConfig>(initialConfig || defaultConfig);
     const [saving, setSaving] = useState(false);
     const [errorMsg, setErrorMsg] = useState<string | null>(null);

     const handleChange = useCallback((field: keyof SMTPConfig, value: string | number | boolean) => {
          setConfig(prev => ({ ...prev, [field]: value }));
          setErrorMsg(null);
     }, []);

     const handleSave = useCallback(async () => {
          setSaving(true);
          setErrorMsg(null);
          try {
               await mikroService.updateSettings({
                    integration_type: "SMTP",
                    settings: { host: config.host, port: config.port, username: config.username, password: config.password, use_tls: config.useTls, sender_name: config.senderName },
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
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: Z_INDEX.modal, padding: 24 }}
               onClick={onClose} role="presentation" aria-hidden="true"
          >
               <Card ref={modalRef} style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto" }}
                    onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="config-modal-title"
               >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
                         <div>
                              <h2 id="config-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>SMTP Sunucu Yap\u0131land\u0131rmas\u0131</h2>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>Sistem e-postalar\u0131n\u0131n (\u015Fifre s\u0131f\u0131rlama vb.) g\u00F6nderim ayarlar\u0131</p>
                         </div>
                         <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: RADIUS.md, color: COLORS.muted }}>
                              <X size={20} />
                         </button>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>SMTP Host <span style={{ color: COLORS.danger }}>*</span></label>
                              <input type="text" value={config.host} onChange={(e) => handleChange("host", e.target.value)} placeholder="smtp.gmail.com" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                         </div>

                         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                   <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>Port <span style={{ color: COLORS.danger }}>*</span></label>
                                   <input type="number" value={config.port} onChange={(e) => handleChange("port", parseInt(e.target.value) || 587)} placeholder="587" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                              </div>
                              <div>
                                   <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>G\u00FCvenlik</label>
                                   <button type="button" onClick={() => handleChange("useTls", !config.useTls)} style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, background: config.useTls ? `${COLORS.success}20` : "transparent", color: config.useTls ? COLORS.success : COLORS.text, cursor: "pointer", fontWeight: 500 }}>
                                        {config.useTls ? "[Aktif] TLS/SSL" : "Opsiyonel"}
                                   </button>
                              </div>
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>Kullan\u0131c\u0131 Ad\u0131 <span style={{ color: COLORS.danger }}>*</span></label>
                              <input type="text" value={config.username} onChange={(e) => handleChange("username", e.target.value)} placeholder="ornek@email.com" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>\u015Eifre <span style={{ color: COLORS.danger }}>*</span></label>
                              <input type="password" value={config.password} onChange={(e) => handleChange("password", e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                         </div>

                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>G\u00F6nderici Ad\u0131</label>
                              <input type="text" value={config.senderName} onChange={(e) => handleChange("senderName", e.target.value)} placeholder="OptiPlan Sistem" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base }} />
                         </div>

                         {errorMsg && (
                              <div style={{ padding: 12, borderRadius: RADIUS.md, background: `${COLORS.danger}15`, border: `1px solid ${COLORS.danger}30`, fontSize: 13, fontWeight: 500, color: COLORS.danger }}>
                                   [HATA] {errorMsg}
                              </div>
                         )}

                         <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                              <div style={{ flex: 1 }} />
                              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>\u0130ptal</Button>
                              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !config.host || !config.username || !config.password}>
                                   {saving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                         </div>
                    </div>
               </Card>
          </div>
     );
}
