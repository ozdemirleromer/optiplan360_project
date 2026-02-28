/**
 * Icon Mapping: Emoji to Lucide React
 * Comprehensive mapping for migrating from emoji to professional icon library
 * Last Updated: 2026-02-16
 * 
 * Usage:
 * import { ICON_MAPPING, getIconName, ICON_SIZES } from '@/config/iconMapping'
 * import * as Icons from 'lucide-react'
 * 
 * const iconName = ICON_MAPPING.edit ?? ICON_MAPPING.default // Returns 'Edit2' or fallback 'HelpCircle'
 * const IconComponent = Icons[iconName]
 */

/**
 * Main icon mapping - maps semantic names to Lucide React icon names
 */
export const ICON_MAPPING = {
  // CRUD Operations
  edit: 'Edit2',
  delete: 'Trash2',
  add: 'Plus',
  create: 'PlusCircle',
  remove: 'X',
  default: 'HelpCircle', // Fallback icon
  
  // Search & Filter
  search: 'Search',
  filter: 'Filter',
  filterX: 'FilterX',
  
  // Status & Validation
  check: 'Check',
  checkCircle: 'CheckCircle2',
  checkSquare: 'CheckSquare',
  success: 'CheckCircle2',
  
  // Alerts & Messages
  info: 'Info',
  warning: 'AlertTriangle',
  alert: 'AlertTriangle',
  alertTriangle: 'AlertTriangle',
  error: 'AlertCircle',
  close: 'X',
  
  // File Operations
  save: 'Save',
  download: 'Download',
  upload: 'Upload',
  export: 'Share2',
  import: 'FileUp',
  file: 'FileText',
  fileText: 'FileText',
  fileDownload: 'Download',
  
  // Security
  lock: 'Lock',
  unlock: 'LockOpen',
  eye: 'Eye',
  eyeOff: 'EyeOff',
  shield: 'Shield',
  
  // Navigation & Structure
  menu: 'Menu',
  menuSquare: 'MenuSquare',
  list: 'List',
  grid: 'Grid',
  home: 'Home',
  dashboard: 'LayoutDashboard',
  
  // Direction & Movement
  back: 'ArrowLeft',
  forward: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  refresh: 'RefreshCw',
  reload: 'RotateCw',
  expand: 'Maximize2',
  collapse: 'Minimize2',
  
  // Chevron Navigation (mobile friendly)
  chevronLeft: 'ChevronLeft',
  chevronRight: 'ChevronRight',
  chevronUp: 'ChevronUp',
  chevronDown: 'ChevronDown',
  
  // Charts & Analytics
  chart: 'BarChart3',
  pie: 'PieChart',
  line: 'TrendingUp',
  bar: 'BarChart2',
  area: 'AreaChart',
  trend: 'TrendingUp',
  trendDown: 'TrendingDown',
  
  // Communication
  chat: 'MessageSquare',
  message: 'MessageCircle',
  mail: 'Mail',
  send: 'Send',
  phone: 'Phone',
  call: 'PhoneCall',
  
  // Notifications
  bell: 'Bell',
  bellOff: 'BellOff',
  notification: 'Bell',
  
  // User & Account
  user: 'User',
  users: 'Users',
  account: 'User',
  profile: 'UserCircle',
  team: 'Users',
  crown: 'Crown',
  
  // Settings & Configuration
  settings: 'Settings',
  cog: 'Cog',
  sliders: 'Sliders',
  config: 'Settings',
  
  // Organization
  org: 'Building2',
  building: 'Building2',
  company: 'Building2',
  factory: 'Factory',
  
  // Location & Maps
  location: 'MapPin',
  map: 'Map',
  navigation: 'Navigation',
  pin: 'MapPin',
  
  // Links & References
  link: 'Link',
  external: 'ExternalLink',
  globe: 'Globe',
  web: 'Globe',
  
  // Time & Duration
  clock: 'Clock',
  calendar: 'Calendar',
  date: 'Calendar',
  time: 'Clock',
  timer: 'Timer',
  duration: 'Clock',
  
  // Finance & Payment
  card: 'CreditCard',
  money: 'DollarSign',
  dollar: 'DollarSign',
  payment: 'CreditCard',
  wallet: 'Wallet',
  invoice: 'Receipt',
  
  // Rating & Feedback
  star: 'Star',
  heart: 'Heart',
  thumbsUp: 'ThumbsUp',
  thumbsDown: 'ThumbsDown',
  
  // Bookmarks & Favorites
  bookmark: 'Bookmark',
  favorite: 'Heart',
  flag: 'Flag',
  
  // Print & Export
  print: 'Printer',
  pdf: 'FileText',
  
  // Status Indicators
  online: 'Circle',
  offline: 'CircleOff',
  active: 'CheckCircle2',
  inactive: 'XCircle',
  pending: 'Clock',
  
  // Loading & Processing
  loading: 'Loader',
  spinner: 'Loader2',
  processing: 'Cpu',
  
  // Special Icons
  copy: 'Copy',
  clipboard: 'Clipboard',
  archive: 'Archive',
  trash: 'Trash2',
  folder: 'Folder',
  folderOpen: 'FolderOpen',
  database: 'Database',
  server: 'Server',
  cloud: 'Cloud',
  smartphone: 'Smartphone',
  package: 'Package',
  arrowRight: 'ArrowRight',
  target: 'Target',
  wrench: 'Wrench',
  palette: 'Palette',
  circle: 'Circle',
  xCircle: 'XCircle',
  barChart: 'BarChart3',
  
  // Package specific
  play: 'Play',
  pause: 'Pause',
  stop: 'Square',
  volume: 'Volume2',
  volumeMute: 'VolumeX',
  fullscreen: 'Maximize',
  minimize: 'Minimize2',
  
  // Order Status
  orderPending: 'Clock',
  orderProcessing: 'Loader',
  orderShipped: 'Truck',
  orderDelivered: 'CheckCircle2',
  orderCancelled: 'XCircle',

  // Integration & Health Status
  statusHealthy: 'CircleCheck',
  statusDegraded: 'CircleAlert',
  statusDown: 'CircleX',
  statusUnknown: 'Circle',
  
  // Communication & Reminders
  email: 'Mail',
  sms: 'Smartphone',
  inApp: 'BellRing',
  letter: 'FileText',
  reminderPending: 'Clock',
  reminderSent: 'CheckCircle2',
  reminderRead: 'Eye',
  reminderIgnored: 'EyeOff',
  reminderBounced: 'Undo2',
  
  // Production & Stations
  scissors: 'Scissors',
  ruler: 'Ruler',
  truck: 'Truck',
  flashlight: 'Flashlight',
  monitor: 'Monitor',
  laptop: 'Laptop',
  camera: 'Camera',
  scan: 'ScanLine',
  scanBarcode: 'ScanBarcode',
  qrCode: 'QrCode',
  zap: 'Zap',
  layers: 'Layers',
  cable: 'Cable',
  bluetooth: 'Bluetooth',
  
  // Station-specific (3 Cihaz / 5 İstasyon)
  stationEbatlama: 'Scissors',
  stationBantlama: 'Layers',
  stationTeslim: 'Truck',
  stationHazirlik: 'Package',
  stationKontrol: 'CheckCircle2',
  
  // Stock & Items
  colorPalette: 'Palette',
  mapPin: 'MapPin',
  receipt: 'Receipt',
} as const;

/**
 * Get icon name with fallback to default
 * @param iconKey - The icon key to look up
 * @returns Lucide React icon name, or fallback 'HelpCircle' if not found
 */
export function getIconName(iconKey: string): typeof ICON_MAPPING[keyof typeof ICON_MAPPING] {
  return (ICON_MAPPING as Record<string, unknown>)[iconKey] as typeof ICON_MAPPING[keyof typeof ICON_MAPPING] || ICON_MAPPING.default;
}

/**
 * Component usage examples
 */
export const ICON_USAGE_EXAMPLES = {
  editButton: `<Edit2 size={18} className="text-blue-500" aria-hidden="true" />`,
  deleteButton: `<Trash2 size={18} className="text-red-500" aria-hidden="true" />`,
  addButton: `<Plus size={18} className="text-green-500" aria-hidden="true" />`,
  statusSuccess: `<CheckCircle2 size={16} className="text-green-600" aria-hidden="true" />`,
  statusError: `<XCircle size={16} className="text-red-600" aria-hidden="true" />`,
  navIcon: `<Settings size={20} className="text-gray-700" aria-hidden="true" />`,
} as const;

/**
 * Icon sizes mapping - use for consistency across UI
 */
export const ICON_SIZES = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
} as const;

/**
 * Icon color palette (Design System colors)
 * Maintains consistency with COLORS constants
 */
export const ICON_COLORS = {
  primary: '#3B8BF5',
  secondary: '#525252',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F43F5E',
  info: '#A78BFA',
  muted: '#737373',
  light: '#D4D4D4',
  disabled: '#D4D4D4',
  white: '#ffffff',
} as const;

/**
 * Migration checklist - components to update with Lucide icons
 * 
 * [x] Sidebar - Navigation icons
 * [x] TopBar - Menu, Dropdown, Notification icons
 * [ ] LoginPage - Form validation icons
 * [ ] OrdersTable - Edit, Delete, View, Export icons
 * [ ] StationsPage - Add, Edit, Delete, Settings icons
 * [ ] AdminPanel - Settings, Users, Chart icons
 * [ ] FormComponents - Success, Error, Info indicators
 * [ ] Modal - Close button icon, status icons
 * [ ] DataTable - Sort, Filter, Pagination icons
 * [ ] Dashboard - Chart, Card header icons
 * [ ] StatusBadges - Status indicator icons
 */
