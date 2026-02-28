import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { Card, Button } from "./Shared";
import { Input } from "./Shared/FormComponents";
import { COLORS, RADIUS } from "./Shared/constants";
import { CheckCircle2 } from "lucide-react";
import { getApiBaseUrl } from "../services/apiClient";
import type { User, UserRole } from "../types";

interface LoginResponse {
  token: string;
  user: {
    id: number | string;
    username: string;
    display_name?: string;
    role: string;
    email?: string;
    is_active?: boolean;
    created_at?: string;
  };
}

export function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);

  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      setError("Kullanıcı adı ve şifre gereklidir");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.error?.message ||
          errorData?.detail ||
          errorData?.message ||
          "Giriş başarısız";
        throw new Error(errorMessage);
      }

      const data: LoginResponse = await response.json();

      const user: User = {
        id: String(data.user.id),
        username: data.user.username,
        email: data.user.email ?? "",
        role: (data.user.role as UserRole) || "OPERATOR",
        fullName: data.user.display_name,
        active: data.user.is_active ?? true,
        createdAt: data.user.created_at ?? new Date().toISOString(),
      };

      // Store token and user data in zustand store (persist middleware handles localStorage)
      login(data.token, user);

      // Set login success to trigger re-render
      setLoginSuccess(true);

      // Redirect to main app after successful login
      setTimeout(() => {
        window.location.href = "/";
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  // If login successful, show success message
  if (loginSuccess) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "radial-gradient(circle at top left, #383838 0%, #2D2D2D 45%, #1C1C1C 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <Card
          title="Giriş Başarılı"
          subtitle="Yönlendiriliyorsunuz..."
          style={{
            width: "100%",
            maxWidth: "400px",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}>
            <CheckCircle2 size={48} color="#4ADE80" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <p style={{ color: COLORS.text, margin: 0 }}>
            OptiPlan 360'a hoş geldiniz!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top left, #383838 0%, #2D2D2D 45%, #1C1C1C 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <Card
        title="OptiPlan 360"
        subtitle="Üretim Yönetim Sistemi"
        style={{
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input
            label="Kullanıcı Adı"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
          />

          <Input
            type="password"
            label="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="admin"
          />

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                padding: "12px",
                borderRadius: RADIUS.md,
                background: "rgba(239, 68, 68, 0.1)",
                border: `1px solid rgba(239, 68, 68, 0.2)`,
                color: "#ef4444",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>

          <div
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: COLORS.muted,
              marginTop: "8px",
            }}
          >
            Test kullanıcı: admin / admin
          </div>
        </form>
      </Card>
    </div>
  );
}
