import { X } from "lucide-react";
import type { CariEslesmesi, CariMatch } from "./siparisKontrolTypes";

interface CariSearchDrawerProps {
  cari: CariEslesmesi;
  cariSearch: string;
  setCariSearch: (v: string) => void;
  filteredCari: CariMatch[];
  lookupLoading: boolean;
  lookupState: "idle" | "loading" | "results" | "empty" | "fallback";
  lookupStatusLabel: string;
  interactionLocked: boolean;
  onRetryLookup: () => void;
  onSelect: (match: CariMatch) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function CariSearchDrawer({
  cari,
  cariSearch,
  setCariSearch,
  filteredCari,
  lookupLoading,
  lookupState,
  lookupStatusLabel,
  interactionLocked,
  onRetryLookup,
  onSelect,
  onClose,
  inputRef,
}: CariSearchDrawerProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && cariSearch.trim() && !interactionLocked) {
      e.preventDefault();
      e.stopPropagation();
      setCariSearch("");
      inputRef.current?.focus();
      return;
    }
    if (lookupLoading || e.key !== "Enter") return;
    if (filteredCari.length > 0) {
      onSelect(filteredCari[0]);
      return;
    }
    if (cariSearch.trim() && (lookupState === "empty" || lookupState === "fallback")) {
      e.preventDefault();
      onRetryLookup();
    }
  }

  const resultHeaderClassName =
    lookupState === "fallback"
      ? "text-[10px] font-semibold uppercase tracking-wider text-amber-400"
      : "text-[10px] font-semibold uppercase tracking-wider text-blue-400";
  const resultHeaderLabel = lookupState === "fallback" ? "Yerel Öneriler" : "Önerilen Eşleşmeler";
  const searchHelpId = "cari-search-help";
  const searchHelpText = lookupLoading
    ? `Enter: bekleyin | Esc: ${cariSearch.trim() ? "aramayı temizle" : "çekmeceyi kapat"}`
    : filteredCari.length > 0
    ? `Enter: ilk sonucu seç | Esc: ${cariSearch.trim() ? "aramayı temizle" : "çekmeceyi kapat"}`
    : cariSearch.trim() && (lookupState === "empty" || lookupState === "fallback")
    ? "Enter: yeniden dene | Esc: aramayı temizle"
    : "Enter: ilk sonucu seç, boşsa yeniden dene | Esc: çekmeceyi kapat";
  return (
    <>
      <button
        type="button"
        aria-label="Cari eşleştirme drawer arka plan"
        onClick={() => {
          if (!interactionLocked) onClose();
        }}
        className="fixed inset-0 z-40 bg-black/60"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cari Ara — Mikro ERP"
        aria-busy={lookupLoading}
        className="fixed right-0 top-0 bottom-0 z-50 flex w-[420px] max-w-full flex-col border-l border-slate-700 bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Cari Ara — Mikro ERP</h2>
          <button
            type="button"
            disabled={interactionLocked}
            onClick={onClose}
            className="p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Cari drawer kapat"
            title="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-700 px-4 py-3">
          <input
            ref={inputRef}
            type="search"
            placeholder="Cari kodu veya ünvanı ara..."
            value={cariSearch}
            disabled={interactionLocked}
            onChange={(e) => setCariSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Cari ara"
            aria-describedby={searchHelpId}
            className="w-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div id={searchHelpId} className="mt-1 text-[10px] text-slate-500">
            {searchHelpText}
          </div>
          {lookupLoading && (
            <div role="status" aria-live="polite" className="mt-1 text-[10px] text-slate-500">{cariSearch.trim() ? `${lookupStatusLabel} (${cariSearch.trim()})` : lookupStatusLabel}</div>
          )}
          {lookupState === "fallback" && !lookupLoading && (
            <div role="status" aria-live="polite" className="mt-1 text-[10px] text-amber-400">Canlı cari lookup alınamadı; yerel öneriler gösteriliyor{cariSearch.trim() ? ` (${cariSearch.trim()})` : "."}</div>
          )}
          {lookupState === "empty" && !lookupLoading && (
            <div role="status" aria-live="polite" className="mt-1 text-[10px] text-slate-500">Mikro ERP'de bu aramaya uygun cari bulunamadı{cariSearch.trim() ? ` (${cariSearch.trim()})` : "."}</div>
          )}
          {cariSearch.trim() && !interactionLocked && (
            <div className="mt-2 flex justify-end gap-2">
              {(lookupState === "fallback" || lookupState === "empty") && !lookupLoading && (
                <button
                  type="button"
                  onClick={() => {
                    onRetryLookup();
                    inputRef.current?.focus();
                  }}
                  aria-label="Cari lookup yeniden dene"
                  className="border border-blue-700 px-2.5 py-1 text-[10px] font-semibold text-blue-300 transition-colors hover:border-blue-500 hover:text-blue-100"
                >
                  Yeniden Dene
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCariSearch("");
                  inputRef.current?.focus();
                }}
                aria-label="Cari aramasını temizle"
                className="border border-slate-600 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
              >
                Aramayı Temizle
              </button>
            </div>
          )}
        </div>

        <div className="border-b border-slate-700 px-4 py-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mevcut Eşleşme</div>
          {cari.durum === "matched" ? (
            <div className="border border-emerald-700/50 bg-emerald-900/20 px-3 py-2 text-xs">
              <div className="font-semibold text-emerald-300">{cari.cariKodu}</div>
              <div className="text-slate-200">{cari.cariUnvan}</div>
              <div className="text-[10px] text-slate-400">{cari.telefon ?? "—"}</div>
            </div>
          ) : (
            <div className="border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-300">
              Cari eşleşmesi yok
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filteredCari.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {lookupState === "empty"
                ? `Canlı lookup'ta sonuç bulunamadı. Arama metnini değiştirin${cariSearch.trim() ? ` (${cariSearch.trim()})` : "."}`
                : lookupState === "fallback"
                ? `Canlı lookup alınamadı. Yerel önerilerde eşleşme bulunamadı${cariSearch.trim() ? ` (${cariSearch.trim()})` : "."}`
                : "Gösterilecek cari önerisi bulunmuyor."}
            </p>
          ) : (
            <div className="space-y-2" role="listbox" aria-label="Cari sonuçları">
              <div className={resultHeaderClassName}>{resultHeaderLabel}</div>
              <div className="divide-y divide-slate-700 border border-slate-700 bg-slate-900/30">
                {filteredCari.map((m) => (
                  <div
                    key={m.cariKodu}
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      if (!lookupLoading && !interactionLocked) onSelect(m);
                    }}
                    className={`flex items-center justify-between gap-3 px-3 py-2 ${
                      lookupLoading || interactionLocked ? "cursor-wait opacity-70" : "cursor-pointer hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-blue-400">{m.cariKodu}</div>
                      <div className="truncate text-xs text-slate-200">{m.cariUnvan}</div>
                      <div className="text-[10px] text-slate-500">{m.telefon}</div>
                    </div>
                    <button
                      type="button"
                      disabled={lookupLoading || interactionLocked}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(m);
                      }}
                      className="border border-blue-600 bg-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Seç
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}



























