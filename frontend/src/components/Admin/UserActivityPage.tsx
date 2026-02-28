/**
 * User Activity Page
 * Monitors and displays all user actions on the system
 * Shows login/logout tracking, create/update/delete operations, and detailed activity trails
 */

import { useState, useEffect, useMemo } from "react";
import { TopBar } from "../Layout";
import { Card } from "../Shared";
import { COLORS } from "../Shared/constants";
import { adminService } from "../../services/adminService";
import { useAsyncOperation } from "./shared/hooks";

export interface UserActivityOut {
  id: string;
  userId: number;
  activityType: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  status: string;
  ipAddress?: string;
  createdAt: string;
}

export interface UserSessionOut {
  id: string;
  userId: number;
  ipAddress?: string;
  deviceType?: string;
  loginAt: string;
  logoutAt?: string;
  lastActivityAt: string;
  isActive: boolean;
}

export interface ActivityStats {
  total: number;
  byOperation: Record<string, number>;
  byEntity: Record<string, number>;
}

export function UserActivityPage() {
  const [activities, setActivities] = useState<UserActivityOut[]>([]);
  const [sessions, setSessions] = useState<UserSessionOut[]>([]);
  const [, setStats] = useState<ActivityStats | null>(null);
  const [activeTab, setActiveTab] = useState<"activities" | "sessions">("activities");
  const [filter, setFilter] = useState({ 
    user: "", 
    activity_type: "", 
    resource_type: "",
    dateFrom: "", 
    dateTo: "" 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { execute: loadActivities } = useAsyncOperation(
    () => adminService.getUserActivities({
      activity_type: filter.activity_type || undefined,
      resource_type: filter.resource_type || undefined,
      limit: 200,
    }),
    (data) => {
      setActivities(data);
      setLoading(false);
    },
    (err) => {
      setError("Aktiviteler yüklenemedi");
      setLoading(false);
      console.error(err);
    }
  );

  const { execute: loadSessions } = useAsyncOperation(
    () => adminService.getUserSessions({ limit: 100 }),
    (data) => setSessions(data),
    (err) => console.error(err)
  );

  const { execute: loadStats } = useAsyncOperation(
    () => adminService.getActivityStats(),
    (data: unknown) => setStats(data as ActivityStats),
    (err) => console.error(err)
  );

  useEffect(() => {
    loadActivities();
    loadSessions();
    loadStats();
  }, [loadActivities, loadSessions, loadStats, filter]);

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const userMatch = !filter.user || activity.userId.toString().includes(filter.user);
      const dateMatch = !filter.dateFrom && !filter.dateTo || (
        new Date(activity.createdAt) >= new Date(filter.dateFrom || '1970-01-01') &&
        new Date(activity.createdAt) <= new Date(filter.dateTo || '2099-12-31')
      );
      return userMatch && dateMatch;
    });
  }, [activities, filter]);

  const activityCounts = useMemo(() => ({
    total: activities.length,
    logins: activities.filter(a => a.activityType === "LOGIN").length,
    creates: activities.filter(a => a.activityType === "CREATE").length,
    updates: activities.filter(a => a.activityType === "UPDATE").length,
    deletes: activities.filter(a => a.activityType === "DELETE").length,
  }), [activities]);

  const activeSessions = useMemo(() => {
    return sessions.filter(s => s.isActive).length;
  }, [sessions]);

  // Activity type color helper
  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      LOGIN: COLORS.success.DEFAULT,
      LOGOUT: COLORS.warning.DEFAULT,
      CREATE: COLORS.info[500],
      UPDATE: COLORS.accent[400],
      DELETE: COLORS.error.DEFAULT,
      VIEW: COLORS.muted,
      EXPORT: COLORS.primary[500],
      IMPORT: COLORS.primary[500],
    };
    return colors[type] || COLORS.gray[400];
  };

  return (
    <div className="electric-page">
      <TopBar 
        title="Kullanıcı Aktivitesi" 
        subtitle="Sistem üzerindeki tüm kullanıcı eylemlerini ve oturumlarını izle" 
        breadcrumbs={["Yönetim", "Aktivite"]} 
      />
      
      <div className="app-page-container" style={{ display: "grid", gap: 16 }}>
        {error && (
          <Card style={{ background: "rgba(239, 68, 68, 0.1)" }}>
            <div style={{ color: COLORS.error.DEFAULT }}>{error}</div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.primary[500] }}>{activityCounts.total}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Toplam Aktiviteler</div>
            </div>
          </Card>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.success.DEFAULT }}>{activityCounts.logins}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Girişler</div>
            </div>
          </Card>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.info[500] }}>{activeSessions}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Aktif Oturumlar</div>
            </div>
          </Card>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.accent[400] }}>{activityCounts.creates}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Oluşturmalar</div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 12 }}>
          <button
            onClick={() => setActiveTab("activities")}
            style={{
              padding: "12px 16px",
              background: activeTab === "activities" ? COLORS.primary[500] : "transparent",
              color: activeTab === "activities" ? "white" : COLORS.muted,
              border: "none",
              cursor: "pointer",
              fontWeight: activeTab === "activities" ? 600 : 500,
            }}
          >
            Aktiviteler
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            style={{
              padding: "12px 16px",
              background: activeTab === "sessions" ? COLORS.primary[500] : "transparent",
              color: activeTab === "sessions" ? "white" : COLORS.muted,
              border: "none",
              cursor: "pointer",
              fontWeight: activeTab === "sessions" ? 600 : 500,
            }}
          >
            Oturumlar
          </button>
        </div>

        {/* Filters */}
        {activeTab === "activities" && (
          <Card title="Filtreleme">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted }}>Aktivite Türü</label>
                <select 
                  value={filter.activity_type} 
                  onChange={(e) => setFilter(p => ({ ...p, activity_type: e.target.value }))}
                >
                  <option value="">Tümü</option>
                  <option value="LOGIN">Giriş</option>
                  <option value="LOGOUT">Çıkış</option>
                  <option value="CREATE">Oluştur</option>
                  <option value="UPDATE">Güncelle</option>
                  <option value="DELETE">Sil</option>
                  <option value="EXPORT">Dışa Aktar</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.muted }}>Kaynak Türü</label>
                <select 
                  value={filter.resource_type} 
                  onChange={(e) => setFilter(p => ({ ...p, resource_type: e.target.value }))}
                >
                  <option value="">Tümü</option>
                  <option value="order">Sipariş</option>
                  <option value="user">Kullanıcı</option>
                  <option value="station">İstasyon</option>
                  <option value="config">Konfigürasyon</option>
                  <option value="invoice">Fatura</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Activities Tab */}
        {activeTab === "activities" && (
          <Card title={`Aktivite Günlüğü (${filteredActivities.length})`}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Yükleniyor...</div>
            ) : filteredActivities.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Aktivite bulunamadı</div>
            ) : (
              filteredActivities.map(activity => (
                <div 
                  key={activity.id} 
                  style={{ 
                    padding: 12, 
                    borderBottom: `1px solid ${COLORS.border}`, 
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span 
                        style={{ 
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: getActivityColor(activity.activityType),
                        }}
                      />
                      <div style={{ fontWeight: 600 }}>
                        {activity.activityType} • {activity.resourceType}
                      </div>
                      {activity.resourceName && (
                        <div style={{ fontSize: 12, color: COLORS.muted }}>({activity.resourceName})</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                      User #{activity.userId} {activity.ipAddress && `• ${activity.ipAddress}`}
                    </div>
                    {activity.description && (
                      <div style={{ fontSize: 12, color: COLORS.gray[500], marginTop: 4 }}>
                        {activity.description}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.gray[400], textAlign: "right", minWidth: 120 }}>
                    {new Date(activity.createdAt).toLocaleString("tr-TR")}
                  </div>
                </div>
              ))
            )}
          </Card>
        )}

        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <Card title={`Aktif Oturumlar (${activeSessions})`}>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Oturum bulunamadı</div>
            ) : (
              sessions.map(session => (
                <div 
                  key={session.id} 
                  style={{ 
                    padding: 12, 
                    borderBottom: `1px solid ${COLORS.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      User #{session.userId}{" "}
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: session.isActive ? COLORS.success.DEFAULT : COLORS.gray[300],
                        color: "white",
                        borderRadius: 4,
                        fontSize: 11,
                        marginLeft: 8,
                      }}>
                        {session.isActive ? "AÇIK" : "KAPALI"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                      {session.deviceType || "Web"} • {session.ipAddress || "N/A"}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 4 }}>
                      Giriş: {new Date(session.loginAt).toLocaleString("tr-TR")}
                      {session.logoutAt && ` • Çıkış: ${new Date(session.logoutAt).toLocaleString("tr-TR")}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {session.isActive && (
                      <button
                        onClick={async () => {
                          try {
                            await adminService.terminateSession(session.id);
                            setSessions(prev => prev.map(s => 
                              s.id === session.id ? { ...s, isActive: false, logoutAt: new Date().toISOString() } : s
                            ));
                          } catch (err) {
                            console.error('Failed to terminate session:', err);
                          }
                        }}
                        style={{
                          padding: "6px 12px",
                          background: COLORS.error.DEFAULT,
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Sonlandır
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
