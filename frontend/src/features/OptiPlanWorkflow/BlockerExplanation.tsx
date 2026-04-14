/**
 * Phase 2 OCR Kontrol — BlockerExplanation Component
 *
 * Displays a single CellBlocker with reason code, message, suggested value, and UI hint
 */

import React from "react";
import { AlertTriangle, AlertCircle } from "lucide-react";
import type { CellBlocker } from "../../types";
import { BLOCKER_REASON_CODES } from "../../types/phase2_constants";

interface BlockerExplanationProps {
  blocker: CellBlocker;
  className?: string;
}

export const BlockerExplanation: React.FC<BlockerExplanationProps> = ({
  blocker,
  className = "",
}) => {
  // Severity-based coloring and icon
  const severityConfig = {
    critical: {
      bgColor: "bg-red-50 border-red-200",
      textColor: "text-red-700",
      icon: AlertTriangle,
    },
    warning: {
      bgColor: "bg-amber-50 border-amber-200",
      textColor: "text-amber-700",
      icon: AlertCircle,
    },
  };

  const config = severityConfig[blocker.severity] || severityConfig.warning;
  const IconComp = config.icon;

  const reasonLabel =
    BLOCKER_REASON_CODES[blocker.reasonCode] || blocker.reasonCode;

  return (
    <div
      className={`border rounded-md p-3 ${config.bgColor} ${className}`}
      role="alert"
      aria-live="polite"
      aria-label={`${blocker.severity} blocker: ${reasonLabel}`}
    >
      <div className="flex items-start gap-3">
        <IconComp
          className={`flex-shrink-0 w-5 h-5 mt-0.5 ${config.textColor}`}
          aria-hidden="true"
        />
        <div className="flex-1">
          {/* Reason code + operator message */}
          <p className={`font-semibold text-sm ${config.textColor}`}>
            {reasonLabel}
          </p>
          <p className={`text-sm mt-1 ${config.textColor}`}>
            {blocker.operatorMessage}
          </p>

          {/* Suggested value if available */}
          {blocker.suggestedValue !== undefined && (
            <div className={`text-sm mt-2 ${config.textColor}`}>
              <span className="font-medium">Önerilen Değer:</span>{" "}
              <code className="bg-white/60 px-2 py-1 rounded text-mono">
                {blocker.suggestedValue}
              </code>
            </div>
          )}

          {/* Confidence score */}
          {blocker.confidenceScore !== undefined && (
            <div className={`text-xs mt-2 ${config.textColor}`}>
              <span className="font-medium">Güven:</span> {Math.round(blocker.confidenceScore)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockerExplanation;
