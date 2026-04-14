import { useEffect } from "react";

import type { WorkflowRecord } from "../../services/optiplanWorkflowService";

type UndoEvent = {
  id: string;
};

type UsePhase2HotkeysParams = {
  undoTimeline: UndoEvent[];
  activeRecord: WorkflowRecord | null;
  canApprove: boolean;
  disableGlobalHotkeys?: boolean;
  undoDecision: (eventId: string) => Promise<void>;
  handleGoPhase3: () => Promise<void>;
  handleApproveAllInRecord: () => void;
  handleApproveLowConfidenceOnly: () => void;
  setSelectedRowId: (rowId: string | null) => void;
  focusGridCell: (rowId: string, fieldIdx: number) => boolean;
};

function isInteractiveTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (target.isContentEditable) {
    return true;
  }

  if (tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (tagName !== "input") {
    return false;
  }

  const input = target as HTMLInputElement;
  const type = (input.type || "text").toLowerCase();
  return !["checkbox", "radio", "button", "submit", "reset", "range"].includes(type);
}

export function usePhase2Hotkeys({
  undoTimeline,
  activeRecord,
  canApprove,
  disableGlobalHotkeys = false,
  undoDecision,
  handleGoPhase3,
  handleApproveAllInRecord,
  handleApproveLowConfidenceOnly,
  setSelectedRowId,
  focusGridCell,
}: UsePhase2HotkeysParams) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (disableGlobalHotkeys || isInteractiveTextEntryTarget(event.target)) {
        return;
      }

      // Undo: Ctrl/Cmd+Z
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (undoTimeline.length > 0) {
          const lastEvent = undoTimeline[undoTimeline.length - 1];
          if (lastEvent) {
            void undoDecision(lastEvent.id);
          }
        }
      }

      // Redo: Ctrl/Cmd+Y veya Ctrl/Cmd+Shift+Z
      if (((event.ctrlKey || event.metaKey) && event.key === "y")
        || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "z")) {
        event.preventDefault();
        // Redo is not supported yet; shortcut is reserved.
      }

      // Approve all: Ctrl/Cmd+Enter
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (activeRecord && canApprove) {
          void handleGoPhase3();
        }
      }

      // Approve all fields in record: Ctrl/Cmd+A
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        handleApproveAllInRecord();
      }

      // Approve low-confidence fields only: Ctrl/Cmd+Shift+A
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        handleApproveLowConfidenceOnly();
      }

      // Number keys 1-9: Jump to row
      if (!event.ctrlKey && !event.metaKey && !event.altKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const rowIndex = parseInt(event.key, 10) - 1;
        if (activeRecord && rowIndex < activeRecord.satirlar.length) {
          const targetRow = activeRecord.satirlar[rowIndex];
          if (targetRow) {
            setSelectedRowId(targetRow.id);
            focusGridCell(targetRow.id, 0);
          }
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    undoTimeline,
    activeRecord,
    canApprove,
    disableGlobalHotkeys,
    undoDecision,
    handleGoPhase3,
    handleApproveAllInRecord,
    handleApproveLowConfidenceOnly,
    setSelectedRowId,
    focusGridCell,
  ]);
}
