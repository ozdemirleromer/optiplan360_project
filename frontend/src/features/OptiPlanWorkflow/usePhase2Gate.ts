import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { optiplanWorkflowService } from "../../services/optiplanWorkflowService";
import type {
  AuditTrailResponse,
  BatchApproveCommitResponse,
  BatchApproveDryRunResponse,
  BatchApproveQuery,
  CellDecideRequest,
  CellDecideResponse,
  DecisionEvent,
  Phase3GateStatusResponse,
  UndoResponse,
  ValidateCellResponse,
} from "../../types";

const REFRESH_MS = 45_000;
const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 120_000;

function toUndoTimeline(events: DecisionEvent[]): DecisionEvent[] {
  return [...events]
    .sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 5);
}

export function useValidateCell() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    async (payload: {
      fieldType: "boy" | "en" | "adet";
      value: number;
      originalOcrValue?: string;
      currentConfidence?: number;
    }): Promise<ValidateCellResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        return await optiplanWorkflowService.validatePhase2Cell(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hücre doğrulama başarısız");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { validate, loading, error };
}

export function useBatchApprove(recordUuid: string | null) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dryRun = useCallback(
    async (query: BatchApproveQuery): Promise<BatchApproveDryRunResponse | null> => {
      if (!recordUuid) return null;
      setRunning(true);
      setError(null);
      try {
        return await optiplanWorkflowService.batchApprovePhase2DryRun({
          recordUuid,
          query,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Toplu onay dry-run başarısız");
        return null;
      } finally {
        setRunning(false);
      }
    },
    [recordUuid],
  );

  const commit = useCallback(
    async (
      query: BatchApproveQuery,
      options: { dryRunId?: string } = {},
    ): Promise<BatchApproveCommitResponse | null> => {
      if (!recordUuid) return null;
      setRunning(true);
      setError(null);
      try {
        return await optiplanWorkflowService.batchApprovePhase2Commit({
          recordUuid,
          query,
          dryRunId: options.dryRunId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Toplu onay commit başarısız");
        return null;
      } finally {
        setRunning(false);
      }
    },
    [recordUuid],
  );

  return {
    dryRun,
    commit,
    running,
    error,
  };
}

export function usePhase2Gate(recordUuid: string | null) {
  const [gateStatus, setGateStatus] = useState<Phase3GateStatusResponse | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailResponse | null>(null);
  const [undoTimeline, setUndoTimeline] = useState<DecisionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingDecision, setProcessingDecision] = useState(false);
  const [processingUndo, setProcessingUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retryDelayRef = useRef(REFRESH_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const loadAudit = useCallback(async (): Promise<AuditTrailResponse | null> => {
    if (!recordUuid) return null;
    const audit = await optiplanWorkflowService.getPhase2AuditTrail(recordUuid, {
      limit: 50,
      offset: 0,
    });
    if (isMountedRef.current) {
      setAuditTrail(audit);
      setUndoTimeline(toUndoTimeline(audit.events));
    }
    return audit;
  }, [recordUuid]);

  const loadGate = useCallback(async (): Promise<Phase3GateStatusResponse | null> => {
    if (!recordUuid) return null;
    const gate = await optiplanWorkflowService.getPhase2GateStatus(recordUuid);
    if (isMountedRef.current) {
      setGateStatus(gate);
    }
    return gate;
  }, [recordUuid]);

  const refresh = useCallback(async () => {
    if (!recordUuid) {
      setGateStatus(null);
      setAuditTrail(null);
      setUndoTimeline([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [gate, audit] = await Promise.all([loadGate(), loadAudit()]);
      const anyFailed = !gate || !audit;
      retryDelayRef.current = anyFailed
        ? Math.min(retryDelayRef.current * 2, MAX_RETRY_MS)
        : REFRESH_MS;
    } catch (err) {
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Phase 2 verileri alınamadı");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        clearTimer();
        timerRef.current = setTimeout(() => {
          void refresh();
        }, Math.max(MIN_RETRY_MS, retryDelayRef.current));
      }
    }
  }, [clearTimer, loadAudit, loadGate, recordUuid]);

  const decideCell = useCallback(
    async (payload: CellDecideRequest): Promise<CellDecideResponse | null> => {
      setProcessingDecision(true);
      setError(null);
      try {
        const result = await optiplanWorkflowService.decidePhase2Cell(payload);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hücre kararı kaydedilemedi");
        return null;
      } finally {
        setProcessingDecision(false);
      }
    },
    [refresh],
  );

  const undoDecision = useCallback(
    async (decisionEventId: string): Promise<UndoResponse | null> => {
      if (!recordUuid) return null;
      setProcessingUndo(true);
      setError(null);
      try {
        const result = await optiplanWorkflowService.undoPhase2Decision({
          recordUuid,
          decisionEventId,
        });
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Geri alma işlemi başarısız");
        return null;
      } finally {
        setProcessingUndo(false);
      }
    },
    [recordUuid, refresh],
  );

  useEffect(() => {
    isMountedRef.current = true;
    void refresh();

    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer, refresh]);

  const canProceed = useMemo(() => gateStatus?.canProceed ?? false, [gateStatus]);

  return {
    gateStatus,
    auditTrail,
    undoTimeline,
    canProceed,
    loading,
    processingDecision,
    processingUndo,
    error,
    refresh,
    decideCell,
    undoDecision,
  };
}
