import { useCallback, useRef, useEffect } from "react";

// Cache entry with timestamp and hit count
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

// Cache statistics interface
export interface CacheStats {
  totalQueries: number;
  hits: number;
  misses: number;
  hitRate: number;
  entriesInCache: number;
}

// Global cache statistics tracked across instances
const globalCacheStats = {
  cari: { hits: 0, misses: 0, total: 0 },
  stok: { hits: 0, misses: 0, total: 0 },
};

/**
 * Custom hook for managing cached API lookups with automatic expiration.
 * Tracks cache statistics and reduces redundant API calls.
 *
 * @param lookupFn - Async function that performs the actual lookup
 * @param ttlMs - Time-to-live for cache entries (default: 30000ms = 30s)
 * @param invalidateKey - Optional key that triggers cache clear when changed
 * @param statsKey - Optional key for tracking statistics ('cari' or 'stok')
 * @returns Wrapped lookup function OR object with { lookup, stats } if statsKey provided
 *
 * @example
 * // Without stats
 * const cached = useLookupCache(lookupPhase3Customers, 30000, retryKey);
 * 
 * // With stats
 * const { lookup, stats } = useLookupCache(
 *   lookupPhase3Customers,
 *   30000,
 *   retryKey,
 *   'cari'
 * );
 */
export function useLookupCache<T>(
  lookupFn: (query: string) => Promise<T[]>,
  ttlMs?: number,
  invalidateKey?: number | "cari" | "stok",
  statsKey?: "cari" | "stok",
): any {
  // Backward compatibility: if invalidateKey is a string, treat it as statsKey
  const actualTtl = typeof ttlMs === "number" ? ttlMs : 30000;
  const actualInvalidateKey = typeof invalidateKey === "number" ? invalidateKey : undefined;
  const actualStatsKey =
    typeof invalidateKey === "string"
      ? (invalidateKey as "cari" | "stok")
      : (statsKey as "cari" | "stok" | undefined);

  const cacheRef = useRef<Map<string, CacheEntry<T[]>>>(new Map());

  // Clear cache when invalidateKey changes
  useEffect(() => {
    cacheRef.current.clear();
  }, [actualInvalidateKey]);

  const getStats = useCallback((): CacheStats => {
    const entries = Array.from(cacheRef.current.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const stats = actualStatsKey ? globalCacheStats[actualStatsKey] : { hits: 0, misses: 0, total: 0 };
    const hitRate = stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) / 100 : 0;

    return {
      totalQueries: stats.total,
      hits: stats.hits,
      misses: stats.misses,
      hitRate,
      entriesInCache: cacheRef.current.size,
    };
  }, [actualStatsKey]);

  const cachedLookup = useCallback(
    async (query: string): Promise<T[]> => {
      const now = Date.now();
      const cached = cacheRef.current.get(query);

      // Track hit
      if (cached && now - cached.timestamp < actualTtl) {
        cached.hits += 1;
        if (actualStatsKey) {
          globalCacheStats[actualStatsKey].hits += 1;
          globalCacheStats[actualStatsKey].total += 1;
        }
        return cached.data;
      }

      // Track miss
      if (actualStatsKey) {
        globalCacheStats[actualStatsKey].misses += 1;
        globalCacheStats[actualStatsKey].total += 1;
      }

      // Call API for miss or expired entry
      const result = await lookupFn(query);

      // Store result with current timestamp and hit counter
      cacheRef.current.set(query, {
        data: result,
        timestamp: now,
        hits: 0,
      });

      // Clean up old entries (~50 entries max)
      if (cacheRef.current.size > 50) {
        const sorted = Array.from(cacheRef.current.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp,
        );
        for (let i = 0; i < 10; i++) {
          cacheRef.current.delete(sorted[i][0]);
        }
      }

      return result;
    },
    [lookupFn, actualTtl, actualStatsKey],
  );

  // Return plain function for backward compatibility, or enriched object if stats tracking
  if (actualStatsKey) {
    return {
      lookup: cachedLookup,
      stats: getStats(),
    };
  }
  return cachedLookup;
}
