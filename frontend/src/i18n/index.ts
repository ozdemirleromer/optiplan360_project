import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Turkish translations
const tr = {
  common: {
    welcome: 'Hoş Geldiniz',
    login: 'Giriş Yap',
    logout: 'Çıkış Yap',
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    edit: 'Düzenle',
    create: 'Oluştur',
    search: 'Ara',
    filter: 'Filtrele',
    export: 'Dışa Aktar',
    import: 'İçe Aktar',
    loading: 'Yükleniyor...',
    error: 'Hata',
    success: 'Başarılı',
    warning: 'Uyarı',
    info: 'Bilgi',
    confirm: 'Onayla',
    close: 'Kapat',
    back: 'Geri',
    next: 'İleri',
    submit: 'Gönder',
    required: 'Zorunlu',
    optional: 'Opsiyonel',
  },
  navigation: {
    dashboard: 'Gösterge Paneli',
    orders: 'Siparişler',
    kanban: 'Kanban',
    crm: 'CRM',
    reports: 'Raporlar',
    settings: 'Ayarlar',
    integrations: 'Entegrasyonlar',
    users: 'Kullanıcılar',
    stations: 'İstasyonlar',
    payments: 'Tahsilatlar',
  },
  orders: {
    title: 'Siparişler',
    newOrder: 'Yeni Sipariş',
    orderNumber: 'Sipariş No',
    customer: 'Müşteri',
    status: 'Durum',
    date: 'Tarih',
    deliveryDate: 'Teslim Tarihi',
    amount: 'Tutar',
    description: 'Açıklama',
    status_new: 'Yeni',
    status_in_production: 'Üretimde',
    status_ready: 'Hazır',
    status_delivered: 'Teslim Edildi',
    status_cancelled: 'İptal Edildi',
  },
  dashboard: {
    todayOrders: 'Bugün Gelen',
    inProduction: 'Üretimde',
    ready: 'Hazır',
    completed: 'Tamamlanan',
    activeStations: 'Aktif İstasyon',
    totalScans: 'Toplam Tarama',
    probabilityInsights: 'Olasılık Analizi',
    capacityPlan: 'Kapasite Planı',
    overview: 'Genel Durum',
  },
  auth: {
    username: 'Kullanıcı Adı',
    password: 'Şifre',
    email: 'E-posta',
    rememberMe: 'Beni Hatırla',
    forgotPassword: 'Şifremi Unuttum',
    invalidCredentials: 'Geçersiz kullanıcı adı veya şifre',
  },
  validation: {
    required: '{{field}} alanı zorunludur',
    minLength: '{{field}} en az {{min}} karakter olmalıdır',
    maxLength: '{{field}} en fazla {{max}} karakter olmalıdır',
    email: 'Geçerli bir e-posta adresi giriniz',
    number: 'Geçerli bir sayı giriniz',
    date: 'Geçerli bir tarih giriniz',
  },
};

// English translations
const en = {
  common: {
    welcome: 'Welcome',
    login: 'Login',
    logout: 'Logout',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
    confirm: 'Confirm',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    submit: 'Submit',
    required: 'Required',
    optional: 'Optional',
  },
  navigation: {
    dashboard: 'Dashboard',
    orders: 'Orders',
    kanban: 'Kanban',
    crm: 'CRM',
    reports: 'Reports',
    settings: 'Settings',
    integrations: 'Integrations',
    users: 'Users',
    stations: 'Stations',
    payments: 'Payments',
  },
  orders: {
    title: 'Orders',
    newOrder: 'New Order',
    orderNumber: 'Order No',
    customer: 'Customer',
    status: 'Status',
    date: 'Date',
    deliveryDate: 'Delivery Date',
    amount: 'Amount',
    description: 'Description',
    status_new: 'New',
    status_in_production: 'In Production',
    status_ready: 'Ready',
    status_delivered: 'Delivered',
    status_cancelled: 'Cancelled',
  },
  dashboard: {
    todayOrders: 'Today\'s Orders',
    inProduction: 'In Production',
    ready: 'Ready',
    completed: 'Completed',
    activeStations: 'Active Stations',
    totalScans: 'Total Scans',
    probabilityInsights: 'Probability Insights',
    capacityPlan: 'Capacity Plan',
    overview: 'Overview',
  },
  auth: {
    username: 'Username',
    password: 'Password',
    email: 'Email',
    rememberMe: 'Remember Me',
    forgotPassword: 'Forgot Password',
    invalidCredentials: 'Invalid username or password',
  },
  validation: {
    required: '{{field}} is required',
    minLength: '{{field}} must be at least {{min}} characters',
    maxLength: '{{field}} must be at most {{max}} characters',
    email: 'Please enter a valid email address',
    number: 'Please enter a valid number',
    date: 'Please enter a valid date',
  },
};

// German translations
const de = {
  common: {
    welcome: 'Willkommen',
    login: 'Anmelden',
    logout: 'Abmelden',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    create: 'Erstellen',
    search: 'Suchen',
    filter: 'Filtern',
    export: 'Exportieren',
    import: 'Importieren',
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    warning: 'Warnung',
    info: 'Info',
    confirm: 'Bestätigen',
    close: 'Schließen',
    back: 'Zurück',
    next: 'Weiter',
    submit: 'Absenden',
    required: 'Erforderlich',
    optional: 'Optional',
  },
  navigation: {
    dashboard: 'Dashboard',
    orders: 'Aufträge',
    kanban: 'Kanban',
    crm: 'CRM',
    reports: 'Berichte',
    settings: 'Einstellungen',
    integrations: 'Integrationen',
    users: 'Benutzer',
    stations: 'Stationen',
    payments: 'Zahlungen',
  },
  orders: {
    title: 'Aufträge',
    newOrder: 'Neuer Auftrag',
    orderNumber: 'Auftragsnr.',
    customer: 'Kunde',
    status: 'Status',
    date: 'Datum',
    deliveryDate: 'Lieferdatum',
    amount: 'Betrag',
    description: 'Beschreibung',
    status_new: 'Neu',
    status_in_production: 'In Produktion',
    status_ready: 'Bereit',
    status_delivered: 'Geliefert',
    status_cancelled: 'Storniert',
  },
  dashboard: {
    todayOrders: 'Heutige Aufträge',
    inProduction: 'In Produktion',
    ready: 'Bereit',
    completed: 'Abgeschlossen',
    activeStations: 'Aktive Stationen',
    totalScans: 'Gesamt Scans',
    probabilityInsights: 'Wahrscheinlichkeitsanalyse',
    capacityPlan: 'Kapazitätsplan',
    overview: 'Überblick',
  },
  auth: {
    username: 'Benutzername',
    password: 'Passwort',
    email: 'E-Mail',
    rememberMe: 'Angemeldet bleiben',
    forgotPassword: 'Passwort vergessen',
    invalidCredentials: 'Ungültiger Benutzername oder Passwort',
  },
  validation: {
    required: '{{field}} ist erforderlich',
    minLength: '{{field}} muss mindestens {{min}} Zeichen sein',
    maxLength: '{{field}} darf höchstens {{max}} Zeichen sein',
    email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    number: 'Bitte geben Sie eine gültige Nummer ein',
    date: 'Bitte geben Sie ein gültiges Datum ein',
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'tr',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
