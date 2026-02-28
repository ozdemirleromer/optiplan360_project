/**
 * Cihaz Yönetimi Bileşeni
 * İstasyonlara bağlı cihazların (barkod okuyucu, el terminali vb.) tanımı,
 * yapılandırması ve kurulum takibi.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Save,
  RefreshCw,
  Wifi,
  WifiOff,
  Monitor,
  Smartphone,
  ScanBarcode,
  Cable,
  Bluetooth,
  CalendarDays,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  DownloadCloud,
} from "lucide-react";
import { Button, Card, Badge, Input, Select, Modal } from "../Shared";
import { COLORS, RADIUS } from "../Shared/constants";
import { adminService } from "../../services/adminService";
import { useToast } from "../../contexts/ToastContext";
import type { StationDto } from "../../services/adminService";

/* ---------- Sabit tanımlar ---------- */

const DEVICE_TYPES = [
  { value: "", label: "Seçiniz..." },
  { value: "barcode_reader", label: "Barkod Okuyucu" },
  { value: "handheld_terminal", label: "El Terminali" },
  { value: "mobile_device", label: "Mobil Cihaz" },
  { value: "desktop_pc", label: "Masaüstü PC" },
  { value: "integrated_reader", label: "Entegre Okuyucu" },
  { value: "label_printer", label: "Etiket Yazıcı" },
  { value: "scanner_gun", label: "Barkod Tabancası" },
] as const;

const CONNECTION_TYPES = [
  { value: "", label: "Seçiniz..." },
  { value: "usb", label: "USB" },
  { value: "bluetooth", label: "Bluetooth" },
  { value: "wifi", label: "WiFi" },
  { value: "ethernet", label: "Ethernet" },
  { value: "serial", label: "Seri Port (RS-232)" },
  { value: "webcam", label: "Webcam" },
] as const;

const DEVICE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DEVICE_TYPES.filter((d) => d.value).map((d) => [d.value, d.label])
);

const CONNECTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONNECTION_TYPES.filter((c) => c.value).map((c) => [c.value, c.label])
);

type DeviceForm = {
  deviceType: string;
  deviceModel: string;
  deviceSerialNumber: string;
  ipAddress: string;
  connectionType: string;
  installationDate: string;
  lastMaintenanceDate: string;
};

const EMPTY_FORM: DeviceForm = {
  deviceType: "",
  deviceModel: "",
  deviceSerialNumber: "",
  ipAddress: "",
  connectionType: "",
  installationDate: "",
  lastMaintenanceDate: "",
};

/* ---------- Yardımcı fonksiyonlar ---------- */

function getDeviceIcon(type: string | null | undefined) {
  switch (type) {
    case "barcode_reader":
    case "scanner_gun":
      return <ScanBarcode size={20} />;
    case "handheld_terminal":
    case "mobile_device":
      return <Smartphone size={20} />;
    case "desktop_pc":
      return <Monitor size={20} />;
    case "integrated_reader":
      return <Cpu size={20} />;
    case "label_printer":
      return <Cpu size={20} />;
    default:
      return <Cpu size={20} />;
  }
}

function getConnectionIcon(type: string | null | undefined) {
  switch (type) {
    case "wifi":
      return <Wifi size={14} />;
    case "bluetooth":
      return <Bluetooth size={14} />;
    case "usb":
    case "serial":
      return <Cable size={14} />;
    case "ethernet":
      return <Cable size={14} />;
    default:
      return <WifiOff size={14} />;
  }
}

function getDeviceStatus(station: StationDto): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  if (!station.deviceType) {
    return {
      label: "Cihaz Atanmamış",
      color: COLORS.muted,
      icon: <XCircle size={14} />,
    };
  }
  if (!station.active) {
    return {
      label: "Pasif",
      color: COLORS.warning?.DEFAULT || "#f59e0b",
      icon: <AlertTriangle size={14} />,
    };
  }
  return {
    label: "Aktif & Bağlı",
    color: COLORS.success?.DEFAULT || "#10b981",
    icon: <CheckCircle2 size={14} />,
  };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR");
}

/* ---------- Bileşen ---------- */

export function DeviceManagement() {
  const [stations, setStations] = useState<StationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<DeviceForm>(EMPTY_FORM);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedDriverDevice, setSelectedDriverDevice] = useState<string>("");
  const { addToast } = useToast();

  const loadStations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminService.getStations();
      setStations(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "İstasyonlar yüklenemedi";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  /* Form yükleme */
  function openEdit(station: StationDto) {
    setEditingStationId(station.id);
    setFormData({
      deviceType: station.deviceType || "",
      deviceModel: station.deviceModel || "",
      deviceSerialNumber: station.deviceSerialNumber || "",
      ipAddress: station.ipAddress || "",
      connectionType: station.connectionType || "",
      installationDate: station.installationDate
        ? station.installationDate.slice(0, 10)
        : "",
      lastMaintenanceDate: station.lastMaintenanceDate
        ? station.lastMaintenanceDate.slice(0, 10)
        : "",
    });
  }

  /* Kaydet */
  async function handleSave() {
    if (editingStationId === null) return;

    try {
      setSaving(true);

      // snake_case'e çevir — backend snake_case bekliyor
      const payload: Record<string, unknown> = {
        device_type: formData.deviceType || null,
        device_model: formData.deviceModel || null,
        device_serial_number: formData.deviceSerialNumber || null,
        ip_address: formData.ipAddress || null,
        connection_type: formData.connectionType || null,
        installation_date: formData.installationDate || null,
        last_maintenance_date: formData.lastMaintenanceDate || null,
      };

      await adminService.updateStation(editingStationId, payload);
      addToast("Cihaz bilgileri güncellendi", "success");
      setEditingStationId(null);
      setFormData(EMPTY_FORM);
      await loadStations();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Güncelleme başarısız";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  }

  /* Cihaz kaldır */
  async function handleRemoveDevice(stationId: number) {
    try {
      setSaving(true);
      await adminService.updateStation(stationId, {
        device_type: null,
        device_model: null,
        device_serial_number: null,
        ip_address: null,
        connection_type: null,
        installation_date: null,
        last_maintenance_date: null,
      } as Record<string, unknown>);
      addToast("Cihaz bilgileri kaldırıldı", "success");
      await loadStations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "İşlem başarısız";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  }

  /* ------- Özet kartları ------- */
  const totalDevices = stations.filter((s) => s.deviceType).length;
  const activeDevices = stations.filter(
    (s) => s.deviceType && s.active
  ).length;
  const unassigned = stations.filter((s) => !s.deviceType).length;

  /* ---------- DRIVER MODAL İÇERİĞİ ---------- */
  const DRIVER_INFO: Record<string, { name: string; url: string; instructions: string[] }> = {
    barcode_reader: {
      name: "Barkod Okuyucu",
      url: "https://www.zebra.com/us/en/support-downloads.html",
      instructions: [
        "Cihazınızın marka ve modelini belirleyin",
        "Üretici web sitesinden uygun sürücüyü indirin",
        "Sürücü kurulumunu yönetici olarak çalıştırın",
        "Cihazı USB/Bluetooth ile bağlayarak test edin",
        "COM port veya HID modu ayarını yapılandırın",
      ],
    },
    handheld_terminal: {
      name: "El Terminali",
      url: "https://www.honeywell.com/us/en/support",
      instructions: [
        "El terminalinin firmware güncellemesini kontrol edin",
        "WiFi veya Bluetooth bağlantı ayarlarını yapılandırın",
        "Cihaz üzerinde uygulama kurulumunu gerçekleştirin",
        "Barkod okuma modülünü test edin",
        "Senkronizasyon ayarlarını yapın",
      ],
    },
    mobile_device: {
      name: "Mobil Cihaz",
      url: "#",
      instructions: [
        "Mobil cihaza uygulama marketinden istemci uygulamayı yükleyin",
        "WiFi ağına bağlanarak sunucu adresini girin",
        "Kimlik doğrulama bilgilerini tanımlayın",
        "Kamera izinlerini barkod okuma için etkinleştirin",
        "Test barkodu tarayarak bağlantıyı doğrulayın",
      ],
    },
    desktop_pc: {
      name: "Masaüstü PC",
      url: "#",
      instructions: [
        "İşletim sistemi güncellemelerini yükleyin",
        "OptiPlan360 istemci yazılımını kurun",
        "Bağlı barkod okuyucu veya çevre birimlerin sürücülerini yükleyin",
        "Ağ ayarlarını ve sunucu bağlantısını yapılandırın",
        "Yazılım lisansını etkinleştirin",
      ],
    },
    integrated_reader: {
      name: "Entegre Okuyucu",
      url: "#",
      instructions: [
        "Entegre okuyucunun PLC/kontrol ünitesine doğru bağlandığını doğrulayın",
        "Seri port veya Ethernet bağlantı parametrelerini ayarlayın",
        "Protokol yapılandırmasını (Modbus, TCP/IP vb.) gerçekleştirin",
        "Okuma mesafesi ve hassasiyet kalibrasyonunu yapın",
        "Sürekli okuma testini başlatın",
      ],
    },
    label_printer: {
      name: "Etiket Yazıcı",
      url: "https://www.zebra.com/us/en/support-downloads.html",
      instructions: [
        "Yazıcı sürücüsünü üretici sitesinden indirin ve kurun",
        "USB veya ağ bağlantısını yapılandırın",
        "Etiket boyutunu ve yazdırma yoğunluğunu ayarlayın",
        "Barkod format şablonunu (ZPL/EPL) yükleyin",
        "Test etiketi yazdırarak kaliteyi doğrulayın",
      ],
    },
    scanner_gun: {
      name: "Barkod Tabancası",
      url: "#",
      instructions: [
        "Barkod tabancasını USB ile bilgisayara bağlayın",
        "HID Keyboard modunda otomatik tanınacaktır",
        "Gerekirse üretici yapılandırma barkodlarıyla ayar yapın",
        "Suffix (Enter/Tab) ayarını etkinleştirin",
        "Test barkodu okuyarak doğrulayın",
      ],
    },
  };

  return (
    <div>
      {/* KPI Özet Kartları */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            padding: "16px",
            background: COLORS.bg.surface,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{ fontSize: 12, color: COLORS.muted, marginBottom: "4px" }}
          >
            Toplam İstasyon
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text }}>
            {stations.length}
          </div>
        </div>
        <div
          style={{
            padding: "16px",
            background: COLORS.bg.surface,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{ fontSize: 12, color: COLORS.muted, marginBottom: "4px" }}
          >
            Cihaz Tanımlı
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.success?.DEFAULT || "#10b981",
            }}
          >
            {totalDevices}
          </div>
        </div>
        <div
          style={{
            padding: "16px",
            background: COLORS.bg.surface,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{ fontSize: 12, color: COLORS.muted, marginBottom: "4px" }}
          >
            Aktif Cihaz
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.primary?.DEFAULT || "#6366f1",
            }}
          >
            {activeDevices}
          </div>
        </div>
        <div
          style={{
            padding: "16px",
            background: COLORS.bg.surface,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{ fontSize: 12, color: COLORS.muted, marginBottom: "4px" }}
          >
            Cihaz Atanmamış
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.warning?.DEFAULT || "#f59e0b",
            }}
          >
            {unassigned}
          </div>
        </div>
      </div>

      {/* Sürücü/Kurulum Rehberi Butonu */}
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowDriverModal(true)}
        >
          <DownloadCloud size={16} /> Kurulum Rehberi
        </Button>
      </div>

      {/* İstasyon Listesi */}
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
            Cihaz bilgileri yükleniyor...
          </div>
        </Card>
      ) : stations.length === 0 ? (
        <Card title="İstasyon Yok">
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: COLORS.muted,
            }}
          >
            <Cpu
              size={48}
              style={{
                margin: "0 auto 12px",
                display: "block",
                opacity: 0.5,
              }}
            />
            <p>Henüz istasyon tanımlanmamış. Önce İstasyonlar sekmesinden istasyon oluşturun.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {stations.map((station) => {
            const status = getDeviceStatus(station);
            const isExpanded = expandedId === station.id;
            const isEditing = editingStationId === station.id;

            return (
              <div
                key={station.id}
                style={{
                  background: COLORS.bg.surface,
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`,
                  overflow: "hidden",
                }}
              >
                {/* İstasyon Başlığı */}
                <div
                  style={{
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : station.id)
                  }
                >
                  {/* Cihaz ikonu */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: RADIUS.md,
                      background: station.deviceType
                        ? `${COLORS.primary?.DEFAULT || "#6366f1"}15`
                        : `${COLORS.muted}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: station.deviceType
                        ? COLORS.primary?.DEFAULT || "#6366f1"
                        : COLORS.muted,
                      flexShrink: 0,
                    }}
                  >
                    {getDeviceIcon(station.deviceType)}
                  </div>

                  {/* İstasyon bilgileri */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: COLORS.text,
                        marginBottom: "2px",
                      }}
                    >
                      {station.name}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: COLORS.muted,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {station.deviceType ? (
                        <>
                          <span>
                            {DEVICE_TYPE_LABELS[station.deviceType] ||
                              station.deviceType}
                          </span>
                          {station.deviceModel && (
                            <>
                              <span style={{ opacity: 0.4 }}>|</span>
                              <span>{station.deviceModel}</span>
                            </>
                          )}
                          {station.connectionType && (
                            <>
                              <span style={{ opacity: 0.4 }}>|</span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                {getConnectionIcon(station.connectionType)}
                                {CONNECTION_TYPE_LABELS[
                                  station.connectionType
                                ] || station.connectionType}
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        <span style={{ fontStyle: "italic" }}>
                          Henüz cihaz atanmamış
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Durum badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Badge
                      variant={
                        !station.deviceType
                          ? "secondary"
                          : station.active
                          ? "success"
                          : "warning"
                      }
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {status.icon} {status.label}
                      </span>
                    </Badge>

                    {isExpanded ? (
                      <ChevronUp size={18} color={COLORS.muted} />
                    ) : (
                      <ChevronDown size={18} color={COLORS.muted} />
                    )}
                  </div>
                </div>

                {/* Genişletilmiş içerik */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: `1px solid ${COLORS.border}`,
                      padding: "16px",
                    }}
                  >
                    {isEditing ? (
                      /* ---------- DÜZENLEME FORMU ---------- */
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                          gap: "16px",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.text,
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Cihaz Tipi *
                          </label>
                          <Select
                            value={formData.deviceType}
                            onChange={(val) =>
                              setFormData((p) => ({
                                ...p,
                                deviceType: String(val),
                              }))
                            }
                            options={DEVICE_TYPES.map((d) => ({
                              value: d.value,
                              label: d.label,
                            }))}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.text,
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Marka / Model
                          </label>
                          <Input
                            value={formData.deviceModel}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                deviceModel: e.target.value,
                              }))
                            }
                            placeholder="Örn: Zebra DS2208"
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.text,
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Seri Numarası
                          </label>
                          <Input
                            value={formData.deviceSerialNumber}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                deviceSerialNumber: e.target.value,
                              }))
                            }
                            placeholder="Cihaz seri numarası"
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.text,
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Bağlantı Tipi
                          </label>
                          <Select
                            value={formData.connectionType}
                            onChange={(val) =>
                              setFormData((p) => ({
                                ...p,
                                connectionType: String(val),
                              }))
                            }
                            options={CONNECTION_TYPES.map((c) => ({
                              value: c.value,
                              label: c.label,
                            }))}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.text,
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            IP Adresi
                          </label>
                          <Input
                            value={formData.ipAddress}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                ipAddress: e.target.value,
                              }))
                            }
                            placeholder="Örn: 192.168.1.100"
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.text,
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Kurulum Tarihi
                          </label>
                          <Input
                            type="date"
                            value={formData.installationDate}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                installationDate: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: COLORS.text,
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Son Bakım Tarihi
                          </label>
                          <Input
                            type="date"
                            value={formData.lastMaintenanceDate}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                lastMaintenanceDate: e.target.value,
                              }))
                            }
                          />
                        </div>

                        {/* Form aksiyonları */}
                        <div
                          style={{
                            gridColumn: "1 / -1",
                            display: "flex",
                            gap: "10px",
                            justifyContent: "flex-end",
                            marginTop: "8px",
                          }}
                        >
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingStationId(null);
                              setFormData(EMPTY_FORM);
                            }}
                          >
                            İptal
                          </Button>
                          <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={saving || !formData.deviceType}
                          >
                            <Save size={16} />{" "}
                            {saving ? "Kaydediliyor..." : "Kaydet"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ---------- DETAY GÖRÜNÜMÜ ---------- */
                      <div>
                        {station.deviceType ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(200px, 1fr))",
                              gap: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <DetailItem
                              label="Cihaz Tipi"
                              value={
                                DEVICE_TYPE_LABELS[station.deviceType] ||
                                station.deviceType
                              }
                              icon={getDeviceIcon(station.deviceType)}
                            />
                            <DetailItem
                              label="Marka / Model"
                              value={station.deviceModel || "—"}
                            />
                            <DetailItem
                              label="Seri Numarası"
                              value={station.deviceSerialNumber || "—"}
                            />
                            <DetailItem
                              label="Bağlantı Tipi"
                              value={
                                station.connectionType
                                  ? CONNECTION_TYPE_LABELS[
                                      station.connectionType
                                    ] || station.connectionType
                                  : "—"
                              }
                              icon={getConnectionIcon(station.connectionType)}
                            />
                            <DetailItem
                              label="IP Adresi"
                              value={station.ipAddress || "—"}
                            />
                            <DetailItem
                              label="Kurulum Tarihi"
                              value={formatDate(station.installationDate)}
                              icon={<CalendarDays size={14} />}
                            />
                            <DetailItem
                              label="Son Bakım"
                              value={formatDate(station.lastMaintenanceDate)}
                              icon={<Wrench size={14} />}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: "20px",
                              textAlign: "center",
                              color: COLORS.muted,
                              marginBottom: "16px",
                            }}
                          >
                            <Cpu
                              size={32}
                              style={{
                                margin: "0 auto 8px",
                                display: "block",
                                opacity: 0.5,
                              }}
                            />
                            <p>
                              Bu istasyona henüz cihaz atanmamış. Cihaz
                              tanımlamak için "Cihaz Ata" butonuna tıklayın.
                            </p>
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            justifyContent: "flex-end",
                          }}
                        >
                          {station.deviceType && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Bu istasyondaki cihaz bilgilerini kaldırmak istediğinizden emin misiniz?"
                                  )
                                ) {
                                  handleRemoveDevice(station.id);
                                }
                              }}
                              disabled={saving}
                            >
                              <XCircle size={14} /> Cihazı Kaldır
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openEdit(station)}
                          >
                            {station.deviceType ? (
                              <>
                                <Wrench size={14} /> Düzenle
                              </>
                            ) : (
                              <>
                                <Cpu size={14} /> Cihaz Ata
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sürücü / Kurulum Rehberi Modal */}
      <Modal
        open={showDriverModal}
        onClose={() => {
          setShowDriverModal(false);
          setSelectedDriverDevice("");
        }}
        title="Cihaz Kurulum Rehberi"
      >
        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.text,
                marginBottom: "6px",
                display: "block",
              }}
            >
              Cihaz Tipi Seçin
            </label>
            <Select
              value={selectedDriverDevice}
              onChange={(val) => setSelectedDriverDevice(String(val))}
              options={DEVICE_TYPES.map((d) => ({
                value: d.value,
                label: d.label,
              }))}
            />
          </div>

          {selectedDriverDevice && DRIVER_INFO[selectedDriverDevice] && (
            <div
              style={{
                background: COLORS.bg.main,
                borderRadius: RADIUS.md,
                padding: "16px",
              }}
            >
              <h4
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.text,
                  marginBottom: "12px",
                }}
              >
                {DRIVER_INFO[selectedDriverDevice].name} — Kurulum Adımları
              </h4>

              <ol
                style={{
                  paddingLeft: "20px",
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {DRIVER_INFO[selectedDriverDevice].instructions.map(
                  (step, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13,
                        color: COLORS.text,
                        lineHeight: 1.5,
                      }}
                    >
                      {step}
                    </li>
                  )
                )}
              </ol>

              {DRIVER_INFO[selectedDriverDevice].url !== "#" && (
                <div style={{ marginTop: "16px" }}>
                  <a
                    href={DRIVER_INFO[selectedDriverDevice].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 13,
                      color: COLORS.primary?.DEFAULT || "#6366f1",
                      textDecoration: "underline",
                    }}
                  >
                    Üretici Destek Sayfası
                  </a>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button
              variant="ghost"
              onClick={() => {
                setShowDriverModal(false);
                setSelectedDriverDevice("");
              }}
            >
              Kapat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Alt bileşenler ---------- */

function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: "4px" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: COLORS.text,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
