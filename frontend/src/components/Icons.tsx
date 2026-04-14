/**
 * Icon Standardization and Lucide Migration
 * Complete icon system with Lucide React icons
 */

import type { LucideIcon } from 'lucide-react';
import {
  // Navigation Icons
  Home,
  Users,
  Package,
  Package2,
  PackageOpen,
  PackageCheck,
  PackageSearch,
  PackageX,
  PackageMinus,
  BarChart3,
  Settings,
  FileText,
  ShoppingCart,
  Truck,

  // Action Icons
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Save,
  X,
  Check,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,

  // Status Icons
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ZapOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Unlock,

  // File Icons
  File,
  FilePlus,
  FileSpreadsheet,
  FileScan,
  FileSearch,
  FileCheck,
  FileX,
  FileDown,
  FileUp,
  Image,
  DownloadCloud,
  UploadCloud,

  // UI Icons
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Menu,
  MoreVertical,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  ExternalLink,
  Copy,
  Move,
  Archive,

  // Communication Icons
  Mail,
  MessageSquare,
  Phone,
  Send,
  Bell,
  AtSign,

  // Data Icons
  Database,
  Server,
  Cloud,
  HardDrive,
  Wifi,
  WifiOff,

  // Business Icons
  Building,
  Factory,
  Store,
  CreditCard,
  DollarSign,
  Receipt,

  // Security Icons
  Key,
  Fingerprint,
  AlertTriangle,
  Ban,

  // Process Icons
  Play,
  Pause,
  Square,
  Circle,
  Loader2,
  Hourglass,

  // Export/Import Icons
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,

  // Quality Icons
  Star,
  StarOff,
  ThumbsUp,
  ThumbsDown,
  Heart,
  HeartOff,

  // System Icons
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Cpu,
  MemoryStick,

  // Utility Icons
  HelpCircle,
  Info,
  Volume2,
  VolumeX,
  Sun,
  Moon,

  // Specialized Icons
  Scan,
  Camera,
  Printer,
  Share2,
  Link,
  Unlink,

  // Customer Management
  UserPlus,
  UserMinus,
  UserX,
  UsersRound,

  // Monitoring
  BarChart,
  BarChart2,
  PieChart,

  // Time and Date
  Timer,
  TimerReset,

  // Location
  MapPin,
  Navigation,
  Compass,
} from 'lucide-react';

// Icon mapping for consistent usage
export const Icons = {
  // Navigation
  home: Home,
  dashboard: BarChart3,
  orders: ShoppingCart,
  customers: Users,
  stock: Package,
  reports: FileText,
  admin: Settings,

  // Actions
  add: Plus,
  edit: Edit,
  delete: Trash2,
  view: Eye,
  hide: EyeOff,
  download: Download,
  upload: Upload,
  search: Search,
  filter: Filter,
  refresh: RefreshCw,
  save: Save,
  cancel: X,
  confirm: Check,

  // Status
  pending: Clock,
  processing: Activity,
  completed: CheckCircle2,
  failed: XCircle,
  warning: AlertCircle,
  success: CheckCircle2,

  // File Operations
  file: File,
  newFile: FilePlus,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  image: Image,

  // Business
  company: Building,
  factory: Factory,
  store: Store,
  price: DollarSign,
  invoice: Receipt,
  receipt: Receipt,

  // Security
  lock: Lock,
  unlock: Unlock,
  key: Key,
  security: Shield,
  verified: ShieldCheck,

  // System
  database: Database,
  server: Server,
  cloud: Cloud,
  monitor: Monitor,

  // Communication
  email: Mail,
  message: MessageSquare,
  phone: Phone,
  send: Send,
  notification: Bell,

  // Data Visualization
  chart: BarChart,
  chartLine: TrendingUp,
  chartPie: PieChart,

  // User Interface
  menu: Menu,
  more: MoreVertical,
  moreHorizontal: MoreHorizontal,
  expand: Maximize2,
  collapse: Minimize2,

  // OCR Specific
  scan: Scan,
  camera: Camera,
  ocr: FileScan,
  documentCheck: FileCheck,
  documentError: FileX,

  // Order Management
  orderNew: Plus,
  orderEdit: Edit,
  orderDelete: Trash2,
  orderComplete: CheckCircle2,

  // Customer Management
  customerNew: UserPlus,
  customerEdit: Edit,
  customerDelete: UserX,
  customerActive: UsersRound,

  // Stock Management
  stockAdd: Package2,
  stockEdit: Edit,
  stockDelete: PackageMinus,
  stockCheck: PackageCheck,

  // Export/Import
  export: FileDown,
  import: FileUp,
  downloadCloud: DownloadCloud,
  uploadCloud: UploadCloud,

  // Quality
  favorite: Star,
  favoriteOff: StarOff,
  like: ThumbsUp,
  dislike: ThumbsDown,

  // Admin
  adminPanel: Settings,
  userManagement: Users,
  systemSettings: Shield,
  audit: FileText,

  // Monitoring
  performance: Activity,
  metrics: BarChart2,
  health: Heart,
  uptime: Clock,

  // Time
  date: Calendar,
  time: Clock,
  timer: Timer,

  // Navigation arrows
  back: ChevronLeft,
  next: ChevronRight,
  previous: ChevronLeft,
  up: ChevronUp,
  down: ChevronDown,

  // Loading
  loading: Loader2,
  spinner: Loader2,

  // Error States
  error: XCircle,
  info: Info,
  help: HelpCircle,

  // Success States
  complete: CheckCircle2,

  // Interactive
  copy: Copy,
  move: Move,
  archive: Archive,
  link: Link,
  unlink: Unlink,
  external: ExternalLink,
};

// Icon size variants for consistent usage
export const IconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Icon color variants for theme consistency
export const IconColors = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
  info: 'text-blue-500',
  muted: 'text-gray-400',
} as const;

// Icon component wrapper for consistent styling
export const Icon = ({
  icon: IconComponent,
  size = IconSizes.md,
  color = IconColors.secondary,
  className = '',
  ...props
}: {
  icon: LucideIcon;
  size?: number;
  color?: string;
  className?: string;
  [key: string]: unknown;
}) => {
  return (
    <IconComponent
      size={size}
      className={`${color} ${className}`}
      {...props}
    />
  );
};

// Export all individual icons for direct usage
export {
  Home,
  Users,
  Package,
  Package2,
  PackageOpen,
  PackageCheck,
  PackageSearch,
  PackageX,
  PackageMinus,
  BarChart3,
  Settings,
  FileText,
  ShoppingCart,
  Truck,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Save,
  X,
  Check,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ZapOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Unlock,
  File,
  FilePlus,
  FileSpreadsheet,
  FileScan,
  FileSearch,
  FileCheck,
  FileX,
  FileDown,
  FileUp,
  Image,
  DownloadCloud,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Menu,
  MoreVertical,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  ExternalLink,
  Copy,
  Move,
  Archive,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Bell,
  AtSign,
  Database,
  Server,
  Cloud,
  HardDrive,
  Wifi,
  WifiOff,
  Building,
  Factory,
  Store,
  CreditCard,
  DollarSign,
  Receipt,
  Key,
  Fingerprint,
  AlertTriangle,
  Ban,
  Play,
  Pause,
  Square,
  Circle,
  Loader2,
  Hourglass,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Star,
  StarOff,
  ThumbsUp,
  ThumbsDown,
  Heart,
  HeartOff,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Cpu,
  MemoryStick,
  HelpCircle,
  Info,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Scan,
  Camera,
  Printer,
  Share2,
  Link,
  Unlink,
  UserPlus,
  UserMinus,
  UserX,
  UsersRound,
  BarChart,
  BarChart2,
  PieChart,
  Timer,
  TimerReset,
  MapPin,
  Navigation,
  Compass,
};

export default Icons;
