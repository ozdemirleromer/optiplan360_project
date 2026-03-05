/**
 * OrderEditor - Main Component
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Order, ORDER_STATUS_LABELS } from "../../../types";
import type { OrderStatus, PriorityLevel } from "../../../types";
import {
  type MeasureRow,
  buildMeasuresCsv,
  buildMeasuresExcelHtml,
  calculateEstimatedArea,
  calculateTotalParts,
  downloadTextFile,
  parseImportedArray,
  parseImportedMeasures,
} from "./shared";
import { OrderOptimizationPanel } from "../../UI/OrderOptimizationPanel";
import type { OrderOptimizationRibbonTab } from "../../Ribbon/OrderOptimizationRibbon";
import { buildCustomerField, buildPlateSizeValue, buildSystemOrderNo, normalizeMaskedNumberOnBlur, parseCustomerField, parseMaskedNumber, parsePlateSizeInputs, sanitizeMaskedNumberInput } from "./workbenchUtils";
import { apiRequest } from "../../../services/apiClient";
import { orchestratorService } from "../../../services/orchestratorService";
import { ordersService } from "../../../services/ordersService";
import { useOrdersStore } from "../../../stores/ordersStore";
import { useAuthStore } from "../../../stores/authStore";
import { useUIStore } from "../../../stores/uiStore";
import { notificationHelpers } from "../../../stores/notificationStore";
import { Modal } from "../../Shared/Modal";
import * as XLSX from "xlsx";

const EMPTY_ROW: MeasureRow = {
  id: 1, boy: "", en: "", adet: "1", grain: "0",
  u1: false, u2: false, k1: false, k2: false,
  delik1: "", delik2: "", info: "",
};

interface OrderEditorProps {
  order: Order | null;
  onBack: () => void;
}

const toInputDate = (value?: string): string => {
  const source = value ? new Date(value) : new Date();
  if (Number.isNaN(source.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return source.toISOString().slice(0, 10);
};

const SUPPORTED_THICKNESSES = [4, 5, 8, 18] as const;

// Malzeme Array
const MATERIAL_SPECIFICATIONS = [
  { thickness: "3MM", dimensions: "170*210" },
  { thickness: "4MM", dimensions: "210*280" },
  { thickness: "5MM", dimensions: "210*280" },
  { thickness: "6MM", dimensions: "210*280" },
  { thickness: "8MM", dimensions: "210*280" },
  { thickness: "10MM", dimensions: "210*280" },
  { thickness: "12MM", dimensions: "210*280" },
  { thickness: "16MM", dimensions: "210*280" },
  { thickness: "18MM", dimensions: "210*280" },
  { thickness: "18MM", dimensions: "183*366" },
  { thickness: "22MM", dimensions: "210*280" },
  { thickness: "25MM", dimensions: "210*280" },
  { thickness: "30MM", dimensions: "210*280" },
] as const;

// Ölçü Spesifikasyonları (Boy x En)
const MEASUREMENTS_SPECIFICATIONS = [
  { boy: "210", en: "280", display: "210x280" },
  { boy: "170", en: "210", display: "170x210" },
  { boy: "183", en: "366", display: "183x366" },
  { boy: "150", en: "200", display: "150x200" },
  { boy: "200", en: "300", display: "200x300" },
  { boy: "250", en: "350", display: "250x350" },
  { boy: "300", en: "400", display: "300x400" },
  { boy: "220", en: "330", display: "220x330" },
  { boy: "240", en: "320", display: "240x320" },
  { boy: "160", en: "240", display: "160x240" },
  { boy: "180", en: "260", display: "180x260" },
  { boy: "195", en: "290", display: "195x290" },
  { boy: "225", en: "315", display: "225x315" },
] as const;

type MeasureRowStatus = NonNullable<MeasureRow["status"]>;

const getExportFilename = (prefix: string, ext: string): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.${ext}`;
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const toMeasureRowStatus = (value?: string): MeasureRowStatus => {
  if (value === "READY") return "READY";
  if (value === "HELD" || value === "HOLD") return "HELD";
  if (value === "OPTIMIZING" || value === "IN_PRODUCTION") return "OPTIMIZING";
  return "NEW";
};

const buildRowDefaults = (material: string, thickness: number, orderStatus: string) => {
  const roundedThickness = Math.round(Number.parseFloat(String(thickness)));
  return {
    material: material.trim(),
    thickness: SUPPORTED_THICKNESSES.includes(roundedThickness as (typeof SUPPORTED_THICKNESSES)[number])
      ? String(roundedThickness)
      : "",
    status: toMeasureRowStatus(orderStatus),
  };
};

const applyRowDefaults = (
  sourceRows: MeasureRow[],
  defaults: { material: string; thickness: string; status: MeasureRowStatus },
): MeasureRow[] => sourceRows.map((row, index) => ({
  ...row,
  id: row.id || index + 1,
  material: row.material || defaults.material,
  thickness: row.thickness || defaults.thickness,
  status: row.status || defaults.status,
}));

export function OrderEditor({ order, onBack }: OrderEditorProps) {
  const [tab, setTab] = useState<"measures" | "validate" | "export">("measures");
  const [rows, setRows] = useState<MeasureRow[]>([{ ...EMPTY_ROW }]);
  const initialPlateInputs = parsePlateSizeInputs(order?.plate || "2800x2070");
  const [material, setMaterial] = useState(order?.mat || "18MM 210*280");
  const [plateSize, setPlateSize] = useState(order?.plate || "2100x2800");
  const [plateBoyInput, setPlateBoyInput] = useState(initialPlateInputs.boy);
  const [plateEnInput, setPlateEnInput] = useState(initialPlateInputs.en);
  const [thickness, setThickness] = useState(order?.thick || 18);
  const [customerName, setCustomerName] = useState(order?.cust || "");
  const [customerPhone, setCustomerPhone] = useState(order?.phone || "");
  const [customerField, setCustomerField] = useState(buildCustomerField(order?.cust || "", order?.phone || ""));
  const [dueDate, setDueDate] = useState(toInputDate(order?.date));
  const [activeRibbonTab, setActiveRibbonTab] = useState<OrderOptimizationRibbonTab>("siparis");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasAttemptedValidation, setHasAttemptedValidation] = useState(false);
  // Yeni oluşturulan siparişin ID'sini tut — çift kayıt önleme
  const [savedOrderId, setSavedOrderId] = useState<string | null>(order?.id || null);
  const savedOrderIdRef = useRef(savedOrderId);
  savedOrderIdRef.current = savedOrderId;
  const [isSaving, setIsSaving] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>(order?.priority || "normal");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(order?.status || "NEW");
  const [importModal, setImportModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [partsLoaded, setPartsLoaded] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const isArk = order?.grp === "ARKALIK";
  const knownOrders = useOrdersStore((state) => state.orders);
  const themeMode = useUIStore((state) => state.theme);
  const activeUserName = useAuthStore((state) => state.user?.fullName || state.user?.username || state.user?.email || "Operator");
  const customerSuggestions = Array.from(
    new Set(
      knownOrders
        .map((entry) => buildCustomerField(entry.cust || "", entry.phone || ""))
        .filter(Boolean),
    ),
  );
  const resolvedOrderNo = buildSystemOrderNo(order?.orderNo, savedOrderId || order?.id || null);
  const rowDefaults = buildRowDefaults(material, thickness, orderStatus);
  const validationState = !hasAttemptedValidation ? "idle" : validationErrors.length === 0 ? "valid" : "invalid";

  // Mevcut siparis acildiginda backend'den parcalari yukle
  useEffect(() => {
    if (!order?.id || partsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        // apiClient transformKeys zaten snake_case -> camelCase donusumu yapar
        const detail = await apiRequest<Record<string, unknown>>(`/orders/${order.id}`, { method: "GET" });
        if (cancelled) return;
        const detailMaterial = String(detail.materialName ?? detail.material_name ?? order?.mat ?? "");
        const detailThickness = Number(detail.thicknessMm ?? detail.thickness_mm ?? order?.thick ?? 18);
        const detailStatus = String(detail.status ?? order?.status ?? "NEW");
        const detailRowDefaults = buildRowDefaults(detailMaterial, detailThickness, detailStatus);
        const rawParts = Array.isArray(detail.parts) ? detail.parts as Record<string, unknown>[] : [];
        if (rawParts.length > 0) {
          const mapped = applyRowDefaults(rawParts.map((p, idx) => ({
            id: idx + 1,
            boy: String(p.boyMm ?? p.boy_mm ?? ""),
            en: String(p.enMm ?? p.en_mm ?? ""),
            adet: String(p.adet ?? "1"),
            grain: String(p.grainCode ?? p.grain_code ?? "0").replace("-Material", ""),
            u1: Boolean(p.u1 ?? false),
            u2: Boolean(p.u2 ?? false),
            k1: Boolean(p.k1 ?? false),
            k2: Boolean(p.k2 ?? false),
            delik1: String(p.drillCode1 ?? p.drill_code_1 ?? ""),
            delik2: String(p.drillCode2 ?? p.drill_code_2 ?? ""),
            info: String(p.partDesc ?? p.part_desc ?? ""),
          })), detailRowDefaults);
          setRows(mapped);
          setPartsError(null);
        } else {
          setPartsError(null);
        }
        // Header bilgilerini de guncelle (camelCase once — transformKeys donusumu)
        const matName = detail.materialName ?? detail.material_name;
        if (matName) setMaterial(String(matName));
        const thickVal = detail.thicknessMm ?? detail.thickness_mm;
        if (thickVal) setThickness(Number(thickVal));
        const plateW = detail.plateWMm ?? detail.plate_w_mm;
        const plateH = detail.plateHMm ?? detail.plate_h_mm;
        if (plateW) {
          const w = Number(plateW);
          const h = Number(plateH ?? 0);
          if (w > 0 && h > 0) setPlateSize(`${w}x${h}`);
        }
        const custName = detail.crmNameSnapshot ?? detail.crm_name_snapshot;
        if (custName) setCustomerName(String(custName));
        const phoneVal = detail.phoneNorm ?? detail.phone_norm;
        if (phoneVal) setCustomerPhone(String(phoneVal));
        if (custName || phoneVal) {
          setCustomerField(buildCustomerField(String(custName ?? ""), String(phoneVal ?? "")));
        }
        const dueDateValue = detail.dueDate ?? detail.due_date ?? detail.date;
        if (dueDateValue) setDueDate(toInputDate(String(dueDateValue)));
        const statusVal = detail.status;
        if (statusVal && typeof statusVal === "string") setOrderStatus(statusVal as OrderStatus);
        const prioVal = detail.priority;
        if (prioVal && typeof prioVal === "string") setPriority(prioVal as PriorityLevel);
      } catch {
        setPartsError("Backend baglantisi kurulamadi — parca bilgileri yuklenemedi. Backend sunucusunun calistigindan emin olun.");
      } finally {
        if (!cancelled) setPartsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [order?.id]);

  useEffect(() => {
    const parsed = parsePlateSizeInputs(plateSize);
    setPlateBoyInput(parsed.boy);
    setPlateEnInput(parsed.en);
  }, [plateSize]);

  useEffect(() => {
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        let nextRow = row;

        if (!row.material && rowDefaults.material) {
          nextRow = { ...nextRow, material: rowDefaults.material };
          changed = true;
        }

        if (!row.thickness && rowDefaults.thickness) {
          nextRow = { ...nextRow, thickness: rowDefaults.thickness };
          changed = true;
        }

        if (!row.status && rowDefaults.status) {
          nextRow = { ...nextRow, status: rowDefaults.status };
          changed = true;
        }

        return nextRow;
      });

      return changed ? next : prev;
    });
  }, [rowDefaults.material, rowDefaults.status, rowDefaults.thickness]);

  const runValidation = useCallback((navigateToExport: boolean): boolean => {
    const errors: string[] = [];
    const normalizedPhone = customerPhone.replace(/\D/g, "");
    const thicknessValue = Number.parseFloat(String(thickness));
    setHasAttemptedValidation(true);

    if (!customerName.trim()) {
      errors.push("Musteri adi gerekli.");
    }

    if (!normalizedPhone || normalizedPhone.length < 10) {
      errors.push("Telefon zorunlu ve en az 10 haneli olmali.");
    } else if (!/^[+0-9()\s-]{10,20}$/.test(customerPhone.trim())) {
      errors.push("Telefon formati gecersiz.");
    }

    if (!Number.isFinite(thicknessValue) || ![4, 5, 8, 18].includes(Math.round(thicknessValue))) {
      errors.push("Kalinlik sadece 4, 5, 8 veya 18 mm olabilir.");
    }

    if (!plateSize.trim()) {
      errors.push("Plaka boyutu gerekli.");
    }

    if (rows.length === 0) {
      errors.push("En az bir olcu satiri gerekli.");
    }

    rows.forEach((row) => {
      const boy = parseMaskedNumber(row.boy);
      const en = parseMaskedNumber(row.en);
      const adet = Number.parseInt(row.adet, 10);
      const grain = Number.parseInt(row.grain, 10);

      if (!Number.isFinite(boy) || boy <= 0) {
        errors.push(`Satir ${row.id}: Boy 0'dan buyuk olmali.`);
      }

      if (!Number.isFinite(en) || en <= 0) {
        errors.push(`Satir ${row.id}: En 0'dan buyuk olmali.`);
      }

      if (!Number.isFinite(adet) || adet <= 0) {
        errors.push(`Satir ${row.id}: Adet 1 veya daha buyuk olmali.`);
      }

      if (![0, 1, 2, 3].includes(grain)) {
        errors.push(`Satir ${row.id}: Desen 0-3 arasinda olmali.`);
      }
    });

    setValidationErrors(errors);

    if (errors.length === 0 && navigateToExport) {
      setTab("export");
    }

    return errors.length === 0;
  }, [customerName, customerPhone, thickness, plateSize, rows]);

  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleValidate = () => {
    runValidation(true);
  };

  const handleCustomerFieldChange = useCallback((value: string) => {
    setCustomerField(value);
    const parsed = parseCustomerField(value);
    setCustomerName(parsed.name);
    setCustomerPhone(parsed.phone);
  }, []);

  const handleCustomerNameChange = useCallback((value: string) => {
    setCustomerName(value);
    setCustomerField(buildCustomerField(value, customerPhone));
  }, [customerPhone]);

  const handleCustomerPhoneChange = useCallback((value: string) => {
    setCustomerPhone(value);
    setCustomerField(buildCustomerField(customerName, value));
  }, [customerName]);

  type BackendOrderPart = {
    part_group: "GOVDE" | "ARKALIK";
    boy_mm: number;
    en_mm: number;
    adet: number;
    grain_code: "0-Material" | "1-Boyuna" | "2-Enine" | "3-Material";
    u1: boolean;
    u2: boolean;
    k1: boolean;
    k2: boolean;
    part_desc: string | null;
    drill_code_1: string | null;
    drill_code_2: string | null;
  };

  type BackendOrderHeader = {
    customer_id: number;
    phone_norm: string;
    thickness_mm: number;
    plate_w_mm: number;
    plate_h_mm: number;
    color: string;
    material_name: string;
    grain_default: "0-Material";
    priority?: string;
  };

  const parsePlateSizeMm = (value: string): { widthMm?: number; heightMm?: number } => {
    const match = value
      .replace(/\s+/g, "")
      .match(/([\d.,]+)\s*[xX*\u00D7]\s*([\d.,]+)/);
    if (!match) {
      return {};
    }

    const width = Number.parseFloat(match[1].replace(/,/g, ""));
    const height = Number.parseFloat(match[2].replace(/,/g, ""));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return {};
    }

    return { widthMm: Math.round(width), heightMm: Math.round(height) };
  };

  const normalizePhone = (value: string): string => value.replace(/\D/g, "");

  const toGrainCode = (value: string): "0-Material" | "1-Boyuna" | "2-Enine" | "3-Material" => {
    const grain = Number.parseInt(value, 10);
    if (grain === 1) return "1-Boyuna";
    if (grain === 2) return "2-Enine";
    if (grain === 3) return "3-Material";
    return "0-Material";
  };

  const mapRowsToBackendParts = (sourceRows: MeasureRow[]): BackendOrderPart[] => {
    const partGroup: "GOVDE" | "ARKALIK" = order?.grp === "ARKALIK" ? "ARKALIK" : "GOVDE";
    return sourceRows.map((row) => {
      const boyMm = parseMaskedNumber(String(row.boy));
      const enMm = parseMaskedNumber(String(row.en));
      const adet = Number.parseInt(String(row.adet), 10);
      const edgeDisabled = partGroup === "ARKALIK";

      return {
        part_group: partGroup,
        boy_mm: Number.isFinite(boyMm) && boyMm > 0 ? boyMm : 0,
        en_mm: Number.isFinite(enMm) && enMm > 0 ? enMm : 0,
        adet: Number.isFinite(adet) && adet > 0 ? adet : 1,
        grain_code: toGrainCode(row.grain),
        u1: edgeDisabled ? false : row.u1,
        u2: edgeDisabled ? false : row.u2,
        k1: edgeDisabled ? false : row.k1,
        k2: edgeDisabled ? false : row.k2,
        part_desc: row.info?.trim() ? row.info.trim() : null,
        drill_code_1: row.delik1?.trim() ? row.delik1.trim() : null,
        drill_code_2: row.delik2?.trim() ? row.delik2.trim() : null,
      };
    });
  };

  const mapRowsToOrchestratorParts = (sourceRows: MeasureRow[]) => {
    const partType: "GOVDE" | "ARKALIK" = order?.grp === "ARKALIK" ? "ARKALIK" : "GOVDE";
    const headerMaterial = material.trim() || "MATERIAL";
    const baseThickness = Number.isFinite(thickness) && thickness > 0 ? thickness : 18;

    return sourceRows.map((row) => {
      const lengthMm = parseMaskedNumber(String(row.boy));
      const widthMm = parseMaskedNumber(String(row.en));
      const quantityRaw = Number.parseInt(String(row.adet), 10);
      const grainRaw = Number.parseInt(String(row.grain), 10);
      const rowMaterial = row.material?.trim() || headerMaterial;
      const rowThickness = Number.parseInt(row.thickness || "", 10);
      const partThickness = partType === "ARKALIK"
        ? 8
        : (Number.isFinite(rowThickness) && rowThickness > 0 ? rowThickness : baseThickness);

      return {
        id: String(row.id),
        partType,
        materialCode: rowMaterial,
        lengthCm: Number.isFinite(lengthMm) && lengthMm > 0 ? lengthMm / 10 : 0,
        widthCm: Number.isFinite(widthMm) && widthMm > 0 ? widthMm / 10 : 0,
        quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1,
        grain: [0, 1, 2, 3].includes(grainRaw) ? grainRaw : 0,
        color: rowMaterial || "Belirtilmedi",
        thicknessMm: partThickness,
      };
    });
  };

  const resolveCustomerId = async (phoneNorm: string): Promise<number> => {
    const normalized10 = phoneNorm.length > 10 ? phoneNorm.slice(-10) : phoneNorm;

    if (normalized10.length === 10 && normalized10.startsWith("5")) {
      try {
        const existing = await apiRequest<{ id: number }>(
          `/customers/lookup?phone=${encodeURIComponent(normalized10)}`,
          { method: "GET" }
        );
        if (existing?.id) {
          return Number(existing.id);
        }
      } catch {
        // lookup bulunamazsa create yoluna devam
      }
    }

    try {
      const allCustomers = await apiRequest<Array<{ id: number; phone?: string }>>(`/customers/`, {
        method: "GET",
      });
      const matched = allCustomers.find((item) => normalizePhone(item.phone || "") === normalized10);
      if (matched?.id) {
        return Number(matched.id);
      }
    } catch {
      // listeleme hatasında create yoluna devam
    }

    try {
      const created = await apiRequest<{ id: number }>(`/customers/`, {
        method: "POST",
        body: JSON.stringify({
          name: customerName.trim() || "Yeni Musteri",
          phone: normalized10,
        }),
      });
      return Number(created.id);
    } catch {
      const allCustomers = await apiRequest<Array<{ id: number; phone?: string }>>(`/customers/`, {
        method: "GET",
      });
      const matched = allCustomers.find((item) => normalizePhone(item.phone || "") === normalized10);
      if (matched?.id) {
        return Number(matched.id);
      }
      throw new Error("Musteri kaydi olusturulamadi.");
    }
  };

  const saveOrderToDB = async () => {
    const phoneNorm = normalizePhone(customerPhone);
    const normalized10 = phoneNorm.length > 10 ? phoneNorm.slice(-10) : phoneNorm;
    const customerId = await resolveCustomerId(normalized10);
    const { widthMm, heightMm } = parsePlateSizeMm(plateSize);
    const materialName = material.trim() || "Belirtilmedi";
    const thicknessMm = Math.round(Number.parseFloat(String(thickness)));

    const headerPayload: BackendOrderHeader = {
      customer_id: customerId,
      phone_norm: normalized10,
      thickness_mm: thicknessMm,
      plate_w_mm: widthMm ?? 2100,
      plate_h_mm: heightMm ?? 2800,
      color: materialName,
      material_name: materialName,
      grain_default: "0-Material",
      priority,
    };

    const partsPayload = mapRowsToBackendParts(rows);

    const existingId = savedOrderIdRef.current || order?.id;
    if (existingId) {
      await apiRequest(`/orders/${existingId}`, {
        method: "PUT",
        body: JSON.stringify(headerPayload),
      });
      await apiRequest(`/orders/${existingId}/parts`, {
        method: "PUT",
        body: JSON.stringify(partsPayload),
      });
      return existingId;
    }

    const created = await apiRequest<{ id: string | number }>(`/orders`, {
      method: "POST",
      body: JSON.stringify({
        ...headerPayload,
        parts: partsPayload,
      }),
    });
    const newId = String(created.id);
    setSavedOrderId(newId);
    return newId;
  };

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const isValid = runValidation(false);
    if (!isValid) {
      return;
    }

    setIsSaving(true);
    try {
      await saveOrderToDB();
      // Store'u güncelle — sipariş listesinde yeni kayıt görünsün
      await useOrdersStore.getState().fetchOrders();
      notificationHelpers.success(`Siparis kaydedildi: ${customerName} (${calculateTotalParts(rows)} parca)`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      notificationHelpers.error("Kaydedilirken hata olustu: " + msg);
    } finally {
      setIsSaving(false);
    }
  }, [rows, customerName, customerPhone, material, plateSize, thickness, order, priority, runValidation, isSaving]);

  const handleOptimize = async () => {
    if (isSaving || isOptimizing) return;
    const isValid = runValidation(false);
    if (!isValid) {
      setTab("validate");
      return;
    }

    setIsOptimizing(true);
    try {
      const resultOrderId = await saveOrderToDB();
      const orderId = Number.parseInt(String(resultOrderId), 10);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        throw new Error("Siparis ID gecersiz.");
      }

      const { widthMm, heightMm } = parsePlateSizeMm(plateSize);
      const job = await orchestratorService.createJob({
        orderId,
        customerPhone: customerPhone.trim() || "",
        customerSnapshotName: customerName.trim() || undefined,
        optiMode: "C",
        plateWidthMm: widthMm,
        plateHeightMm: heightMm,
        parts: mapRowsToOrchestratorParts(rows),
      });
      // Store'u güncelle
      await useOrdersStore.getState().fetchOrders();
      notificationHelpers.success(`Siparis optimizasyon kuyruguna alindi. Job ID: ${job.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      notificationHelpers.error("Optimizasyon baslatilamadi: " + msg);
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const handleRowUpdate = useCallback((id: number, field: string, value: string | number | boolean) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((prev) => {
      const nextRowId = Math.max(...prev.map((row) => row.id), 0) + 1;
      return [
        ...prev,
        {
          id: nextRowId,
          boy: "",
          en: "",
          adet: "1",
          grain: "0",
          u1: false,
          u2: false,
          k1: false,
          k2: false,
          delik1: "",
          delik2: "",
          info: "",
          thickness: rowDefaults.thickness,
          material: rowDefaults.material,
          status: rowDefaults.status,
        },
      ];
    });
  }, [rowDefaults.material, rowDefaults.status, rowDefaults.thickness]);

  const handleRemoveRow = useCallback((id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const handleDuplicateRow = useCallback((id: number) => {
    setRows((prev) => {
      const source = prev.find((row) => row.id === id);
      if (!source) {
        return prev;
      }
      const nextRowId = Math.max(...prev.map((row) => row.id), 0) + 1;
      return [...prev, { ...source, id: nextRowId }];
    });
  }, []);

  const handleExportCsv = useCallback(() => {
    const csv = buildMeasuresCsv(rows);
    downloadTextFile(csv, getExportFilename("siparis-olculeri", "csv"), "text/csv");
    notificationHelpers.success("CSV disa aktarma baslatildi.");
  }, [rows]);

  const handleExportExcel = useCallback(() => {
    const html = buildMeasuresExcelHtml(rows, {
      customerName,
      customerPhone,
      plateSize,
      thickness,
    });
    downloadTextFile(html, getExportFilename("siparis-olculeri", "xls"), "application/vnd.ms-excel");
    notificationHelpers.success("Excel disa aktarma baslatildi.");
  }, [customerName, customerPhone, plateSize, rows, thickness]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank", "width=1280,height=860");
    if (!printWindow) {
      notificationHelpers.error("Yazdirma penceresi acilamadi.");
      return;
    }

    const rowsHtml = rows
      .map(
        (row) => `
          <tr>
            <td>${row.id}</td>
            <td>${escapeHtml(row.boy)}</td>
            <td>${escapeHtml(row.en)}</td>
            <td>${escapeHtml(row.adet)}</td>
            <td>${escapeHtml(row.grain)}</td>
            <td>${row.u1 ? "1" : "0"}</td>
            <td>${row.u2 ? "1" : "0"}</td>
            <td>${row.k1 ? "1" : "0"}</td>
            <td>${row.k2 ? "1" : "0"}</td>
            <td>${escapeHtml(row.delik1)}</td>
            <td>${escapeHtml(row.delik2)}</td>
            <td>${escapeHtml(row.info)}</td>
            <td>${escapeHtml(row.material || "")}</td>
            <td>${escapeHtml(row.thickness || "")}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Siparis Yazdirma</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 18px; }
            h1 { margin: 0 0 8px 0; font-size: 20px; }
            .meta { margin-bottom: 14px; color: #374151; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
            th { background: #f3f4f6; }
            .footer { margin-top: 14px; font-size: 11px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>Siparis Olculeri</h1>
          <div class="meta">
            Musteri: ${escapeHtml(customerName || "-")} |
            Telefon: ${escapeHtml(customerPhone || "-")} |
            Plaka: ${escapeHtml(plateSize)} |
            Kalinlik: ${thickness} mm |
            Toplam Parca: ${calculateTotalParts(rows)}
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Boy</th>
                <th>En</th>
                <th>Adet</th>
                <th>Desen</th>
                <th>U1</th>
                <th>U2</th>
                <th>K1</th>
                <th>K2</th>
                <th>Delik-1</th>
                <th>Delik-2</th>
                <th>Bilgi</th>
                <th>Malzeme</th>
                <th>Kalinlik</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="footer">Olusturma: ${new Date().toLocaleString("tr-TR")}</div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [customerName, customerPhone, plateSize, rows, thickness]);

  const handleTemplateDownload = useCallback(() => {
    const template = buildMeasuresCsv([
      { id: 1, boy: "650", en: "420", adet: "2", grain: "0", u1: false, u2: false, k1: false, k2: false, delik1: "", delik2: "", info: "Ornek satir 1", material: material.trim(), thickness: rowDefaults.thickness, status: rowDefaults.status },
      { id: 2, boy: "1200", en: "300", adet: "1", grain: "1", u1: true, u2: false, k1: true, k2: false, delik1: "8", delik2: "", info: "Ornek satir 2", material: material.trim(), thickness: rowDefaults.thickness, status: rowDefaults.status },
    ]);
    downloadTextFile(template, "ornek-olcu-sablonu.csv", "text/csv");
    notificationHelpers.success("Ornek CSV sablonu indirildi.");
  }, [material, rowDefaults.status, rowDefaults.thickness]);

  const handleImportFile = useCallback(async (file: File) => {
    setImportError(null);
    setImportInfo(null);

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "txt", "xls", "xlsx"].includes(extension)) {
      setImportError("Desteklenmeyen dosya tipi. CSV, TXT, XLS veya XLSX kullanin.");
      return;
    }

    try {
      let importedRows: MeasureRow[];
      let warnings: string[];
      let importDefaults = rowDefaults;

      if (extension === "xlsx" || extension === "xls") {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const dataRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        const result = parseImportedArray(dataRows);
        importedRows = result.rows;
        warnings = result.warnings;

        if (result.meta?.thickness) setThickness(result.meta.thickness);
        if (result.meta?.plateSize) setPlateSize(result.meta.plateSize);
        if (result.meta?.material) setMaterial(result.meta.material);
        importDefaults = buildRowDefaults(
          result.meta?.material ?? material,
          result.meta?.thickness ?? thickness,
          orderStatus,
        );

        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        const importedName = nameWithoutExt.trim();
        setCustomerName(importedName);
        setCustomerPhone("");
        setCustomerField(buildCustomerField(importedName, ""));
      } else {
        const rawText = await file.text();
        const result = parseImportedMeasures(rawText);
        importedRows = result.rows;
        warnings = result.warnings;
      }

      if (importedRows.length === 0) {
        setImportError(warnings[0] || "Dosya icinden gecerli olcu satiri okunamadi.");
        return;
      }

      const normalizedRows = applyRowDefaults(importedRows.map((row, index) => ({
        ...row,
        id: index + 1,
        grain: row.grain || "0",
      })), importDefaults);

      setRows(normalizedRows);
      setTab("measures");
      setImportModal(false);
      setImportInfo(`${normalizedRows.length} satir ice aktarildi (${file.name}).`);

      if (warnings.length > 0) {
        setImportError(warnings.join(" "));
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportError("Dosya okunurken bir hata olustu.");
    }
  }, [material, orderStatus, rowDefaults, thickness]);

  const handleDeleteOrder = useCallback(async () => {
    if (!order) return;
    if (!window.confirm("Bu siparisi silmek istediginizden emin misiniz?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await ordersService.remove(order.id);
      await useOrdersStore.getState().fetchOrders();
      notificationHelpers.success("Siparis silindi.");
      onBack();
    } catch {
      notificationHelpers.error("Siparis silinemedi (sadece NEW durumundaki siparisler silinebilir)");
    } finally {
      setIsDeleting(false);
    }
  }, [onBack, order]);

  const commitPlateSize = useCallback((nextBoy: string, nextEn: string) => {
    setPlateSize(buildPlateSizeValue({ boy: nextBoy, en: nextEn }));
  }, []);

  const handlePlateBoyChange = useCallback((value: string) => {
    setPlateBoyInput(sanitizeMaskedNumberInput(value));
  }, []);

  const handlePlateEnChange = useCallback((value: string) => {
    setPlateEnInput(sanitizeMaskedNumberInput(value));
  }, []);

  const handlePlateBoyBlur = useCallback(() => {
    const normalized = normalizeMaskedNumberOnBlur(plateBoyInput);
    const nextBoy = normalized || parsePlateSizeInputs(plateSize).boy;
    setPlateBoyInput(nextBoy);
    commitPlateSize(nextBoy, plateEnInput);
  }, [commitPlateSize, plateBoyInput, plateEnInput, plateSize]);

  const handlePlateEnBlur = useCallback(() => {
    const normalized = normalizeMaskedNumberOnBlur(plateEnInput);
    const nextEn = normalized || parsePlateSizeInputs(plateSize).en;
    setPlateEnInput(nextEn);
    commitPlateSize(plateBoyInput, nextEn);
  }, [commitPlateSize, plateBoyInput, plateEnInput, plateSize]);

  const panelNotice = partsError
    ? { text: partsError, tone: "danger" as const }
    : {
        text: `${ORDER_STATUS_LABELS[orderStatus] || orderStatus} / ${activeUserName}`,
        tone: "default" as const,
      };
  const panelMessages = [
    partsError ? { tone: "danger" as const, text: partsError } : null,
    importInfo ? { tone: "success" as const, text: importInfo } : null,
    importError ? { tone: "warning" as const, text: importError } : null,
  ].filter(Boolean) as Array<{ tone: "danger" | "success" | "warning"; text: string }>;

  const handleRibbonTabChange = useCallback((nextTab: OrderOptimizationRibbonTab) => {
    setActiveRibbonTab(nextTab);
  }, []);

  return (
    <div style={{ width: "100%", paddingBottom: 24 }}>
      <OrderOptimizationPanel
        themeMode={themeMode}
        activeTab={activeRibbonTab}
        customerValue={customerField}
        customerName={customerName}
        customerPhone={customerPhone}
        orderNo={resolvedOrderNo}
        orderStatus={ORDER_STATUS_LABELS[orderStatus] || orderStatus}
        dueDate={dueDate}
        plateBoy={plateBoyInput}
        plateEn={plateEnInput}
        material={material}
        thickness={thickness}
        priority={priority}
        customerSuggestions={customerSuggestions}
        items={rows}
        notice={panelNotice}
        messages={panelMessages}
        totalParts={calculateTotalParts(rows)}
        estimatedArea={calculateEstimatedArea(rows)}
        validationState={validationState}
        canDelete={Boolean(order)}
        isDeleting={isDeleting}
        isSaving={isSaving}
        isOptimizing={isOptimizing}
        validationErrors={validationErrors}
        onTabChange={handleRibbonTabChange}
        onClose={onBack}
        onCustomerChange={handleCustomerFieldChange}
        onCustomerNameChange={handleCustomerNameChange}
        onCustomerPhoneChange={handleCustomerPhoneChange}
        onDueDateChange={setDueDate}
        onPlateBoyChange={handlePlateBoyChange}
        onPlateEnChange={handlePlateEnChange}
        onPlateBoyBlur={handlePlateBoyBlur}
        onPlateEnBlur={handlePlateEnBlur}
        onMaterialChange={setMaterial}
        onThicknessChange={setThickness}
        onPriorityChange={(v) => setPriority(v as PriorityLevel)}
        onItemChange={handleRowUpdate}
        onAddItem={handleAddRow}
        onRemoveItem={handleRemoveRow}
        onDuplicateItem={handleDuplicateRow}
        onSave={handleSave}
        onOptimize={handleOptimize}
        onValidate={handleValidate}
        onOpenImport={() => setImportModal(true)}
        onExportCsv={handleExportCsv}
        onExportExcel={handleExportExcel}
        onPrint={handlePrint}
        onDownloadTemplate={handleTemplateDownload}
        onDelete={order ? () => void handleDeleteOrder() : undefined}
      />
      <Modal open={importModal} title="Olculeri Ice Aktar" onClose={() => setImportModal(false)}>
        <div style={{ padding: "20px", fontSize: 14, display: "grid", gap: 14 }}>
          <div style={{ lineHeight: 1.6 }}>
            CSV/TXT/XLS dosyasi yukleyin.
            <br />
            Beklenen sutunlar: <code>boy,en,adet,grain,u1,u2,k1,k2,delik-1,delik-2,bilgi</code>
          </div>

          <input
            type="file"
            accept=".csv,.txt,.xls,.xlsx"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await handleImportFile(file);
              event.target.value = "";
            }}
            style={{ display: "block", padding: "8px" }}
          />

          {importError ? (
            <div style={{ padding: "10px 12px", borderRadius: 6, background: "rgba(220, 38, 38, 0.12)", color: "#DC2626", fontSize: 12 }}>
              {importError}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleTemplateDownload}
              style={{ height: 32, padding: "0 14px", border: "1px solid #9CA3AF", background: "transparent", cursor: "pointer" }}
            >
              Ornek CSV Indir
            </button>
            <button
              type="button"
              onClick={() => setImportModal(false)}
              style={{ height: 32, padding: "0 14px", border: "1px solid #9CA3AF", background: "transparent", cursor: "pointer" }}
            >
              Kapat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
