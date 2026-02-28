import { useState } from "react";
import { Search, X } from "lucide-react";

export const GlobalSearchBar = () => {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <div className={`global-search ${focused ? "is-focused" : ""}`}>
      <Search size={14} className="global-search-icon" aria-hidden="true" />
      <input
        data-global-search
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Siparis, musteri ara..."
        aria-label="Global arama"
        className="global-search-input"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Aramayi temizle"
          className="global-search-clear"
        >
          <X size={14} />
        </button>
      ) : (
        <span className="global-search-hint">Ctrl+F</span>
      )}
    </div>
  );
};
