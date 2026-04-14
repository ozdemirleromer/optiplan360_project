/**
 * Cihaz Yönetimi — Alt Bileşenler (Atoms)
 */

import {
  Cpu,
  Wifi,
  WifiOff,
  Monitor,
  Smartphone,
  ScanBarcode,
  Cable,
  Bluetooth,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { COLORS } from "../../components/Shared/constants";

/* ---------- İkon yardımcıları ---------- */

export function getDeviceIcon(type: string | null | undefined) {
  switch (type) {
    case "barcode_reader":
      return <ScanBarcode size={20} />;
    case "scanner_gun":
      return <ScanBarcode size={20} />;
    case "handheld_terminal":
      return <Smartphone size={20} />;
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

export function getConnectionIcon(type: string | null | undefined) {
  switch (type) {
    case "wifi":
      return <Wifi size={14} />;
    case "bluetooth":
      return <Bluetooth size={14} />;
    case "usb":
    /* fallthrough */
    case "serial":
      return <Cable size={14} />;
    case "ethernet":
      return <Cable size={14} />;
    default:
      return <WifiOff size={14} />;
  }
}

export function getStatusIcon(statusType: "unassigned" | "inactive" | "active") {
  switch (statusType) {
    case "unassigned":
      return <XCircle size={14} />;
    case "inactive":
      return <AlertTriangle size={14} />;
    case "active":
      return <CheckCircle2 size={14} />;
  }
}

/* ---------- DetailItem alt bileşeni ---------- */

export function DetailItem({
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
