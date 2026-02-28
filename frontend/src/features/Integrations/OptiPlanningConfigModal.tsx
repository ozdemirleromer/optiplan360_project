import React, { useState, useEffect } from "react";
import { Save, X, Folder, FileType, Play } from "lucide-react";
import { Card, Button } from "../../components/Shared";
import { COLORS, RADIUS } from "../../components/Shared/constants";

export interface OptiPlanningConfig {
     exportDir: string;
     exePath: string;
     formatType: "XML" | "OSI" | "EXCEL";
     autoTrigger: boolean;
     // Machine Config Advanced Options
     sawThickness?: number;
     trimTop?: number;
     trimBottom?: number;
     trimLeft?: number;
     trimRight?: number;
     // Optimization Params
     optimizationMode?: string;
     grainPriority?: number;
     allowRotation?: boolean;
     spacingMm?: number;
}

interface Props {
     isOpen: boolean;
     onClose: () => void;
     onSave: (config: OptiPlanningConfig) => void;
     initialConfig?: OptiPlanningConfig;
}

export function OptiPlanningConfigModal({ isOpen, onClose, onSave, initialConfig }: Props) {
     const [exportDir, setExportDir] = useState(initialConfig?.exportDir || "C:\\Biesse\\OptiPlanning\\XmlJob");
     const [exePath, setExePath] = useState(initialConfig?.exePath || "C:\\Biesse\\OptiPlanning\\System\\OptiPlan.exe");
     const [formatType, setFormatType] = useState<"XML" | "OSI" | "EXCEL">(initialConfig?.formatType || "EXCEL");
     const [autoTrigger, setAutoTrigger] = useState(initialConfig?.autoTrigger ?? true);

     // Advanced Features: Machine Config
     const [sawThickness, setSawThickness] = useState(initialConfig?.sawThickness ?? 3.2);
     const [trimTop, setTrimTop] = useState(initialConfig?.trimTop ?? 10.0);
     const [trimBottom, setTrimBottom] = useState(initialConfig?.trimBottom ?? 10.0);
     const [trimLeft, setTrimLeft] = useState(initialConfig?.trimLeft ?? 10.0);
     const [trimRight, setTrimRight] = useState(initialConfig?.trimRight ?? 10.0);
     const [showAdvanced, setShowAdvanced] = useState(false);

     // Optimization Params
     const [optimizationMode, setOptimizationMode] = useState(initialConfig?.optimizationMode || "Standard");
     const [grainPriority, setGrainPriority] = useState(initialConfig?.grainPriority ?? 1);
     const [allowRotation, setAllowRotation] = useState(initialConfig?.allowRotation ?? true);
     const [spacingMm, setSpacingMm] = useState(initialConfig?.spacingMm ?? 0.0);

     useEffect(() => {
          if (isOpen) {
               if (initialConfig) {
                    setExportDir(initialConfig.exportDir || "C:\\Biesse\\OptiPlanning\\XmlJob");
                    setExePath(initialConfig.exePath || "C:\\Biesse\\OptiPlanning\\System\\OptiPlan.exe");
                    setFormatType(initialConfig.formatType || "EXCEL");
                    setAutoTrigger(initialConfig.autoTrigger ?? true);
                    setSawThickness(initialConfig.sawThickness ?? 3.2);
                    setTrimTop(initialConfig.trimTop ?? 10.0);
                    setTrimBottom(initialConfig.trimBottom ?? 10.0);
                    setTrimLeft(initialConfig.trimLeft ?? 10.0);
                    setTrimRight(initialConfig.trimRight ?? 10.0);
                    // Opti params
                    setOptimizationMode(initialConfig.optimizationMode || "Standard");
                    setGrainPriority(initialConfig.grainPriority ?? 1);
                    setAllowRotation(initialConfig.allowRotation ?? true);
                    setSpacingMm(initialConfig.spacingMm ?? 0.0);
               }
          }
     }, [isOpen, initialConfig]);

     if (!isOpen) return null;

     return (
          <div style={{
               position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
               backgroundColor: "rgba(0,0,0,0.5)",
               display: "flex", alignItems: "center", justifyContent: "center",
               zIndex: 1000
          }}>
               <Card style={{ width: "100%", maxWidth: 600, padding: 0, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                    <div style={{
                         padding: "20px 24px",
                         borderBottom: `1px solid ${COLORS.border}`,
                         display: "flex", justifyContent: "space-between", alignItems: "center",
                         flexShrink: 0
                    }}>
                         <h2 style={{ margin: 0, fontSize: 18, color: COLORS.text }}>OptiPlanning Yapılandırması</h2>
                         <Button variant="ghost" size="sm" onClick={onClose} style={{ padding: 4 }}>
                              <X size={20} />
                         </Button>
                    </div>

                    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
                         {/* Export Dir */}
                         <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <label style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>Aktarım Dizini (Export Dir)</label>
                              <div style={{ position: "relative" }}>
                                   <Folder size={16} style={{ position: "absolute", left: 12, top: 10, color: COLORS.muted }} />
                                   <input
                                        type="text"
                                        value={exportDir}
                                        onChange={(e) => setExportDir(e.target.value)}
                                        style={{
                                             width: "100%", padding: "8px 12px 8px 36px",
                                             borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`,
                                             fontSize: 14, outline: "none"
                                        }}
                                        placeholder="Örn. C:\Biesse\OptiPlanning\XmlJob"
                                   />
                              </div>
                         </div>

                         {/* Exe Path */}
                         <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <label style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>OptiPlan EXE Yolu</label>
                              <div style={{ position: "relative" }}>
                                   <Play size={16} style={{ position: "absolute", left: 12, top: 10, color: COLORS.muted }} />
                                   <input
                                        type="text"
                                        value={exePath}
                                        onChange={(e) => setExePath(e.target.value)}
                                        style={{
                                             width: "100%", padding: "8px 12px 8px 36px",
                                             borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`,
                                             fontSize: 14, outline: "none"
                                        }}
                                        placeholder="Örn. C:\Biesse\OptiPlanning\System\OptiPlan.exe"
                                   />
                              </div>
                         </div>

                         {/* Format Type */}
                         <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <label style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>Dışa Aktarım Formatı</label>
                              <div style={{ position: "relative" }}>
                                   <FileType size={16} style={{ position: "absolute", left: 12, top: 10, color: COLORS.muted }} />
                                   <select
                                        value={formatType}
                                        onChange={(e) => setFormatType(e.target.value as any)}
                                        style={{
                                             width: "100%", padding: "8px 12px 8px 36px",
                                             borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`,
                                             fontSize: 14, backgroundColor: "white", outline: "none"
                                        }}
                                   >
                                        <option value="EXCEL">EXCEL (.xlsx)</option>
                                        <option value="OSI">OSI (.osi)</option>
                                        <option value="XML">XML (.xml)</option>
                                   </select>
                              </div>
                         </div>

                         {/* Auto Trigger */}
                         <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 8 }}>
                              <input
                                   type="checkbox"
                                   checked={autoTrigger}
                                   onChange={(e) => setAutoTrigger(e.target.checked)}
                                   style={{ width: 16, height: 16, accentColor: COLORS.primary.DEFAULT }}
                              />
                              <span style={{ fontSize: 14, color: COLORS.text }}>Aktarım sonrası OptiPlan'ı otomatik tetikle</span>
                         </label>

                         {/* Advanced Settings Toggle */}
                         <div
                              onClick={() => setShowAdvanced(!showAdvanced)}
                              style={{
                                   marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`,
                                   cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"
                              }}
                         >
                              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.primary.DEFAULT }}>Gelişmiş Makine Parametreleri</span>
                              <span style={{ fontSize: 18, color: COLORS.primary.DEFAULT }}>{showAdvanced ? "−" : "+"}</span>
                         </div>

                         {/* Advanced Settings Fields */}
                         {showAdvanced && (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, backgroundColor: COLORS.bg.subtle, padding: 16, borderRadius: RADIUS.md }}>
                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Testere Kalınlığı (mm)</label>
                                        <input type="number" step="0.1" value={sawThickness} onChange={(e) => setSawThickness(parseFloat(e.target.value) || 0)} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}` }} />
                                   </div>
                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Trim Üst (mm)</label>
                                        <input type="number" step="0.1" value={trimTop} onChange={(e) => setTrimTop(parseFloat(e.target.value) || 0)} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}` }} />
                                   </div>
                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Trim Alt (mm)</label>
                                        <input type="number" step="0.1" value={trimBottom} onChange={(e) => setTrimBottom(parseFloat(e.target.value) || 0)} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}` }} />
                                   </div>
                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Trim Sol (mm)</label>
                                        <input type="number" step="0.1" value={trimLeft} onChange={(e) => setTrimLeft(parseFloat(e.target.value) || 0)} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}` }} />
                                   </div>
                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Trim Sağ (mm)</label>
                                        <input type="number" step="0.1" value={trimRight} onChange={(e) => setTrimRight(parseFloat(e.target.value) || 0)} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}` }} />
                                   </div>

                                   {/* Optimizasyon Parametreleri */}
                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Optimizasyon Modu</label>
                                        <select value={optimizationMode} onChange={(e) => setOptimizationMode(e.target.value)} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, backgroundColor: "white" }}>
                                             <option value="Standard">Standart</option>
                                             <option value="High Yield">Yüksek Verim (High Yield)</option>
                                             <option value="Fast">Hızlı (Fast)</option>
                                        </select>
                                   </div>

                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Suyu / Desen Önceliği</label>
                                        <select value={grainPriority.toString()} onChange={(e) => setGrainPriority(parseInt(e.target.value))} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, backgroundColor: "white" }}>
                                             <option value="1">Kesinlikle Uy (1)</option>
                                             <option value="0">Göz Ardı Et (0)</option>
                                        </select>
                                   </div>

                                   <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end", height: "100%", paddingBottom: 6 }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                             <input type="checkbox" checked={allowRotation} onChange={(e) => setAllowRotation(e.target.checked)} style={{ accentColor: COLORS.primary.DEFAULT }} />
                                             <span style={{ fontSize: 13, color: COLORS.text }}>Döndürmeye İzin Ver (Rotation)</span>
                                        </label>
                                   </div>

                                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <label style={{ fontSize: 13, color: COLORS.text }}>Parça Arası Boşluk (mm)</label>
                                        <input type="number" step="0.5" value={spacingMm} onChange={(e) => setSpacingMm(parseFloat(e.target.value) || 0)} style={{ padding: "6px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}` }} />
                                   </div>

                              </div>
                         )}

                    </div>

                    <div style={{
                         padding: "16px 24px",
                         borderTop: `1px solid ${COLORS.border}`,
                         display: "flex", justifyContent: "flex-end", gap: 12,
                         backgroundColor: `${COLORS.bg.surface}`,
                         flexShrink: 0
                    }}>
                         <Button variant="ghost" onClick={onClose}>İptal</Button>
                         <Button onClick={() => {
                              onSave({
                                   exportDir, exePath, formatType, autoTrigger,
                                   sawThickness, trimTop, trimBottom, trimLeft, trimRight,
                                   optimizationMode, grainPriority, allowRotation, spacingMm
                              });
                              onClose();
                         }}>
                              <Save size={16} style={{ marginRight: 6 }} />
                              Kaydet
                         </Button>
                    </div>
               </Card>
          </div>
     );
}
