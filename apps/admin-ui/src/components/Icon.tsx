import {
  Activity,
  CheckCircle,
  CircleAlert,
  Cog,
  List,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

const ICON_MAP = {
  activity: Activity,
  checkCircle: CheckCircle,
  alert: CircleAlert,
  cog: Cog,
  list: List,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
} as const;

export type IconName = keyof typeof ICON_MAP;

interface IconProps extends Omit<LucideProps, "ref"> {
  name: IconName;
  label: string;
}

export function Icon({ name, label, ...props }: IconProps) {
  const Component = ICON_MAP[name];
  return <Component aria-label={label} role="img" {...props} />;
}
