import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Trash2, Copy, CheckCircle, Plus, AlertTriangle, X, Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { orderOptimizationStyles, ORDER_OPTIMIZATION_THEME } from "./orderOptimizationStyles";
import "../../../styles/optiplan-order-entry.css";

import { ordersService } from "../../../services/ordersService";
import { useOrdersStore } from "../../../stores/ordersStore";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface OrderRow {
    id: number;
    mat: string;
    en: number | "";
    boy: number | "";
    adet: number;
    grain: number; // 0=mat, 1=boyuna, 2=enine, 3=döner
    note: string;
    u1: boolean;
    u2: boolean;
    k1: boolean;
    k2: boolean;
    d1: string;
    d2: string;
    status: "—" | "OK" | "HATA";
}

type ToastTone = "success" | "danger" | "warning";
interface ToastMsg { text: string; tone: ToastTone; }

/* ─── Constants ─────────────────────────────────────────────────────────── */
const GRAIN_OPTIONS = [
    { value: 0, label: "→", title: "Mat (varsayılan)" },
    { value: 1, label: "←", title: "Boyuna" },
    { value: 2, label: "↑↓", title: "Enine" },
    { value: 3, label: "⟲", title: "Döner" },
] as const;

const MATERIAL_OPTIONS = [
    "Suntalam — Beyaz",
    "Suntalam — Siyah",
    "Suntalam — Ceviz",
    "MDF — Standart Beyaz",
    "MDF — Ultra Mat",
    "Kontrplak 4mm",
    "Kontrplak 6mm",
    "Kontrplak 12mm",
    "OSB 9mm",
    "OSB 15mm",
] as const;

const THICKNESS_MAP: Record<string, string[]> = {
    "Suntalam — Beyaz": ["8", "12", "16", "18", "25", "32"],
    "Suntalam — Siyah": ["8", "12", "16", "18", "25", "32"],
    "Suntalam — Ceviz": ["8", "12", "16", "18", "25", "32"],
    "MDF — Standart Beyaz": ["3", "4", "6", "8", "12", "16", "18", "22", "25"],
    "MDF — Ultra Mat": ["3", "4", "6", "8", "12", "16", "18", "22", "25"],
    "Kontrplak 4mm": ["4"],
    "Kontrplak 6mm": ["6"],
    "Kontrplak 12mm": ["12"],
    "OSB 9mm": ["9"],
    "OSB 15mm": ["15"],
};

const PLATE_SIZES: Record<string, { l: number; w: number }> = {
    "3": { l: 1700, w: 2100 }, "4": { l: 2100, w: 2800 }, "6": { l: 2100, w: 2800 },
    "8": { l: 2100, w: 2800 }, "9": { l: 1250, w: 2500 }, "12": { l: 2100, w: 2800 },
    "15": { l: 1830, w: 2440 }, "16": { l: 2100, w: 2800 }, "18": { l: 2100, w: 2800 },
    "22": { l: 2100, w: 2800 }, "25": { l: 2100, w: 2800 }, "32": { l: 2100, w: 2800 },
};

const PRIORITY_OPTIONS = [
    { value: "low", label: "Düşük" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "Yüksek" },
    { value: "urgent", label: "Acil" },
];

const DARK_OPT: React.CSSProperties = { backgroundColor: "#1e1e1e", color: "#e0e4ea" };

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function nextId(ridRef: React.MutableRefObject<number>): number {
    return ++ridRef.current;
}

function makeEmptyRow(id: number, mat: string): OrderRow {
    return { id, mat, en: "", boy: "", adet: 1, grain: 0, note: "", u1: false, u2: false, k1: false, k2: false, d1: "", d2: "", status: "—" };
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export function OptiPlanStrictOrderEntry() {
    const ridRef = useRef(0);

    /* ── Form state ── */
    const [firmaAdi, setFirmaAdi] = useState("Nano Banana A.Ş.");
    const [musteriAdi, setMusteriAdi] = useState("Ahmet Yılmaz");
    const [telefon, setTelefon] = useState("+90 532 000 00 00");
    const [email, setEmail] = useState("info@nanobanana.com");
    const [note, setNote] = useState("Acil sipariş, termin tarihine dikkat edilsin.");
    const [material, setMaterial] = useState<string>(MATERIAL_OPTIONS[0]);
    const [thick, setThick] = useState("18");
    const [priority, setPriority] = useState("normal");
    const [dueDate, setDueDate] = useState("");
    const [orderStatus, setOrderStatus] = useState("Beklemede");

    /* ── Row state ── */
    const [rows, setRows] = useState<OrderRow[]>(() => [
        { id: nextId(ridRef), mat: "Suntalam — Beyaz", en: 170, boy: 370, adet: 2, grain: 0, note: "Dolap yan panel", u1: true, u2: false, k1: true, k2: false, d1: "01", d2: "01", status: "—" },
        { id: nextId(ridRef), mat: "Suntalam — Beyaz", en: 220, boy: 300, adet: 2, grain: 1, note: "Raf bölmesi", u1: true, u2: true, k1: false, k2: true, d1: "01", d2: "01", status: "—" },
        { id: nextId(ridRef), mat: "Suntalam — Beyaz", en: 250, boy: 300, adet: 2, grain: 2, note: "Kapak paneli", u1: false, u2: true, k1: true, k2: true, d1: "01", d2: "01", status: "—" },
    ]);

    /* ── UI state ── */
    const [toast, setToast] = useState<ToastMsg | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    /* ── Derived ── */
    const thickOptions = THICKNESS_MAP[material] ?? ["18"];
    const plate = PLATE_SIZES[thick];

    useEffect(() => {
        const opts = THICKNESS_MAP[material] ?? ["18"];
        if (!opts.includes(thick)) setThick(opts[0]);
    }, [material, thick]);

    const summary = useMemo(() => {
        const totalParts = rows.reduce((a, r) => a + (r.adet || 0), 0);
        const totalArea = rows.reduce((a, r) => a + ((Number(r.en) || 0) * (Number(r.boy) || 0) * (r.adet || 0)) / 1e6, 0);
        return { totalParts, totalArea: totalArea.toFixed(3) };
    }, [rows]);

    /* ── Toast ── */
    const showToast = useCallback((text: string, tone: ToastTone = "success") => {
        setToast({ text, tone });
        setTimeout(() => setToast(null), 3000);
    }, []);

    /* ── Row Operations ── */
    const addRow = useCallback(() => {
        setRows(p => [...p, makeEmptyRow(nextId(ridRef), material)]);
    }, [material]);

    const delRow = useCallback((id: number) => {
        setRows(p => p.filter(r => r.id !== id));
    }, []);

    const cpRow = useCallback((id: number) => {
        setRows(p => {
            const idx = p.findIndex(r => r.id === id);
            if (idx < 0) return p;
            const copy = { ...p[idx], id: nextId(ridRef) };
            const next = [...p];
            next.splice(idx + 1, 0, copy);
            return next;
        });
        showToast("Satır kopyalandı");
    }, [showToast]);

    const updateRow = useCallback((id: number, field: keyof OrderRow, value: unknown) => {
        setRows(p => p.map(r => r.id === id ? { ...r, [field]: value } : r));
    }, []);

    /* ── Clear ── */
    const clearRows = useCallback(() => {
        setRows([makeEmptyRow(nextId(ridRef), material)]);
        setOrderStatus("Beklemede");
        setValidationErrors([]);
        setShowClearConfirm(false);
        showToast("Sipariş satırları temizlendi", "warning");
    }, [material, showToast]);

    /* ── Validate ── */
    const validateRows = useCallback((): boolean => {
        const errors: string[] = [];

        if (!firmaAdi.trim()) errors.push("Firma adı zorunludur.");
        if (!musteriAdi.trim()) errors.push("Müşteri adı zorunludur.");
        const digits = telefon.replace(/\D/g, "");
        if (digits.length < 10) errors.push("Telefon numarası en az 10 haneli olmalıdır.");

        if (rows.length === 0) errors.push("En az bir sipariş satırı gereklidir.");

        rows.forEach((r, i) => {
            const en = Number(r.en);
            const boy = Number(r.boy);
            if (!r.en || en <= 0) errors.push(`Satır ${i + 1}: Geçerli bir EN değeri giriniz.`);
            if (!r.boy || boy <= 0) errors.push(`Satır ${i + 1}: Geçerli bir BOY değeri giriniz.`);
            if (r.adet < 1) errors.push(`Satır ${i + 1}: Adet en az 1 olmalıdır.`);
            if (plate && en > plate.l) errors.push(`Satır ${i + 1}: EN (${en}mm) plaka boyutunu (${plate.l}mm) aşıyor.`);
            if (plate && boy > plate.w) errors.push(`Satır ${i + 1}: BOY (${boy}mm) plaka boyutunu (${plate.w}mm) aşıyor.`);
        });

        setValidationErrors(errors);
        return errors.length === 0;
    }, [firmaAdi, musteriAdi, telefon, rows, plate]);

    const handleValidate = useCallback(() => {
        const ok = validateRows();
        if (ok) {
            setRows(p => p.map(r => ({ ...r, status: "OK" as const })));
            setOrderStatus("Doğrulandı");
            showToast("Tüm satırlar doğrulandı ✓", "success");
        } else {
            setRows(p => p.map(r => ({ ...r, status: "HATA" as const })));
            showToast(`${validationErrors.length} hata bulundu`, "danger");
        }
    }, [validateRows, validationErrors.length, showToast]);

    /* ── Save ── */
    const handleSave = useCallback(async () => {
        if (isSaving) return;
        const ok = validateRows();
        if (!ok) { showToast("Kaydetmeden önce hataları düzeltin", "danger"); return; }
        setIsSaving(true);
        try {
            await ordersService.create({
                cust: firmaAdi.trim(),
                phone: telefon.replace(/\D/g, ""),
                mat: material,
                thick: parseFloat(thick),
                priority: priority as import("../../../types").PriorityLevel,
                parts: rows.map((r, idx) => ({
                    id: idx + 1,
                    boy: String(Number(r.boy)),
                    en: String(Number(r.en)),
                    adet: String(r.adet),
                    grain: String(r.grain) as import("../../../types").GrainDirection,
                    u1: r.u1, u2: r.u2, k1: r.k1, k2: r.k2,
                    delik1: r.d1,
                    delik2: r.d2,
                    info: r.note,
                })),
            });
            await useOrdersStore.getState().fetchOrders();
            setOrderStatus("Kaydedildi");
            showToast("Sipariş kaydedildi ✓", "success");
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showToast("Kayıt hatası: " + msg, "danger");
        } finally {
            setIsSaving(false);
        }
    }, [firmaAdi, telefon, material, thick, priority, rows, validateRows, isSaving, showToast]);

    /* ── Send to Optimization ── */
    const handleOptimize = useCallback(async () => {
        if (isSending) return;
        const ok = validateRows();
        if (!ok) { showToast("Optimizasyon için hataları düzeltin", "danger"); return; }
        setIsSending(true);
        try {
            await handleSave();
            setOrderStatus("Optimizasyonda");
            showToast("Optimizasyona gönderildi 🚀", "success");
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showToast("Optimizasyon hatası: " + msg, "danger");
        } finally {
            setIsSending(false);
        }
    }, [isSending, validateRows, handleSave, showToast]);

    /* ── Render ── */
    return (
        <div
            style={{
                ...(ORDER_OPTIMIZATION_THEME.dark as React.CSSProperties),
                background: "var(--op-main-bg)",
                color: "var(--op-text)",
                fontFamily: '"Inter", system-ui, sans-serif',
                fontSize: "13px",
                minHeight: "100%",
            }}
        >
            {/* ── HEADER STRIP ──────────────────────────────────────────────── */}
            <div className="oe-header-bar">
                {/* Left — sipariş meta */}
                <div className="oe-header-left">
                    {/* Brand badge */}
                    <div className="oe-badge">YENİ SİPARİŞ</div>

                    <div className="oe-separator" />

                    <div className="oe-meta-block">
                        <span className="oe-meta-label">SİPARİŞ NO</span>
                        <span className="oe-meta-value">SIP-000088</span>
                    </div>

                    <div className="oe-separator" />

                    <div className="oe-meta-block">
                        <span className="oe-meta-label">TERMİN</span>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            style={{
                                background: "transparent", border: "none",
                                color: "var(--op-text)", outline: "none", cursor: "pointer",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: "14px", fontWeight: 700, lineHeight: 1.2, padding: 0,
                            }}
                        />
                    </div>

                    <div className="oe-separator" />

                    <div className="oe-meta-block">
                        <span className="oe-meta-label">DURUM</span>
                        <span className={orderOptimizationStyles.statusPill}>{orderStatus}</span>
                    </div>
                </div>

                {/* Right — actions */}
                <div className="oe-header-right">
                    <button type="button" onClick={handleValidate} className="oe-btn">
                        <CheckCircle size={13} /> Doğrula
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowClearConfirm(true)}
                        className="oe-btn oe-btn-danger"
                    >
                        <X size={13} /> Temizle
                    </button>

                    <div className="oe-separator" />

                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                        className="oe-btn oe-btn-primary"
                        style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer", padding: "0 24px" }}
                    >
                        {isSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                </div>
            </div>

            {/* ── VALIDATION ERRORS ────────────────────────────────────────── */}
            {validationErrors.length > 0 && (
                <div className={orderOptimizationStyles.messageStack}>
                    {validationErrors.map((err, i) => (
                        <div key={i} className={`${orderOptimizationStyles.messageBar} ${orderOptimizationStyles.messageDanger}`}>
                            <AlertTriangle size={11} style={{ display: "inline", marginRight: 5 }} /> {err}
                        </div>
                    ))}
                </div>
            )}

            {/* ── DETAIL CARDS ─────────────────────────────────────────────── */}
            <div className={orderOptimizationStyles.detailStrip}>
                {/* Müşteri */}
                <section className={orderOptimizationStyles.detailCard}>
                    <div className={orderOptimizationStyles.detailCardTitle}>Müşteri Bilgileri</div>
                    <label className={orderOptimizationStyles.detailField}>
                        <span className={orderOptimizationStyles.detailLabel}>Firma Adı</span>
                        <input className={orderOptimizationStyles.input} value={firmaAdi} onChange={e => setFirmaAdi(e.target.value)} placeholder="Firma adı" />
                    </label>
                    <label className={orderOptimizationStyles.detailField}>
                        <span className={orderOptimizationStyles.detailLabel}>Müşteri Adı</span>
                        <input className={orderOptimizationStyles.input} value={musteriAdi} onChange={e => setMusteriAdi(e.target.value)} placeholder="Müşteri adı" />
                    </label>
                    <label className={orderOptimizationStyles.detailField}>
                        <span className={orderOptimizationStyles.detailLabel}>Telefon</span>
                        <input className={orderOptimizationStyles.input} value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="+90 5xx xxx xx xx" type="tel" />
                    </label>
                    <label className={orderOptimizationStyles.detailField}>
                        <span className={orderOptimizationStyles.detailLabel}>E-Posta</span>
                        <input className={orderOptimizationStyles.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@mail.com" type="email" />
                    </label>
                </section>

                {/* Malzeme */}
                <section className={orderOptimizationStyles.detailCard}>
                    <div className={orderOptimizationStyles.detailCardTitle}>Malzeme ve Plan</div>
                    <label className={orderOptimizationStyles.detailField}>
                        <span className={orderOptimizationStyles.detailLabel}>Malzeme</span>
                        <select
                            className={orderOptimizationStyles.selectInput}
                            value={material}
                            onChange={e => setMaterial(e.target.value)}
                        >
                            {MATERIAL_OPTIONS.map(m => (
                                <option key={m} value={m} style={DARK_OPT}>{m}</option>
                            ))}
                        </select>
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <label className={orderOptimizationStyles.detailField}>
                            <span className={orderOptimizationStyles.detailLabel}>Kalınlık</span>
                            <select className={orderOptimizationStyles.selectInput} value={thick} onChange={e => setThick(e.target.value)}>
                                {thickOptions.map(t => <option key={t} value={t} style={DARK_OPT}>{t}mm</option>)}
                            </select>
                        </label>
                        <label className={orderOptimizationStyles.detailField}>
                            <span className={orderOptimizationStyles.detailLabel}>Öncelik</span>
                            <select className={orderOptimizationStyles.selectInput} value={priority} onChange={e => setPriority(e.target.value)}>
                                {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value} style={DARK_OPT}>{p.label}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className={orderOptimizationStyles.detailField}>
                        <span className={orderOptimizationStyles.detailLabel}>Plaka Boyutu</span>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--op-text)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {plate ? `${plate.l} mm × ${plate.w} mm` : "—"}
                        </div>
                    </div>
                </section>

                {/* Özet */}
                <section className={orderOptimizationStyles.detailCard}>
                    <div className={orderOptimizationStyles.detailCardTitle}>Sipariş Özeti</div>
                    <div className={orderOptimizationStyles.metricGrid}>
                        <div className={orderOptimizationStyles.metricItem}>
                            <span className={orderOptimizationStyles.detailLabel}>Toplam Alan</span>
                            <strong className={orderOptimizationStyles.metricValue}>{summary.totalArea} m²</strong>
                        </div>
                        <div className={orderOptimizationStyles.metricItem}>
                            <span className={orderOptimizationStyles.detailLabel}>Toplam Parça</span>
                            <strong className={orderOptimizationStyles.metricValue}>{summary.totalParts}</strong>
                        </div>
                        <div className={orderOptimizationStyles.metricItem}>
                            <span className={orderOptimizationStyles.detailLabel}>Satır Sayısı</span>
                            <strong className={orderOptimizationStyles.metricValue}>{rows.length}</strong>
                        </div>
                        <div className={orderOptimizationStyles.metricItem}>
                            <span className={orderOptimizationStyles.detailLabel}>Hata</span>
                            <strong className={orderOptimizationStyles.metricValue} style={{ color: validationErrors.length > 0 ? "var(--op-danger)" : "inherit" }}>
                                {validationErrors.length > 0 ? validationErrors.length : "—"}
                            </strong>
                        </div>
                    </div>
                    <label className={orderOptimizationStyles.detailField} style={{ marginTop: 6 }}>
                        <span className={orderOptimizationStyles.detailLabel}>Operasyon Notu</span>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                            style={{
                                background: "var(--op-surface-bg)", border: "1px solid var(--op-border)", color: "var(--op-text)",
                                fontSize: "12px", padding: "6px 8px", resize: "none", width: "100%", outline: "none",
                                fontFamily: "inherit", lineHeight: 1.5,
                            }}
                            placeholder="Operasyon notu..."
                        />
                    </label>
                </section>

                {/* Dosya ve Çıktı / Optimizasyon */}
                <section className={orderOptimizationStyles.detailCard} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className={orderOptimizationStyles.detailCardTitle}>Dosya ve Çıktı</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, flex: 1 }}>
                        <button type="button" className="oe-file-btn">
                            <Download size={14} className="mb-1" />
                            İçe Aktar
                        </button>
                        <button type="button" className="oe-file-btn">
                            <FileSpreadsheet size={14} className="mb-1" />
                            Excel
                        </button>
                        <button type="button" className="oe-file-btn">
                            <FileText size={14} className="mb-1" />
                            CSV
                        </button>
                        <button type="button" className="oe-file-btn">
                            <Printer size={14} className="mb-1" />
                            Yazdır
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleOptimize()}
                        disabled={isSending || isSaving}
                        className="oe-optim-btn"
                    >
                        {isSending ? "BEKLEYİN..." : "OPTİMİZASYON"}
                    </button>
                </section>
            </div>

            {/* ── TABLE ────────────────────────────────────────────────────── */}
            <div style={{ margin: "0", overflow: "hidden" }}>
                {/* Table Toolbar */}
                <div className="oe-table-toolbar">
                    <span className="oe-table-toolbar-label">Sipariş Satırları</span>
                    <button type="button" onClick={addRow} className="oe-btn" style={{ height: 28, gap: 5 }}>
                        <Plus size={12} /> Satır Ekle
                    </button>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                {["#", "Malzeme", "Boy (mm)", "En (mm)", "Adet", "Yön", "Bilgi", "U1", "U2", "K1", "K2", "Delik 1", "Delik 2", "Durum", ""].map((h, i) => (
                                    <th
                                        key={i}
                                        className="oe-table-th"
                                        style={{
                                            textAlign: ([7, 8, 9, 10, 11, 12, 13, 14].includes(i) ? "center" : "left") as React.CSSProperties["textAlign"],
                                            minWidth: i === 1 ? 150 : i === 6 ? 180 : i >= 7 && i <= 12 ? 44 : undefined,
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={15} style={{ textAlign: "center", padding: 32, color: "var(--op-text)", opacity: 0.4, fontSize: "13px" }}>
                                        Satır yok — "Satır Ekle" butonuna tıklayın.
                                    </td>
                                </tr>
                            )}
                            {rows.map((r, i) => (
                                <tr
                                    key={r.id}
                                    style={{
                                        borderBottom: "1px solid var(--op-border)",
                                        background: i % 2 === 0 ? "var(--op-surface-bg)" : "var(--op-main-bg)",
                                    }}
                                >
                                    {/* # */}
                                    <td style={{
                                        padding: "6px 10px", fontSize: "11px", color: "var(--op-text)", opacity: 0.5,
                                        textAlign: "center",
                                        background: i % 2 === 0 ? "rgba(0,120,212,0.06)" : "rgba(0,0,0,0.14)",
                                        fontFamily: "'JetBrains Mono', monospace",
                                        borderRight: "1px solid var(--op-border)",
                                    }}>
                                        {i + 1}
                                    </td>
                                    {/* Malzeme */}
                                    <td style={{ padding: "2px 4px", background: "var(--op-surface-bg)" }}>
                                        <input
                                            value={r.mat}
                                            onChange={e => updateRow(r.id, "mat", e.target.value)}
                                            className="oe-table-input"
                                            placeholder="Malzeme..."
                                            list={`mat-list-${r.id}`}
                                        />
                                        <datalist id={`mat-list-${r.id}`}>
                                            {MATERIAL_OPTIONS.map(m => <option key={m} value={m} />)}
                                        </datalist>
                                    </td>
                                    {/* Boy */}
                                    <td style={{ padding: "2px 4px", background: "var(--op-surface-bg)" }}>
                                        <input
                                            type="number"
                                            value={r.boy}
                                            onChange={e => updateRow(r.id, "boy", Number(e.target.value) || "")}
                                            className="oe-table-input oe-table-input-mono"
                                            style={{ width: 76 }}
                                        />
                                    </td>
                                    {/* En */}
                                    <td style={{ padding: "2px 4px", background: "var(--op-surface-bg)" }}>
                                        <input
                                            type="number"
                                            value={r.en}
                                            onChange={e => updateRow(r.id, "en", Number(e.target.value) || "")}
                                            className="oe-table-input oe-table-input-mono"
                                            style={{ width: 76 }}
                                        />
                                    </td>
                                    {/* Adet */}
                                    <td style={{ padding: "2px 4px", background: "var(--op-surface-bg)" }}>
                                        <input
                                            type="number" min={1}
                                            value={r.adet}
                                            onChange={e => updateRow(r.id, "adet", Math.max(1, Number(e.target.value) || 1))}
                                            className="oe-table-input oe-table-input-mono"
                                            style={{ width: 48, textAlign: "center" }}
                                        />
                                    </td>
                                    {/* Grain */}
                                    <td style={{ padding: "2px 4px", textAlign: "center", background: "var(--op-surface-bg)" }}>
                                        <div style={{ display: "inline-flex", gap: 2 }}>
                                            {GRAIN_OPTIONS.map(g => (
                                                <button
                                                    key={g.value}
                                                    type="button"
                                                    onClick={() => updateRow(r.id, "grain", g.value)}
                                                    title={g.title}
                                                    style={{
                                                        minWidth: 22, height: 20, padding: "0 4px", border: "1px solid",
                                                        borderColor: r.grain === g.value ? "var(--op-accent)" : "var(--op-border)",
                                                        background: r.grain === g.value ? "rgba(0,120,212,0.15)" : "transparent",
                                                        color: r.grain === g.value ? "var(--op-accent)" : "var(--op-text)",
                                                        fontSize: "11px", cursor: "pointer", fontWeight: r.grain === g.value ? 700 : 400,
                                                    }}
                                                >
                                                    {g.label}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                    {/* Bilgi */}
                                    <td style={{ padding: "2px 4px", background: "var(--op-surface-bg)" }}>
                                        <input
                                            value={r.note}
                                            onChange={e => updateRow(r.id, "note", e.target.value)}
                                            className="oe-table-input"
                                            placeholder="Not..."
                                        />
                                    </td>
                                    {/* U1, U2, K1, K2 */}
                                    {(["u1", "u2", "k1", "k2"] as const).map(key => (
                                        <td key={key} style={{ textAlign: "center", padding: "2px", background: "var(--op-surface-bg)" }}>
                                            <input
                                                type="checkbox"
                                                checked={r[key]}
                                                onChange={() => updateRow(r.id, key, !r[key])}
                                                style={{ width: 14, height: 14, accentColor: "var(--op-accent)", cursor: "pointer" }}
                                            />
                                        </td>
                                    ))}
                                    {/* D1 */}
                                    <td style={{ padding: "2px 4px", textAlign: "center", background: "var(--op-surface-bg)" }}>
                                        <input
                                            value={r.d1}
                                            onChange={e => updateRow(r.id, "d1", e.target.value)}
                                            className="oe-table-input oe-table-input-mono"
                                            style={{ width: 38, textAlign: "center" }}
                                        />
                                    </td>
                                    {/* D2 */}
                                    <td style={{ padding: "2px 4px", textAlign: "center", background: "var(--op-surface-bg)" }}>
                                        <input
                                            value={r.d2}
                                            onChange={e => updateRow(r.id, "d2", e.target.value)}
                                            className="oe-table-input oe-table-input-mono"
                                            style={{ width: 38, textAlign: "center" }}
                                        />
                                    </td>
                                    {/* Status */}
                                    <td style={{ textAlign: "center", padding: "2px 4px", background: "var(--op-surface-bg)" }}>
                                        <span style={{
                                            fontSize: "10px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color:
                                                r.status === "OK" ? "#22c55e" : r.status === "HATA" ? "var(--op-danger)" : "var(--op-text)",
                                            opacity: r.status === "—" ? 0.4 : 1,
                                        }}>
                                            {r.status}
                                        </span>
                                    </td>
                                    {/* Actions */}
                                    <td style={{ padding: "2px 8px", background: "var(--op-surface-bg)" }}>
                                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                            <button
                                                type="button"
                                                onClick={() => cpRow(r.id)}
                                                title="Satırı kopyala"
                                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--op-text)", opacity: 0.5, padding: "2px" }}
                                            >
                                                <Copy size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => delRow(r.id)}
                                                title="Satırı sil"
                                                disabled={rows.length <= 1}
                                                style={{ background: "none", border: "none", cursor: rows.length <= 1 ? "not-allowed" : "pointer", color: "var(--op-danger)", opacity: rows.length <= 1 ? 0.3 : 0.7, padding: "2px" }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                <div className="oe-table-footer">
                    <span className="oe-table-footer-summary">
                        {rows.length} satır · {summary.totalParts} parça · {summary.totalArea} m²
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={isSaving}
                            className="oe-btn oe-btn-primary"
                            style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer", padding: "0 24px" }}
                        >
                            {isSaving ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── CLEAR CONFIRM MODAL ───────────────────────────────────────── */}
            {showClearConfirm && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 10000,
                    background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <div style={{
                        background: "var(--op-surface-bg)", border: "1px solid var(--op-danger)",
                        padding: "24px 28px", minWidth: 300, maxWidth: 380,
                    }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--op-danger)", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                            ⚠ Tüm satırları temizle?
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--op-text)", opacity: 0.7, marginBottom: 18, lineHeight: 1.6 }}>
                            Bu işlem geri alınamaz. Tüm sipariş satırları silinecektir.
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                onClick={() => setShowClearConfirm(false)}
                                className="oe-btn"
                                style={{ height: 30 }}
                            >
                                İptal
                            </button>
                            <button
                                type="button"
                                onClick={clearRows}
                                className="oe-btn oe-btn-primary"
                                style={{ height: 30, background: "var(--op-danger)", borderColor: "var(--op-danger)" }}
                            >
                                Evet, Temizle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TOAST ────────────────────────────────────────────────────── */}
            {toast && (
                <div
                    style={{
                        position: "fixed", bottom: 20, right: 20, zIndex: 9999,
                        background: "var(--op-surface-bg)",
                        borderLeft: `3px solid ${toast.tone === "success" ? "#22c55e" : toast.tone === "danger" ? "var(--op-danger)" : "#f59e0b"}`,
                        padding: "10px 16px", fontSize: "12px", fontWeight: 500, color: "var(--op-text)",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: 340,
                        fontFamily: "inherit",
                    }}
                >
                    {toast.text}
                </div>
            )}
        </div>
    );
}

