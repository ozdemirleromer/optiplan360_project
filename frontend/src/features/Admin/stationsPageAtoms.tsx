/**
 * StationsPage — Alt Bileşenler (Atoms)
 */

import {
  Scissors,
  Layers,
  Truck,
  Cpu,
  RefreshCw,
  Activity,
  Clock,
  ScanBarcode,
  AlertTriangle,
  CheckCircle2,
  Power,
  Edit2,
  Trash2,
  Plus,
} from "lucide-react";
import { Button, Card, Badge } from "../../components/Shared";
import { COLORS, RADIUS } from "../../components/Shared/constants";
import type { StationDto } from "../../services/adminService";
import type { DeviceGroupDef, StationTab, DeviceGroupPanelProps } from "./stationsPageTypes";

// -------------------------------------------------------
// Sabit Veriler
// -------------------------------------------------------

/** 3 cihaz grubunun statik tanımları */
export const DEVICE_GROUPS: DeviceGroupDef[] = [
  {
    key: "ebatlama",
    label: "EBATLAMA",
    deviceName: "Cihaz 1",
    icon: <Scissors size={18} />,
    color: "#3b82f6",
    stationNames: ["HAZIRLIK", "EBATLAMA"],
    steps: [
      { scan: 1, stationName: "HAZIRLIK", label: "Ürün Hazırlık" },
      { scan: 2, stationName: "EBATLAMA", label: "Ebatlama İşlemi" },
    ],
    maxScans: 2,
    hasWaitRule: true,
    description:
      "1. okutma ile ürün hazırlığa alınır, 30 dakika sonra 2. okutma ile ebatlama tamamlanır.",
  },
  {
    key: "bantlama",
    label: "BANTLAMA",
    deviceName: "Cihaz 2",
    icon: <Layers size={18} />,
    color: "#8b5cf6",
    stationNames: ["BANTLAMA"],
    steps: [{ scan: 1, stationName: "BANTLAMA", label: "Bantlama İşlemi" }],
    maxScans: 1,
    hasWaitRule: false,
    description:
      "Tek okutma ile bantlama tamamlanır. Bekleme süresi kuralı yoktur.",
  },
  {
    key: "teslim",
    label: "TESLİM",
    deviceName: "Cihaz 3",
    icon: <Truck size={18} />,
    color: "#10b981",
    stationNames: ["KONTROL", "TESLİMAT"],
    steps: [
      { scan: 1, stationName: "KONTROL", label: "Teslimata Hazır" },
      { scan: 2, stationName: "TESLİMAT", label: "Teslimat Yapıldı" },
    ],
    maxScans: 2,
    hasWaitRule: true,
    description:
      "1. okutma ile kontrol başlar, 30 dakika sonra 2. okutma ile teslimat tamamlanır.",
  },
];

/** Tab bar tanımları */
export const TABS: { key: StationTab; label: string; icon: React.ReactNode }[] =
  [
    { key: "ebatlama", label: "EBATLAMA", icon: <Scissors size={16} /> },
    { key: "bantlama", label: "BANTLAMA", icon: <Layers size={16} /> },
    { key: "teslim", label: "TESLİM", icon: <Truck size={16} /> },
    { key: "devices", label: "Cihaz Yönetimi", icon: <Cpu size={16} /> },
  ];

// -------------------------------------------------------
// DeviceGroupPanel
// -------------------------------------------------------

/** Her tab'ın ana içerik paneli */
export function DeviceGroupPanel({
  group,
  stations,
  allStations,
  loading,
  onRefresh,
  onToggle,
  onDelete,
  onEdit,
  onCreate,
}: DeviceGroupPanelProps) {
  return (
    <div>
      {/* ===== CİHAZ BİLGİ KARTI ===== */}
      <div
        style={{
          padding: "20px",
          background: `${group.color}08`,
          borderRadius: RADIUS.lg,
          border: `1px solid ${group.color}30`,
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* Sol — Cihaz başlığı */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: RADIUS.lg,
              background: `${group.color}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: group.color,
              flexShrink: 0,
            }}
          >
            {group.icon}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "6px",
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.text,
                  margin: 0,
                }}
              >
                {group.label}
              </h2>
              <Badge variant="info">{group.deviceName}</Badge>
              {group.hasWaitRule && (
                <Badge variant="warning">
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Clock size={12} /> 30 dk Kuralı
                  </span>
                </Badge>
              )}
            </div>
            <p
              style={{
                fontSize: 13,
                color: COLORS.muted,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {group.description}
            </p>
          </div>

          {/* Sağ — Aksiyonlar */}
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              <RefreshCw size={16} /> Yenile
            </Button>
            <Button variant="primary" size="sm" onClick={onCreate}>
              <Plus size={16} /> Yeni İstasyon
            </Button>
          </div>
        </div>

        {/* ===== OKUTMA ADIMLARI ===== */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "20px",
            flexWrap: "wrap",
          }}
        >
          {group.steps.map((step, i) => (
            <div
              key={step.scan}
              style={{
                flex: "1 1 200px",
                padding: "14px 16px",
                background: COLORS.bg.surface,
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`,
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* Numara dairesi */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: `${group.color}20`,
                  color: group.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {step.scan}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.muted,
                    marginBottom: "2px",
                  }}
                >
                  {step.scan}. Okutma
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.text,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.muted,
                    fontFamily: "monospace",
                    marginTop: "2px",
                  }}
                >
                  {step.stationName}
                </div>
              </div>
              {/* Ok (aralarında) */}
              {i < group.steps.length - 1 && group.hasWaitRule && (
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: COLORS.warning || "#f59e0b",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 600,
                  }}
                >
                  <Clock size={12} /> 30dk
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== İSTASYON KARTLARI ===== */}
      {loading ? (
        <Card title="Yükleniyor...">
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: COLORS.muted,
            }}
          >
            <RefreshCw
              size={32}
              style={{
                animation: "spin 1s linear infinite",
                margin: "0 auto 12px",
                display: "block",
              }}
            />
            İstasyonlar yükleniyor...
          </div>
        </Card>
      ) : stations.length === 0 ? (
        <Card title={`${group.label} İstasyonları`}>
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: COLORS.muted,
            }}
          >
            <Activity
              size={48}
              style={{
                margin: "0 auto 12px",
                display: "block",
                opacity: 0.5,
              }}
            />
            <p style={{ marginBottom: "8px" }}>
              Bu gruba ait istasyon bulunamadı.
            </p>
            <p style={{ fontSize: 12, marginBottom: "20px" }}>
              Beklenen istasyonlar:{" "}
              <strong>{group.stationNames.join(", ")}</strong>
            </p>
            <Button variant="primary" onClick={onCreate}>
              İstasyon Oluştur
            </Button>
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              group={group}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* ===== TÜM İSTASYONLAR ÖZET ===== */}
      <AllStationsMap allStations={allStations} />
    </div>
  );
}

// -------------------------------------------------------
// StationCard
// -------------------------------------------------------

interface StationCardProps {
  station: StationDto;
  group: DeviceGroupDef;
  onToggle: (id: number) => void;
  onEdit: (station: StationDto) => void;
  onDelete: (id: number) => void;
}

/** Tekil istasyon kartı */
export function StationCard({
  station,
  group,
  onToggle,
  onEdit,
  onDelete,
}: StationCardProps) {
  const step = group.steps.find(
    (s) => s.stationName.toUpperCase() === station.name.toUpperCase()
  );

  return (
    <div
      style={{
        padding: "20px",
        background: COLORS.bg.surface,
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `4px solid ${group.color}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Üst bilgi */}
      <div
        style={{
          marginBottom: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: COLORS.text,
                margin: 0,
              }}
            >
              {station.name}
            </h3>
            {step && <Badge variant="info">{step.scan}. Okutma</Badge>}
          </div>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
            {step?.label || station.description || "—"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Badge variant={station.active ? "success" : "secondary"}>
            {station.active ? "Aktif" : "Pasif"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(station.id)}
            title={station.active ? "Durdur" : "Başlat"}
          >
            <Power
              size={16}
              color={station.active ? COLORS.success : COLORS.muted}
            />
          </Button>
        </div>
      </div>

      {/* Cihaz bilgileri */}
      {station.deviceType && (
        <div
          style={{
            padding: "10px 12px",
            background: `${group.color}06`,
            borderRadius: RADIUS.sm,
            marginBottom: "12px",
            fontSize: 12,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: COLORS.muted }}>Cihaz:</span>
            <span style={{ fontWeight: 600, color: COLORS.text }}>
              {station.deviceModel || station.deviceType || "—"}
            </span>
          </div>
          {station.connectionType && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.muted }}>Bağlantı:</span>
              <span style={{ fontWeight: 500, color: COLORS.text }}>
                {station.connectionType.toUpperCase()}
              </span>
            </div>
          )}
          {station.ipAddress && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.muted }}>IP:</span>
              <span
                style={{
                  fontWeight: 500,
                  color: COLORS.text,
                  fontFamily: "monospace",
                }}
              >
                {station.ipAddress}
              </span>
            </div>
          )}
        </div>
      )}

      {/* İstatistikler */}
      <div
        style={{
          padding: "12px",
          background: COLORS.bg.main,
          borderRadius: RADIUS.sm,
          marginBottom: "12px",
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              color: COLORS.muted,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ScanBarcode size={12} /> Bugün Okutma:
          </span>
          <span style={{ fontWeight: 600, color: COLORS.text }}>
            {station.scanCountToday || 0}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span
            style={{
              color: COLORS.muted,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Clock size={12} /> Son İşlem:
          </span>
          <span style={{ fontWeight: 500, color: COLORS.text }}>
            {station.lastScanAt
              ? new Date(station.lastScanAt).toLocaleTimeString("tr-TR")
              : "—"}
          </span>
        </div>
      </div>

      {/* 30 dk kuralı uyarısı */}
      {group.hasWaitRule && step && step.scan === 2 && (
        <div
          style={{
            padding: "8px 12px",
            background: `${COLORS.warning || "#f59e0b"}10`,
            borderRadius: RADIUS.sm,
            marginBottom: "12px",
            fontSize: 11,
            color: COLORS.warning || "#f59e0b",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={14} />
          2. okutma, 1. okutmadan en az 30 dakika sonra yapılmalıdır.
        </div>
      )}

      {/* Aksiyonlar */}
      <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
        <Button variant="secondary" size="sm" onClick={() => onEdit(station)}>
          <Edit2 size={14} /> Düzenle
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(station.id)}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// AllStationsMap
// -------------------------------------------------------

interface AllStationsMapProps {
  allStations: StationDto[];
}

/** Tüm cihaz-istasyon haritası özet bileşeni */
export function AllStationsMap({ allStations }: AllStationsMapProps) {
  return (
    <div
      style={{
        marginTop: "32px",
        padding: "16px",
        background: COLORS.bg.surface,
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.text,
          marginBottom: "12px",
        }}
      >
        Tüm Cihaz-İstasyon Haritası
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "12px",
        }}
      >
        {DEVICE_GROUPS.map((g) => {
          const gStations = allStations.filter((s) =>
            g.stationNames.some(
              (name) => s.name.toUpperCase() === name.toUpperCase()
            )
          );
          const allActive =
            gStations.length > 0 && gStations.every((s) => s.active);

          return (
            <div
              key={g.key}
              style={{
                padding: "12px 14px",
                background: COLORS.bg.main,
                borderRadius: RADIUS.sm,
                borderLeft: `3px solid ${g.color}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <span style={{ color: g.color }}>{g.icon}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: COLORS.text,
                  }}
                >
                  {g.deviceName}
                </span>
                <span style={{ fontSize: 12, color: COLORS.muted }}>
                  ({g.label})
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                {g.steps.map((s) => s.stationName).join(" → ")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginTop: "6px",
                  fontSize: 11,
                }}
              >
                {allActive ? (
                  <>
                    <CheckCircle2
                      size={12}
                      color={COLORS.success || "#10b981"}
                    />
                    <span
                      style={{
                        color: COLORS.success || "#10b981",
                        fontWeight: 600,
                      }}
                    >
                      Tüm istasyonlar aktif
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle
                      size={12}
                      color={COLORS.warning || "#f59e0b"}
                    />
                    <span
                      style={{
                        color: COLORS.warning || "#f59e0b",
                        fontWeight: 600,
                      }}
                    >
                      {gStations.length === 0
                        ? "İstasyon tanımlı değil"
                        : `${gStations.filter((s) => !s.active).length} pasif`}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
