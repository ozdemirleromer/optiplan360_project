/**
 * StationsPage — Saf Utility Fonksiyonlar
 */

import type { StationDto } from "../../services/adminService";
import type { DeviceGroupDef } from "./stationsPageTypes";

/**
 * Verilen gruba ait istasyonları filtreler.
 * İstasyon adları büyük/küçük harf duyarsız karşılaştırılır.
 */
export function getGroupStations(
  group: DeviceGroupDef,
  stations: StationDto[]
): StationDto[] {
  return stations.filter((s) =>
    group.stationNames.some(
      (name) => s.name.toUpperCase().trim() === name.toUpperCase().trim()
    )
  );
}
