/**
 * Roller ve Yetkilendirme Yönetim Sayfası
 * 4 temel rol ve yetki matrisi
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { ShieldCheck, Users, Eye, Monitor } from "lucide-react";
import { TopBar } from "../Layout";
import { Button, Card, Badge } from "../Shared";
import { COLORS, TYPOGRAPHY, RADIUS } from "../Shared/constants";
import { adminService } from "../../services/adminService";
import { useToast } from "../../contexts/ToastContext";
import type { AdminUser } from "../../services/adminService";

interface RoleDefinition {
  id: string;
  name: string;
  nameEN: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; color?: string }>;
  color: string;
  description: string;
  permissions: string[];
}

interface PermissionItem {
  module: string;
  actions: Record<string, string>;
}

const ROLES: RoleDefinition[] = [
  {
    id: "ADMIN",
    name: "Sistem Yöneticisi",
    nameEN: "Admin",
    icon: ShieldCheck,
    color: "#ef4444",
    description: "Tüm sistem yetkilerine tam erişim sahibi",
    permissions: [
      "users:view",
      "users:create",
      "users:edit",
      "users:delete",
      "roles:manage",
      "config:edit",
      "logs:view",
      "audit:view",
      "reports:view",
      "integrations:manage",
    ],
  },
  {
    id: "OPERATOR",
    name: "Üretim Operatörü",
    nameEN: "Operator",
    icon: Users,
    color: "#3b82f6",
    description: "Günlük üretim operasyonlarını yönetme",
    permissions: [
      "orders:create",
      "orders:view",
      "orders:edit",
      "stations:view",
      "stations:scan",
      "reports:view",
    ],
  },
  {
    id: "STATION",
    name: "İstasyon Kullanıcısı",
    nameEN: "Station",
    icon: Monitor,
    color: "#8b5cf6",
    description: "İstasyon görevleri ve QR tarama",
    permissions: [
      "orders:view",
      "stations:view",
      "stations:scan",
      "tasks:execute",
    ],
  },
  {
    id: "VIEWER",
    name: "Görmek-Sadece Kullanıcı",
    nameEN: "Viewer",
    icon: Eye,
    color: "#6b7280",
    description: "Sistemdeki verileri sadece görüntüleme",
    permissions: [
      "orders:view",
      "stations:view",
      "reports:view",
      "analytics:view",
    ],
  },
];

const PERMISSION_MODULES: PermissionItem[] = [
  {
    module: "Kullanıcılar",
    actions: {
      "users:view": "Görüntüle",
      "users:create": "Oluştur",
      "users:edit": "Düzenle",
      "users:delete": "Sil",
    },
  },
  {
    module: "Siparişler",
    actions: {
      "orders:view": "Görüntüle",
      "orders:create": "Oluştur",
      "orders:edit": "Düzenle",
      "orders:delete": "Sil",
    },
  },
  {
    module: "İstasyonlar",
    actions: {
      "stations:view": "Görüntüle",
      "stations:scan": "QR Tara",
      "stations:edit": "Düzenle",
    },
  },
  {
    module: "Raporlar & Analitik",
    actions: {
      "reports:view": "Raporlar",
      "analytics:view": "Analitik",
      "exports:create": "İhraç",
    },
  },
  {
    module: "Sistem Ayarları",
    actions: {
      "config:edit": "Ayarları Düzenle",
      "logs:view": "Logları Görüntüle",
      "audit:view": "Denetim Kayıtları",
    },
  },
  {
    module: "Entegrasyonlar",
    actions: {
      "integrations:manage": "Yönet",
      "integrations:test": "Test Yap",
    },
  },
];

export function RolesPermissionsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("ADMIN");
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getUsers();
      setUsers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kullanıcılar yüklenemedi";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const currentRole = useMemo(() => ROLES.find((r) => r.id === selectedRole) || ROLES[0], [selectedRole]);

  const usersByRole = useMemo(() => {
    const grouped: Record<string, AdminUser[]> = {};
    ROLES.forEach((role) => {
      grouped[role.id] = users.filter((u) => u.role === role.id);
    });
    return grouped;
  }, [users]);

  const roleStats = useMemo(
    () => ({
      total: users.length,
      byRole: Object.entries(usersByRole).reduce((acc, [role, roleUsers]) => {
        acc[role] = roleUsers.length;
        return acc;
      }, {} as Record<string, number>),
    }),
    [users, usersByRole]
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg.main, fontFamily: TYPOGRAPHY.fontFamily.base }}>
        <TopBar title="Roller ve Yetkilendirme" subtitle="Rol yönetimi ve yetki matrisi" />
        <Card title="Yükleniyor...">
          <div style={{ padding: "40px", textAlign: "center", color: COLORS.muted }}>
            Roller ve yetkilendirme verisi getiriliyor...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg.main, fontFamily: TYPOGRAPHY.fontFamily.base }}>
      <TopBar
        title="Roller ve Yetkilendirme"
        subtitle="Rol tanımları ve yetki yönetimi"
        breadcrumbs={["Yönetim", "Roller & Yetkilendirme"]}
      >
        <Button variant="secondary" onClick={loadUsers} disabled={loading}>
          {loading ? "Yenileniyor..." : "Yenile"}
        </Button>
      </TopBar>

      <div style={{ padding: "20px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {/* İstatistik Kartları */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <Card style={{ background: `${COLORS.primary[500]}08`, borderLeft: `4px solid ${COLORS.primary[500]}` }}>
              <div style={{ fontSize: "13px", color: COLORS.muted, marginBottom: "8px" }}>Toplam Kullanıcı</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: COLORS.primary[500] }}>{roleStats.total}</div>
            </Card>
            {ROLES.map((role) => (
              <Card
                key={role.id}
                style={{
                  background: `${role.color}08`,
                  borderLeft: `4px solid ${role.color}`,
                }}
              >
                <div style={{ fontSize: "13px", color: COLORS.muted, marginBottom: "8px" }}>{role.nameEN}</div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: role.color }}>
                  {roleStats.byRole[role.id] || 0}
                </div>
              </Card>
            ))}
          </div>

          {/* Rol Tanımları */}
          <Card title="Rol Tanımları" style={{ marginBottom: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {ROLES.map((role) => {
                const RoleIcon = role.icon;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    style={{
                      border: selectedRole === role.id ? `2px solid ${role.color}` : `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.md,
                      padding: "16px",
                      cursor: "pointer",
                      background: selectedRole === role.id ? `${role.color}08` : "transparent",
                      transition: "all 200ms",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: `${role.color}20`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <RoleIcon size={20} color={role.color} />
                      </div>
                      <div>
                        <div style={{ fontWeight: "700", color: COLORS.text }}>{role.name}</div>
                        <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "2px" }}>
                          {roleStats.byRole[role.id] || 0} kullanıcı
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: "12px", color: COLORS.muted, lineHeight: "1.5" }}>
                      {role.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Detaylı Rol Bilgileri */}
          <Card
            title={`${currentRole.name} - Detaylı Bilgi`}
            style={{ marginBottom: "20px", background: `${currentRole.color}08` }}
          >
            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", color: COLORS.muted, fontWeight: "600", marginBottom: "8px" }}>
                  Açıklama
                </div>
                <div style={{ fontSize: "14px", color: COLORS.text }}>{currentRole.description}</div>
              </div>

              <div>
                <div style={{ fontSize: "13px", color: COLORS.muted, fontWeight: "600", marginBottom: "8px" }}>
                  Temel Yetkilendirmeler
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                  {currentRole.permissions.map((perm) => (
                    <div
                      key={perm}
                      style={{
                        padding: "8px 12px",
                        background: `${currentRole.color}15`,
                        border: `1px solid ${currentRole.color}40`,
                        borderRadius: RADIUS.sm,
                        fontSize: "12px",
                        color: currentRole.color,
                        fontWeight: "500",
                      }}
                    >
                      [OK] {perm}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Yetki Matrisi */}
          <Card title="Eksiksiz Yetki Matrisi" style={{ marginBottom: "20px" }}>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: COLORS.text }}>
                      Modül / Yetki
                    </th>
                    {ROLES.map((role) => (
                      <th
                        key={role.id}
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          fontWeight: "600",
                          color: role.color,
                          minWidth: "100px",
                        }}
                      >
                        {role.nameEN}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map((mod, idx) => (
                    <tr
                      key={mod.module}
                      style={{
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: idx % 2 === 0 ? "transparent" : `${COLORS.gray[100]}40`,
                      }}
                    >
                      <td style={{ padding: "12px", fontWeight: "600", color: COLORS.text }}>
                        {mod.module}
                      </td>
                      {ROLES.map((role) => {
                        const hasPermissions = Object.keys(mod.actions).some((perm) =>
                          role.permissions.includes(perm)
                        );
                        return (
                          <td key={role.id} style={{ padding: "12px", textAlign: "center" }}>
                            {hasPermissions ? (
                              <Badge variant="success">Evet</Badge>
                            ) : (
                              <Badge variant="secondary">Hayır</Badge>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Rol Başına Kullanıcı Listesi */}
          {Object.entries(usersByRole).map(([roleId, roleUsers]) => {
            if (roleUsers.length === 0) return null;
            const role = ROLES.find((r) => r.id === roleId);
            if (!role) return null;

            return (
              <Card
                key={roleId}
                title={`${role.name} (${roleUsers.length} kullanıcı)`}
                style={{ marginBottom: "20px" }}
              >
                <div style={{ display: "grid", gap: "8px" }}>
                  {roleUsers.map((user) => (
                    <div
                      key={user.id}
                      style={{
                        padding: "10px 12px",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: "600", color: COLORS.text }}>
                          {user.username}
                        </div>
                        <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "2px" }}>
                          {user.displayName} {user.email ? `(${user.email})` : ""}
                        </div>
                      </div>
                      <Badge variant={user.isActive ? "success" : "secondary"}>
                        {user.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
