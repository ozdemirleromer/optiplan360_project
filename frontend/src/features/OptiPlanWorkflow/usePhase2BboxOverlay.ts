import { useEffect, type MutableRefObject } from "react";

import type { WorkflowRecord } from "../../services/optiplanWorkflowService";
import type { ConfidenceField } from "./phase2GridTypes";
import {
  findPhase2SelectedBbox,
  getPhase2BboxFocusPan,
  getPhase2BboxItems,
  phase2BboxFieldMatches,
  supportsPhase2CanvasOverlay,
} from "./phase2BboxUtils";
import { getRowFieldScore } from "./phase2WorkflowUtils";

type PanState = { x: number; y: number };

type UsePhase2BboxOverlayParams = {
  selectedField: ConfidenceField | null;
  selectedRowId: string | null;
  activeRecord: WorkflowRecord | null;
  confidenceThreshold: number;
  isPreviewVisible: boolean;
  imageRef: MutableRefObject<HTMLImageElement | null>;
  bboxCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  imageZoom: number;
  setImageZoom: (nextZoom: number) => void;
  setImagePan: (nextPan: PanState) => void;
  colorDanger: string;
  colorWarning: string;
  colorSuccess: string;
};

export function usePhase2BboxOverlay({
  selectedField,
  selectedRowId,
  activeRecord,
  confidenceThreshold,
  isPreviewVisible,
  imageRef,
  bboxCanvasRef,
  imageZoom,
  setImageZoom,
  setImagePan,
  colorDanger,
  colorWarning,
  colorSuccess,
}: UsePhase2BboxOverlayParams) {
  useEffect(() => {
    const drawCanvas = () => {
      const canvas = bboxCanvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img || !supportsPhase2CanvasOverlay()) return;
      if (!isPreviewVisible || (typeof document !== "undefined" && document.hidden)) {
        let hiddenCtx: CanvasRenderingContext2D | null;
        try { hiddenCtx = canvas.getContext("2d"); } catch { return; }
        if (hiddenCtx) hiddenCtx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      let ctx: CanvasRenderingContext2D | null;
      try { ctx = canvas.getContext("2d"); } catch { return; }
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!selectedRowId || !activeRecord) return;
      const row = activeRecord.satirlar.find((recordRow) => recordRow.id === selectedRowId);
      const bboxItems = getPhase2BboxItems(row);
      if (bboxItems.length === 0) return;

      const scaleX = img.naturalWidth > 0 ? canvas.width / img.naturalWidth : 1;
      const scaleY = img.naturalHeight > 0 ? canvas.height / img.naturalHeight : 1;

      ctx.font = "11px monospace";
      ctx.shadowBlur = 4;

      const drawOperations: Array<() => void> = [];

      for (const item of bboxItems) {
        const { bbox, field } = item;
        const x = bbox.x * scaleX;
        const y = bbox.y * scaleY;
        const w = bbox.w * scaleX;
        const h = bbox.h * scaleY;
        const focused = phase2BboxFieldMatches(field, selectedField);

        const confidenceScore = getRowFieldScore(row, field.toLowerCase() as ConfidenceField);
        const bboxColor = confidenceScore < 50
          ? colorDanger
          : confidenceScore < confidenceThreshold
            ? colorWarning
            : colorSuccess;

        drawOperations.push(() => {
          ctx!.strokeStyle = bboxColor;
          ctx!.fillStyle = bboxColor;
          ctx!.shadowColor = bboxColor;
          ctx!.lineWidth = focused ? 3 : 2;
          ctx!.strokeRect(x, y, w, h);
          ctx!.fillText(`${field} %${Math.round(confidenceScore)}`, x + 2, y - 3);
        });
      }

      drawOperations.forEach((operation) => operation());
    };

    const rafId = requestAnimationFrame(drawCanvas);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [selectedField, selectedRowId, activeRecord, confidenceThreshold, isPreviewVisible, imageRef, bboxCanvasRef, colorDanger, colorWarning, colorSuccess]);

  useEffect(() => {
    if (!selectedRowId || !selectedField || !activeRecord) return;
    const row = activeRecord.satirlar.find((recordRow) => recordRow.id === selectedRowId);
    const bboxItem = findPhase2SelectedBbox(row, selectedField);
    if (!bboxItem?.bbox) return;
    const img = imageRef.current;
    if (!img) return;

    const focusPan = getPhase2BboxFocusPan({
      bbox: bboxItem.bbox,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      currentZoom: imageZoom,
    });
    if (!focusPan) return;

    const { targetZoom, panX, panY } = focusPan;
    if (targetZoom !== imageZoom) setImageZoom(targetZoom);
    setImagePan({ x: panX, y: panY });
  }, [activeRecord, imageRef, imageZoom, selectedField, selectedRowId, setImagePan, setImageZoom]);
}
