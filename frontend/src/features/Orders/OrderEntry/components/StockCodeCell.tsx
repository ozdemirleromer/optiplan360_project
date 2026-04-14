import { useState, useEffect, useRef } from "react";
import { apiRequest } from "../../../../services/apiClient";
import { COLORS } from "../../../../components/Shared/constants";

interface StockCodeCellProps {
  cellId: string;
  value: string;
  stokAd?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
  onStockFound?: (stock: Record<string, unknown>) => void;
}

export function StockCodeCell({
  cellId,
  value,
  stokAd = "",
  placeholder = "",
  disabled = false,
  invalid = false,
  onChange,
  onStockFound
}: StockCodeCellProps) {
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value.length < 3 || disabled) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await apiRequest<Record<string, unknown>>(
          `/api/v1/stock/stock-cards/${encodeURIComponent(value)}`,
          { method: "GET" },
        );
        if (data && onStockFound) {
          onStockFound(data);
        }
      } catch {
        // Silently fail if not found
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, disabled, onStockFound]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <input
        type="text"
        data-order-cell={cellId}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "2px 4px",
          fontSize: "12px",
          border: "1px solid transparent",
          borderRadius: "3px",
          background: "transparent",
          outline: "none",
          height: "26px",
          ...(loading ? { opacity: 0.6 } : {})
        }}
      />
      {stokAd && !loading && (
        <div 
          title={stokAd}
          style={{
            position: "absolute",
            bottom: -14,
            left: 4,
            fontSize: "9px",
            color: COLORS.primary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "calc(100% - 8px)",
            pointerEvents: "none",
            fontWeight: 600
          }}
        >
          {stokAd}
        </div>
      )}
    </div>
  );
}
