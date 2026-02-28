/**
 * Constants and configuration for Admin components
 */

/**
 * Station definitions with scan rules and workflow
 */
export const STATION_DEFINITIONS = {
  HAZIRLIK: {
    name: "HAZIRLIK",
    order: 1,
    displayName: "Hazırlık & Kutu Açma",
    description: "Hammadde kontrolü ve kutu açma işlemleri",
    icon: "package",
    color: "#3B8BF5",
    scanRule: "Giriş taraması (tek okuma)",
    requiresSecondScan: false,
    allowedNext: ["EBATLAMA"],
    device: "Mobil Cihaz / Tablet"
  },
  EBATLAMA: {
    name: "EBATLAMA",
    order: 2,
    displayName: "Ebatlama",
    description: "Parçaların ölçü kesimi ve hazırlanması",
    icon: "scissors",
    color: "#4ADE80",
    scanRule: "İlk okuma (giriş) + İkinci okuma (çıkış - min 30dk)",
    requiresSecondScan: true,
    secondScanMinutes: 30,
    allowedNext: ["BANTLAMA", "KONTROL"],
    device: "El Terminali / QR Scanner"
  },
  BANTLAMA: {
    name: "BANTLAMA",
    order: 3,
    displayName: "Bantlama",
    description: "Kenar bantlama işlemi",
    icon: "ruler",
    color: "#FBBF24",
    scanRule: "İlk okuma (giriş) + İkinci okuma (çıkış - min 30dk)",
    requiresSecondScan: true,
    secondScanMinutes: 30,
    allowedNext: ["KONTROL"],
    device: "Entegre QR Okuyucu / El Terminali"
  },
  KONTROL: {
    name: "KONTROL",
    order: 4,
    displayName: "Kalite Kontrol",
    description: "Ürün kalite kontrol noktası",
    icon: "check-circle",
    color: "#A78BFA",
    scanRule: "Tek okuma (kontrol onayı)",
    requiresSecondScan: false,
    allowedNext: ["TESLIM"],
    device: "Mobil Cihaz / Masaüstü Bilgisayar"
  },
  TESLIM: {
    name: "TESLIM",
    order: 5,
    displayName: "Teslim & Sevk",
    description: "Nihai teslim ve sevkiyat",
    icon: "truck",
    color: "#F43F5E",
    scanRule: "Tek okuma (teslim onayı)",
    requiresSecondScan: false,
    allowedNext: [],
    device: "Mobil Cihaz / Masaüstü Bilgisayar"
  },
} as const;

/**
 * Device types for QR code scanning
 */
export const DEVICE_TYPES = [
  {
    id: 1,
    name: "Mobil Cihaz / Tablet",
    icon: "smartphone",
    description: "Akıllı telefon veya tablet üzerinden tarama",
    usage: "Esnek ve hareketli istasyonlarda (Hazırlık, Kontrol, Teslim)",
    features: [
      "Arka kamera ile QR tarama",
      "Tarayıcı tabanlı uygulama",
      "Düşük maliyet",
      "Kolay erişim"
    ]
  },
  {
    id: 2,
    name: "El Terminali / QR Scanner",
    icon: "flashlight",
    description: "Profesyonel el tipi barkod okuyucu",
    usage: "Yoğun kullanımlı istasyonlarda (Ebatlama, Bantlama)",
    features: [
      "Hızlı ve doğru okuma",
      "USB veya Bluetooth bağlantı",
      "Dayanıklı yapı",
      "Uzun pil ömrü"
    ]
  },
  {
    id: 3,
    name: "Entegre QR Okuyucu",
    icon: "monitor",
    description: "Makineye entegre sabit QR okuyucu",
    usage: "Otomatik geçişli istasyonlarda (Ebatlama, Bantlama)",
    features: [
      "Eller serbest çalışma",
      "Otomatik tetikleme",
      "7/24 kesintisiz çalışma",
      "Yüksek okuma hızı"
    ]
  },
  {
    id: 4,
    name: "Masaüstü Bilgisayar + Webcam",
    icon: "laptop",
    description: "Masaüstü bilgisayar kamerası ile tarama",
    usage: "Ofis ortamında (Kontrol, Teslim, Planlama)",
    features: [
      "Webcam ile QR tarama",
      "Detaylı veri girişi",
      "Raporlama ve analiz",
      "Büyük ekran avantajı"
    ]
  }
] as const;
