import { useState, useCallback, useMemo } from "react";

/* ── Types ── */
interface OrderRow {
    id: number;
    mat: string;
    en: number | "";
    boy: number | "";
    adet: number;
    grain: number;
    note: string;
    uz1: boolean;
    uz2: boolean;
    ks1: boolean;
    ks2: boolean;
    d1: string;
    d2: string;
    status: string;
}

/* ── Styles ── */
const s = {
    page: { background: "#111", color: "#e0e4ea", fontFamily: "'Inter',sans-serif", minHeight: "100vh", fontSize: "14px" } as React.CSSProperties,
    nav: { background: "#0d0d0d", borderBottom: "1px solid #2d2d2d", padding: "0 16px", display: "flex", alignItems: "center", height: 44, position: "sticky" as const, top: 0, zIndex: 200 },
    brand: { display: "flex", alignItems: "center", gap: 8, marginRight: 24 },
    brandIcon: { width: 28, height: 28, borderRadius: "50%", background: "#1a8cd8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".72rem", color: "#fff" },
    brandText: { fontWeight: 700, fontSize: "1rem", color: "#fff" },
    navLink: { padding: "10px 16px", color: "#7d8595", fontSize: ".85rem", fontWeight: 500, textDecoration: "none", borderBottom: "2px solid transparent", cursor: "pointer" } as React.CSSProperties,
    navLinkActive: { padding: "10px 16px", color: "#fff", fontSize: ".85rem", fontWeight: 500, textDecoration: "none", borderBottom: "2px solid #1a8cd8", cursor: "pointer" } as React.CSSProperties,
    ribbon: { background: "#1a1a1a", borderBottom: "1px solid #2d2d2d", padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const },
    rb: { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid #3a3a3a", borderRadius: 20, color: "#e0e4ea", fontSize: ".8rem", fontFamily: "'Inter',sans-serif", padding: "5px 16px", cursor: "pointer", fontWeight: 500 } as React.CSSProperties,
    rbPrimary: { display: "inline-flex", alignItems: "center", gap: 6, background: "#1a8cd8", border: "1px solid #1a8cd8", borderRadius: 20, color: "#fff", fontSize: ".8rem", fontFamily: "'Inter',sans-serif", padding: "5px 16px", cursor: "pointer", fontWeight: 500 } as React.CSSProperties,
    meta: { background: "#1a1a1a", borderBottom: "1px solid #2d2d2d", padding: "14px 20px", display: "flex", alignItems: "flex-end", gap: 32, flexWrap: "wrap" as const },
    metaLbl: { fontSize: ".68rem", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".06em", color: "#7d8595" },
    metaVal: { fontSize: "1.3rem", fontWeight: 700, color: "#fff" },
    card: { background: "#1a1a1a", border: "1px solid #2d2d2d", borderRadius: 6, padding: 14, height: "100%" } as React.CSSProperties,
    cardH: { fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", color: "#7d8595", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #2d2d2d" },
    lbl: { fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".05em", color: "#7d8595", marginBottom: 3, display: "block" },
    fi: { background: "#222", border: "1px solid #3a3a3a", borderRadius: 4, color: "#e0e4ea", fontFamily: "'Inter',sans-serif", fontSize: ".84rem", padding: "6px 10px", outline: "none", width: "100%" } as React.CSSProperties,
    fs: { background: "#222", border: "1px solid #3a3a3a", borderRadius: 4, color: "#e0e4ea", fontFamily: "'Inter',sans-serif", fontSize: ".84rem", padding: "6px 10px", outline: "none", width: "100%" } as React.CSSProperties,
    badge: { display: "inline-block", padding: "3px 12px", borderRadius: 14, fontSize: ".72rem", fontWeight: 700, background: "rgba(26,140,216,.2)", color: "#4facf7" },
    sumRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    sumLbl: { color: "#7d8595", fontSize: ".8rem" },
    sumVal: { fontFamily: "'JetBrains Mono',monospace", fontSize: ".92rem", fontWeight: 600, color: "#e0e4ea" },
    tblWrap: { background: "#1a1a1a", border: "1px solid #2d2d2d", borderRadius: 6, overflow: "hidden" },
    tblHd: { padding: "10px 16px", borderBottom: "1px solid #2d2d2d", display: "flex", alignItems: "center", justifyContent: "space-between" },
    th: { background: "#151515", color: "#7d8595", fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".04em", padding: "10px 12px", borderBottom: "1px solid #2d2d2d", whiteSpace: "nowrap" as const, textAlign: "left" as const },
    td: { padding: "10px 12px", verticalAlign: "middle" as const, fontSize: ".86rem", borderBottom: "1px solid #222" },
    tdInput: { background: "transparent", border: "none", borderBottom: "1px solid transparent", color: "#e0e4ea", fontSize: ".84rem", fontFamily: "'Inter',sans-serif", outline: "none", width: "100%", padding: "3px 4px" } as React.CSSProperties,
    tdNum: { background: "transparent", border: "none", borderBottom: "1px solid transparent", color: "#e0e4ea", fontSize: ".84rem", fontFamily: "'JetBrains Mono',monospace", outline: "none", textAlign: "right" as const, padding: "3px 4px" } as React.CSSProperties,
    grainGroup: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 } as React.CSSProperties,
    grainChip: { minWidth: 24, height: 22, padding: "0 6px", border: "1px solid #3a3a3a", borderRadius: 4, background: "#222", color: "#b9c0cc", fontSize: ".75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1 } as React.CSSProperties,
    grainChipActive: { background: "#17314a", border: "1px solid #2a75b6", color: "#d8ebff", fontWeight: 700 } as React.CSSProperties,
    chk: { width: 18, height: 18, accentColor: "#1a8cd8", cursor: "pointer" } as React.CSSProperties,
    actBtn: { background: "none", border: "none", cursor: "pointer", color: "#7d8595", fontSize: ".78rem", padding: "2px 4px" } as React.CSSProperties,
    foot: { padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    btnDur: { background: "transparent", border: "1px solid #3a3a3a", borderRadius: 4, color: "#e0e4ea", fontSize: ".82rem", padding: "7px 20px", cursor: "pointer", fontWeight: 600, fontFamily: "'Inter',sans-serif" } as React.CSSProperties,
    btnK: { padding: "7px 22px", borderRadius: 4, fontSize: ".82rem", fontWeight: 600, cursor: "pointer", border: "1px solid #3a3a3a", background: "transparent", color: "#e0e4ea", fontFamily: "'Inter',sans-serif" } as React.CSSProperties,
    btnOpt: { padding: "7px 22px", borderRadius: 4, fontSize: ".82rem", fontWeight: 600, cursor: "pointer", border: "none", background: "#1a8cd8", color: "#fff", fontFamily: "'Inter',sans-serif" } as React.CSSProperties,
};

const GRAIN_OPTIONS = [
    { value: 0, label: "→" },
    { value: 1, label: "←" },
    { value: 2, label: "↑↓" },
    { value: 3, label: "⟲" },
];

/* ── Material Data ── */
const MATS: Record<string, { thick: string[] }> = {
    suntalam: { thick: ["8", "12", "16", "18", "25", "32"] },
    mdf: { thick: ["3", "4", "6", "8", "12", "16", "18", "22", "25"] },
    kontrplak: { thick: ["4", "6", "8", "12", "18"] },
    osb: { thick: ["9", "12", "15", "18", "22"] },
};
const PLATES: Record<string, { l: number; w: number }> = {
    "3": { l: 1700, w: 2100 }, "4": { l: 2100, w: 2800 }, "6": { l: 2100, w: 2800 },
    "8": { l: 2100, w: 2800 }, "9": { l: 1250, w: 2500 }, "12": { l: 2100, w: 2800 },
    "15": { l: 1830, w: 2440 }, "16": { l: 2100, w: 2800 }, "18": { l: 2100, w: 2800 },
    "22": { l: 2100, w: 2800 }, "25": { l: 2100, w: 2800 }, "32": { l: 2100, w: 2800 },
};

let _rid = 0;

export function OptiPlanStrictOrderEntry() {
    const [rows, setRows] = useState<OrderRow[]>(() => {
        const init: OrderRow[] = [
            { id: ++_rid, mat: "Suntalam - Beyaz", en: 170, boy: 370, adet: 2, grain: 0, note: "Dolap yan panel", uz1: true, uz2: false, ks1: true, ks2: false, d1: "01", d2: "01", status: "—" },
            { id: ++_rid, mat: "Suntalam - Beyaz", en: 220, boy: 300, adet: 2, grain: 1, note: "Raf bölmesi", uz1: true, uz2: true, ks1: false, ks2: true, d1: "01", d2: "01", status: "—" },
            { id: ++_rid, mat: "Suntalam - Beyaz", en: 250, boy: 300, adet: 2, grain: 2, note: "Kapak paneli", uz1: false, uz2: true, ks1: true, ks2: true, d1: "01", d2: "01", status: "—" },
        ];
        return init;
    });
    const [matType, setMatType] = useState("suntalam");
    const [thick, setThick] = useState("18");
    const [status, setStatus] = useState("Beklemede");
    const [toast, setToast] = useState<string | null>(null);

    const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);

    const plate = PLATES[thick];
    const thickOptions = MATS[matType]?.thick || [];

    const summary = useMemo(() => {
        const totalParts = rows.reduce((a, r) => a + (r.adet || 0), 0);
        const totalArea = rows.reduce((a, r) => a + ((Number(r.en) || 0) * (Number(r.boy) || 0) * (r.adet || 0)) / 1e6, 0);
        return { totalParts, totalArea: totalArea.toFixed(2) };
    }, [rows]);

    const addRow = () => {
        setRows(p => [...p, { id: ++_rid, mat: "", en: "", boy: "", adet: 1, grain: 0, note: "", uz1: false, uz2: false, ks1: false, ks2: false, d1: "01", d2: "01", status: "—" }]);
    };

    const delRow = (id: number) => setRows(p => p.filter(r => r.id !== id));

    const cpRow = (id: number) => {
        setRows(p => {
            const idx = p.findIndex(r => r.id === id);
            if (idx < 0) return p;
            const copy = { ...p[idx], id: ++_rid };
            const next = [...p];
            next.splice(idx + 1, 0, copy);
            return next;
        });
        showToast("Kopyalandı");
    };

    const updateRow = (id: number, field: keyof OrderRow, value: unknown) => {
        setRows(p => p.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const saveOrder = () => {
        const data = { siparisNo: "SIP-000088", satirlar: rows, tarih: new Date().toISOString() };
        console.log("📦 Sipariş:", JSON.stringify(data, null, 2));
        showToast("Kaydedildi ✓");
    };

    const validate = () => {
        const bad = rows.filter(r => !r.en || !r.boy || !r.adet);
        if (bad.length) { showToast(`${bad.length} satırda eksik!`); return; }
        setRows(p => p.map(r => ({ ...r, status: "OK" })));
        setStatus("Doğrulandı");
        showToast("Doğrulandı ✓");
    };

    return (
        <div style={s.page}>
            {/* NAV */}
            <nav style={s.nav}>
                <div style={s.brand}>
                    <div style={s.brandIcon}>OP</div>
                    <div style={s.brandText}>OptiPlan <span style={{ color: "#7d8595", fontWeight: 400 }}>360</span></div>
                </div>
                <span style={s.navLink}>Dosya</span>
                <span style={s.navLink}>Cari</span>
                <span style={s.navLinkActive}>Sipariş</span>
                <span style={s.navLink}>Raporlar</span>
            </nav>

            {/* RIBBON */}
            <div style={s.ribbon}>
                <button style={s.rb} onClick={() => { setRows([]); showToast("Yeni sipariş"); }}><i className="fas fa-plus-circle" /> Yeni</button>
                <button style={s.rb} onClick={() => { setRows([]); showToast("Silindi"); }}><i className="fas fa-trash" /> Sil</button>
                <button style={s.rb} onClick={() => { setRows(p => [...p, ...p.map(r => ({ ...r, id: ++_rid }))]); showToast("Kopyalandı"); }}><i className="fas fa-copy" /> Kopyala</button>
                <button style={s.rb} onClick={validate}><i className="fas fa-check-circle" /> Doğrula</button>
                <button style={s.rbPrimary} onClick={() => showToast("Optimizasyona gönderildi 🚀")}><i className="fas fa-paper-plane" /> Optimizasyona Gönder</button>
            </div>

            {/* META */}
            <div style={s.meta}>
                <div><div style={s.metaLbl}>Sipariş No</div><div style={s.metaVal}>SIP-000088</div></div>
                <div><div style={s.metaLbl}>Termin Tarihi</div><div style={{ ...s.metaVal, fontSize: "1.1rem" }}>04.03.2026</div></div>
                <div><div style={s.metaLbl}>Cari Unvan</div><div style={s.metaVal}>Nano Banana A.Ş.</div></div>
            </div>

            {/* CARDS */}
            <div className="container-fluid px-3 pt-3">
                <div className="row g-3 mb-3">
                    {/* Müşteri */}
                    <div className="col-md-3">
                        <div style={s.card}>
                            <div style={s.cardH}>Müşteri Bilgileri</div>
                            <div className="mb-2"><label style={s.lbl}>Firma Adı</label><input style={s.fi} defaultValue="Nano Banana A.Ş." /></div>
                            <div className="mb-2"><label style={s.lbl}>Müşteri Adı</label><input style={s.fi} defaultValue="Ahmet Yılmaz" /></div>
                            <div className="mb-2"><label style={s.lbl}>Telefon</label><input style={s.fi} defaultValue="+90 532 000 00 00" /></div>
                            <div><label style={s.lbl}>E-Mail</label><input style={s.fi} defaultValue="info@nanobanana.com" /></div>
                        </div>
                    </div>
                    {/* Malzeme */}
                    <div className="col-md-3">
                        <div style={s.card}>
                            <div style={s.cardH}>Malzeme ve Plan</div>
                            <div className="mb-2"><label style={s.lbl}>Malzeme Adı</label>
                                <select style={s.fs} value={matType} onChange={e => { setMatType(e.target.value); setThick(MATS[e.target.value]?.thick[0] || ""); }}>
                                    <option value="suntalam">Suntalam - Beyaz</option>
                                    <option value="mdf">MDF — Standart Beyaz</option>
                                    <option value="kontrplak">Kontrplak</option>
                                    <option value="osb">OSB Levha</option>
                                </select>
                            </div>
                            <div className="row g-2 mb-2">
                                <div className="col-6"><label style={s.lbl}>Kalınlık</label>
                                    <select style={s.fs} value={thick} onChange={e => setThick(e.target.value)}>
                                        {thickOptions.map(t => <option key={t} value={t}>{t}mm</option>)}
                                    </select>
                                </div>
                                <div className="col-6"><label style={s.lbl}>Öncelik</label>
                                    <select style={s.fs}><option>Normal</option><option>Acil</option><option>Düşük</option></select>
                                </div>
                            </div>
                            <div><label style={s.lbl}>Plaka Boyutu</label>
                                <div style={{ fontSize: ".92rem", fontWeight: 600, color: "#e0e4ea", marginTop: 4 }}>
                                    {plate ? `${plate.l}mm x ${plate.w}mm` : "—"}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Özet */}
                    <div className="col-md-3">
                        <div style={s.card}>
                            <div style={{ ...s.cardH, display: "flex", justifyContent: "space-between" }}>
                                <span>Sipariş Özeti</span>
                                <span style={{ fontSize: ".66rem", color: "#7d8595", fontWeight: 400, textTransform: "none" as const }}>Görsel Kaldırıldı</span>
                            </div>
                            <div style={s.sumRow}><span style={s.sumLbl}>Durum</span><span style={s.badge}>{status}</span></div>
                            <div style={s.sumRow}><span style={s.sumLbl}>Toplam Alan</span><span style={s.sumVal}>{summary.totalArea} m²</span></div>
                            <div style={s.sumRow}><span style={s.sumLbl}>Toplam Parça</span><span style={s.sumVal}>{summary.totalParts}</span></div>
                            <div className="mt-2"><label style={s.lbl}>Operasyon Notu</label>
                                <textarea style={{ ...s.fi, resize: "none", fontSize: ".8rem" }} rows={2} defaultValue="Acil sipariş, termin tarihine dikkat edilsin." />
                            </div>
                        </div>
                    </div>
                    {/* Dosya */}
                    <div className="col-md-3">
                        <div style={s.card}>
                            <div style={s.cardH}>Dosya ve Çıktı</div>
                            <div className="row g-2">
                                {[["fa-file-excel", "Excel Aktar"], ["fa-file-csv", "CSV Aktar"], ["fa-file-pdf", "PDF Yazdır"], ["fa-download", "Şablon Kaydet"]].map(([icon, label]) => (
                                    <div className="col-6 mb-2" key={label}>
                                        <button style={{ ...s.rb, width: "100%", justifyContent: "center", borderRadius: 4, fontSize: ".76rem", padding: "7px 0" }}
                                            onClick={() => showToast(`${label}...`)}>
                                            <i className={`fas ${icon}`} /> {label}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div style={s.tblWrap}>
                    <div style={s.tblHd}>
                        <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#7d8595" }}>Sipariş Satırları</div>
                        <button onClick={addRow} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "1px dashed #3a3a3a", borderRadius: 3, color: "#1a8cd8", fontSize: ".76rem", padding: "3px 12px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                            <i className="fas fa-plus" /> + Satır
                        </button>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    {["Sıra", "Malzeme", "En (mm)", "Boy (mm)", "Adet", "Grain", "Bilgi", "Kenar 1", "Kenar 2", "Kenar 3", "Kenar 4", "Delik 1", "Delik 2", "DURUM", ""].map((h, i) => (
                                        <th key={i} style={{ ...s.th, textAlign: [7, 8, 9, 10, 11, 12, 13].includes(i) ? "center" : "left", minWidth: i === 1 ? 170 : i === 6 ? 200 : i >= 7 && i <= 12 ? 56 : undefined }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr><td colSpan={15} style={{ textAlign: "center", padding: 28, color: "#7d8595" }}>Satır yok. "+ Satır" butonuna tıklayın.</td></tr>
                                )}
                                {rows.map((r, i) => (
                                    <tr key={r.id} style={{ borderBottom: "1px solid #222" }}>
                                        <td style={{ ...s.td, textAlign: "center", color: "#7d8595", fontSize: ".78rem" }}>{i + 1}</td>
                                        <td style={s.td}><input style={s.tdInput} value={r.mat} onChange={e => updateRow(r.id, "mat", e.target.value)} /></td>
                                        <td style={s.td}><input style={{ ...s.tdNum, width: 80 }} type="number" value={r.en} onChange={e => updateRow(r.id, "en", Number(e.target.value) || "")} /></td>
                                        <td style={s.td}><input style={{ ...s.tdNum, width: 80 }} type="number" value={r.boy} onChange={e => updateRow(r.id, "boy", Number(e.target.value) || "")} /></td>
                                        <td style={s.td}><input style={{ ...s.tdNum, width: 52, textAlign: "center" }} type="number" min={1} value={r.adet} onChange={e => updateRow(r.id, "adet", Number(e.target.value) || 1)} /></td>
                                        <td style={{ ...s.td, textAlign: "center" }}>
                                            <div style={s.grainGroup}>
                                                {GRAIN_OPTIONS.map((g) => (
                                                    <button
                                                        key={g.value}
                                                        type="button"
                                                        onClick={() => updateRow(r.id, "grain", g.value)}
                                                        style={r.grain === g.value ? { ...s.grainChip, ...s.grainChipActive } : s.grainChip}
                                                        title={`Grain ${g.label}`}
                                                    >
                                                        {g.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={s.td}><input style={{ ...s.tdInput, minWidth: 200 }} value={r.note} onChange={e => updateRow(r.id, "note", e.target.value)} /></td>
                                        <td style={{ ...s.td, textAlign: "center" }}><input type="checkbox" style={s.chk} checked={r.uz1} onChange={() => updateRow(r.id, "uz1", !r.uz1)} /></td>
                                        <td style={{ ...s.td, textAlign: "center" }}><input type="checkbox" style={s.chk} checked={r.uz2} onChange={() => updateRow(r.id, "uz2", !r.uz2)} /></td>
                                        <td style={{ ...s.td, textAlign: "center" }}><input type="checkbox" style={s.chk} checked={r.ks1} onChange={() => updateRow(r.id, "ks1", !r.ks1)} /></td>
                                        <td style={{ ...s.td, textAlign: "center" }}><input type="checkbox" style={s.chk} checked={r.ks2} onChange={() => updateRow(r.id, "ks2", !r.ks2)} /></td>
                                        <td style={{ ...s.td, textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: ".78rem", color: "#7d8595" }}>{r.d1}</td>
                                        <td style={{ ...s.td, textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: ".78rem", color: "#7d8595" }}>{r.d2}</td>
                                        <td style={{ ...s.td, textAlign: "center", fontSize: ".76rem", color: r.status === "OK" ? "#66bb6a" : "#7d8595" }}>{r.status}</td>
                                        <td style={s.td}>
                                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                <button style={s.actBtn} onClick={() => cpRow(r.id)} title="Kopyala"><i className="fas fa-copy" /></button>
                                                <button style={{ ...s.actBtn, color: undefined }} onClick={() => delRow(r.id)} title="Sil"><i className="fas fa-trash" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={s.foot}>
                        <button style={s.btnDur} onClick={() => { setRows([]); showToast("Temizlendi"); }}>DURULA</button>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button style={s.btnK} onClick={saveOrder}>Kaydet</button>
                            <button style={s.btnOpt} onClick={() => { showToast("Optimizasyona gönderildi 🚀"); setStatus("İşlemde"); }}>Optimizasyona Gönder</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* TOAST */}
            {toast && (
                <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, background: "#252525", color: "#e0e4ea", borderLeft: "3px solid #4caf50", borderRadius: 5, padding: "10px 16px", fontSize: ".78rem", boxShadow: "0 4px 20px rgba(0,0,0,.5)" }}>
                    {toast}
                </div>
            )}
        </div>
    );
}
