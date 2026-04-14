/**
 * Cihaz Yönetimi — Tip Tanımları
 */

export type DeviceForm = {
  deviceType: string;
  deviceModel: string;
  deviceSerialNumber: string;
  ipAddress: string;
  connectionType: string;
  installationDate: string;
  lastMaintenanceDate: string;
};

export type DriverInfo = {
  name: string;
  url: string;
  instructions: string[];
};
