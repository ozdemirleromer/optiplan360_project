/**
 * Advanced Search & Filter Hook
 * Global Spotlight arama + sayfa filtresi
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

export interface SearchFilter {
  field: string;
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'between';
  value: unknown;
}

interface SearchResult<T> {
  item: T;
  score: number; // 0-1 arasında relevance skoru
}

/**
 * Fuzzy search - yazım hatalarını tolere eder
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const [s1, s2] = str1.length > str2.length ? [str2, str1] : [str1, str2];
  const distances: number[] = Array(s1.length + 1)
    .fill(null)
    .map((_, i) => i);

  for (let i = 0; i < s2.length; i++) {
    let prevDistance = i;
    for (let j = 0; j < s1.length; j++) {
      const newDistance = s2[i] === s1[j]
        ? distances[j]
        : Math.min(
            distances[j] + 1,
            distances[j + 1] + 1,
            prevDistance + 1
          );
      distances[j] = prevDistance;
      prevDistance = newDistance;
    }
    distances[s1.length] = prevDistance;
  }

  return distances[s1.length];
};

const calculateFuzzyScore = (query: string, text: string): number => {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return 1;

  // Contains
  if (lowerText.includes(lowerQuery)) return 0.8;

  // Fuzzy (Levenshtein)
  const distance = levenshteinDistance(lowerQuery, lowerText);
  const maxLen = Math.max(lowerQuery.length, lowerText.length);
  return Math.max(0, 1 - distance / maxLen);
};

/**
 * useSearch Hook
 * @example
 *   const { results, search, filters, setFilter, clearFilters } = useSearch(orders);
 *   search('müşteri adı');
 *   setFilter({ field: 'status', operator: 'equals', value: 'PRODUCTION' });
 */
export const useSearch = <T extends Record<string, unknown>>(
  data: T[],
  searchFields: (keyof T)[] = Object.keys(data[0] || {}) as (keyof T)[],
) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilter[]>([]);

  const results: SearchResult<T>[] = useMemo(() => {
    let filtered = data;

    // Apply filters
    if (filters.length > 0) {
      filtered = data.filter((item) =>
        filters.every((filter) => {
          const fieldValue = item[filter.field];

          switch (filter.operator) {
            case 'contains':
              return String(fieldValue)
                .toLowerCase()
                .includes(String(filter.value).toLowerCase());
            case 'equals':
              return fieldValue === filter.value;
            case 'gt':
              return fieldValue > filter.value;
            case 'lt':
              return fieldValue < filter.value;
            case 'gte':
              return fieldValue >= filter.value;
            case 'lte':
              return fieldValue <= filter.value;
            case 'between':
              return (
                fieldValue >= filter.value[0] &&
                fieldValue <= filter.value[1]
              );
            default:
              return true;
          }
        }),
      );
    }

    // Search
    if (!query.trim()) {
      return filtered.map((item) => ({ item, score: 1 }));
    }

    const searchResults = filtered
      .map((item) => {
        const scores = searchFields.map((field) => {
          const fieldValue = String(item[field] || '');
          return calculateFuzzyScore(query, fieldValue);
        });

        const score = Math.max(...scores);
        return { item, score };
      })
      .filter((result) => result.score > 0.3) // Min score threshold
      .sort((a, b) => b.score - a.score);

    return searchResults;
  }, [data, query, filters, searchFields]);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleSetFilter = useCallback((filter: SearchFilter) => {
    setFilters((prev) => {
      const existing = prev.findIndex((f) => f.field === filter.field);
      if (existing >= 0) {
        const newFilters = [...prev];
        newFilters[existing] = filter;
        return newFilters;
      }
      return [...prev, filter];
    });
  }, []);

  const handleAddFilter = useCallback(
    (filter: SearchFilter) => {
      setFilters((prev) => [...prev, filter]);
    }, []
  );

  const handleRemoveFilter = useCallback((field: string) => {
    setFilters((prev) => prev.filter((f) => f.field !== field));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const handleClearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    search: handleSearch,
    results: results.map((r) => r.item),
    filters,
    setFilter: handleSetFilter,
    addFilter: handleAddFilter,
    removeFilter: handleRemoveFilter,
    clearFilters: handleClearFilters,
    clearSearch: handleClearSearch,
    clear: () => {
      setQuery('');
      setFilters([]);
    },
  };
};

/**
 * useGlobalSearch Hook
 * Spotlight tarzı global arama (tüm sistemde)
 */
export const useGlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K ile aç
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    inputRef,
  };
};

/**
 * useDateRangeFilter Hook
 */
export const useDateRangeFilter = (field: string) => {
  const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);

  const filter: SearchFilter | null = range[0] && range[1]
    ? { field, operator: 'between', value: range }
    : null;

  const presets = {
    today: () => {
      const today = new Date();
      setRange([today, today]);
    },
    thisWeek: () => {
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      setRange([weekStart, new Date()]);
    },
    thisMonth: () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setRange([monthStart, new Date()]);
    },
    lastMonth: () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      setRange([monthStart, monthEnd]);
    },
    last7Days: () => {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      setRange([weekAgo, new Date()]);
    },
    custom: (from: Date, to: Date) => {
      setRange([from, to]);
    },
    clear: () => {
      setRange([null, null]);
    },
  };

  return { range, setRange, filter, presets };
};
