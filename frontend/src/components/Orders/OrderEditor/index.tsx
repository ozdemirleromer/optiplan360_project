/**
 * OrderEditor - Main Component
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../Shared/Button";
import { Card } from "../../Shared/Card";
import { Modal } from "../../Shared/Modal";
import { TopBar } from "../../Layout/TopBar";
import { COLORS, RADIUS, TYPOGRAPHY, TRANSITIONS } from "../../Shared/constants";
import { Order, ORDER_STATUS_LABELS } from "../../../types";
import type { OrderStatus, PriorityLevel } from "../../../types";
import { ordersService } from "../../../services/ordersService";
import {
  type MeasureRow,
  buildMeasuresCsv,
  buildMeasuresExcelHtml,
  calculateTotalParts,
  downloadTextFile,
  parseImportedMeasures,
  parseImportedArray,
} from "./shared";
import { MeasureTable } from "./MeasureTable";
import { apiRequest } from "../../../services/apiClient";
import { orchestratorService } from "../../../services/orchestratorService";
import { useOrdersStore } from "../../../stores/ordersStore";
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

const exportButtonStyle: React.CSSProperties = {
  padding: "18px 16px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  background: `${COLORS.primary[500]}10`,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  color: COLORS.primary[500],
  transition: TRANSITIONS.fast,
  fontSize: 13,
  fontWeight: 600,
};

export function OrderEditor({ order, onBack }: OrderEditorProps) {
  const [tab, setTab] = useState<"measures" | "validate" | "export">("measures");
  const [rows, setRows] = useState<MeasureRow[]>([{ ...EMPTY_ROW }]);
  const [material, setMaterial] = useState(order?.mat || "Belirtilmedi");
  const [plateSize, setPlateSize] = useState(order?.plate || "2100x2800");
  const [thickness, setThickness] = useState(order?.thick || 18);
  const [customerName, setCustomerName] = useState(order?.cust || "");
  const [customerPhone, setCustomerPhone] = useState(order?.phone || "");
  const [importModal, setImportModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  // Yeni oluşturulan siparişin ID'sini tut — çift kayıt önleme
  const [savedOrderId, setSavedOrderId] = useState<string | null>(order?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>(order?.priority || "normal");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(order?.status || "NEW");
  const [isDeleting, setIsDeleting] = useState(false);

  const [partsLoaded, setPartsLoaded] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const isArk = order?.grp === "ARKALIK";
  const nextRowId = Math.max(...rows.map((row) => row.id), 0) + 1;

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
      const boy = Number.parseFloat(row.boy);
      const en = Number.parseFloat(row.en);
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
      .match(/(\d+(?:[.,]\d+)?)\s*[xX*\u00D7]\s*(\d+(?:[.,]\d+)?)/);
    if (!match) {
      return {};
    }

    const width = Number.parseFloat(match[1].replace(",", "."));
    const height = Number.parseFloat(match[2].replace(",", "."));
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
      const boyMm = Number.parseFloat(String(row.boy).replace(",", "."));
      const enMm = Number.parseFloat(String(row.en).replace(",", "."));
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
      const lengthMm = Number.parseFloat(String(row.boy).replace(",", "."));
      const widthMm = Number.parseFloat(String(row.en).replace(",", "."));
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

  const handleRowUpdate = (id: number, field: string, value: string | number | boolean) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleAddRow = () => {
    setRows((prev) => [
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
    ]);
  };

  const handleRemoveRow = (id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleExportCsv = () => {
    const csv = buildMeasuresCsv(rows);
    downloadTextFile(csv, getExportFilename("siparis-olculeri", "csv"), "text/csv");
  };

  const handleExportExcel = () => {
    const html = buildMeasuresExcelHtml(rows, {
      customerName,
      customerPhone,
      plateSize,
      thickness,
    });
    downloadTextFile(html, getExportFilename("siparis-olculeri", "xls"), "application/vnd.ms-excel");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=1280,height=860");
    if (!printWindow) {
      alert("Yazdirma penceresi acilamadi. Tarayici acilir pencereyi engellemis olabilir.");
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
          </tr>
        `
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
            th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
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
  };

  const handleTemplateDownload = () => {
    const template = buildMeasuresCsv([
      { id: 1, boy: "650", en: "420", adet: "2", grain: "0", u1: false, u2: false, k1: false, k2: false, delik1: "", delik2: "", info: "Ornek satir 1" },
      { id: 2, boy: "1200", en: "300", adet: "1", grain: "1", u1: true, u2: false, k1: true, k2: false, delik1: "8", delik2: "", info: "Ornek satir 2" },
    ]);
    downloadTextFile(template, "ornek-olcu-sablonu.csv", "text/csv");
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    setImportInfo(null);

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "txt", "xls", "xlsx"].includes(extension)) {
      setImportError("Desteklenmeyen dosya tipi. CSV, TXT, XLS veya XLSX kullanin.");
      return;
    }

    try {
      let importedRows;
      let warnings: string[];

      if (extension === "xlsx" || extension === "xls") {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // json header: 1 means we get array of arrays
        const dataRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        const result = parseImportedArray(dataRows);
        importedRows = result.rows;
        warnings = result.warnings;

        // Metadata aktarimi
        if (result.meta?.thickness) setThickness(result.meta.thickness);
        if (result.meta?.plateSize) setPlateSize(result.meta.plateSize);
        if (result.meta?.material) setMaterial(result.meta.material);

        // Musteri adi dosya isminden, telefon bos
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setCustomerName(nameWithoutExt.trim());
        setCustomerPhone("");
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

      const normalizedRows = importedRows.map((row, index) => ({
        ...row,
        id: index + 1,
        grain: row.grain || "0",
      }));

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
  };

  const onExportButtonEnter = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.background = `${COLORS.primary[500]}20`;
    event.currentTarget.style.borderColor = COLORS.primary[500];
  };

  const onExportButtonLeave = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.background = `${COLORS.primary[500]}10`;
    event.currentTarget.style.borderColor = COLORS.border;
  };

  return (
    <div className="electric-page">
      <TopBar
        title={order ? order.cust : "Yeni Siparis"}
        subtitle="Olcu girisi, dogrulama ve disa aktarma"
        breadcrumbs={["Siparisler", "Editor"]}
      />
      <div className="app-page-container" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 200 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onBack}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: COLORS.muted,
                fontSize: 20,
              }}
              aria-label="Geri don"
            >
              {"<-"}
            </button>
            <h2 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize["2xl"], fontWeight: TYPOGRAPHY.fontWeight.bold }}>
              {order ? order.cust : "Yeni Siparis"}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {order && (
              <span style={{
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: RADIUS.md,
                background: orderStatus === "NEW" ? `${COLORS.info.DEFAULT}20` : orderStatus === "IN_PRODUCTION" ? `${COLORS.accent[400]}20` : orderStatus === "READY" ? `${COLORS.success.DEFAULT}20` : `${COLORS.muted}20`,
                color: orderStatus === "NEW" ? COLORS.info.DEFAULT : orderStatus === "IN_PRODUCTION" ? COLORS.accent[400] : orderStatus === "READY" ? COLORS.success.DEFAULT : COLORS.muted,
              }}>
                {ORDER_STATUS_LABELS[orderStatus] || orderStatus}
              </span>
            )}
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              title="Oncelik"
              style={{
                padding: "6px 8px",
                fontSize: 12,
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(14, 20, 25, 0.5)",
                color: COLORS.text,
              }}
            >
              <option value="low">Dusuk</option>
              <option value="normal">Normal</option>
              <option value="high">Yuksek</option>
              <option value="urgent">Acil</option>
            </select>
            <Button onClick={() => setImportModal(true)} variant="secondary" size="sm">
              Ice Aktar
            </Button>
            <Button onClick={handleSave} variant="secondary" size="sm">
              Kaydet (Ctrl+S)
            </Button>
            <Button
              onClick={handleOptimize}
              size="sm"
              disabled={isOptimizing || rows.length === 0}
              title="Siparisi kaydedip OptiPlanning'e gonderir"
            >
              {isOptimizing ? "Gonderiliyor..." : "Optimizasyona Gonder"}
            </Button>
            {order && (
              <Button
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={async () => {
                  if (!confirm("Bu siparisi silmek istediginizden emin misiniz?")) return;
                  setIsDeleting(true);
                  try {
                    await ordersService.remove(order.id);
                    await useOrdersStore.getState().fetchOrders();
                    onBack();
                  } catch {
                    window.alert("Siparis silinemedi (sadece NEW durumundaki siparisler silinebilir)");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? "Siliniyor..." : "Sil"}
              </Button>
            )}
          </div>
        </div>

        {partsError && (
          <Card style={{ border: `1px solid ${COLORS.error.DEFAULT}`, background: `${COLORS.error.DEFAULT}10` }}>
            <div style={{ padding: "10px 14px", fontSize: 13, color: COLORS.error.DEFAULT }}>
              {partsError}
            </div>
          </Card>
        )}

        {importInfo && (
          <Card style={{ border: `1px solid ${COLORS.success.DEFAULT}`, background: `${COLORS.success.DEFAULT}10` }}>
            <div style={{ padding: "10px 14px", fontSize: 13, color: COLORS.success.DEFAULT }}>
              {importInfo}
            </div>
          </Card>
        )}

        {importError && (
          <Card style={{ border: `1px solid ${COLORS.warning.DEFAULT}`, background: `${COLORS.warning.DEFAULT}10` }}>
            <div style={{ padding: "10px 14px", fontSize: 13, color: COLORS.warning.DEFAULT }}>
              {importError}
            </div>
          </Card>
        )}

        <Card>
          <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray[400], display: "block", marginBottom: 8 }}>
                Musteri
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(14, 20, 25, 0.5)",
                  color: COLORS.text,
                  fontSize: 13,
                  outline: "none",
                  transition: TRANSITIONS.fast,
                }}
                placeholder="Musteri adi"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray[400], display: "block", marginBottom: 8 }}>
                Telefon
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(14, 20, 25, 0.5)",
                  color: COLORS.text,
                  fontSize: 13,
                  outline: "none",
                  transition: TRANSITIONS.fast,
                }}
                placeholder="+90 555 123 45 67"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray[400], display: "block", marginBottom: 8 }}>
                Plaka Boyutu
              </label>
              <select
                value={plateSize}
                onChange={(event) => setPlateSize(event.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(14, 20, 25, 0.5)",
                  color: COLORS.text,
                  fontSize: 13,
                  outline: "none",
                  transition: TRANSITIONS.fast,
                }}
              >
                <option>2100x2800</option>
                <option>2000x3000</option>
                <option>1500x2000</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray[400], display: "block", marginBottom: 8 }}>
                Kalinlik (mm)
              </label>
              <input
                type="number"
                value={thickness}
                onChange={(event) => setThickness(parseFloat(event.target.value))}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(14, 20, 25, 0.5)",
                  color: COLORS.text,
                  fontSize: 13,
                  outline: "none",
                  transition: TRANSITIONS.fast,
                }}
                min="0.5"
                max="100"
                step="0.5"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray[400], display: "block", marginBottom: 8 }}>
                Renk / Malzeme
              </label>
              <input
                type="text"
                value={material}
                onChange={(event) => setMaterial(event.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(14, 20, 25, 0.5)",
                  color: COLORS.text,
                  fontSize: 13,
                  outline: "none",
                  transition: TRANSITIONS.fast,
                }}
                placeholder="Renk veya malzeme"
              />
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${COLORS.border}` }}>
          {(["measures", "validate", "export"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                padding: "12px 20px",
                border: "none",
                background: "none",
                cursor: "pointer",
                color: tab === value ? COLORS.primary[500] : COLORS.gray[500],
                fontSize: 14,
                fontWeight: TYPOGRAPHY.fontWeight.semibold,
                borderBottom: tab === value ? `2px solid ${COLORS.primary[500]}` : "none",
                transition: TRANSITIONS.fast,
              }}
            >
              {value === "measures" && "Olculer"}
              {value === "validate" && "Dogrula"}
              {value === "export" && "Disa Aktar"}
            </button>
          ))}
        </div>

        {tab === "measures" && (
          <MeasureTable
            rows={rows}
            isArk={isArk}
            selectedGrain="0"
            onRowUpdate={handleRowUpdate}
            onAddRow={handleAddRow}
            onRemoveRow={handleRemoveRow}
          />
        )}

        {tab === "validate" && (
          <Card style={{ padding: "20px" }}>
            {validationErrors.length === 0 ? (
              <div style={{ textAlign: "center", color: COLORS.success.DEFAULT, padding: "20px 12px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>OK</div>
                <div style={{ fontSize: 14, fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                  Hata yok. Disa aktarmaya hazir.
                </div>
                <Button onClick={() => setTab("export")} style={{ marginTop: 16 }}>
                  Disa Aktar Adimina Git
                </Button>
              </div>
            ) : (
              <div>
                <div style={{ color: COLORS.error.DEFAULT, marginBottom: 16, fontSize: 14, fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                  {validationErrors.length} hata bulundu:
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, color: COLORS.text, fontSize: 13, lineHeight: 1.6 }}>
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
              <Button onClick={handleValidate} variant="secondary">
                Tekrar Dogrula
              </Button>
              <Button onClick={() => setTab("measures")}>Geri Don</Button>
            </div>
          </Card>
        )}

        {tab === "export" && (
          <Card style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ display: "inline-flex", color: COLORS.primary[500], fontSize: 20 }}>v</span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.primary[500] }}>
                Disa Aktarma Secenekleri
              </h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
              <button
                onClick={handleExportCsv}
                style={exportButtonStyle}
                onMouseEnter={onExportButtonEnter}
                onMouseLeave={onExportButtonLeave}
              >
                <span style={{ fontSize: 24 }}>[CSV]</span>
                CSV Indir
              </button>
              <button
                onClick={handleExportExcel}
                style={exportButtonStyle}
                onMouseEnter={onExportButtonEnter}
                onMouseLeave={onExportButtonLeave}
              >
                <span style={{ fontSize: 24 }}>[XLS]</span>
                Excel Indir
              </button>
              <button
                onClick={handlePrint}
                style={exportButtonStyle}
                onMouseEnter={onExportButtonEnter}
                onMouseLeave={onExportButtonLeave}
              >
                <span style={{ fontSize: 24 }}>[PRN]</span>
                Yazdir
              </button>
            </div>
          </Card>
        )}

        {importModal && (
          <Modal open={importModal} title="Olculeri Ice Aktar" onClose={() => setImportModal(false)}>
            <div style={{ padding: "20px", fontSize: 14, display: "grid", gap: 14 }}>
              <div style={{ color: COLORS.gray[400], lineHeight: 1.6 }}>
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
                style={{
                  display: "block",
                  padding: "8px",
                }}
              />

              {importError && (
                <div style={{ padding: "10px 12px", borderRadius: 6, background: `${COLORS.error.DEFAULT}12`, color: COLORS.error.DEFAULT, fontSize: 12 }}>
                  {importError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={handleTemplateDownload}>
                  Ornek CSV Indir
                </Button>
                <Button variant="secondary" onClick={() => setImportModal(false)}>
                  Kapat
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
