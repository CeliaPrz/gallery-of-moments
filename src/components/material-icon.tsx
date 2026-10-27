import {
  AlertTriangle, ArrowRight, AtSign, BarChart3, Building, Building2, CalendarClock, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleX, Download, Eye, EyeOff, File,
  FileDown, FileSpreadsheet, FileText, FileUp,
  ClipboardCheck, FolderOpen, Hourglass, Info, Landmark,
  LayoutDashboard, LayoutGrid, LineChart, Lock, LogOut, MapPin, Menu, BellRing, Banknote,
  BadgeCheck, ClipboardList, History, CircleAlert, RefreshCw, ShieldCheck, Trash2, TrendingUp,
  User, Users, X, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  account_balance: Landmark,
  alternate_email: AtSign,
  analytics: LineChart,
  apartment: Building2,
  arrow_forward: ArrowRight,
  bar_chart: BarChart3,
  check: Check,
  check_circle: CheckCircle2,
  chevron_right: ChevronRight,
  close: X,
  corporate_fare: Building,
  dashboard: LayoutDashboard,
  delete: Trash2,
  description: FileText,
  domain: Building2,
  domain_disabled: Building,
  download: Download,
  download_for_offline: FileDown,
  error: CircleX,
  event_repeat: CalendarClock,
  expand_more: ChevronDown,
  file_download: FileDown,
  folder_open: FolderOpen,
  grid_view: LayoutGrid,
  groups: Users,
  history: History,
  hourglass_empty: Hourglass,
  info: Info,
  location_on: MapPin,
  lock: Lock,
  logout: LogOut,
  menu: Menu,
  notifications_active: BellRing,
  payments: Banknote,
  person: User,
  priority_high: CircleAlert,
  shield_lock: ShieldCheck,
  summarize: ClipboardList,
  sync: RefreshCw,
  table_chart: FileSpreadsheet,
  trending_up: TrendingUp,
  upload_file: FileUp,
  fact_check: ClipboardCheck,
  verified: BadgeCheck,
  verified_user: ShieldCheck,
  visibility: Eye,
  visibility_off: EyeOff,
  warning: AlertTriangle,
};

/** Lucide icon with a fixed pixel size (read from `text-[Npx]`, default 24) to avoid layout shift. */
export function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? (File);
  const match = /text-\[(\d+)px\]/.exec(className);
  const size = match ? Number(match[1]) : 24;
  return (
    <Icon
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
