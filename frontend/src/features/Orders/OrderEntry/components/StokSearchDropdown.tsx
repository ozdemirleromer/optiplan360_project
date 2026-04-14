import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { apiRequest } from "../../../../services/apiClient";

interface StokItem {
  stok_kodu: string;
  stok_adi: string;
}

interface StokSearchDropdownProps {
  value: string | null;
  onChange: (stokKod: string, stokAd: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  style?: CSSProperties;
}

export function StokSearchDropdown({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  placeholder = "Stok kodu ara...",
  id,
  ariaLabel,
  style,
}: StokSearchDropdownProps) {
  const [inputValue, setInputValue] = useState(value ?? "");
  const [results, setResults] = useState<StokItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync inputValue when value prop changes
  useEffect(() => {
    setInputValue(value ?? "");
  }, [value]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<StokItem[]>(
        `/mikro/validate/stok?q=${encodeURIComponent(query)}`
      );
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setInputValue(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(q), 300);
  };

  const selectItem = (item: StokItem) => {
    setInputValue(item.stok_kodu);
    setOpen(false);
    setResults([]);
    onChange(item.stok_kodu, item.stok_adi);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectItem(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isLocked = Boolean(value) && !open;

  const baseStyle: CSSProperties = {
    width: "100%",
    height: 28,
    padding: "0 8px",
    border: "1px solid var(--op-border, #e2e8f0)",
    borderRadius: 4,
    fontSize: 13,
    background: readOnly || disabled ? "var(--op-bg, #f8fafc)" : "var(--op-surface, #fff)",
    color: "var(--op-text, #0f172a)",
    outline: "none",
    cursor: readOnly || disabled ? "not-allowed" : isLocked ? "pointer" : "text",
    ...style,
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type="text"
          aria-label={ariaLabel ?? "Stok kodu ara"}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
          role="combobox"
          value={inputValue}
          readOnly={readOnly}
          disabled={disabled}
          placeholder={isLocked ? undefined : placeholder}
          style={baseStyle}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onClick={() => {
            if (readOnly || disabled) return;
            if (isLocked) {
              setInputValue("");
              setOpen(false);
            }
          }}
        />
        {loading && (
          <span
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              color: "var(--op-text-muted, #64748b)",
            }}
          >
            ...
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          aria-label="Stok arama sonuçları"
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "var(--op-surface, #fff)",
            border: "1px solid var(--op-border, #e2e8f0)",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            maxHeight: 220,
            overflowY: "auto",
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {results.map((item, idx) => (
            <li
              key={item.stok_kodu}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(item);
              }}
              style={{
                padding: "7px 10px",
                cursor: "pointer",
                background: idx === activeIndex ? "var(--op-accent-soft, #ede9fe)" : "transparent",
                borderBottom: "1px solid var(--op-border, #e2e8f0)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600 }}>{item.stok_kodu}</span>
              {item.stok_adi ? (
                <span style={{ marginLeft: 8, color: "var(--op-text-muted, #64748b)", fontSize: 12 }}>
                  {item.stok_adi}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
