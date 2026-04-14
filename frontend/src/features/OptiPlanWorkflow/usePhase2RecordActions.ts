import { useCallback } from "react";
import type { MutableRefObject } from "react";

import { optiplanWorkflowService } from "../../services/optiplanWorkflowService";
import type { WorkflowRecord, WorkflowRow } from "../../services/optiplanWorkflowService";
import { CONFIDENCE_FIELDS, EMPTY_APPROVED_FIELDS } from "./phase2GridConstants";
import type { ConfidenceField, RowEditState } from "./phase2GridTypes";
import { pickNextPhase2Uuid } from "./phase2WorkflowUtils";

type UsePhase2RecordActionsParams = {
  activeRecord: WorkflowRecord | null;
  activeUuid: string | null;
  approvedCells: Record<string, Set<ConfidenceField>>;
  rowEdits: Record<string, RowEditState>;
  load: () => Promise<WorkflowRecord[]>;
  setSaving: (value: boolean) => void;
  setErrorMsg: (value: string | null) => void;
  setActiveUuid: (value: string | null) => void;
  isMountedRef: MutableRefObject<boolean>;
};

export function usePhase2RecordActions({
  activeRecord,
  activeUuid,
  approvedCells,
  rowEdits,
  load,
  setSaving,
  setErrorMsg,
  setActiveUuid,
  isMountedRef,
}: UsePhase2RecordActionsParams) {
  const handleRemoveRow = useCallback(async (rowId: string) => {
    if (!activeUuid) return;
    setSaving(true);
    try {
      await optiplanWorkflowService.removeRow(activeUuid, rowId);
      await load();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Satır kaldırılamadı");
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }, [activeUuid, isMountedRef, load, setErrorMsg, setSaving]);

  const handleRestoreRow = useCallback(async (rowId: string) => {
    if (!activeUuid) return;
    setSaving(true);
    try {
      await optiplanWorkflowService.restoreRow(activeUuid, rowId);
      await load();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Satır geri alınamadı");
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }, [activeUuid, isMountedRef, load, setErrorMsg, setSaving]);

  const handleGoPhase3 = useCallback(async () => {
    if (!activeRecord || !activeUuid) return;
    setSaving(true);
    setErrorMsg(null);
    const approvedUuid = activeUuid;

    try {
      const rows: WorkflowRow[] = activeRecord.satirlar.map((row) => {
        const edits = rowEdits[row.id];
        const approved = approvedCells[row.id] ?? EMPTY_APPROVED_FIELDS;
        const updatedScores = { ...row.hucreGuvenSkorlari };

        CONFIDENCE_FIELDS.forEach((field) => {
          if (approved.has(field)) {
            updatedScores[field] = 100;
          }
        });

        return {
          ...row,
          boy: edits?.boy !== undefined ? edits.boy : row.boy,
          en: edits?.en !== undefined ? edits.en : row.en,
          adet: edits?.adet !== undefined ? edits.adet : row.adet,
          u1: edits?.u1 !== undefined ? edits.u1 : row.u1,
          u2: edits?.u2 !== undefined ? edits.u2 : row.u2,
          k1: edits?.k1 !== undefined ? edits.k1 : row.k1,
          k2: edits?.k2 !== undefined ? edits.k2 : row.k2,
          hucreGuvenSkorlari: updatedScores,
          satirGuvenSkorOzeti: {
            ...row.satirGuvenSkorOzeti,
            onaylanan_hucreler: [...approved],
          } as unknown as Record<string, number | string>,
        };
      });

      await optiplanWorkflowService.updatePhase2(approvedUuid, {
        rows,
        okunanCariUnvan: activeRecord.okunanCariUnvan,
        okunanCariTelefon: activeRecord.okunanCariTelefon,
        aiGuvenSkoruOzeti: activeRecord.aiGuvenSkoruOzeti,
        revizyonAdayiUyarisi: activeRecord.revizyonAdayiUyarisi,
      });

      await optiplanWorkflowService.approvePhase2(approvedUuid);
      const freshRecords = await load();
      setActiveUuid(pickNextPhase2Uuid(freshRecords, approvedUuid));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const isStale = message.includes("409")
        || message.toLowerCase().includes("conflict")
        || message.toLowerCase().includes("stale");
      const isRejected = message.toLowerCase().includes("blocker")
        || message.toLowerCase().includes("engellendi")
        || message.toLowerCase().includes("rejected");

      if (isStale) {
        setErrorMsg("Kayıt başka bir operatör tarafından güncellendi. Lütfen yenileyip tekrar deneyin.");
      } else if (isRejected) {
        setErrorMsg(`Phase 3'e geçiş engellendi: ${message || "Blocker hataları giderilmeden geçiş yapılamaz."}`);
      } else {
        setErrorMsg(message || "Phase 3'e geçiş başarısız");
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    activeRecord,
    activeUuid,
    approvedCells,
    rowEdits,
    load,
    setSaving,
    setErrorMsg,
    setActiveUuid,
    isMountedRef,
  ]);

  return {
    handleRemoveRow,
    handleRestoreRow,
    handleGoPhase3,
  };
}
