import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
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
                                   SMS Gateway Yapılandırması
                              </h2>
                              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
                                   Müşteri bildirimleri için SMS entegrasyonu
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
                         {/* Provider */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Sağlayıcı (Provider)
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
                                        background: "white",
                                        color: COLORS.text,
                                        cursor: "pointer",
                                   }}
                              >
                                   <option value="ILETI_MERKEZI">İleti Merkezi</option>
                                   <option value="NETGSM">NetGSM</option>
                                   <option value="TWILIO">Twilio</option>
                              </select>
                         </div>

                         {/* API Key */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   API Anahtarı <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <input
                                   type="text"
                                   value={config.apiKey}
                                   onChange={(e) => handleChange("apiKey", e.target.value)}
                                   placeholder="API Key"
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

                         {/* Secret Key */}
                         <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                                   Gizli Anahtar (Secret) <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                              </label>
                              <input
                                   type="password"
                                   value={config.secretKey}
                                   onChange={(e) => handleChange("secretKey", e.target.value)}
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
                                   Gönderici Adı (Başlık)
                              </label>
                              <input
                                   type="text"
                                   value={config.senderName}
                                   onChange={(e) => handleChange("senderName", e.target.value)}
                                   placeholder="OPTIPLAN"
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
                                   disabled={saving || !config.apiKey || !config.secretKey}
                              >
                                   {saving ? "Kaydediliyor..." : "Kaydet"}
                              </Button>
                         </div>
                    </div>
               </Card>
          </div>
     );
}
