import { type CacheStats } from "./useLookupCache";

interface LookupCacheDebugPanelProps {
  cariStats?: CacheStats;
  stokStats?: CacheStats;
}

/**
 * Development-only debug panel to display and monitor lookup cache statistics.
 * Shows hit/miss ratios, cache size, and performance metrics.
 * Only visible in development builds.
 */
export function LookupCacheDebugPanel({ cariStats, stokStats }: LookupCacheDebugPanelProps) {
  const isDevBuild = import.meta.env.DEV;

  if (!isDevBuild) {
    return null;
  }

  const StatRow = ({
    label,
    value,
    suffix = "",
  }: {
    label: string;
    value: string | number;
    suffix?: string;
  }) => (
    <div className="flex justify-between text-[10px] border-b border-slate-700/30 py-0.5 px-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-200">
        {value}
        {suffix}
      </span>
    </div>
  );

  const CacheStatsBlock = ({
    title,
    stats,
  }: {
    title: string;
    stats: CacheStats | undefined;
  }) => {
    if (!stats) return null;

    const missRate = 100 - stats.hitRate * 100;
    const hitRatePercent = Math.round(stats.hitRate * 100);

    return (
      <div className="mb-2 border border-slate-700/50 rounded bg-slate-900/40">
        <div className="px-2 py-1 bg-slate-800/60 border-b border-slate-700/30 font-semibold text-[10px] text-slate-300">
          {title}
        </div>
        <StatRow label="Total Queries" value={stats.totalQueries} />
        <StatRow label="Cache Hits" value={stats.hits} />
        <StatRow label="Cache Misses" value={stats.misses} />
        <StatRow label="Hit Rate" value={hitRatePercent} suffix="%" />
        <StatRow label="Entries" value={stats.entriesInCache} suffix="/50" />
      </div>
    );
  };

  return (
    <div className="fixed bottom-1 right-1 z-50 w-[200px] max-h-[200px] overflow-y-auto bg-slate-950 border border-slate-700 rounded shadow-lg">
      <div className="px-2 py-1 bg-slate-800 font-bold text-[9px] text-slate-300 uppercase border-b border-slate-700">
        📊 Cache Stats (DEV)
      </div>
      <div className="p-1">
        <CacheStatsBlock title="Customer Lookup" stats={cariStats} />
        <CacheStatsBlock title="Stock Lookup" stats={stokStats} />
      </div>
      <div className="px-2 py-1 text-[9px] text-slate-500 border-t border-slate-700">
        <span className="text-emerald-400 font-semibold">✓</span> Cache monitoring active
      </div>
    </div>
  );
}
