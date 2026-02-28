/**
 * Kullanıcı Yönetimi Sayfası
 * CRUD işlemleri, rol atama, şifre sıfırlama
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, X, Mail, Shield, Calendar, Edit2, Key, Trash2 } from "lucide-react";
import { TopBar } from "../Layout";
import { Button, Card, Badge, Input, Select } from "../Shared";
import { COLORS, TYPOGRAPHY, RADIUS } from "../Shared/constants";
import { adminService } from "../../services/adminService";
import { useToast } from "../../contexts/ToastContext";
import type { AdminUser } from "../../services/adminService";

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ search: "", role: "all", status: "all" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ username: "", display_name: "", email: "", name: "", password: "", role: "OPERATOR" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.username.trim()) errors.username = "Kullanıcı adı zorunlu";
    if (!formData.display_name.trim()) errors.display_name = "Görünen ad zorunlu";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Geçerli e-posta giriniz";
    }
    if (!editingUser && !formData.password.trim()) errors.password = "Şifre zorunlu";
    if (formData.password && formData.password.length < 6) errors.password = "Şifre minimum 6 karakter olmalı";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreateUser() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await adminService.createUser({
        username: formData.username,
        password: formData.password,
        display_name: formData.display_name,
        email: formData.email || undefined,
        name: formData.name || undefined,
        role: formData.role,
      });
      addToast("Kullanıcı başarıyla oluşturuldu", "success");
      setShowCreateForm(false);
      setFormData({ username: "", display_name: "", email: "", name: "", password: "", role: "OPERATOR" });
      await loadUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kullanıcı oluşturulamadı";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUser() {
    if (!editingUser || !validateForm()) return;
    setSaving(true);
    try {
      const updates = {
        display_name: formData.display_name,
        email: formData.email || undefined,
        name: formData.name || undefined,
        role: formData.role,
        ...(formData.password.trim() ? { password: formData.password } : {}),
      };
      await adminService.updateUser(editingUser.id, updates);
      addToast("Kullanıcı başarıyla güncellendi", "success");
      setEditingUser(null);
      setFormData({ username: "", display_name: "", email: "", name: "", password: "", role: "OPERATOR" });
      await loadUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kullanıcı güncellenemedi";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`${username} kullanıcısını silmek istediğinizden emin misiniz?`)) return;
    setSaving(true);
    try {
      await adminService.deleteUser(userId);
      addToast("Kullanıcı başarıyla silindi", "success");
      await loadUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kullanıcı silinemedi";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleUserState(user: AdminUser) {
    setSaving(true);
    try {
      await adminService.updateUser(user.id, { is_active: !user.isActive });
      addToast("Kullanıcı durumu başarıyla güncellendi", "success");
      await loadUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kullanıcı durumu güncellenemedi";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordUserId || newPassword.length < 6) return;
    setResetting(true);
    try {
      await adminService.resetUserPassword(resetPasswordUserId, newPassword);
      addToast("Şifre başarıyla sıfırlandı", "success");
      setResetPasswordUserId(null);
      setNewPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Şifre sıfırlanamadı";
      addToast(`Hata: ${msg}`, "error");
    } finally {
      setResetting(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = !filter.search ||
        (user.username.toLowerCase().includes(filter.search.toLowerCase()) ||
         user.displayName.toLowerCase().includes(filter.search.toLowerCase()));
      const matchesRole = filter.role === "all" || user.role === filter.role;
      const matchesStatus = filter.status === "all" ||
        (filter.status === "active" && user.isActive) ||
        (filter.status === "inactive" && !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, filter]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.isActive).length;
    const byRole: Record<string, number> = {};
    ["ADMIN", "OPERATOR", "STATION", "VIEWER"].forEach(role => {
      byRole[role] = users.filter(u => u.role === role).length;
    });
    return { total, active, inactive: total - active, byRole };
  }, [users]);

  const getAvatarInitials = (displayName: string, username: string) => {
    const name = displayName || username;
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg.main, fontFamily: TYPOGRAPHY.fontFamily.base }}>
        <TopBar title="Kullanıcılar" subtitle="Kullanıcı yönetimi" />
        <Card title="Yükleniyor...">
          <div style={{ padding: "40px", textAlign: "center", color: COLORS.muted }}>
            Kullanıcılar getiriliyor...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg.main, fontFamily: TYPOGRAPHY.fontFamily.base }}>
      <TopBar
        title="Kullanıcılar"
        subtitle="Kullanıcı ve hesap yönetimi"
        breadcrumbs={["Yönetim", "Kullanıcılar"]}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="primary"
            onClick={() => {
              setShowCreateForm(true);
              setFormData({ username: "", display_name: "", email: "", name: "", password: "", role: "OPERATOR" });
              setFormErrors({});
            }}
          >
            Yeni Kullanıcı
          </Button>
          <Button
            variant="secondary"
            onClick={loadUsers}
            disabled={loading}
          >
            {loading ? "Yenileniyor..." : "Yenile"}
          </Button>
        </div>
      </TopBar>

      <div style={{ padding: "20px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {/* İstatistik Kartları */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <Card style={{ background: `${COLORS.primary[500]}08`, borderLeft: `4px solid ${COLORS.primary[500]}` }}>
              <div style={{ fontSize: "13px", color: COLORS.muted, marginBottom: "8px" }}>Toplam Kullanıcı</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: COLORS.primary[500] }}>{stats.total}</div>
            </Card>
            <Card style={{ background: `${COLORS.success.DEFAULT}08`, borderLeft: `4px solid ${COLORS.success.DEFAULT}` }}>
              <div style={{ fontSize: "13px", color: COLORS.muted, marginBottom: "8px" }}>Aktif</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: COLORS.success.DEFAULT }}>{stats.active}</div>
            </Card>
            <Card style={{ background: `${COLORS.gray[400]}08`, borderLeft: `4px solid ${COLORS.gray[400]}` }}>
              <div style={{ fontSize: "13px", color: COLORS.muted, marginBottom: "8px" }}>Pasif</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: COLORS.gray[400] }}>{stats.inactive}</div>
            </Card>
          </div>

          {/* Rol Dağılımı */}
          <Card title="Rol Dağılımı" style={{ marginBottom: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              {Object.entries({ ADMIN: "Admin", OPERATOR: "Operatör", STATION: "İstasyon", VIEWER: "Görüntüleyici" }).map(([role, label]) => (
                <div key={role} style={{ textAlign: "center", padding: "12px", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: COLORS.primary[500], marginBottom: "4px" }}>
                    {stats.byRole[role] || 0}
                  </div>
                  <div style={{ fontSize: "12px", color: COLORS.muted }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Şifre Sıfırlama Modal */}
          {resetPasswordUserId && (
            <Card title="Şifre Sıfırla" style={{ marginBottom: "20px", background: `${COLORS.warning.DEFAULT}08` }}>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.text, marginBottom: "6px", display: "block" }}>
                    Yeni Şifre (Minimum 6 karakter)
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yeni şifre"
                  />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    variant="primary"
                    onClick={handleResetPassword}
                    disabled={resetting || newPassword.length < 6}
                  >
                    {resetting ? "Sıfırlanıyor..." : "Şifre Sıfırla"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResetPasswordUserId(null);
                      setNewPassword("");
                    }}
                  >
                    İptal
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Oluştur/Düzenle Formu */}
          {(showCreateForm || editingUser) && (
            <Card
              title={editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı Oluştur"}
              style={{ marginBottom: "20px", background: `${COLORS.primary[500]}08` }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.text, marginBottom: "6px", display: "block" }}>
                    Kullanıcı Adı *
                  </label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData(s => ({ ...s, username: e.target.value }))}
                    placeholder="kullanici_adi"
                    disabled={!!editingUser}
                    style={{ borderColor: formErrors.username ? COLORS.error.DEFAULT : undefined }}
                  />
                  {formErrors.username && <div style={{ fontSize: "12px", color: COLORS.error.DEFAULT, marginTop: "4px" }}>{formErrors.username}</div>}
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.text, marginBottom: "6px", display: "block" }}>
                    Görünen Ad *
                  </label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData(s => ({ ...s, display_name: e.target.value }))}
                    placeholder="Ahmet Yılmaz"
                    style={{ borderColor: formErrors.display_name ? COLORS.error.DEFAULT : undefined }}
                  />
                  {formErrors.display_name && <div style={{ fontSize: "12px", color: COLORS.error.DEFAULT, marginTop: "4px" }}>{formErrors.display_name}</div>}
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.text, marginBottom: "6px", display: "block" }}>
                    E-posta
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(s => ({ ...s, email: e.target.value }))}
                    placeholder="kullanici@example.com"
                    style={{ borderColor: formErrors.email ? COLORS.error.DEFAULT : undefined }}
                  />
                  {formErrors.email && <div style={{ fontSize: "12px", color: COLORS.error.DEFAULT, marginTop: "4px" }}>{formErrors.email}</div>}
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.text, marginBottom: "6px", display: "block" }}>
                    Ad Soyad
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(s => ({ ...s, name: e.target.value }))}
                    placeholder="Ahmet Yılmaz"
                  />
                </div>
                {!editingUser && (
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.text, marginBottom: "6px", display: "block" }}>
                      Şifre *
                    </label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(s => ({ ...s, password: e.target.value }))}
                      placeholder="Minimum 6 karakter"
                      style={{ borderColor: formErrors.password ? COLORS.error.DEFAULT : undefined }}
                    />
                    {formErrors.password && <div style={{ fontSize: "12px", color: COLORS.error.DEFAULT, marginTop: "4px" }}>{formErrors.password}</div>}
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.text, marginBottom: "6px", display: "block" }}>
                    Rol *
                  </label>
                  <Select
                    value={formData.role}
                    onChange={(value) => setFormData((s) => ({ ...s, role: String(value) }))}
                    options={[
                      { value: "ADMIN", label: "Admin" },
                      { value: "OPERATOR", label: "Operator" },
                      { value: "STATION", label: "Istasyon" },
                      { value: "VIEWER", label: "Goruntuleyici" },
                    ]}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <Button
                  variant="primary"
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  disabled={saving}
                >
                  {saving ? "İşleniyor..." : (editingUser ? "Güncelle" : "Oluştur")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingUser(null);
                    setFormData({ username: "", display_name: "", email: "", name: "", password: "", role: "OPERATOR" });
                    setFormErrors({});
                  }}
                >
                  İptal
                </Button>
              </div>
            </Card>
          )}

          {/* Filtreler */}
          <Card title="Filtreler" style={{ marginBottom: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <Input
                placeholder="Ara..."
                value={filter.search}
                onChange={(e) => setFilter(s => ({ ...s, search: e.target.value }))}
              />
              <Select
                value={filter.role}
                onChange={(value) => setFilter((s) => ({ ...s, role: String(value) }))}
                options={[
                  { value: "all", label: "Tum Roller" },
                  { value: "ADMIN", label: "Admin" },
                  { value: "OPERATOR", label: "Operator" },
                  { value: "STATION", label: "Istasyon" },
                  { value: "VIEWER", label: "Goruntuleyici" },
                ]}
              />
              <Select
                value={filter.status}
                onChange={(value) => setFilter((s) => ({ ...s, status: String(value) }))}
                options={[
                  { value: "all", label: "Tum Durumlar" },
                  { value: "active", label: "Aktif" },
                  { value: "inactive", label: "Pasif" },
                ]}
              />
            </div>
          </Card>

          {/* Kullanıcı Listesi */}
          <Card title={`Kullanıcılar (${filteredUsers.length}/${users.length})`}>
            {filteredUsers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: COLORS.muted }}>
                {loading ? "Yükleniyor..." : "Kullanıcı bulunamadı"}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {filteredUsers.map((user) => {
                  const initials = getAvatarInitials(user.displayName, user.username);
                  return (
                    <div
                      key={user.id}
                      style={{
                        padding: "16px",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.md,
                        background: user.isActive ? "transparent" : `${COLORS.gray[200]}40`,
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: "16px",
                        alignItems: "center",
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: `${COLORS.primary[500]}20`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: "700",
                          color: COLORS.primary[500],
                        }}
                      >
                        {initials}
                      </div>

                      {/* User Info */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600" }}>{user.username}</span>
                          <Badge variant={user.isActive ? "success" : "secondary"}>
                            {user.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </div>
                        <div style={{ fontSize: "13px", color: COLORS.muted, marginBottom: "6px" }}>
                          {user.displayName}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px", fontSize: "12px", color: COLORS.muted }}>
                          {user.email && (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Mail size={14} />
                              <span>{user.email}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Shield size={14} />
                            <span>
                              {user.role === "ADMIN"
                                ? "Admin"
                                : user.role === "OPERATOR"
                                ? "Operatör"
                                : user.role === "STATION"
                                ? "İstasyon"
                                : "Görüntüleyici"}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Calendar size={14} />
                            <span>{new Date(user.createdAt).toLocaleDateString("tr-TR")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingUser(user);
                              setFormData({
                                username: user.username,
                                display_name: user.displayName,
                                email: user.email || "",
                                name: user.name || "",
                                password: "",
                                role: user.role,
                              });
                            }}
                            disabled={saving}
                          >
                            <Edit2 size={14} /> Düzenle
                          </Button>
                          <Button
                            size="sm"
                            variant={user.isActive ? "secondary" : "primary"}
                            onClick={() => handleToggleUserState(user)}
                            disabled={saving}
                          >
                            {user.isActive ? <X size={14} /> : <Check size={14} />}
                            {user.isActive ? "Pasif Yap" : "Aktif Yap"}
                          </Button>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setResetPasswordUserId(user.id)}
                          >
                            <Key size={14} /> Şifre Sıfırla
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            disabled={saving}
                          >
                            <Trash2 size={14} /> Sil
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
