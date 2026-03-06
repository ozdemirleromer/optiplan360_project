import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import "./engineeringGrid.css";

export interface GridRow {
  id: number;
  name: string;
  length: number; // mm
  width: number; // mm
  height?: number; // mm
  quantity: number;
  material: string;
  preview?: string;
  edges?: string;
  hasError?: boolean;
  errorMessage?: string;
}

interface EngineeringGridProps {
  rows: GridRow[];
  onRowChange?: (rowId: number, data: Partial<GridRow>) => void;
  onRowSelect?: (rowId: number) => void;
  selectedRowId?: number;
  readOnly?: boolean;
}

export const EngineeringGrid: React.FC<EngineeringGridProps> = ({
  rows,
  onRowChange,
  onRowSelect,
  selectedRowId,
  readOnly,
}) => {
  const [editingCell, setEditingCell] = useState<{ rowId: number; field: string } | null>(null);

  const handleCellChange = (rowId: number, field: string, value: unknown) => {
    if (readOnly) return;
    onRowChange?.(rowId, { [field]: value });
  };

  const handleCellDoubleClick = (rowId: number, field: string) => {
    if (!readOnly) {
      setEditingCell({ rowId, field });
    }
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const renderPreview = (row: GridRow) => {
    if (!row.length || !row.width) return null;
    
    // Aspect ratio based on length/width
    const ratio = row.width / row.length;
    const containerWidth = 60;
    const containerHeight = 40;
    
    let rectWidth = containerWidth;
    let rectHeight = containerWidth * ratio;
    
    if (rectHeight > containerHeight) {
      rectHeight = containerHeight;
      rectWidth = containerHeight / ratio;
    }

    return (
      <svg
        width={containerWidth}
        height={containerHeight}
        className="grid-preview-svg"
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      >
        <rect
          x={(containerWidth - rectWidth) / 2}
          y={(containerHeight - rectHeight) / 2}
          width={rectWidth}
          height={rectHeight}
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
      </svg>
    );
  };

  const edges = ["T", "B", "L", "R"];

  return (
    <div className="engineering-grid-container">
      <div className="grid-wrapper">
        <table className="engineering-grid">
          <thead>
            <tr className="grid-header">
              <th className="grid-col-num">#</th>
              <th className="grid-col-name">ADI/ÜNVANI</th>
              <th className="grid-col-dim">BOY (mm)</th>
              <th className="grid-col-dim">EN (mm)</th>
              <th className="grid-col-qty">ADET</th>
              <th className="grid-col-material">MALZEME</th>
              <th className="grid-col-preview">ÖNİZLEME</th>
              <th className="grid-col-edges">KENAR B.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`grid-row ${selectedRowId === row.id ? "selected" : ""} ${row.hasError ? "error" : ""}`}
                onClick={() => onRowSelect?.(row.id)}
              >
                <td className="grid-col-num">{row.id}</td>
                <td
                  className="grid-col-name"
                  onDoubleClick={() => handleCellDoubleClick(row.id, "name")}
                >
                  {editingCell?.rowId === row.id && editingCell?.field === "name" ? (
                    <input
                      type="text"
                      autoFocus
                      value={row.name}
                      onChange={(e) => handleCellChange(row.id, "name", e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleCellBlur()}
                      className="grid-cell-input"
                    />
                  ) : (
                    row.name
                  )}
                </td>
                <td
                  className="grid-col-dim"
                  onDoubleClick={() => handleCellDoubleClick(row.id, "length")}
                >
                  {editingCell?.rowId === row.id && editingCell?.field === "length" ? (
                    <input
                      type="number"
                      autoFocus
                      value={row.length}
                      onChange={(e) => handleCellChange(row.id, "length", parseFloat(e.target.value))}
                      onBlur={handleCellBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleCellBlur()}
                      className="grid-cell-input"
                    />
                  ) : (
                    row.length.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
                  )}
                </td>
                <td
                  className="grid-col-dim"
                  onDoubleClick={() => handleCellDoubleClick(row.id, "width")}
                >
                  {editingCell?.rowId === row.id && editingCell?.field === "width" ? (
                    <input
                      type="number"
                      autoFocus
                      value={row.width}
                      onChange={(e) => handleCellChange(row.id, "width", parseFloat(e.target.value))}
                      onBlur={handleCellBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleCellBlur()}
                      className="grid-cell-input"
                    />
                  ) : (
                    row.width.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
                  )}
                </td>
                <td
                  className="grid-col-qty"
                  onDoubleClick={() => handleCellDoubleClick(row.id, "quantity")}
                >
                  {editingCell?.rowId === row.id && editingCell?.field === "quantity" ? (
                    <input
                      type="number"
                      autoFocus
                      value={row.quantity}
                      onChange={(e) => handleCellChange(row.id, "quantity", parseInt(e.target.value))}
                      onBlur={handleCellBlur}
                      onKeyDown={(e) => e.key === "Enter" && handleCellBlur()}
                      className="grid-cell-input"
                    />
                  ) : (
                    row.quantity
                  )}
                </td>
                <td className="grid-col-material">{row.material}</td>
                <td className="grid-col-preview">{renderPreview(row)}</td>
                <td className="grid-col-edges">
                  <div className="edges-container">
                    {edges.map((edge) => (
                      <button type="button"
                        key={edge}
                        className={`edge-btn ${row.edges?.includes(edge) ? "active" : ""}`}
                        onClick={() => {
                          const currentEdges = row.edges || "";
                          const newEdges = currentEdges.includes(edge)
                            ? currentEdges.replace(edge, "")
                            : currentEdges + edge;
                          handleCellChange(row.id, "edges", newEdges);
                        }}
                        disabled={readOnly}
                      >
                        {edge}
                      </button>
                    ))}
                  </div>
                  {row.hasError && (
                    <div className="error-indicator">
                      <AlertTriangle size={16} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.hasError) && (
        <div className="grid-error-summary">
          <AlertTriangle size={14} />
          <span>
            {rows.filter((r) => r.hasError).length} satırda hata bulunmaktadır
          </span>
        </div>
      )}
    </div>
  );
};

