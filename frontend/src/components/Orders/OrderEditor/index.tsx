/**
 * OrderEditor - Main Component
 */

import { useCallback, useEffect, useState } from "react";
import { Order, ORDER_STATUS_LABELS } from "../../../types";
import type { OrderStatus, PriorityLevel } from "../../../types";
import {
  type MeasureRow,
  calculateTotalParts,
} from "./shared";
import { OrderOptimizationPanel } from "../../UI/OrderOptimizationPanel";
import type { OrderOptimizationRibbonTab } from "../../Ribbon/OrderOptimizationRibbon";
import { buildCustomerField, buildPlateSizeValue, buildSystemOrderNo, normalizeMaskedNumberOnBlur, parseCustomerField, parseMaskedNumber, parsePlateSizeInputs, sanitizeMaskedNumberInput } from "./workbenchUtils";
import { apiRequest } from "../../../services/apiClient";
import { orchestratorService } from "../../../services/orchestratorService";
import { useOrdersStore } from "../../../stores/ordersStore";
import { useAuthStore } from "../../../stores/authStore";
import { useUIStore } from "../../../stores/uiStore";

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

export function OrderEditor({ order, onBack }: OrderEditorProps) {
  const [tab, setTab] = useState<"measures" | "validate" | "export">("measures");
  const [rows, setRows] = useState<MeasureRow[]>([{ ...EMPTY_ROW }]);
  const initialPlateInputs = parsePlateSizeInputs(order?.plate || "2800x2070");
  const [material, setMaterial] = useState(order?.mat || "Belirtilmedi");
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
  // Yeni oluşturulan siparişin ID'sini tut — çift kayıt önleme
  const [savedOrderId, setSavedOrderId] = useState<string | null>(order?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>(order?.priority || "normal");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(order?.status || "NEW");

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

  // Mevcut siparis acildiginda backend'den parcalari yukle
  useEffect(() => {
    if (!order?.id || partsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        // apiClient transformKeys zaten snake_case -> camelCase donusumu yapar
        const detail = await apiRequest<Record<string, unknown>>(`/orders/${order.id}`, { method: "GET" });
        if (cancelled) return;
        const rawParts = Array.isArray(detail.parts) ? detail.parts as Record<string, unknown>[] : [];
        if (rawParts.length > 0) {
          const mapped: MeasureRow[] = rawParts.map((p, idx) => ({
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
          }));
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

  const runValidation = useCallback((navigateToExport: boolean): boolean => {
    const errors: string[] = [];
    const normalizedPhone = customerPhone.replace(/\D/g, "");
    const thicknessValue = Number.parseFloat(String(thickness));

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

  type BackendOrderPart = {
    part_group: "GOVDE" | "ARKALIK";
    boy_mm: number;
    en_mm: number;
    adet: number;
    grain_code: "0-Material" | "1-Material" | "2-Material" | "3-Material";
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

  const toGrainCode = (value: string): "0-Material" | "1-Material" | "2-Material" | "3-Material" => {
    const grain = Number.parseInt(value, 10);
    if (grain === 1) return "1-Material";
    if (grain === 2) return "2-Material";
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
    const materialCode = material.trim() || "MATERIAL";
    const color = material.trim() || "Belirtilmedi";
    const baseThickness = Number.isFinite(thickness) && thickness > 0 ? thickness : 18;
    const partThickness = partType === "ARKALIK" ? 8 : baseThickness;

    return sourceRows.map((row) => {
      const lengthMm = parseMaskedNumber(String(row.boy));
      const widthMm = parseMaskedNumber(String(row.en));
      const quantityRaw = Number.parseInt(String(row.adet), 10);
      const grainRaw = Number.parseInt(String(row.grain), 10);

      return {
        id: String(row.id),
        partType,
        materialCode,
        lengthCm: Number.isFinite(lengthMm) && lengthMm > 0 ? lengthMm / 10 : 0,
        widthCm: Number.isFinite(widthMm) && widthMm > 0 ? widthMm / 10 : 0,
        quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1,
        grain: [0, 1, 2, 3].includes(grainRaw) ? grainRaw : 0,
        color,
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

    const existingId = savedOrderId || order?.id;
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
      setTab("validate");
      return;
    }

    setIsSaving(true);
    try {
      await saveOrderToDB();
      // Store'u güncelle — sipariş listesinde yeni kayıt görünsün
      await useOrdersStore.getState().fetchOrders();
      window.alert(`Siparis kaydedildi: ${customerName} (${calculateTotalParts(rows)} parca)`);
    } catch (e: any) {
      window.alert("Kaydedilirken hata olustu: " + e.message);
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
      window.alert(`Siparis optimizasyon kuyruguna alindi. Job ID: ${job.id}`);
    } catch (e: any) {
      window.alert("Optimizasyon baslatilamadi: " + e.message);
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
        },
      ];
    });
  }, []);

  const handleRemoveRow = useCallback((id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

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

  const handleRibbonTabChange = useCallback((nextTab: OrderOptimizationRibbonTab) => {
    setActiveRibbonTab(nextTab);
  }, []);

  return (
    <div style={{ width: "100%", paddingBottom: 24 }}>
      <OrderOptimizationPanel
        themeMode={themeMode}
        activeTab={activeRibbonTab}
        customerValue={customerField}
        orderNo={resolvedOrderNo}
        dueDate={dueDate}
        plateBoy={plateBoyInput}
        plateEn={plateEnInput}
        customerSuggestions={customerSuggestions}
        items={rows}
        notice={panelNotice}
        onTabChange={handleRibbonTabChange}
        onClose={onBack}
        onCustomerChange={handleCustomerFieldChange}
        onDueDateChange={setDueDate}
        onPlateBoyChange={handlePlateBoyChange}
        onPlateEnChange={handlePlateEnChange}
        onPlateBoyBlur={handlePlateBoyBlur}
        onPlateEnBlur={handlePlateEnBlur}
        onItemChange={handleRowUpdate}
        onAddItem={handleAddRow}
      />
    </div>
  );
}
