/**
 * Phase 2 OCR Kontrol — BlockerSummaryPanel Component
 *
 * Displays a summary of low confidence cells and export readiness
 */

import React from "react";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";

export interface BlockerSummary {
  totalRows: number;
  lowCells: number;
  pendingApprovals: number;
  approvedCells: number;
  exportReady: boolean;
}

interface BlockerSummaryPanelProps {
  summary: BlockerSummary | null;
  confidenceThreshold: number;
  className?: string;
}

export const BlockerSummaryPanel: React.FC<BlockerSummaryPanelProps> = ({
  summary,
  confidenceThreshold,
  className = "",
}) => {
  if (!summary) {
    return (
      <div
        className={`border border-slate-700 bg-slate-800/50 rounded-md p-3 ${className}`}
      >
        <p className="text-xs text-slate-500">Blocker özeti yükleniyor...</p>
      </div>
    );
  }

  const { totalRows, lowCells, pendingApprovals, approvedCells, exportReady } = summary;

  // Calculate percentages
  const approvalProgress = lowCells > 0 ? Math.round((approvedCells / lowCells) * 100) : 100;

  return (
    <div
      className={`border rounded-md p-3 ${
        exportReady
          ? "border-emerald-700/60 bg-emerald-900/20"
          : "border-amber-700/60 bg-amber-900/20"
      } ${className}`}
      role="region"
      aria-label="Blocker özeti paneli"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {exportReady ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
        )}
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            exportReady ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {exportReady ? "Export Hazır" : "Onay Bekleniyor"}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-900/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            <span>Toplam Satır</span>
          </div>
          <span className="text-sm font-semibold text-slate-300">{totalRows}</span>
        </div>

        <div className="bg-slate-900/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            <span>Düşük Güven</span>
          </div>
          <span
            className={`text-sm font-semibold ${
              lowCells > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {lowCells}
          </span>
          <span className="text-[10px] text-slate-500 ml-1">hücre</span>
        </div>

        <div className="bg-slate-900/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>Bekleyen</span>
          </div>
          <span
            className={`text-sm font-semibold ${
              pendingApprovals > 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {pendingApprovals}
          </span>
          <span className="text-[10px] text-slate-500 ml-1">onay</span>
        </div>

        <div className="bg-slate-900/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            <span>Onaylanan</span>
          </div>
          <span className="text-sm font-semibold text-emerald-400">{approvedCells}</span>
          <span className="text-[10px] text-slate-500 ml-1">hücre</span>
        </div>
      </div>

      {/* Progress Bar */}
      {lowCells > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-slate-500">Onay İlerlemesi</span>
            <span
              className={`font-medium ${
                approvalProgress === 100 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              %{approvalProgress}
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                approvalProgress === 100
                  ? "bg-emerald-500"
                  : approvalProgress > 50
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${approvalProgress}%` }}
              aria-valuenow={approvalProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
        </div>
      )}

      {/* Threshold Info */}
      <div className="text-[10px] text-slate-500 border-t border-slate-700/50 pt-2">
        <span>Güven eşiği: </span>
        <span className="text-slate-300 font-medium">%{confidenceThreshold}</span>
        <span> altı düşük güven</span>
      </div>

      {/* Action Hint */}
      {!exportReady && pendingApprovals > 0 && (
        <div className="mt-2 text-[10px] text-amber-400/80">
          <span className="font-medium">{pendingApprovals} onay</span> bekleniyor. Onaylayarak devam edin.
        </div>
      )}
    </div>
  );
};

export default BlockerSummaryPanel;
