import type { AppPage } from "../../utils/appNavigation";

export interface NavigationRouteMeta {
  page: AppPage;
  title: string;
  navLabel: string;
  description: string;
}

export const ORDER_ROUTE_META = {
  orderList: {
    page: "orders",
    title: "Siparişler",
    navLabel: "Sipariş Listesi",
    description: "Sipariş listesi ve operasyon kuyruğu",
  },
  newOrder: {
    page: "order-editor",
    title: "Yeni Sipariş",
    navLabel: "Yeni Sipariş",
    description: "Yeni sipariş fişi çalışma alanını aç",
  },
  orderForm: {
    page: "siparis-fisi",
    title: "Sipariş Fişi",
    navLabel: "Sipariş Fişi",
    description: "Seçili siparişi gerçek OrderEntry yüzeyinde aç",
  },
  workflowInbox: {
    page: "ocr-havuzu",
    title: "OCR Havuzu",
    navLabel: "OCR Havuzu",
    description: "OCR kayıt kuyruğunu izle ve kayıt seç",
  },
  workflowReview: {
    page: "ocr-kontrol",
    title: "OCR Kontrol",
    navLabel: "OCR Kontrol",
    description: "OCR sonucunu kontrol et, eşleştir ve blocker çöz",
  },
  workflowEditing: {
    page: "siparis-duzenleme",
    title: "Sipariş Kontrol",
    navLabel: "Sipariş Kontrol",
    description: "Workflow faz 3 — teknik finalizasyon ve programsal bilgi birleştirme",
  },
  workflowExport: {
    page: "optiplan-job",
    title: "OptiPlanning",
    navLabel: "OptiPlanning",
    description: "Faz 4 — .opj / .xlsx üretim çıktısı ve veri gölü aktarımı",
  },
  optiplanJob: {
    page: "optiplan-order",
    title: "OptiPlanning Job",
    navLabel: "OptiPlanning Job",
    description: "Sipariş fişi üzerinden job hazırlığı",
  },
  quoteForm: {
    page: "teklif-fisi",
    title: "Teklif Fişi",
    navLabel: "Teklif Fişi",
    description: "Teklif başlıkları, satırlar ve revizyon akışı",
  },
  stockCard: {
    page: "stok-karti",
    title: "Stok Kartı",
    navLabel: "Stok Kartı",
    description: "Stok kartları ve hareket tablosu",
  },
  customerCard: {
    page: "cari-karti",
    title: "Cari Kartı",
    navLabel: "Cari Kartı",
    description: "Cari kart listesi ve detay görünümü",
  },
} as const satisfies Record<string, NavigationRouteMeta>;

export const ORDER_MODULE_SURFACE_ROUTES = [
  ORDER_ROUTE_META.orderForm,
  ORDER_ROUTE_META.quoteForm,
  ORDER_ROUTE_META.stockCard,
  ORDER_ROUTE_META.customerCard,
] as const satisfies readonly NavigationRouteMeta[];
