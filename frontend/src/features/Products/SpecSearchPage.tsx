/**
 * OptiPlan 360 — Spec-first Urun Arama Sayfasi
 * Satisci serbest metin ile urun arar, eslesen spec'ler listelenir.
 * MATCHED/AMBIGUOUS/NO_MATCH durumu goruntulenir.
 */
import { useState, useCallback } from "react";
import { Search, Package, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Button, COLORS, RADIUS } from "../../components/Shared";
import { TopBar } from "../../components/Layout";
import { productService } from "../../services/productService";
import type { SpecSearchResult } from "../../services/productService";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  MATCHED: { label: "Eslesti", color: "#22c55e", icon: CheckCircle },
  AMBIGUOUS: { label: "Birden fazla firma", color: "#f59e0b", icon: AlertTriangle },
  NO_MATCH: { label: "Eslesme yok", color: "#ef4444", icon: HelpCircle },
};

export default function SpecSearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SpecSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await productService.searchSpecs({ query: searchQuery.trim(), limit: 50 });
      setResults(res.results);
      setTotal(res.total);
      setSearched(true);
    } catch (err: unknown) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Arama basarisiz" });
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Urun Arama (Spec-first)" />

      <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
        {/* Arama alani */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearch();
          }}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            maxWidth: 600,
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: COLORS.gray[400],
              }}
              aria-hidden="true"
            />
            <input
              id="spec-search-input"
              type="text"
              placeholder="Orn: BEYAZ 18, MDF 5mm, SUNTALAM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Urun arama metni"
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.bg.elevated,
                color: COLORS.text,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={loading || !searchQuery.trim()}>
            {loading ? "Araniyor..." : "Ara"}
          </Button>
        </form>

        {/* Feedback */}
        {feedback && (
          <div
            style={{
              padding: "8px 16px",
              borderRadius: RADIUS.md,
              backgroundColor: feedback.type === "error" ? "#fef2f2" : "#f0fdf4",
              color: feedback.type === "error" ? "#dc2626" : "#16a34a",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {feedback.text}
          </div>
        )}

        {/* Sonuclar */}
        {searched && results.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: COLORS.gray[400],
              fontSize: 14,
            }}
          >
            <Package size={40} style={{ marginBottom: 12, opacity: 0.4 }} aria-hidden="true" />
            <div>Aramanizla eslesen urun bulunamadi.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Farkli anahtar kelimeler deneyin (orn: renk, kalinlik, malzeme turu).
            </div>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: COLORS.gray[400], marginBottom: 12 }}>
              {total} sonuc bulundu
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              }}
            >
              {results.map((spec) => {
                const cfg = STATUS_CONFIG[spec.matchStatus] ?? STATUS_CONFIG.NO_MATCH;
                const StatusIcon = cfg.icon;
                return (
                  <div
                    key={spec.id}
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.lg,
                      padding: 16,
                      background: COLORS.bg.elevated,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {/* Baslik */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                          {spec.productTypeName} — {spec.colorName}
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.gray[400], marginTop: 2 }}>
                          {spec.thicknessMm}mm | {spec.widthCm}×{spec.heightCm} cm
                        </div>
                      </div>
                      {/* Durum rozeti */}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: RADIUS.full,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: cfg.color + "18",
                          color: cfg.color,
                          border: `1px solid ${cfg.color}33`,
                        }}
                      >
                        <StatusIcon size={12} aria-hidden="true" />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Tedarikci bilgileri */}
                    {spec.supplierItems.length > 0 && (
                      <div style={{ fontSize: 12, color: COLORS.gray[400] }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Tedarikciler:</div>
                        {spec.supplierItems.map((si) => (
                          <div
                            key={si.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "3px 0",
                            }}
                          >
                            <span style={{ fontWeight: si.isDefault ? 700 : 400 }}>
                              {si.brandName}
                            </span>
                            <span style={{ color: COLORS.gray[400] }}>— {si.displayName}</span>
                            {si.isDefault && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: RADIUS.sm,
                                  backgroundColor: "#22c55e22",
                                  color: "#22c55e",
                                }}
                              >
                                Varsayilan
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* NO_MATCH uyarisi */}
                    {spec.matchStatus === "NO_MATCH" && (
                      <div
                        style={{
                          fontSize: 11,
                          padding: "6px 10px",
                          borderRadius: RADIUS.md,
                          backgroundColor: "#fef2f2",
                          color: "#dc2626",
                        }}
                      >
                        Bu urun icin tedarikci eslesmesi bulunamadi. Urun talebi olusturuldu.
                      </div>
                    )}

                    {/* AMBIGUOUS - firma secimi */}
                    {spec.matchStatus === "AMBIGUOUS" && (
                      <div
                        style={{
                          fontSize: 11,
                          padding: "6px 10px",
                          borderRadius: RADIUS.md,
                          backgroundColor: "#fffbeb",
                          color: "#d97706",
                        }}
                      >
                        Birden fazla tedarikci eslesti. Lutfen tercih belirleyin.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
