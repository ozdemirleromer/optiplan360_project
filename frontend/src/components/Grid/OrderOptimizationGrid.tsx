import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type MutableRefObject } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import type { MeasureRow } from "../Orders/OrderEditor/shared";
import { orderOptimizationStyles } from "../UI/orderOptimizationStyles";
import { DEFAULT_MATERIAL, MATERIAL_SPECIFICATIONS } from "../UI/orderOptimizationConstants";
import { countInvalidBoyItems, normalizeMaskedNumberOnBlur, parseMaskedNumber, sanitizeIntegerInput, sanitizeMaskedNumberInput } from "../Orders/OrderEditor/workbenchUtils";
import { notificationHelpers } from "../../stores/notificationStore";

type FocusableColumn = "partName" | "boy" | "en" | "adet" | "material" | "u1" | "u2" | "k1" | "k2" | "rotation" | "delik1" | "delik2" | "status";

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
  onRemoveItem: (id: number) => void;
  onDuplicateItem: (id: number) => void;
}

interface OrderOptimizationGridRowProps {
  row: MeasureRow;
  rowIndex: number;
  topOffset: number;
  plateBoyValue: number;
  canDelete: boolean;
  registerCell: (rowId: number, column: FocusableColumn, node: HTMLElement | null) => void;
  moveFocus: (rowIndex: number, column: FocusableColumn, direction: "down" | "next" | "prev") => void;
  onContextMenuOpen: (event: MouseEvent<HTMLElement>, row: MeasureRow) => void;
  firstCellRef?: MutableRefObject<HTMLInputElement | null>;
  onItemChange: (id: number, field: keyof MeasureRow, value: string | number | boolean) => void;
  onRemoveItem: (id: number) => void;
}

// v4.0 Grid layout: Sıra No | Malzeme | BOY | EN | ADET | GRAİN | BİLGİ | U1 | U2 | K1 | K2 | DELİK-1 | DELİK-2 | Delete
const GRID_TEMPLATE = "40px minmax(80px,0.6fr) 60px 60px 60px 70px minmax(160px,1.5fr) 50px 50px 50px 50px 80px 80px 40px";
const COLUMN_LABELS = ["#", "Malzeme", "BOY", "EN", "ADET", "GRAİN", "BİLGİ", "U1", "U2", "K1", "K2", "DELİK-1", "DELİK-2", ""];
const COLUMN_ORDER: FocusableColumn[] = ["material", "boy", "en", "adet", "rotation", "partName", "u1", "u2", "k1", "k2", "delik1", "delik2"];
const GRID_ROW_HEIGHT = 27;
const GRID_OVERSCAN = 8;
const GRAIN_OPTIONS = [
  { value: "0", label: "→" },
  { value: "1", label: "←" },
  { value: "2", label: "↑↓" },
  { value: "3", label: "⟲" },
] as const;

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

const OrderOptimizationGridRow = memo(function OrderOptimizationGridRow({
  row,
  rowIndex,
  topOffset,
  plateBoyValue,
  canDelete,
  registerCell,
  moveFocus,
  onContextMenuOpen,
  firstCellRef,
  onItemChange,
  onRemoveItem,
}: OrderOptimizationGridRowProps) {
  const invalidBoy = Number.isFinite(plateBoyValue) && parseMaskedNumber(row.boy) > plateBoyValue;

  const handleGridNavigation = (event: KeyboardEvent<HTMLElement>, column: FocusableColumn) => {
    if (event.key === "Enter") {
      event.preventDefault();
      moveFocus(rowIndex, column, "down");
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      moveFocus(rowIndex, column, event.shiftKey ? "prev" : "next");
    }
  };

  return (
    <div
      className={`${orderOptimizationStyles.gridRow} absolute left-0 right-0 top-0`}
      style={{ gridTemplateColumns: GRID_TEMPLATE, height: GRID_ROW_HEIGHT, transform: `translateY(${topOffset}px)` }}
      onContextMenu={(event) => onContextMenuOpen(event, row)}
    >
      <div className={orderOptimizationStyles.indexCell}>
        <span className="font-mono">{row.id}</span>
      </div>

      <div className={orderOptimizationStyles.cell}>
        <select
          ref={(node) => {
            registerCell(row.id, "material", node as HTMLElement | null);
            if (firstCellRef && rowIndex === 0) {
              (firstCellRef as MutableRefObject<HTMLSelectElement | null>).current = node;
            }
          }}
          value={row.material || DEFAULT_MATERIAL}
          onChange={(event) => onItemChange(row.id, "material", event.target.value)}
          onKeyDown={(event) => handleGridNavigation(event, "material")}
          className="h-full w-full border-0 bg-transparent px-2 text-[13px] text-[var(--op-text)] outline-none focus:bg-[rgba(0,188,212,0.05)] cursor-pointer"
          aria-label={`Malzeme ${row.id}`}
        >
          {MATERIAL_SPECIFICATIONS.map((spec, idx) => (
            <option key={`${spec.thickness}-${spec.dimensions}-${idx}`} value={`${spec.thickness} ${spec.dimensions}`}>
              {spec.thickness} {spec.dimensions}
            </option>
          ))}
        </select>
      </div>

      <div className={orderOptimizationStyles.cell}>
        <div className="relative w-full h-full">
          <input
            ref={(node) => registerCell(row.id, "boy", node)}
            value={row.boy}
            onChange={(event) => onItemChange(row.id, "boy", sanitizeMaskedNumberInput(event.target.value))}
            onBlur={(event) => onItemChange(row.id, "boy", normalizeMaskedNumberOnBlur(event.target.value))}
            onKeyDown={(event) => {
              preventInvalidNumericKey(event, true);
              handleGridNavigation(event, "boy");
            }}
            className={`${orderOptimizationStyles.monoInput} font-mono ${invalidBoy ? "!bg-[var(--op-danger)] text-white" : ""}`}
            inputMode="decimal"
            aria-label={`Boy ${row.id}`}
          />
          {invalidBoy ? (
            <AlertCircle className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white" aria-hidden="true" />
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
            handleGridNavigation(event, "en");
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
            handleGridNavigation(event, "adet");
          }}
          className={`${orderOptimizationStyles.quantityInput} font-mono`}
          inputMode="numeric"
          aria-label={`Adet ${row.id}`}
        />
      </div>

      <div className={`${orderOptimizationStyles.cell} justify-center`}>
        <select
          ref={(node) => registerCell(row.id, "rotation", node as HTMLElement | null)}
          value={row.grain || "0"}
          onChange={(event) => onItemChange(row.id, "grain", event.target.value)}
          onKeyDown={(event) => handleGridNavigation(event, "rotation")}
          className="h-full w-full border-0 bg-transparent px-2 text-center text-[13px] text-[var(--op-text)] outline-none focus:bg-[rgba(0,188,212,0.05)]"
          aria-label={`Grain ${row.id}`}
        >
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>

      <div className={orderOptimizationStyles.cell}>
        <input
          ref={(node) => registerCell(row.id, "partName", node)}
          value={row.info}
          onChange={(event) => onItemChange(row.id, "info", event.target.value)}
          onKeyDown={(event) => handleGridNavigation(event, "partName")}
          className={orderOptimizationStyles.partInput}
          aria-label={`BİLGİ ${row.id}`}
        />
      </div>

      {[
        { key: "u1", label: "U1" },
        { key: "u2", label: "U2" },
        { key: "k1", label: "K1" },
        { key: "k2", label: "K2" },
      ].map((edge) => {
        const active = Boolean(row[edge.key as keyof MeasureRow]);
        return (
          <div className={`${orderOptimizationStyles.cell} justify-center items-center`} key={edge.key}>
            <div className="relative">
              <input
                ref={(node) => registerCell(row.id, edge.key as FocusableColumn, node)}
                type="checkbox"
                checked={active}
                onChange={() => onItemChange(row.id, edge.key as keyof MeasureRow, !active)}
                onKeyDown={(event) => handleGridNavigation(event, edge.key as FocusableColumn)}
                className="peer h-4 w-4 cursor-pointer appearance-none rounded-sm border-[2px] border-[#555] bg-transparent checked:border-[#00bcd4] checked:bg-[#00bcd4] focus:outline-none focus:ring-1 focus:ring-[#00bcd4] focus:ring-offset-0"
                aria-label={`${edge.label} kenarı ${row.id}`}
              />
              <svg
                className="pointer-events-none absolute left-0 top-0 h-4 w-4 hidden peer-checked:block text-[#1a1a1a]"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
        );
      })}

      <div className={orderOptimizationStyles.cell}>
        <input
          ref={(node) => registerCell(row.id, "delik1", node)}
          value={row.delik1 || ""}
          onChange={(event) => onItemChange(row.id, "delik1", event.target.value)}
          onKeyDown={(event) => handleGridNavigation(event, "delik1")}
          className={orderOptimizationStyles.partInput}
          aria-label={`Delik 1 ${row.id}`}
        />
      </div>

      <div className={orderOptimizationStyles.cell}>
        <input
          ref={(node) => registerCell(row.id, "delik2", node)}
          value={row.delik2 || ""}
          onChange={(event) => onItemChange(row.id, "delik2", event.target.value)}
          onKeyDown={(event) => handleGridNavigation(event, "delik2")}
          className={orderOptimizationStyles.partInput}
          aria-label={`Delik 2 ${row.id}`}
        />
      </div>

      <div className={`${orderOptimizationStyles.cell} justify-center`}>
        {canDelete ? (
          <button
            type="button"
            onClick={() => onRemoveItem(row.id)}
            className="flex h-6 w-6 items-center justify-center rounded-none bg-transparent text-[var(--op-danger)] outline-none hover:bg-[rgba(185,28,28,0.1)]"
            aria-label={`Satir sil ${row.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
});

export function OrderOptimizationGrid({ items, plateBoy, notice, firstCellRef, onItemChange, onAddItem, onRemoveItem, onDuplicateItem }: OrderOptimizationGridProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<Record<string, HTMLElement | null>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: MeasureRow } | null>(null);
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

  const moveFocus = useCallback(
    (rowIndex: number, column: FocusableColumn, direction: "down" | "next" | "prev") => {
      if (direction === "down") {
        focusCell(rowIndex + 1, column);
        return;
      }

      const columnIndex = COLUMN_ORDER.indexOf(column);
      if (columnIndex === -1) {
        return;
      }

      if (direction === "next") {
        const nextColumnIndex = columnIndex + 1;
        if (nextColumnIndex < COLUMN_ORDER.length) {
          focusCell(rowIndex, COLUMN_ORDER[nextColumnIndex]);
          return;
        }
        focusCell(rowIndex + 1, COLUMN_ORDER[0]);
        return;
      }

      const prevColumnIndex = columnIndex - 1;
      if (prevColumnIndex >= 0) {
        focusCell(rowIndex, COLUMN_ORDER[prevColumnIndex]);
        return;
      }
      focusCell(Math.max(0, rowIndex - 1), COLUMN_ORDER[COLUMN_ORDER.length - 1]);
    },
    [focusCell],
  );

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const onContextMenuOpen = useCallback((event: MouseEvent<HTMLElement>, row: MeasureRow) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, row });
  }, []);

  const copyRow = useCallback(async () => {
    if (!contextMenu) return;
    await navigator.clipboard.writeText(JSON.stringify(contextMenu.row));
    notificationHelpers.success("Satır panoya kopyalandı");
    setContextMenu(null);
  }, [contextMenu]);

  const pasteRow = useCallback(async () => {
    if (!contextMenu) return;
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text) as Partial<MeasureRow>;
    const targetId = contextMenu.row.id;
    const allowedKeys: Array<keyof MeasureRow> = ["boy", "en", "adet", "grain", "u1", "u2", "k1", "k2", "delik1", "delik2", "info", "thickness", "material", "status"];
    allowedKeys.forEach((key) => {
      if (parsed[key] !== undefined) {
        onItemChange(targetId, key, parsed[key] as string | number | boolean);
      }
    });
    notificationHelpers.success("Satır panodan yapıştırıldı");
    setContextMenu(null);
  }, [contextMenu, onItemChange]);

  const duplicateRow = useCallback(() => {
    if (!contextMenu) return;
    onDuplicateItem(contextMenu.row.id);
    notificationHelpers.success("Satır çoğaltıldı");
    setContextMenu(null);
  }, [contextMenu, onDuplicateItem]);

  const findEquivalent = useCallback(() => {
    if (!contextMenu) return;
    notificationHelpers.info(`Muadil arama kuyruğa alındı (Satır ${contextMenu.row.id})`);
    setContextMenu(null);
  }, [contextMenu]);

  const totalHeight = items.length * GRID_ROW_HEIGHT;
  const visibleCount = Math.ceil(viewportHeight / GRID_ROW_HEIGHT) + GRID_OVERSCAN * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / GRID_ROW_HEIGHT) - GRID_OVERSCAN);
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const visibleRows = items.slice(startIndex, endIndex);

  return (
    <div className={orderOptimizationStyles.gridShell}>
      <div className={orderOptimizationStyles.gridFrame}>
        <div className="min-w-[1070px]">
          <div className={orderOptimizationStyles.gridHeaderRow} style={{ gridTemplateColumns: GRID_TEMPLATE }}>
            {COLUMN_LABELS.map((label, index) => (
              <div key={`${label}-${index}`} className={`${orderOptimizationStyles.gridHeaderCell} ${index === COLUMN_LABELS.length - 1 ? "justify-center" : ""}`}>
                {label}
              </div>
            ))}
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
                  canDelete={items.length > 1}
                  registerCell={registerCell}
                  moveFocus={moveFocus}
                  onContextMenuOpen={onContextMenuOpen}
                  firstCellRef={firstCellRef}
                  onItemChange={onItemChange}
                  onRemoveItem={onRemoveItem}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {contextMenu ? (
        <div
          className="fixed z-[9999] min-w-[180px] rounded-none border border-[var(--op-border)] bg-[var(--op-surface-bg)] p-1 text-[12px] shadow-none"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button type="button" className="block h-7 w-full rounded-none px-2 text-left hover:bg-[var(--op-main-bg)]" onClick={() => void copyRow()}>
            Kopyala
          </button>
          <button type="button" className="block h-7 w-full rounded-none px-2 text-left hover:bg-[var(--op-main-bg)]" onClick={() => void pasteRow()}>
            Yapıştır
          </button>
          <button type="button" className="block h-7 w-full rounded-none px-2 text-left hover:bg-[var(--op-main-bg)]" onClick={duplicateRow}>
            Satırı Çoğalt
          </button>
          <button type="button" className="block h-7 w-full rounded-none px-2 text-left hover:bg-[var(--op-main-bg)]" onClick={findEquivalent}>
            Muadil Ara
          </button>
        </div>
      ) : null}
    </div>
  );
}
