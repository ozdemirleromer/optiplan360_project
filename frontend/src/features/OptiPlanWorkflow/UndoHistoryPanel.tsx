import { Button } from "../../components/Shared";
import { COLORS, RADIUS } from "../../components/Shared/constants";
import type { DecisionEvent } from "../../types";
import { BLOCKER_REASON_CODES } from "../../types/phase2_constants";

const panelStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.md,
  background: COLORS.bg.surface,
  overflow: "hidden",
};

const panelHeaderStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: `1px solid ${COLORS.border}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: COLORS.text,
};

const panelSubTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.muted,
};

const emptyStateStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: 12,
  color: COLORS.muted,
};

const eventsGridStyle: React.CSSProperties = {
  display: "grid",
};

const eventRowBaseStyle: React.CSSProperties = {
  padding: "10px 12px",
  display: "grid",
  gap: 6,
};

const rowHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const rowHeaderLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const eventMetaRowStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.muted,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const valueChangeRowStyle: React.CSSProperties = {
  fontSize: 11,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 8px",
  background: COLORS.bg?.hover || "#0f172a",
  borderRadius: 4,
  flexWrap: "wrap",
};

const oldValueLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
};

const oldValueTextStyle: React.CSSProperties = {
  textDecoration: "line-through",
  color: COLORS.muted,
};

const arrowStyle: React.CSSProperties = {
  color: COLORS.text,
};

const confidenceStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.muted,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

function getEventRowStyle(isLast: boolean): React.CSSProperties {
  return {
    ...eventRowBaseStyle,
    borderBottom: isLast ? "none" : `1px solid ${COLORS.border}`,
  };
}

function getEventTitleStyle(eventType: string): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    color: getEventColor(eventType),
  };
}

function getEventNewValueStyle(eventType: string): React.CSSProperties {
  return {
    color: getEventColor(eventType),
    fontWeight: 600,
  };
}

interface ExtendedDecisionEvent extends DecisionEvent {
  previousValue?: string | null;
  newValue?: string | null;
  operatorName?: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
}

interface UndoHistoryPanelProps {
  events: ExtendedDecisionEvent[]; // Use ExtendedDecisionEvent
  disabled?: boolean;
  processingUndo?: boolean;
  pendingUndoEventId?: string | null;
  onUndo: (eventId: string) => void;
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function eventTitle(event: ExtendedDecisionEvent): string {
  switch (event.eventType) {
    case "CELL_UNDONE":
      return "Geri Alma";
    case "ERROR_MARKED":
      return "Hata İşaretleme";
    case "ERROR_UNMARKED":
      return "Hata İşareti Kaldırma";
    case "ROW_APPROVED":
      return "Satır Onayı";
    case "CELL_APPROVED":
      return "Hücre Onayı";
    case "CELL_OVERRIDDEN":
      return "Değer Değiştirme";
    default:
      return "Hücre Kararı";
  }
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case "CELL_APPROVED":
      return "#16a34a"; // yeşil
    case "CELL_OVERRIDDEN":
      return "#2563eb"; // mavi
    case "CELL_UNDONE":
      return "#64748b"; // gri
    case "ERROR_MARKED":
      return "#dc2626"; // kırmızı
    default:
      return "#94a3b8";
  }
}

export function UndoHistoryPanel({
  events,
  disabled = false,
  processingUndo = false,
  pendingUndoEventId = null,
  onUndo,
}: UndoHistoryPanelProps) {
  return (
    <section
      aria-label="Son İşlemler ve Geri Alma"
      aria-busy={processingUndo}
      style={panelStyle}
    >
      <div style={panelHeaderStyle}>
        <strong style={panelTitleStyle}>Son 5 İşlem (Undo)</strong>
        <span style={panelSubTitleStyle}>5 dk pencere</span>
      </div>

      {events.length === 0 ? (
        <div style={emptyStateStyle}>
          Geri alınabilir işlem bulunamadı.
        </div>
      ) : (
        <div style={eventsGridStyle}>
          {events.map((event, index) => {
            const isPending =
              processingUndo && (pendingUndoEventId ? pendingUndoEventId === event.id : true);
            return (
              <div
                key={event.id}
                style={getEventRowStyle(index === events.length - 1)}
              >
                <div style={rowHeaderStyle}>
                  <div style={rowHeaderLeftStyle}>
                    <span style={getEventTitleStyle(event.eventType)}>{eventTitle(event)}</span>
                  </div>
                  <span style={panelSubTitleStyle}>
                    Zaman: {formatEventTime(event.createdAt)}
                  </span>
                </div>

                <div style={eventMetaRowStyle}>
                  <span>Kim: {event.operatorName || "Sistem"}</span>
                  <span>Satır: {event.rowId || "—"}</span>
                  <span>Alan: {event.fieldType ? event.fieldType.toUpperCase() : "—"}</span>
                </div>

                <div style={eventMetaRowStyle}>
                  {event.decisionReason ? (
                    <span>
                      Neden: {BLOCKER_REASON_CODES[event.decisionReason] ?? event.decisionReason}
                    </span>
                  ) : null}
                </div>

                <div style={valueChangeRowStyle}>
                  <span style={oldValueLabelStyle}>Eski:</span>
                  <span style={oldValueTextStyle}>{event.previousValue ?? "—"}</span>
                  <span style={arrowStyle}>→</span>
                  <span style={oldValueLabelStyle}>Yeni:</span>
                  <span style={getEventNewValueStyle(event.eventType)}>
                    {event.newValue ?? "—"}
                  </span>
                </div>

                {(event.confidenceBefore !== undefined || event.confidenceAfter !== undefined) && (
                  <div style={confidenceStyle}>
                    Güven: {event.confidenceBefore ?? "—"}% → {event.confidenceAfter ?? "—"}%
                  </div>
                )}

                <div style={actionRowStyle}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onUndo(event.id)}
                    disabled={disabled || isPending}
                    title="Bu işlemi geri al"
                  >
                    {isPending ? "Geri Alınıyor..." : "Geri Al"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
