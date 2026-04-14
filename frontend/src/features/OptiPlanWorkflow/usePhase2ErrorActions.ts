import { useCallback } from "react";
import type { MutableRefObject } from "react";

import { optiplanWorkflowService } from "../../services/optiplanWorkflowService";
import type { WorkflowRecord } from "../../services/optiplanWorkflowService";
import { buildWhatsAppDraft, pickNextPhase2Uuid } from "./phase2WorkflowUtils";

type UsePhase2ErrorActionsParams = {
  activeUuid: string | null;
  activeRecord: WorkflowRecord | null;
  errorNote: string;
  load: () => Promise<WorkflowRecord[]>;
  setSaving: (value: boolean) => void;
  setShowErrorModal: (value: boolean) => void;
  setErrorNote: (value: string) => void;
  setWhatsAppDraftText: (value: string) => void;
  setShowWhatsAppModal: (value: boolean) => void;
  setActiveUuid: (value: string | null) => void;
  setErrorMsg: (value: string | null) => void;
  setWhatsAppCopied: (value: boolean) => void;
  pendingNextUuidRef: MutableRefObject<string | null>;
  isMountedRef: MutableRefObject<boolean>;
};

export function usePhase2ErrorActions({
  activeUuid,
  activeRecord,
  errorNote,
  load,
  setSaving,
  setShowErrorModal,
  setErrorNote,
  setWhatsAppDraftText,
  setShowWhatsAppModal,
  setActiveUuid,
  setErrorMsg,
  setWhatsAppCopied,
  pendingNextUuidRef,
  isMountedRef,
}: UsePhase2ErrorActionsParams) {
  const handleWhatsAppClose = useCallback(async () => {
    setShowWhatsAppModal(false);
    setWhatsAppCopied(false);
    const nextUuid = pendingNextUuidRef.current;
    pendingNextUuidRef.current = null;
    if (nextUuid !== undefined) {
      setActiveUuid(nextUuid);
    }
  }, [pendingNextUuidRef, setActiveUuid, setShowWhatsAppModal, setWhatsAppCopied]);

  const handleMarkError = useCallback(async () => {
    if (!activeUuid) return;
    setSaving(true);
    setShowErrorModal(false);
    const markedUuid = activeUuid;
    const capturedRecord = activeRecord;
    const capturedNote = errorNote;

    try {
      await optiplanWorkflowService.markError(markedUuid, "phase2", "Operatör hatası işaretledi", capturedNote);
      setErrorNote("");
      const freshRecords = await load();
      const nextUuid = pickNextPhase2Uuid(freshRecords, markedUuid);
      if (capturedRecord) {
        const draft = buildWhatsAppDraft(capturedRecord, capturedNote);
        setWhatsAppDraftText(draft);
        pendingNextUuidRef.current = nextUuid;
        setShowWhatsAppModal(true);
      } else {
        setActiveUuid(nextUuid);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Hata işaretleme başarısız");
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    activeRecord,
    activeUuid,
    errorNote,
    isMountedRef,
    load,
    pendingNextUuidRef,
    setActiveUuid,
    setErrorMsg,
    setErrorNote,
    setSaving,
    setShowErrorModal,
    setShowWhatsAppModal,
    setWhatsAppDraftText,
  ]);

  return {
    handleWhatsAppClose,
    handleMarkError,
  };
}
