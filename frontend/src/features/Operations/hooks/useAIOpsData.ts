/**
 * useAIOpsData
 * AIOpsDashboard için tüm veri çekme ve dönüşüm mantığı.
 * Bileşenden ayrılmış: test edilebilir, tekrar kullanılabilir.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminService } from "../../../services/adminService";
import { integrationService, SyncStatus } from "../../../services/integrationService";
import { ordersService } from "../../../services/ordersService";
import { paymentReportService } from "../../../services/paymentService";
import { apiRequest } from "../../../services/apiClient";

// ── Tip tanımları ──────────────────────────────────────────────

interface StockSummaryStats {
  totalStockCards?: number;
  activeStockCards?: number;
  inactiveStockCards?: number;
  lastMovementDate?: string | null;
  totalStockMovements?: number;
}

interface LowStockResponse {
  threshold?: number;
  count?: number;
  items?: Array<{
    id: string;
    stockCode: string;
    stockName: string;
    availableQuantity: number;
  }>;
}

export interface AIOpsStats {
  ordersNew: number;
  ordersProduction: number;
  ordersReady: number;
  ordersDelivered: number;
  ordersTotal: number;
  paymentCollectionRate: number;
  paymentOverdue: number;
  paymentPromises: number;
  integrationsHealth: string;
  integrationsErrors: number;
  integrationsOutbox: number;
  integrationsInbox: number;
  integrationsRunning: number;
  stockTotal: number;
  stockActive: number;
  stockLowCount: number;
  lastSync: string;
}

export interface ActivityItem {
  title: string;
  detail: string;
  tone: "danger" | "warning" | "info" | "success";
}

export interface RecentOrder {
  id: string;
  cust: string;
  mat: string;
  status: string;
}

export interface UseAIOpsDataResult {
  stats: AIOpsStats;
  activityFeed: ActivityItem[];
  recentOrders: RecentOrder[];
  loading: boolean;
  /** Kısmi hata: bazı kaynaklar yanıt vermedi */
  partialError: string | null;
  /** Yeniden yükle */
  reload: () => void;
}

// ── Sabitler ──────────────────────────────────────────────────

const REFRESH_MS  = 45_000;
const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 120_000;

const DEFAULT_STATS: AIOpsStats = {
  ordersNew: 0,
  ordersProduction: 0,
  ordersReady: 0,
  ordersDelivered: 0,
  ordersTotal: 0,
  paymentCollectionRate: 0,
  paymentOverdue: 0,
  paymentPromises: 0,
  integrationsHealth: "UNKNOWN",
  integrationsErrors: 0,
  integrationsOutbox: 0,
  integrationsInbox: 0,
  integrationsRunning: 0,
  stockTotal: 0,
  stockActive: 0,
  stockLowCount: 0,
  lastSync: "--",
};

// ── Yardımcı fonksiyon ────────────────────────────────────────

function buildActivityFeed(
  integrationErrors: Array<{ errorMessage?: string }>,
  outbox: unknown[],
  orders: unknown[],
): ActivityItem[] {
  const feed: ActivityItem[] = [];

  if (integrationErrors.length > 0) {
    feed.push({
      title: "Entegrasyon Hatası",
      detail: integrationErrors[0]?.errorMessage ?? "Hata kaydı mevcut",
      tone: "danger",
    });
  }
  if (outbox.length > 0) {
    feed.push({
      title: "Outbox Bekliyor",
      detail: `${outbox.length} işlem kuyrukta`,
      tone: "warning",
    });
  }
  if (orders.length > 0) {
    feed.push({
      title: "Sipariş Akışı",
      detail: `${orders.length} aktif iş`,
      tone: "info",
    });
  }
  if (feed.length === 0) {
    feed.push({
      title: "Sistem Stabil",
      detail: "Anormal durum yok",
      tone: "success",
    });
  }

  return feed.slice(0, 4);
}

// ── Hook ─────────────────────────────────────────────────────

export function useAIOpsData(): UseAIOpsDataResult {
  const [loading, setLoading] = useState(true);
  const [partialError, setPartialError] = useState<string | null>(null);
  const [stats, setStats] = useState<AIOpsStats>(DEFAULT_STATS);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const retryDelayRef  = useRef(REFRESH_MS);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef   = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPartialError(null);

    const results = await Promise.allSettled([
      adminService.getStats(),                                                         // 0
      ordersService.list(),                                                            // 1
      paymentReportService.getStatistics(),                                            // 2
      integrationService.getHealth(),                                                  // 3
      integrationService.listSyncJobs(),                                               // 4
      integrationService.listOutbox(),                                                 // 5
      integrationService.listInbox(),                                                  // 6
      integrationService.listErrors({ is_resolved: false }),                          // 7
      apiRequest<StockSummaryStats>("/stock/stock-cards/summary/stats", { method: "GET" }),  // 8
      apiRequest<LowStockResponse>("/stock/stock-cards/low-stock/alert", { method: "GET" }), // 9
    ]);

    // Tip güvenli yardımcı
    function pick<T>(index: number, fallback: T): T {
      const item = results[index];
      return item?.status === "fulfilled" ? (item.value as T) : fallback;
    }

    const systemStats  = pick(0, null as Record<string, number> | null);
    const orders       = pick(1, [] as Array<{ status?: string }>);
    const paymentStats = pick(2, null as Record<string, number> | null);
    const health       = pick(3, null as { status?: string; lastSync?: string } | null);
    const syncJobs     = pick(4, [] as Array<{ status?: SyncStatus; createdAt?: string }>);
    const outbox       = pick(5, [] as Array<unknown>);
    const inbox        = pick(6, [] as Array<unknown>);
    const errors       = pick(7, [] as Array<{ errorMessage?: string; createdAt?: string }>);
    const stockStats   = pick(8, null as StockSummaryStats | null);
    const lowStock     = pick(9, null as LowStockResponse | null);

    const runningJobs = syncJobs.filter((j) => j.status === SyncStatus.RUNNING).length;
    const lastSync    = syncJobs[0]?.createdAt ?? health?.lastSync ?? "--";

    setStats({
      ordersNew:              systemStats?.ordersNew              ?? 0,
      ordersProduction:       systemStats?.ordersProduction        ?? 0,
      ordersReady:            systemStats?.ordersReady             ?? 0,
      ordersDelivered:        systemStats?.ordersDelivered         ?? 0,
      ordersTotal:            systemStats?.totalOrders             ?? orders.length,
      paymentCollectionRate:  paymentStats?.collectionRate          ?? 0,
      paymentOverdue:         paymentStats?.overdueInvoices         ?? 0,
      paymentPromises:        paymentStats?.pendingPromisesCount    ?? 0,
      integrationsHealth:     health?.status                        ?? "UNKNOWN",
      integrationsErrors:     errors.length,
      integrationsOutbox:     outbox.length,
      integrationsInbox:      inbox.length,
      integrationsRunning:    runningJobs,
      stockTotal:             stockStats?.totalStockCards          ?? 0,
      stockActive:            stockStats?.activeStockCards          ?? 0,
      stockLowCount:          lowStock?.count                       ?? 0,
      lastSync,
    });

    setRecentOrders(
      (orders as Array<Record<string, unknown>>).slice(0, 10).map((o) => ({
        id: String(o.id ?? ""),
        cust: String(o.cust ?? o.customerName ?? ""),
        mat: String(o.mat ?? o.material ?? ""),
        status: String(o.status ?? "NEW"),
      }))
    );
    setActivityFeed(buildActivityFeed(errors, outbox, orders));

    const anyFailed = results.some((r) => r.status === "rejected");
    if (anyFailed) {
      setPartialError("Bazı kaynaklar yanıt vermedi. Veriler kısıtlı olabilir.");
      // Hata varsa: gecikmeyi ikiye katla (max MAX_RETRY_MS)
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS);
    } else {
      // Başarı: gecikmeyi sıfırla
      retryDelayRef.current = REFRESH_MS;
    }

    setLoading(false);

    // Bir sonraki yüklemeyi planla (sabit interval yerine backoff)
    if (isMountedRef.current) {
      timerRef.current = setTimeout(() => void loadData(), retryDelayRef.current);
    }
  }, []);

  // İlk yükleme + cleanup
  useEffect(() => {
    isMountedRef.current = true;
    retryDelayRef.current = MIN_RETRY_MS; // İlk hata varsa kısa bekle
    void loadData();
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadData]);

  return useMemo(
    () => ({ stats, activityFeed, recentOrders, loading, partialError, reload: loadData }),
    [stats, activityFeed, recentOrders, loading, partialError, loadData],
  );
}

// ── Format yardımcıları (bileşenlerden de import edilebilir) ──

export function toHumanCount(value: number | null | undefined): string {
  if (value == null) return "--";
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function toPercent(value: number | null | undefined): string {
  if (value == null) return "--";
  return `${Math.round(value)}%`;
}
