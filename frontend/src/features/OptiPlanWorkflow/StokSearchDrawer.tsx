import { X } from "lucide-react";
import type { StokMatch } from "./siparisKontrolTypes";

interface StokSearchDrawerProps {
  stokTargetRowNo: number | null;
  stokSearch: string;
  setStokSearch: (v: string) => void;
  filteredStok: StokMatch[];
  uygunStoklar: StokMatch[];
  benzerStoklar: StokMatch[];
  lookupLoading: boolean;
  lookupState: "idle" | "loading" | "results" | "empty" | "fallback";
  lookupStatusLabel: string;
  interactionLocked: boolean;
  onRetryLookup: () => void;
  onSelect: (match: StokMatch) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function StokSearchDrawer({
  stokTargetRowNo,
  stokSearch,
  setStokSearch,
  filteredStok,
  uygunStoklar,
  benzerStoklar,
  lookupLoading,
  lookupState,
  lookupStatusLabel,
  interactionLocked,
  onRetryLookup,
  onSelect,
  onClose,
  inputRef,
}: StokSearchDrawerProps) {
  const searchHelpId = "stok-search-help";
  const searchHelpText = lookupLoading
    ? `Enter: bekleyin | Esc: ${stokSearch.trim() ? "aramayı temizle" : "çekmeceyi kapat"}`
    : filteredStok.length > 0
    ? `Enter: ilk uygun sonucu seç | Esc: ${stokSearch.trim() ? "aramayı temizle" : "çekmeceyi kapat"}`
    : stokSearch.trim() && (lookupState === "empty" || lookupState === "fallback")
    ? "Enter: yeniden dene | Esc: aramayı temizle"
    : "Enter: ilk uygun sonucu seç, boşsa yeniden dene | Esc: çekmeceyi kapat";
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && stokSearch.trim() && !interactionLocked) {
      e.preventDefault();
      e.stopPropagation();
      setStokSearch("");
      inputRef.current?.focus();
      return;
    }
    if (lookupLoading || e.key !== "Enter") return;
    if (filteredStok.length > 0) {
      onSelect(filteredStok[0]);
      return;
    }
    if (stokSearch.trim() && (lookupState === "empty" || lookupState === "fallback")) {
      e.preventDefault();
      onRetryLookup();
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Stok eşleştirme drawer arka plan"
        onClick={() => {
          if (!interactionLocked) onClose();
        }}
        className="fixed inset-0 z-40 bg-black/60"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Stok Ara${stokTargetRowNo !== null ? ` — Satır #${stokTargetRowNo}` : ""}`}
        aria-busy={lookupLoading}
        className="fixed right-0 top-0 bottom-0 z-50 flex w-[420px] max-w-full flex-col border-l border-slate-700 bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Stok Ara{stokTargetRowNo !== null ? ` — Satır #${stokTargetRowNo}` : ""}
          </h2>
          <button
            type="button"
            disabled={interactionLocked}
            onClick={onClose}
            className="p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Stok drawer kapat"
            title="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-700 px-4 py-3">
          <input
            ref={inputRef}
            type="search"
            placeholder="Stok kodu veya adı ara..."
            value={stokSearch}
            disabled={interactionLocked}
            onChange={(e) => setStokSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Stok ara"
            aria-describedby={searchHelpId}
            className="w-full border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div id={searchHelpId} className="mt-1 text-[10px] text-slate-500">
            {searchHelpText}
          </div>
          {lookupLoading && (
            <div role="status" aria-live="polite" className="mt-1 text-[10px] text-slate-500">{stokSearch.trim() ? `${lookupStatusLabel} (${stokSearch.trim()})` : lookupStatusLabel}</div>
          )}
          {lookupState === "fallback" && !lookupLoading && (
            <div role="status" aria-live="polite" className="mt-1 text-[10px] text-amber-400">Canlı stok lookup alınamadı; yerel öneriler gösteriliyor{stokSearch.trim() ? ` (${stokSearch.trim()})` : "."}</div>
          )}
          {lookupState === "empty" && !lookupLoading && (
            <div role="status" aria-live="polite" className="mt-1 text-[10px] text-slate-500">Mikro ERP'de bu aramaya uygun stok bulunamadı{stokSearch.trim() ? ` (${stokSearch.trim()})` : "."}</div>
          )}
          {stokSearch.trim() && !interactionLocked && (
            <div className="mt-2 flex justify-end gap-2">
              {(lookupState === "fallback" || lookupState === "empty") && !lookupLoading && (
                <button
                  type="button"
                  onClick={() => {
                    onRetryLookup();
                    inputRef.current?.focus();
                  }}
                  aria-label="Stok lookup yeniden dene"
                  className="border border-blue-700 px-2.5 py-1 text-[10px] font-semibold text-blue-300 transition-colors hover:border-blue-500 hover:text-blue-100"
                >
                  Yeniden Dene
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setStokSearch("");
                  inputRef.current?.focus();
                }}
                aria-label="Stok aramasını temizle"
                className="border border-slate-600 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
              >
                Aramayı Temizle
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filteredStok.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {lookupState === "empty"
                ? `Canlı lookup'ta sonuç bulunamadı. Arama metnini değiştirin${stokSearch.trim() ? ` (${stokSearch.trim()})` : "."}`
                : lookupState === "fallback"
                ? `Canlı lookup alınamadı. Yerel önerilerde eşleşme bulunamadı${stokSearch.trim() ? ` (${stokSearch.trim()})` : "."}`
                : "Gösterilecek stok önerisi bulunmuyor."}
            </p>
          ) : (
            <div className="space-y-4">
              {lookupState === "fallback" && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  Yerel Öneriler
                </div>
              )}
              <section>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  Uygun Eşleşmeler ({uygunStoklar.length})
                </div>
                <div className="divide-y divide-slate-700 border border-slate-700 bg-slate-900/40">
                  {uygunStoklar.map((m) => (
                    <div
                      key={`uygun-${m.stokKodu}`}
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
                        <div className="text-xs font-semibold text-emerald-400">{m.stokKodu}</div>
                        <div className="truncate text-xs text-slate-200">{m.stokAdi}</div>
                        <div className="text-[10px] text-slate-500">{m.kategori}</div>
                        <div className="text-[10px] text-slate-500">{m.olcuKalinlik ?? "Ölçü/Kalınlık: —"}</div>
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
              </section>

              {benzerStoklar.length > 0 && (
                <section>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    Benzer Eşleşmeler ({benzerStoklar.length})
                  </div>
                  <div className="divide-y divide-slate-700 border border-slate-700 bg-slate-900/20">
                    {benzerStoklar.map((m) => (
                      <div
                        key={`benzer-${m.stokKodu}`}
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
                          <div className="text-xs font-semibold text-amber-400">{m.stokKodu}</div>
                          <div className="truncate text-xs text-slate-300">{m.stokAdi}</div>
                          <div className="text-[10px] text-slate-500">{m.kategori}</div>
                          <div className="text-[10px] text-slate-500">{m.olcuKalinlik ?? "Ölçü/Kalınlık: —"}</div>
                        </div>
                        <button
                          type="button"
                          disabled={lookupLoading || interactionLocked}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(m);
                          }}
                          className="border border-slate-600 bg-slate-700 px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Seç
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}




























