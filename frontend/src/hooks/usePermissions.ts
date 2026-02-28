/**
 * Permissions Hook
 * Backend'den izinleri çeker, TTL bazlı önbelleğe alır.
 * Tüm UI yetkilendirme kararları için tek kaynak.
 */
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../services/apiClient';

interface PermissionsResponse {
  success: boolean;
  user_role: string;
  user_permissions: string[];
  all_roles: Record<string, string[]>;
  cache_key: string;
  error?: string;
}

interface CachedEntry {
  data: PermissionsResponse;
  cachedAt: number;
}

interface UsePermissionsResult {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  loading: boolean;
  error: string | null;
}

// Modül seviyesinde cache — bileşen mount/unmount'larından bağımsız yaşar
const permissionCache = new Map<string, CachedEntry>();
const CACHE_LIFETIME_MS = 60 * 60 * 1000; // 1 saat

// Aynı anda birden fazla çağrının aynı endpoint'e gitmesini engeller
const inflightRequests = new Map<string, Promise<PermissionsResponse>>();

function buildCacheKey(role: string): string {
  return `perms_${role}`;
}

function isCacheValid(entry: CachedEntry): boolean {
  return Date.now() - entry.cachedAt < CACHE_LIFETIME_MS;
}

/**
 * Mevcut kullanıcının backend izinlerini döndürür.
 * Önbellek geçerliyse network isteği atmaz.
 *
 * Kullanım:
 * ```tsx
 * const { hasPermission } = usePermissions();
 * if (hasPermission('orders:view')) return <Orders />;
 * ```
 */
export function usePermissions(): UsePermissionsResult {
  const [permResponse, setPermResponse] = useState<PermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !authUser) {
      setLoading(false);
      setPermResponse(null);
      return;
    }

    const cacheKey = buildCacheKey(authUser.role);

    const fetchPermissions = async () => {
      // 1. Geçerli önbellek varsa ağa gitme
      const cached = permissionCache.get(cacheKey);
      if (cached && isCacheValid(cached)) {
        setPermResponse(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 2. Zaten uçuştaki istek varsa ona bağlan (request deduplication)
        let fetchPromise = inflightRequests.get(cacheKey);
        if (!fetchPromise) {
          fetchPromise = fetch(`${getApiBaseUrl()}/config/permissions`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${useAuthStore.getState().token}`,
            },
          }).then((res) => {
            if (!res.ok) throw new Error(`İzin sorgusu başarısız: HTTP ${res.status}`);
            return res.json() as Promise<PermissionsResponse>;
          }).then((data) => {
            // Başarılı yanıtı önbelleğe al
            permissionCache.set(cacheKey, { data, cachedAt: Date.now() });
            return data;
          }).finally(() => {
            // Uçuştan düşünce listeyi temizle (hata da dahil)
            inflightRequests.delete(cacheKey);
          });

          inflightRequests.set(cacheKey, fetchPromise);
        }

        const data = await fetchPromise;

        if (data.success) {
          setPermResponse(data);
        } else {
          throw new Error(data.error ?? 'İzin bilgisi alınamadı');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'İzin sorgusu başarısız';
        setError(message);
        console.error('[usePermissions] Hata:', err);

        // Fail-closed: hata durumunda boş izin listesi (güvenli taraf)
        setPermResponse({
          success: false,
          user_role: authUser.role,
          user_permissions: [],
          all_roles: {},
          cache_key: '',
          error: message,
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchPermissions();
  }, [authUser, isAuthenticated]);

  const permissions = permResponse?.user_permissions ?? [];

  return {
    permissions,
    hasPermission: (permission) => permissions.includes(permission),
    hasAllPermissions: (...required) => required.every((p) => permissions.includes(p)),
    hasAnyPermission: (...required) => required.some((p) => permissions.includes(p)),
    loading,
    error,
  };
}

/**
 * HOC: Bileşeni izin kontrolüne göre render eder ya da fallback gösterir.
 * Props tipi korunur — any kaçağı yok.
 *
 * ```tsx
 * const ProtectedOrders = withPermission(Orders, 'orders:view', () => <NotAuthorized />);
 * ```
 */
export function withPermission<TProps extends object>(
  Component: React.ComponentType<TProps>,
  requiredPermission: string,
  fallback?: () => React.ReactNode,
): React.FC<TProps> {
  function PermissionWrapper(props: TProps): React.ReactElement {
    const { hasPermission, loading } = usePermissions();

    if (loading) {
      return React.createElement('div', {}, 'Yetkilendirme kontrol ediliyor...');
    }

    if (!hasPermission(requiredPermission)) {
      const fallbackNode = fallback?.() ?? 'Bu işlem için yetkiniz yok.';
      return React.createElement(React.Fragment, {}, fallbackNode);
    }

    return React.createElement(Component, props);
  }

  PermissionWrapper.displayName = `withPermission(${Component.displayName ?? Component.name})`;
  return PermissionWrapper;
}

/**
 * Inline permission gate bileşeni.
 *
 * ```tsx
 * <PermissionGate permission="orders:create">
 *   <CreateOrderButton />
 * </PermissionGate>
 * ```
 */
export function PermissionGate(props: {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactNode {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { permission, children, fallback = null } = props;

  const granted = Array.isArray(permission)
    ? hasAnyPermission(...permission)
    : hasPermission(permission);

  return granted ? children : fallback;
}

/**
 * Önbelleği temizle — logout veya rol değişiminden sonra çağır.
 */
export function clearPermissionCache(): void {
  permissionCache.clear();
  inflightRequests.clear();
}
