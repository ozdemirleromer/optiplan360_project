/**
 * Cihaz Yönetimi — Sabit Veriler ve Yardımcı Fonksiyonlar
 */

import type { DeviceForm, DriverInfo } from "./deviceManagementTypes";
import type { StationDto } from "../../services/adminService";
import { COLORS } from "../../components/Shared/constants";

/* ---------- Sabit tanımlar ---------- */

export const DEVICE_TYPES = [
  { value: "", label: "Seçiniz..." },
  { value: "barcode_reader", label: "Barkod Okuyucu" },
  { value: "handheld_terminal", label: "El Terminali" },
  { value: "mobile_device", label: "Mobil Cihaz" },
  { value: "desktop_pc", label: "Masaüstü PC" },
  { value: "integrated_reader", label: "Entegre Okuyucu" },
  { value: "label_printer", label: "Etiket Yazıcı" },
  { value: "scanner_gun", label: "Barkod Tabancası" },
] as const;

export const CONNECTION_TYPES = [
  { value: "", label: "Seçiniz..." },
  { value: "usb", label: "USB" },
  { value: "bluetooth", label: "Bluetooth" },
  { value: "wifi", label: "WiFi" },
  { value: "ethernet", label: "Ethernet" },
  { value: "serial", label: "Seri Port (RS-232)" },
  { value: "webcam", label: "Webcam" },
] as const;

export const DEVICE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DEVICE_TYPES.filter((d) => d.value).map((d) => [d.value, d.label])
);

export const CONNECTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONNECTION_TYPES.filter((c) => c.value).map((c) => [c.value, c.label])
);

export const EMPTY_FORM: DeviceForm = {
  deviceType: "",
  deviceModel: "",
  deviceSerialNumber: "",
  ipAddress: "",
  connectionType: "",
  installationDate: "",
  lastMaintenanceDate: "",
};

export const DRIVER_INFO: Record<string, DriverInfo> = {
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

/* ---------- Yardımcı fonksiyonlar ---------- */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR");
}

export function getDeviceStatus(station: StationDto): {
  label: string;
  color: string;
  statusType: "unassigned" | "inactive" | "active";
} {
  if (!station.deviceType) {
    return {
      label: "Cihaz Atanmamış",
      color: COLORS.muted,
      statusType: "unassigned",
    };
  }

  if (!station.active) {
    return {
      label: "Pasif",
      color: COLORS.warning || "#f59e0b",
      statusType: "inactive",
    };
  }

  return {
    label: "Aktif & Bağlı",
    color: COLORS.success || "#10b981",
    statusType: "active",
  };
}
