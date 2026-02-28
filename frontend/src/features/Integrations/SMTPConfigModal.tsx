import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
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
                    settings: {
                         host: config.host,
                         port: config.port,
                         username: config.username,
                         password: config.password,
                         use_tls: config.useTls,
                         sender_name: config.senderName,
                    },
                    is_active: true
               });
               onSave(config);
               onClose();
          } catch (error) {
               setErrorMsg(error instanceof Error ? error.message : "Kaydetme başarısız");
          } finally {
               setSaving(false);
          }
     }, [config, onSave, onClose]);

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
                    zIndex: 1000,
                    padding: 24,
               }}
               onClick={onClose}
          >
               <Card
                    style={{
                         width: "100%",
                         maxWidth: 480,
                         maxHeight: "90vh",
                         overflow: "auto",
                    }}
                    onClick={(e) => e.stopPropagation()}
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
                              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
                                   SMTP Sunucu Yapılandırması
                              </h2>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
                                   Sistem e-postalarının (şifre sıfırlama vb.) gönderim ayarları
                              </p>
                         </div>
                         <button
                              onClick={onClose}
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
                         {/* Host */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   SMTP Host <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <input
                                   type="text"
                                   value={config.host}
                                   onChange={(e) => handleChange("host", e.target.value)}
                                   placeholder="smtp.gmail.com"
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
                              {/* Port */}
                              <div>
                                   <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                        Port <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                                   </label>
                                   <input
                                        type="number"
                                        value={config.port}
                                        onChange={(e) => handleChange("port", parseInt(e.target.value) || 587)}
                                        placeholder="587"
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
                              {/* TLS */}
                              <div>
                                   <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                        Güvenlik
                                   </label>
                                   <button
                                        onClick={() => handleChange("useTls", !config.useTls)}
                                        style={{
                                             width: "100%",
                                             padding: "10px 12px",
                                             borderRadius: RADIUS.md,
                                             border: `1px solid ${COLORS.border}`,
                                             fontSize: 14,
                                             fontFamily: TYPOGRAPHY.fontFamily.base,
                                             background: config.useTls ? `${COLORS.success.DEFAULT}20` : "transparent",
                                             color: config.useTls ? COLORS.success.DEFAULT : COLORS.text,
                                             cursor: "pointer",
                                             fontWeight: 500,
                                        }}
                                   >
                                        {config.useTls ? "[Aktif] TLS/SSL" : "Opsiyonel"}
                                   </button>
                              </div>
                         </div>

                         {/* Username */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Kullanıcı Adı <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <input
                                   type="text"
                                   value={config.username}
                                   onChange={(e) => handleChange("username", e.target.value)}
                                   placeholder="ornek@email.com"
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

                         {/* Password */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Şifre <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <input
                                   type="password"
                                   value={config.password}
                                   onChange={(e) => handleChange("password", e.target.value)}
                                   placeholder="••••••••••••"
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

                         {/* Sender Name */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Gönderici Adı
                              </label>
                              <input
                                   type="text"
                                   value={config.senderName}
                                   onChange={(e) => handleChange("senderName", e.target.value)}
                                   placeholder="OptiPlan Sistem"
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

                         {errorMsg && (
                              <div
                                   style={{
                                        padding: 12,
                                        borderRadius: RADIUS.md,
                                        background: `${COLORS.error.DEFAULT}15`,
                                        border: `1px solid ${COLORS.error.DEFAULT}30`,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: COLORS.error.DEFAULT,
                                   }}
                              >
                                   [HATA] {errorMsg}
                              </div>
                         )}

                         <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                              <div style={{ flex: 1 }} />
                              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                                   İptal
                              </Button>
                              <Button
                                   variant="primary"
                                   size="sm"
                                   onClick={handleSave}
                                   disabled={saving || !config.host || !config.username || !config.password}
                              >
                                   {saving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                         </div>
                    </div>
               </Card>
          </div>
     );
}
