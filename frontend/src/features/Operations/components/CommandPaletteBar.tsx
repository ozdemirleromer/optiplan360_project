import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export function CommandPaletteBar() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPaletteHotkey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isPaletteHotkey) return;

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const kbdLabel = useMemo(() => {
    if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
      return "Cmd";
    }
    return "Ctrl";
  }, []);

  return (
    <div className={`ai-ops-command-palette ${focused ? "is-focused" : ""}`} role="search">
      <Search size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        aria-label="Komut Paleti"
        placeholder="Komut, siparis veya ajan ara..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      {query ? (
        <button
          type="button"
          className="ai-ops-command-clear"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="Aramayi temizle"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : (
        <div className="ai-ops-command-kbd">
          <kbd>{kbdLabel}</kbd>
          <kbd>K</kbd>
        </div>
      )}
    </div>
  );
}
