interface StationsFlowBoardProps {
  runningJobs: number;
  queueCount: number;
  warningCount: number;
}

export function StationsFlowBoard({ runningJobs, queueCount, warningCount }: StationsFlowBoardProps) {
  const hasWarnings = warningCount > 0;

  return (
    <div className="ai-ops-flow-board">
      <svg viewBox="0 0 860 320" className="ai-ops-flow-lines" aria-hidden="true">
        <path className="ai-ops-flow-path" d="M150 160 C 250 160, 260 72, 360 72" />
        <path className="ai-ops-flow-path" d="M150 160 C 240 160, 255 160, 360 160" />
        <path className="ai-ops-flow-path" d="M150 160 C 250 160, 260 252, 360 252" />
        <path className="ai-ops-flow-path" d="M480 72 C 585 72, 595 160, 700 160" />
        <path className="ai-ops-flow-path" d="M480 160 C 585 160, 595 160, 700 160" />
        <path className="ai-ops-flow-path" d="M480 252 C 585 252, 595 160, 700 160" />
      </svg>

      <div className="ai-ops-flow-node ai-ops-node-source ai-ops-node-core">
        <strong>AI Çekirdek</strong>
        <span>{runningJobs} aktif görev</span>
      </div>

      <div className="ai-ops-flow-node ai-ops-node-1">
        <strong>İstasyon 1</strong>
        <span>Beceri Katmanı</span>
      </div>

      <div className="ai-ops-flow-node ai-ops-node-2">
        <strong>İstasyon 2</strong>
        <span>Alt Ajan</span>
      </div>

      <div className="ai-ops-flow-node ai-ops-node-3">
        <strong>İstasyon 3</strong>
        <span>Queue: {queueCount}</span>
      </div>

      <div
        className={`ai-ops-drop-zone ai-ops-drop-target ${hasWarnings ? "is-warning" : ""}`}
        aria-live="polite"
      >
        <strong>Bırakma Alanı</strong>
        <span>{hasWarnings ? `${warningCount} uyarılı paket` : "Sürükle bırak hazır"}</span>
      </div>

      <div className="ai-ops-flow-minimap" aria-hidden="true">
        <svg viewBox="0 0 180 96">
          <rect x="2" y="2" width="176" height="92" rx="10" />
          <circle cx="24" cy="48" r="6" />
          <circle cx="78" cy="20" r="5" />
          <circle cx="78" cy="48" r="5" />
          <circle cx="78" cy="76" r="5" />
          <rect x="130" y="38" width="26" height="18" rx="4" />
          <path d="M30 48 C 40 48, 48 20, 72 20" />
          <path d="M30 48 C 48 48, 55 48, 72 48" />
          <path d="M30 48 C 40 48, 48 76, 72 76" />
          <path d="M84 20 C 98 20, 110 48, 130 48" />
          <path d="M84 48 C 98 48, 110 48, 130 48" />
          <path d="M84 76 C 98 76, 110 48, 130 48" />
        </svg>
      </div>
    </div>
  );
}

