import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import type { SiparisRow } from "./siparisKontrolTypes";


// ─── InfoChip ────────────────────────────────────────────────────────────────

export function InfoChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-200">{value}</span>
    </span>
  );
}

// ─── ValidationItem ──────────────────────────────────────────────────────────

export function ValidationItem({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
      )}
      <span className={ok ? "text-slate-400" : "font-medium text-red-400"}>{label}:</span>
      <span className={ok ? "text-emerald-400" : "text-red-400"}>{value}</span>
    </div>
  );
}

// ─── MiniBadge ───────────────────────────────────────────────────────────────

export function MiniBadge({
  label,
  variant,
}: {
  label: string;
  variant: "emerald" | "red" | "amber" | "purple" | "blue" | "slate";
}) {
  const cls = {
    emerald: "border-emerald-700/60 bg-emerald-900/30 text-emerald-400",
    red:     "border-red-700/60 bg-red-900/30 text-red-400",
    amber:   "border-amber-700/60 bg-amber-900/20 text-amber-400",
    purple:  "border-purple-700/60 bg-purple-900/30 text-purple-300",
    blue:    "border-blue-700/60 bg-blue-900/30 text-blue-400",
    slate:   "border-slate-600 bg-slate-700/50 text-slate-400",
  }[variant];
  return (
    <span className={`border px-1 py-0.5 text-[9px] font-semibold leading-none ${cls}`}>
      {label}
    </span>
  );
}

// ─── SummaryField ─────────────────────────────────────────────────────────────

export function SummaryField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-200 truncate max-w-[180px]">{value}</span>
    </div>
  );
}

// ─── ToolbarBtn ──────────────────────────────────────────────────────────────

export function ToolbarBtn({
  icon,
  label,
  onClick,
  disabled,
  primary,
  danger,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  title?: string;
}) {
  const cls = disabled
    ? "border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
    : primary
    ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-500"
    : danger
    ? "border-red-500/40 bg-red-900/40 text-red-400 hover:bg-red-900/50 focus:outline-none focus:ring-1 focus:ring-red-500"
    : "border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition-colors ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── ModalOverlay ────────────────────────────────────────────────────────────

export function ModalOverlay({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className={`relative border border-slate-600 bg-slate-800 shadow-2xl ${wide ? "w-full max-w-xl" : "w-full max-w-md"}`}>
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            aria-label="Kapat (Escape)"
            title="Kapat (Escape)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Td (tablo hücresi) ───────────────────────────────────────────────────────

export function Td({
  children,
  right,
  dim,
}: {
  children: React.ReactNode;
  right?: boolean;
  dim?: boolean;
}) {
  return (
    <td
      className={`border-b border-r border-slate-700 px-3 py-1 tabular-nums text-xs ${
        right ? "text-right" : ""
      } ${dim ? "text-slate-400" : "text-slate-300"}`}
    >
      {children}
    </td>
  );
}

// ─── DetailBlock ─────────────────────────────────────────────────────────────

export function DetailBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-slate-500">{label}</div>
      <div className="text-xs text-slate-200">{value}</div>
    </div>
  );
}

// ─── FireModal ────────────────────────────────────────────────────────────────

export function FireModal({
  initialValue,
  contextLabel,
  onSave,
  onClose,
  inputRef,
}: {
  initialValue: string;
  contextLabel?: string;
  onSave: (aciklama: string) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [aciklama, setAciklama] = useState(initialValue);
  const [fireNedeni, setFireNedeni] = useState("Kesim Sapması");
  const [fireMiktari, setFireMiktari] = useState("");
  return (
    <ModalOverlay onClose={onClose} title="Genel Fire Açıklaması">
      <p className="mb-2 text-xs text-slate-400">
        Bu açıklama kayıt genelinde geçerlidir.{contextLabel ? <span className="font-medium text-slate-200"> {contextLabel}</span> : null}
      </p>
      <label className="mb-1 block text-xs font-medium text-slate-400">Fire Nedeni</label>
      <select
        value={fireNedeni}
        onChange={(e) => setFireNedeni(e.target.value)}
        className="mb-3 w-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
      >
        <option value="Kesim Sapması">Kesim Sapması</option>
        <option value="Malzeme Hatası">Malzeme Hatası</option>
        <option value="Operatör Müdahalesi">Operatör Müdahalesi</option>
        <option value="Diğer">Diğer</option>
      </select>
      <label className="mb-1 block text-xs font-medium text-slate-400">Fire Miktarı (opsiyonel)</label>
      <input
        value={fireMiktari}
        onChange={(e) => setFireMiktari(e.target.value)}
        placeholder="Örn: 0.12 m²"
        className="mb-3 w-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
      />
      <label className="mb-1 block text-xs font-medium text-slate-400">Kısa Açıklama / Not</label>
      <textarea
        ref={inputRef}
        value={aciklama}
        onChange={(e) => setAciklama(e.target.value)}
        rows={4}
        placeholder="Fire nedeni, miktar ve ek notları girin…"
        className="mb-4 w-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 transition-colors"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={() => {
            const birlesikMetin = [
              `Neden: ${fireNedeni}`,
              fireMiktari.trim() ? `Miktar: ${fireMiktari.trim()}` : "",
              aciklama.trim() ? `Not: ${aciklama.trim()}` : "",
            ].filter(Boolean).join(" | ");
            onSave(birlesikMetin);
          }}
          className="border border-blue-600 bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Kaydet
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── MergeModal ───────────────────────────────────────────────────────────────

export function MergeModal({
  selectedRows,
  onConfirm,
  onClose,
}: {
  selectedRows: SiparisRow[];
  onConfirm: (operatorNotu: string) => void;
  onClose: () => void;
}) {
  const totalMergeAdet = selectedRows.reduce((s, r) => s + r.adet, 0);
  const [operatorNotu, setOperatorNotu] = useState("");
  return (
    <ModalOverlay onClose={onClose} title={`Satır Birleştirme — ${selectedRows.length} Satır Seçili`} wide>
      <p className="mb-3 text-xs text-slate-400">
        Seçili satırlar birleştirme sonrası tek satır haline gelir. Bu işlem geri alınamaz.
      </p>
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-700">
              {["#", "Malzeme", "Boy", "En", "Adet", "Açıklama", "Plaka"].map((h) => (
                <th key={h} className="border border-slate-600 px-2 py-1 text-left font-medium text-slate-300">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedRows.map((r) => (
              <tr key={r.siraNo} className="border-b border-slate-700">
                <td className="border border-slate-700 px-2 py-1 text-slate-400">{r.siraNo}</td>
                <td className="border border-slate-700 px-2 py-1 text-slate-200">{r.malzeme}</td>
                <td className="border border-slate-700 px-2 py-1 text-right tabular-nums">{r.boy}</td>
                <td className="border border-slate-700 px-2 py-1 text-right tabular-nums">{r.en}</td>
                <td className="border border-slate-700 px-2 py-1 text-right tabular-nums">{r.adet}</td>
                <td className="border border-slate-700 px-2 py-1 text-slate-400">{r.aciklama || "—"}</td>
                <td className="border border-slate-700 px-2 py-1 text-slate-400">{r.plakaRef}</td>
              </tr>
            ))}
            <tr className="bg-slate-700/50 font-semibold">
              <td colSpan={5} className="border border-slate-600 px-2 py-1 text-slate-300">Birleşme Sonrası Toplam Adet</td>
              <td className="border border-slate-600 px-2 py-1 text-right text-emerald-400 tabular-nums">{totalMergeAdet}</td>
              <td className="border border-slate-600" />
            </tr>
          </tbody>
        </table>
      </div>
      <label className="mb-1 block text-xs font-medium text-slate-400">Operatör Notu</label>
      <textarea
        value={operatorNotu}
        onChange={(e) => setOperatorNotu(e.target.value)}
        rows={2}
        placeholder="Birleştirme gerekçesi / kontrol notu"
        className="mb-3 w-full border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 transition-colors"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={() => onConfirm(operatorNotu)}
          className="border border-blue-600 bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Birleştirmeyi Onayla
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── RowDetailPanel ───────────────────────────────────────────────────────────

export function RowDetailPanel({
  row,
  sonMudahale,
  mergeGecmisi,
  generalFireAciklamasi,
  onClose,
}: {
  row: SiparisRow;
  sonMudahale: string;
  mergeGecmisi: string[];
  generalFireAciklamasi?: string;
  onClose: () => void;
}) {
  const normalizedGeneralFireAciklamasi = (generalFireAciklamasi ?? "").trim();
  return (
    <div
      role="complementary"
      aria-label={`Satır #${row.siraNo} detayı`}
      className="fixed right-0 top-0 bottom-0 z-40 flex w-72 flex-col border-l border-slate-700 bg-slate-800 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">Satır #{row.siraNo} Detayı</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          title="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {row.malzemeEslesmeDurumu === "matched" ? (
            <MiniBadge label="ERP OK" variant="emerald" />
          ) : (
            <MiniBadge label="Stok Eksik" variant="red" />
          )}
          {row.merged && <MiniBadge label="Merge" variant="purple" />}
          {row.fireAciklamasi && <MiniBadge label="Fire" variant="amber" />}
          {row.satirKaynagi === "MANUEL" && <MiniBadge label="Manuel" variant="blue" />}
        </div>
        <DetailBlock label="Malzeme" value={row.malzeme} />
        <DetailBlock label="ERP Stok Kodu" value={row.erpStokKodu ?? "—"} />
        <DetailBlock label="Plaka" value={row.plakaRef} />
        <DetailBlock label="Boyutlar" value={`${row.boy} × ${row.en} mm`} />
        <DetailBlock label="Adet" value={row.adet} />
        <DetailBlock label="Yön" value={row.yon} />
        <DetailBlock label="Bant (U1/U2/K1/K2)" value={`${row.u1} / ${row.u2} / ${row.k1} / ${row.k2}`} />
        <DetailBlock label="Satır Kaynağı" value={row.satirKaynagi} />
        <DetailBlock label="Son Operatör Müdahalesi" value={sonMudahale} />
        {normalizedGeneralFireAciklamasi && (
          <div className="border border-amber-700/50 bg-amber-900/10 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase text-amber-400">Genel Fire Açıklaması</div>
            <p className="text-xs text-amber-200">{normalizedGeneralFireAciklamasi}</p>
          </div>
        )}
        {row.aciklama && <DetailBlock label="Açıklama" value={row.aciklama} />}
        {row.ilaveAciklama && <DetailBlock label="İlave Açıklama" value={row.ilaveAciklama} />}
        {row.aciklama1 && <DetailBlock label="Açıklama 1" value={row.aciklama1} />}
        {row.fireAciklamasi && (
          <div className="border border-amber-700/50 bg-amber-900/20 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase text-amber-400">Fire Açıklaması</div>
            <p className="text-xs text-amber-300">{row.fireAciklamasi}</p>
          </div>
        )}
        {row.merged && (
          <div className="border border-purple-700/50 bg-purple-900/20 p-2">
            <div className="text-[10px] font-semibold uppercase text-purple-400">Birleştirilmiş Satır</div>
            <p className="mt-0.5 text-xs text-purple-300">Bu satır birleştirme işleminden oluşturuldu (audit izi aktif).</p>
          </div>
        )}
        <div className="border border-slate-700 bg-slate-900/30 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Merge Geçmişi</div>
          {mergeGecmisi.length === 0 ? (
            <p className="text-xs text-slate-500">Merge kaydı bulunmuyor.</p>
          ) : (
            <ul className="space-y-1">
              {mergeGecmisi.map((item) => (
                <li key={item} className="text-xs text-slate-300">• {item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

