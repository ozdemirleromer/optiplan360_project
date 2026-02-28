/**
 * OPTIPLAN360 - REFACTORED DATA TABLE
 * 
 * Advanced table component with:
 * - Sorting (with visual indicators)
 * - Pagination
 * - Filtering
 * - Empty states
 * - Loading skeleton
 * - Responsive design
 * - Accessibility (ARIA)
 */

import React, { useState, useMemo } from "react";
import { Search, FileText, ChevronUp, ChevronDown, X } from "lucide-react";
import { COLORS, RADIUS, TYPOGRAPHY, TRANSITIONS } from "./constants";
import { Button } from "./Button";
import { Badge } from "./Badge";

// ============================================
// TYPES & INTERFACES
// ============================================

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (value: T[keyof T] | undefined, row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  hidden?: boolean;
}

export interface TableAction<T> {
  label: string;
  onClick: (row: T) => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: React.ReactNode;
  condition?: (row: T) => boolean;
}

export interface DataTableProps<T extends { id: string | number }> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  actions?: TableAction<T>[];
  sortKey?: keyof T | string;
  sortDir?: "asc" | "desc";
  onSort?: (key: keyof T | string) => void;
  paginated?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  filterable?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  rowClass?: (row: T, index: number) => string;
  striped?: boolean;
  compact?: boolean;
  hoverable?: boolean;
  selectable?: boolean;
  selectedRows?: Set<string | number>;
  onSelectRows?: (rows: Set<string | number>) => void;
}

// ============================================
// SKELETON LOADER COMPONENT
// ============================================

const TableSkeleton: React.FC<{ columns: number; rows: number }> = ({ columns, rows }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <tr key={rowIdx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        {Array.from({ length: columns }).map((_, colIdx) => (
          <td key={colIdx} style={{ padding: "12px", height: 40 }}>
            <div
              style={{
                height: "100%",
                background: `linear-gradient(90deg, ${COLORS.border} 25%, rgba(255,255,255,.08) 50%, ${COLORS.border} 75%)`,
                backgroundSize: "200% 100%",
                animation: "loading 1.5s infinite",
                borderRadius: RADIUS.md,
              }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// ============================================
// EMPTY STATE COMPONENT
// ============================================

interface EmptyStateProps {
  icon?: string;
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = "Veri Bulunamadı",
  message = "Seçili filtrelere uygun veri yok",
  action,
}) => (
  <tr>
    <td colSpan={99} style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{ color: COLORS.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <FileText size={48} strokeWidth={1.5} />
        {icon ? <div style={{ fontSize: 18 }}>{icon}</div> : null}
        <div>
          <h3 style={{ margin: 0, color: COLORS.text, fontSize: 16 }}>{title}</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13 }}>{message}</p>
        </div>
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
      </div>
    </td>
  </tr>
);

// ============================================
// MAIN DATA TABLE COMPONENT
// ============================================

const DataTableInner = <T extends { id: string | number }>(
  {
      columns,
      data,
      loading = false,
      onRowClick,
      actions = [],
      sortKey,
      sortDir = "asc",
      onSort,
      paginated = true,
      pageSize = 20,
      searchable = false,
      searchKeys = [],
      filterable = true,
      emptyMessage = "Veri bulunamadı",
      emptyIcon,
      rowClass,
      striped = true,
      compact = false,
      hoverable = true,
      selectable = false,
      selectedRows = new Set<string | number>(),
      onSelectRows,
    }: DataTableProps<T>,
    ref: React.ForwardedRef<HTMLTableElement>
  ) => {
    void filterable;
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    // Filter and search logic
    const filteredData = useMemo(() => {
      let result = [...data];

      // Apply search
      if (search && searchKeys.length > 0) {
        const searchLower = search.toLowerCase();
        result = result.filter((row) =>
          searchKeys.some((key) =>
            String(row[key]).toLowerCase().includes(searchLower)
          )
        );
      }

      // Apply sorting
      if (sortKey && onSort) {
        result.sort((a, b) => {
          const aVal = a[sortKey as keyof typeof a];
          const bVal = b[sortKey as keyof typeof b];

          if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
          if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
          return 0;
        });
      }

      return result;
    }, [data, search, searchKeys, sortKey, sortDir, onSort]);

    // Pagination logic
    const pageData = useMemo(() => {
      if (!paginated) return filteredData;
      const start = (page - 1) * pageSize;
      return filteredData.slice(start, start + pageSize);
    }, [filteredData, page, pageSize, paginated]);

    const totalPages = Math.ceil(filteredData.length / pageSize);

    const visibleColumns = columns.filter((col) => !col.hidden);
    const actionCount = actions.length > 0 ? 1 : 0;

    const handleSelectAll = () => {
      if (selectedRows.size === pageData.length) {
        onSelectRows?.(new Set());
      } else {
        const ids = new Set(pageData.map((row) => row.id));
        onSelectRows?.(ids);
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Search bar */}
        {searchable && searchKeys.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              border: "1px solid rgba(var(--primary-rgb), 0.28)",
              borderRadius: RADIUS.md,
              background: "linear-gradient(140deg, rgba(var(--primary-rgb),0.12), rgba(124,58,237,0.1))",
              boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Search size={16} color={COLORS.muted} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Arama yapın..."
              aria-label="Tablo ara"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: COLORS.text,
                outline: "none",
                fontSize: 13,
              }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.muted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label="Aramayı temizle"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Table container */}
        <div style={{ overflowX: "auto" }}>
          <table
            ref={ref}
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: compact ? 12 : 14,
            }}
            role="table"
            aria-label="Veri tablosu"
          >
            <thead>
              <tr
                style={{
                  borderBottom: `2px solid ${COLORS.border}`,
                  position: "sticky",
                  top: 0,
                  background: COLORS.panel,
                  zIndex: 10,
                }}
              >
                {selectable && (
                  <th
                    style={{
                      padding: "12px",
                      width: 40,
                      textAlign: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRows.size === pageData.length && pageData.length > 0}
                      onChange={handleSelectAll}
                      aria-label="Tümünü seç"
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                )}

                {visibleColumns.map((col) => (
                  <th
                    key={String(col.key)}
                    onClick={() => col.sortable && onSort?.(col.key)}
                    style={{
                      padding: compact ? "8px 10px" : "12px",
                      textAlign: col.align || "left",
                      width: col.width,
                      fontWeight: TYPOGRAPHY.fontWeight.semibold,
                      color: COLORS.gray[400],
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      cursor: col.sortable ? "pointer" : "default",
                      userSelect: "none",
                      transition: `background ${TRANSITIONS.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      if (col.sortable) {
                        e.currentTarget.style.background = "rgba(var(--primary-rgb), 0.12)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    role="columnheader"
                    aria-sort={
                      col.sortable && sortKey === col.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                ))}

                {actionCount > 0 && (
                  <th
                    style={{
                      padding: compact ? "8px 10px" : "12px",
                      textAlign: "center",
                      width: 100,
                      fontWeight: TYPOGRAPHY.fontWeight.semibold,
                      color: COLORS.gray[400],
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    İşlemler
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <TableSkeleton columns={visibleColumns.length + actionCount + (selectable ? 1 : 0)} rows={pageSize} />
              ) : pageData.length === 0 ? (
                <EmptyState
                  icon={emptyIcon}
                  message={emptyMessage}
                  action={
                    search && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                        }}
                      >
                        Aramayı Temizle
                      </Button>
                    )
                  }
                />
              ) : (
                pageData.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      background:
                        striped && idx % 2 === 0 ? "rgba(var(--primary-rgb), 0.045)" : "transparent",
                      cursor: onRowClick ? "pointer" : "default",
                      transition: `background 0.2s`,
                    }}
                    onMouseEnter={(e) => {
                      if (hoverable) {
                        e.currentTarget.style.background = "rgba(var(--primary-rgb), 0.16)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        striped && idx % 2 === 0 ? "rgba(var(--primary-rgb), 0.045)" : "transparent";
                    }}
                    role="row"
                    className={rowClass?.(row, idx)}
                  >
                    {selectable && (
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.id)}
                          onChange={() => {
                            const newSelection = new Set(selectedRows);
                            if (newSelection.has(row.id)) {
                              newSelection.delete(row.id);
                            } else {
                              newSelection.add(row.id);
                            }
                            onSelectRows?.(newSelection);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                    )}

                    {visibleColumns.map((col) => (
                      <td
                        key={String(col.key)}
                        style={{
                          padding: compact ? "8px 10px" : "12px",
                          textAlign: col.align || "left",
                          color: COLORS.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        role="cell"
                      >
                        {col.render
                          ? col.render(row[col.key as keyof typeof row], row, idx)
                          : (() => {
                              const val = row[col.key as keyof typeof row];
                              if (val === null || val === undefined) return "—";
                              if (typeof val === "object") return Array.isArray(val) ? String(val.length) : JSON.stringify(val);
                              return String(val);
                            })()}
                      </td>
                    ))}

                    {actionCount > 0 && (
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          {actions
                            .filter((action) => !action.condition || action.condition(row))
                            .map((action) => (
                              <Button
                                key={action.label}
                                variant={action.variant}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(row);
                                }}
                                icon={action.icon}
                              >
                                {action.label}
                              </Button>
                            ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {paginated && filteredData.length > pageSize && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              borderTop: `1px solid ${COLORS.border}`,
              fontSize: 12,
              color: COLORS.muted,
            }}
          >
            <span>
              {data.length} sonuç • Sayfa {page}/{totalPages}
            </span>

            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Önceki
              </Button>

              <span style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>
                {page}
              </span>

              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sonraki →
              </Button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  };

export const DataTable = React.forwardRef(DataTableInner) as <
  T extends { id: string | number }
>(
  props: DataTableProps<T> & { ref?: React.Ref<HTMLTableElement> }
) => React.ReactElement;

// ============================================
// EXAMPLE USAGE
// ============================================

export const DataTableExample = () => {
  const [selectedRows, setSelectedRows] = React.useState<Set<string | number>>(new Set());
  const [sortKey, setSortKey] = React.useState<string>("date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const mockOrders = [
    { id: "O-001", customer: "Ahmet Y.", material: "Laminat", thickness: 18, status: "IN_PRODUCTION", date: "2026-02-15" },
    { id: "O-002", customer: "Mehmet S.", material: "Laminat", thickness: 8, status: "READY", date: "2026-02-16" },
    { id: "O-003", customer: "Ayşe P.", material: "Masif", thickness: 25, status: "HOLD", date: "2026-02-16" },
  ];

  return (
    <DataTable
      columns={[
        {
          key: "id",
          label: "Sipariş No",
          sortable: true,
          width: "100px",
          render: (val) => <span style={{ color: COLORS.primary[500], fontFamily: "monospace" }}>{val}</span>,
        },
        {
          key: "customer",
          label: "Müşteri",
          sortable: true,
        },
        {
          key: "material",
          label: "Malzeme",
          sortable: false,
        },
        {
          key: "thickness",
          label: "Kalınlık",
          sortable: true,
          align: "center",
          render: (val) => `${val}mm`,
        },
        {
          key: "status",
          label: "Durum",
          sortable: true,
          render: (_val, row) => <Badge status={row.status} />,
        },
        {
          key: "date",
          label: "Tarih",
          sortable: true,
          render: (val) => new Date(val).toLocaleDateString("tr-TR"),
        },
      ]}
      data={mockOrders}
      actions={[
        {
          label: "Düzenle",
          onClick: (row) => console.log("Edit", row),
          variant: "secondary",
          icon: undefined,
        },
        {
          label: "Sil",
          onClick: (row) => console.log("Delete", row),
          variant: "danger",
          icon: undefined,
        },
      ]}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => {
        if (sortKey === key) {
          setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
          setSortKey(key as string);
          setSortDir("asc");
        }
      }}
      searchable
      searchKeys={["customer", "material", "id"]}
      paginated
      pageSize={10}
      selectable
      selectedRows={selectedRows}
      onSelectRows={setSelectedRows}
      emptyMessage="Sipariş bulunamadı"
      hoverable
      striped
    />
  );
};

export default DataTable;
