import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { AlertCircle, Plus, RotateCw } from "lucide-react";
import type { MeasureRow } from "../Orders/OrderEditor/shared";
import { orderOptimizationStyles } from "../UI/orderOptimizationStyles";
import { countInvalidBoyItems, isRotated, normalizeMaskedNumberOnBlur, parseMaskedNumber, sanitizeIntegerInput, sanitizeMaskedNumberInput, toggleRotation } from "../Orders/OrderEditor/workbenchUtils";

type FocusableColumn = "partName" | "boy" | "en" | "adet" | "pvc" | "rotation";

type NoticeTone = "default" | "danger" | "accent";

interface GridNotice {
  text: string;
  tone: NoticeTone;
}

interface OrderOptimizationGridProps {
  items: MeasureRow[];
  plateBoy: string;
  notice?: GridNotice | null;
  firstCellRef?: MutableRefObject<HTMLInputElement | null>;
  onItemChange: (id: number, field: keyof MeasureRow, value: string | number | boolean) => void;
  onAddItem: () => void;
}

interface OrderOptimizationGridRowProps {
  row: MeasureRow;
  rowIndex: number;
  topOffset: number;
  plateBoyValue: number;
  registerCell: (rowId: number, column: FocusableColumn, node: HTMLElement | null) => void;
  moveToSameColumnBelow: (rowIndex: number, column: FocusableColumn) => void;
  firstCellRef?: MutableRefObject<HTMLInputElement | null>;
  onItemChange: (id: number, field: keyof MeasureRow, value: string | number | boolean) => void;
}

const GRID_TEMPLATE = "40px minmax(200px,1fr) 120px 120px 80px 92px 64px 72px";
const GRID_ROW_HEIGHT = 52;
const GRID_OVERSCAN = 8;

function preventInvalidNumericKey(event: KeyboardEvent<HTMLInputElement>, allowDecimal: boolean) {
  if (event.key === "Enter" || event.key === "Tab") {
    return;
  }

  if (event.key.length !== 1) {
    return;
  }

  const isDigit = /\d/.test(event.key);
  const isDecimalSeparator = allowDecimal && (event.key === "." || event.key === ",");
  if (!isDigit && !isDecimalSeparator) {
    event.preventDefault();
  }
}

function buildPreviewRect(row: MeasureRow) {
  const boy = parseMaskedNumber(row.boy);
  const en = parseMaskedNumber(row.en);
  if (!Number.isFinite(boy) || !Number.isFinite(en) || boy <= 0 || en <= 0) {
    return null;
  }

  const maxSide = Math.max(boy, en);
  const width = Math.max(12, (boy / maxSide) * 38);
  const height = Math.max(12, (en / maxSide) * 38);
  const rotated = isRotated(row.grain);

  return {
    x: 25 - width / 2,
    y: 25 - height / 2,
    width,
    height,
    rotated,
  };
}

const OrderOptimizationGridRow = memo(function OrderOptimizationGridRow({
  row,
  rowIndex,
  topOffset,
  plateBoyValue,
  registerCell,
  moveToSameColumnBelow,
  firstCellRef,
  onItemChange,
}: OrderOptimizationGridRowProps) {
  const invalidBoy = Number.isFinite(plateBoyValue) && parseMaskedNumber(row.boy) > plateBoyValue;
  const previewRect = buildPreviewRect(row);

  const handleEnterDown = (event: KeyboardEvent<HTMLElement>, column: FocusableColumn) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    moveToSameColumnBelow(rowIndex, column);
  };

  return (
    <div
      className={`${orderOptimizationStyles.gridRow} absolute left-0 right-0 top-0`}
      style={{ gridTemplateColumns: GRID_TEMPLATE, height: GRID_ROW_HEIGHT, transform: `translateY(${topOffset}px)` }}
    >
      <div className={orderOptimizationStyles.indexCell}>
        <span className="font-mono">{row.id}</span>
      </div>

      <div className={orderOptimizationStyles.cell}>
        <input
          ref={(node) => {
            registerCell(row.id, "partName", node);
            if (firstCellRef && rowIndex === 0) {
              firstCellRef.current = node;
            }
          }}
          value={row.info}
          onChange={(event) => onItemChange(row.id, "info", event.target.value)}
          onKeyDown={(event) => handleEnterDown(event, "partName")}
          className={orderOptimizationStyles.partInput}
          aria-label={`Parça adı ${row.id}`}
        />
      </div>

      <div className={orderOptimizationStyles.cell}>
        <div className="relative w-full">
          <input
            ref={(node) => registerCell(row.id, "boy", node)}
            value={row.boy}
            onChange={(event) => onItemChange(row.id, "boy", sanitizeMaskedNumberInput(event.target.value))}
            onBlur={(event) => onItemChange(row.id, "boy", normalizeMaskedNumberOnBlur(event.target.value))}
            onKeyDown={(event) => {
              preventInvalidNumericKey(event, true);
              handleEnterDown(event, "boy");
            }}
            className={`${orderOptimizationStyles.monoInput} font-mono ${invalidBoy ? "border-2 border-[var(--op-danger)] pr-6" : ""}`}
            inputMode="decimal"
            aria-label={`Boy ${row.id}`}
          />
          {invalidBoy ? (
            <AlertCircle className="pointer-events-none absolute right-1 top-1 h-3 w-3 text-[var(--op-danger)]" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      <div className={orderOptimizationStyles.cell}>
        <input
          ref={(node) => registerCell(row.id, "en", node)}
          value={row.en}
          onChange={(event) => onItemChange(row.id, "en", sanitizeMaskedNumberInput(event.target.value))}
          onBlur={(event) => onItemChange(row.id, "en", normalizeMaskedNumberOnBlur(event.target.value))}
          onKeyDown={(event) => {
            preventInvalidNumericKey(event, true);
            handleEnterDown(event, "en");
          }}
          className={`${orderOptimizationStyles.monoInput} font-mono`}
          inputMode="decimal"
          aria-label={`En ${row.id}`}
        />
      </div>

      <div className={orderOptimizationStyles.cell}>
        <input
          ref={(node) => registerCell(row.id, "adet", node)}
          value={row.adet}
          onChange={(event) => onItemChange(row.id, "adet", sanitizeIntegerInput(event.target.value))}
          onBlur={(event) => onItemChange(row.id, "adet", sanitizeIntegerInput(event.target.value) || "1")}
          onKeyDown={(event) => {
            preventInvalidNumericKey(event, false);
            handleEnterDown(event, "adet");
          }}
          className={`${orderOptimizationStyles.quantityInput} font-mono`}
          inputMode="numeric"
          aria-label={`Adet ${row.id}`}
        />
      </div>

      <div className={`${orderOptimizationStyles.cell} justify-center`}>
        <div
          ref={(node) => registerCell(row.id, "pvc", node)}
          tabIndex={0}
          onKeyDown={(event) => handleEnterDown(event, "pvc")}
          className="grid h-8 w-[64px] grid-cols-2 grid-rows-2 gap-[2px] outline-none"
          aria-label={`PVC ${row.id}`}
        >
          {[
            { key: "u1", label: "Ü" },
            { key: "u2", label: "A" },
            { key: "k2", label: "S" },
            { key: "k1", label: "Y" },
          ].map((edge) => {
            const active = Boolean(row[edge.key as keyof MeasureRow]);
            return (
              <button
                key={edge.key}
                type="button"
                tabIndex={-1}
                onClick={() => onItemChange(row.id, edge.key as keyof MeasureRow, !active)}
                className={`${orderOptimizationStyles.pvcButton} ${active ? orderOptimizationStyles.pvcActive : ""}`}
                aria-label={`${edge.label} kenarı ${row.id}`}
              >
                {edge.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${orderOptimizationStyles.cell} justify-center`}>
        <button
          ref={(node) => registerCell(row.id, "rotation", node)}
          type="button"
          onClick={() => onItemChange(row.id, "grain", toggleRotation(row.grain))}
          onKeyDown={(event) => handleEnterDown(event, "rotation")}
          className={orderOptimizationStyles.rotationButton}
          aria-label={`Rotasyon ${row.id}`}
        >
          <RotateCw className={`h-4 w-4 ${isRotated(row.grain) ? "rotate-90" : ""}`} />
        </button>
      </div>

      <div className={`${orderOptimizationStyles.cell} justify-center`}>
        <div className={orderOptimizationStyles.previewWrap}>
          <svg viewBox="0 0 50 50" className={orderOptimizationStyles.previewSvg} aria-hidden="true">
            {previewRect ? (
              <rect
                x={previewRect.x}
                y={previewRect.y}
                width={previewRect.width}
                height={previewRect.height}
                className={orderOptimizationStyles.previewRect}
                transform={previewRect.rotated ? "rotate(90 25 25)" : undefined}
              />
            ) : (
              <rect x="8" y="8" width="34" height="34" className={orderOptimizationStyles.previewRect} />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
});

export function OrderOptimizationGrid({ items, plateBoy, notice, firstCellRef, onItemChange, onAddItem }: OrderOptimizationGridProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<Record<string, HTMLElement | null>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);
  const plateBoyValue = parseMaskedNumber(plateBoy);
  const invalidBoyCount = countInvalidBoyItems(items, plateBoyValue);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    const syncViewportHeight = () => {
      setViewportHeight(node.clientHeight || 520);
    };

    syncViewportHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(syncViewportHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const registerCell = useCallback((rowId: number, column: FocusableColumn, node: HTMLElement | null) => {
    cellRefs.current[`${rowId}:${column}`] = node;
  }, []);

  const focusCell = useCallback(
    (rowIndex: number, column: FocusableColumn) => {
      const targetRow = items[rowIndex];
      const viewport = viewportRef.current;
      if (!targetRow || !viewport) {
        return;
      }

      const rowTop = rowIndex * GRID_ROW_HEIGHT;
      const rowBottom = rowTop + GRID_ROW_HEIGHT;
      if (rowTop < viewport.scrollTop) {
        viewport.scrollTop = rowTop;
      } else if (rowBottom > viewport.scrollTop + viewport.clientHeight) {
        viewport.scrollTop = rowBottom - viewport.clientHeight;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cellRefs.current[`${targetRow.id}:${column}`]?.focus();
        });
      });
    },
    [items],
  );

  const moveToSameColumnBelow = useCallback(
    (rowIndex: number, column: FocusableColumn) => {
      focusCell(rowIndex + 1, column);
    },
    [focusCell],
  );

  const totalHeight = items.length * GRID_ROW_HEIGHT;
  const visibleCount = Math.ceil(viewportHeight / GRID_ROW_HEIGHT) + GRID_OVERSCAN * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / GRID_ROW_HEIGHT) - GRID_OVERSCAN);
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const visibleRows = items.slice(startIndex, endIndex);

  const toneClass =
    notice?.tone === "danger"
      ? orderOptimizationStyles.noticeDanger
      : notice?.tone === "accent"
        ? orderOptimizationStyles.noticeAccent
        : "";

  return (
    <div className={orderOptimizationStyles.gridShell}>
      <div className={orderOptimizationStyles.gridNotice}>
        <div className={`flex items-center gap-3 ${toneClass}`}>
          <span>Satır {items.length}</span>
          <span>Boy Uyarısı {invalidBoyCount}</span>
          <span>{notice?.text || "Grid Hazır"}</span>
        </div>
        <button type="button" className={orderOptimizationStyles.commandButton} onClick={onAddItem}>
          <Plus className="mr-1 h-3 w-3" />
          Satır
        </button>
      </div>

      <div className={orderOptimizationStyles.gridFrame}>
        <div className="min-w-[788px]">
          <div className={orderOptimizationStyles.gridHeaderRow} style={{ gridTemplateColumns: GRID_TEMPLATE }}>
            <div className={`${orderOptimizationStyles.gridHeaderCell} justify-center`}>#</div>
            <div className={orderOptimizationStyles.gridHeaderCell}>Parça Adı</div>
            <div className={`${orderOptimizationStyles.gridHeaderCell} justify-end`}>Boy</div>
            <div className={`${orderOptimizationStyles.gridHeaderCell} justify-end`}>En</div>
            <div className={`${orderOptimizationStyles.gridHeaderCell} justify-center`}>Adet</div>
            <div className={`${orderOptimizationStyles.gridHeaderCell} justify-center`}>PVC</div>
            <div className={`${orderOptimizationStyles.gridHeaderCell} justify-center`}>Suyu-Yolu</div>
            <div className={`${orderOptimizationStyles.gridHeaderCell} justify-center border-r-0`}>Önizleme</div>
          </div>

          <div ref={viewportRef} className={orderOptimizationStyles.gridViewport} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
            <div className="relative" style={{ height: totalHeight }}>
              {visibleRows.map((row, index) => (
                <OrderOptimizationGridRow
                  key={row.id}
                  row={row}
                  rowIndex={startIndex + index}
                  topOffset={(startIndex + index) * GRID_ROW_HEIGHT}
                  plateBoyValue={plateBoyValue}
                  registerCell={registerCell}
                  moveToSameColumnBelow={moveToSameColumnBelow}
                  firstCellRef={firstCellRef}
                  onItemChange={onItemChange}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
