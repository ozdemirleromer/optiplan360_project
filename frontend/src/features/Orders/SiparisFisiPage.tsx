import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "../../components/Layout";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { COLORS, RADIUS, SHADOWS } from "../../components/Shared/constants";
import { useOrdersStore } from "../../stores/ordersStore";
import type { OrderStatus, PriorityLevel } from "../../types";
import { Button } from "../../components/Shared";
import { navigateToAppPage } from "../../utils/appNavigation";
import { exportToPDF } from "../../utils/export";

interface SiparisFisiPageProps {
  preferredOrderId?: string | null;
  title?: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Yeni",
  PREPARED: "Hazırlandı",
  OPTI_IMPORTED: "Opti Import",
  OPTI_RUNNING: "Opti Çalışıyor",
  OPTI_DONE: "Opti Tamamlandı",
  XML_READY: "XML Hazır",
  DELIVERED: "Teslim Edildi",
  DONE: "Tamamlandı",
  HOLD: "Beklemede",
  FAILED: "Hata",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  NEW: "#3b82f6",
  PREPARED: "#8b5cf6",
  OPTI_IMPORTED: "#0891b2",
  OPTI_RUNNING: "#d97706",
  OPTI_DONE: "#059669",
  XML_READY: "#0284c7",
  DELIVERED: "#16a34a",
  DONE: "#16a34a",
  HOLD: "#f59e0b",
  FAILED: "#ef4444",
};

const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  low: COLORS.muted,
  normal: COLORS.text,
  high: "#f59e0b",
  urgent: "#ef4444",
};

export default function SiparisFisiPage({ preferredOrderId, title }: SiparisFisiPageProps) {
  const orders = useOrdersStore((s) => s.orders);
  const fetchOrders = useOrdersStore((s) => s.fetchOrders);
  const updateOrder = useOrdersStore((s) => s.updateOrder);
  const initialized = useOrdersStore((s) => s.initialized);

  // Real-time updates state
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    visible: boolean;
  } | null>(null);

  useEffect(() => {
    if (!initialized) void fetchOrders();
  }, [initialized, fetchOrders]);

  // Show notification function
  const showNotification = (type: 'success' | 'info' | 'warning' | 'error', message: string) => {
    setNotification({ type, message, visible: true });
    setTimeout(() => {
      setNotification(prev => prev ? { ...prev, visible: false } : null);
    }, 3000);
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!preferredOrderId) return;

    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:8000'}/ws/orders/${preferredOrderId}`;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        setConnectionStatus('connecting');
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setConnectionStatus('connected');
          showNotification('success', 'Canlı güncellemeler aktif');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'order_update' && data.order) {
              // Update order in store
              updateOrder(data.order);
              setLastUpdate(new Date());

              // Show notification for status changes
              if (data.order.status !== order?.status) {
                const statusLabel = STATUS_LABEL[data.order.status] || data.order.status;
                showNotification('info', `Sipariş durumu güncellendi: ${statusLabel}`);
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          setConnectionStatus('disconnected');
          showNotification('warning', 'Canlı güncellemeler kesildi');

          // Auto-reconnect after 5 seconds
          reconnectTimer = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('disconnected');
          showNotification('error', 'Bağlantı hatası');
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setConnectionStatus('disconnected');
        showNotification('error', 'Bağlantı kurulamadı');
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [preferredOrderId, updateOrder]);

  const order = preferredOrderId ? orders.find((o) => String(o.id) === String(preferredOrderId)) : null;
  const exportAreaRef = useRef<HTMLDivElement>(null);

  const pageTitle = title ?? ORDER_ROUTE_META.orderForm.title;

  const card: CSSProperties = {
    background: COLORS.bg.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.xl,
    boxShadow: SHADOWS.sm,
    padding: "20px 24px",
    display: "grid",
    gap: 12,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden'
  };

  // Enhanced card with hover effect
  const enhancedCard: CSSProperties = {
    ...card,
    cursor: 'default'
  };

  // Card hover handler
  const handleCardHover = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
  };

  const handleCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = SHADOWS.sm;
    e.currentTarget.style.borderColor = COLORS.border;
  };

  const label: CSSProperties = {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 2,
  };

  const value: CSSProperties = {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: 500,
  };

  const fieldGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  };

  // Responsive field grid for mobile
  const mobileFieldGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  };

  const sectionTitle: CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 8,
    marginBottom: 4,
  };

  // Check if mobile (simplified check)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Connection status indicator
  const ConnectionStatusIndicator = () => {
    const statusConfig = {
      connecting: { color: '#f59e0b', text: 'Bağlanıyor...', icon: '🔄' },
      connected: { color: '#10b981', text: 'Canlı', icon: '🟢' },
      disconnected: { color: '#ef4444', text: 'Çevrimdışı', icon: '🔴' }
    };

    const config = statusConfig[connectionStatus];

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: config.color,
        fontWeight: 500
      }}>
        <span style={{ fontSize: 8 }}>{config.icon}</span>
        <span>{config.text}</span>
        {lastUpdate && (
          <span style={{ color: COLORS.muted, marginLeft: 4 }}>
            • {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    );
  };

  // Status timeline steps
  const getStatusSteps = (status: OrderStatus) => {
    const allSteps = [
      { key: 'NEW', label: 'Yeni', completed: true },
      { key: 'PREPARED', label: 'Hazırlandı', completed: ['PREPARED', 'OPTI_IMPORTED', 'OPTI_RUNNING', 'OPTI_DONE', 'XML_READY', 'DELIVERED', 'DONE'].includes(status) },
      { key: 'OPTI_IMPORTED', label: 'Opti Import', completed: ['OPTI_IMPORTED', 'OPTI_RUNNING', 'OPTI_DONE', 'XML_READY', 'DELIVERED', 'DONE'].includes(status) },
      { key: 'OPTI_RUNNING', label: 'Opti Çalışıyor', completed: ['OPTI_RUNNING', 'OPTI_DONE', 'XML_READY', 'DELIVERED', 'DONE'].includes(status) },
      { key: 'OPTI_DONE', label: 'Opti Tamamlandı', completed: ['OPTI_DONE', 'XML_READY', 'DELIVERED', 'DONE'].includes(status) },
      { key: 'XML_READY', label: 'XML Hazır', completed: ['XML_READY', 'DELIVERED', 'DONE'].includes(status) },
      { key: 'DELIVERED', label: 'Teslim Edildi', completed: ['DELIVERED', 'DONE'].includes(status) },
      { key: 'DONE', label: 'Tamamlandı', completed: status === 'DONE' },
    ];
    return allSteps;
  };

  const StatusTimeline = () => {
    const steps = getStatusSteps(order.status);
    const currentStepIndex = steps.findIndex(step => step.key === order.status);

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
        {steps.map((step, index) => (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: step.completed ? COLORS.primary : "#374151",
                border: step.key === order.status ? `3px solid ${COLORS.primary}` : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                position: "relative",
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                boxShadow: step.completed ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
                transform: step.key === order.status ? 'scale(1.1)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (step.completed || step.key === order.status) {
                  e.currentTarget.style.transform = 'scale(1.2)';
                  e.currentTarget.style.boxShadow = step.completed
                    ? '0 0 0 8px rgba(59, 130, 246, 0.2)'
                    : '0 0 0 4px rgba(156, 163, 175, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = step.key === order.status ? 'scale(1.1)' : 'scale(1)';
                e.currentTarget.style.boxShadow = step.completed
                  ? '0 0 0 4px rgba(59, 130, 246, 0.1)'
                  : 'none';
              }}
              title={`${step.label} - ${step.completed ? 'Tamamlandı' : 'Bekleniyor'}`}
            >
              {step.completed ? (
                <span style={{ animation: 'checkmark 0.3s ease-in-out' }}>✓</span>
              ) : (
                <span style={{ opacity: 0.7 }}>{index + 1}</span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: 36,
                  height: 3,
                  backgroundColor: steps[index + 1].completed ? COLORS.primary : "#374151",
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {steps[index + 1].completed && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      animation: 'shimmer 2s infinite'
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!initialized) {
    return (
      <div className="electric-page">
        <TopBar
          title={pageTitle}
          breadcrumbs={[ORDER_ROUTE_META.orderList.title, pageTitle]}
        />
        <div className="app-page-container" style={{ color: COLORS.muted, padding: "24px" }}>
          {/* Skeleton Loading */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* Header Skeleton */}
            <div style={{
              ...card,
              gridTemplateColumns: "1fr auto",
              alignItems: "start",
              gap: 16
            }}>
              <div>
                <div style={{
                  width: 200,
                  height: 24,
                  backgroundColor: "#374151",
                  borderRadius: RADIUS.md,
                  marginBottom: 8,
                  animation: 'pulse 2s infinite'
                }} />
                <div style={{
                  width: 300,
                  height: 14,
                  backgroundColor: "#374151",
                  borderRadius: RADIUS.sm,
                  animation: 'pulse 2s infinite',
                  animationDelay: '0.2s'
                }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 80,
                      height: 36,
                      backgroundColor: "#374151",
                      borderRadius: RADIUS.md,
                      animation: 'pulse 2s infinite',
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Customer Info Skeleton */}
            <div style={card}>
              <div style={{
                width: 120,
                height: 14,
                backgroundColor: "#374151",
                borderRadius: RADIUS.sm,
                marginBottom: 12,
                animation: 'pulse 2s infinite'
              }} />
              <div style={fieldGrid}>
                {[1, 2].map((i) => (
                  <div key={i}>
                    <div style={{
                      width: 80,
                      height: 11,
                      backgroundColor: "#374151",
                      borderRadius: RADIUS.sm,
                      marginBottom: 4,
                      animation: 'pulse 2s infinite',
                      animationDelay: `${i * 0.1}s`
                    }} />
                    <div style={{
                      width: 120,
                      height: 16,
                      backgroundColor: "#374151",
                      borderRadius: RADIUS.sm,
                      animation: 'pulse 2s infinite',
                      animationDelay: `${i * 0.1 + 0.2}s`
                    }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Status Timeline Skeleton */}
            <div style={card}>
              <div style={{
                width: 100,
                height: 14,
                backgroundColor: "#374151",
                borderRadius: RADIUS.sm,
                marginBottom: 12,
                animation: 'pulse 2s infinite'
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        backgroundColor: "#374151",
                        animation: 'pulse 2s infinite',
                        animationDelay: `${i * 0.1}s`
                      }}
                    />
                    {i < 8 && (
                      <div
                        style={{
                          width: 36,
                          height: 3,
                          backgroundColor: "#374151",
                          borderRadius: 2,
                          animation: 'pulse 2s infinite',
                          animationDelay: `${i * 0.1 + 0.1}s`
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Material Info Skeleton */}
            <div style={card}>
              <div style={{
                width: 120,
                height: 14,
                backgroundColor: "#374151",
                borderRadius: RADIUS.sm,
                marginBottom: 12,
                animation: 'pulse 2s infinite'
              }} />
              <div style={fieldGrid}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i}>
                    <div style={{
                      width: 60,
                      height: 11,
                      backgroundColor: "#374151",
                      borderRadius: RADIUS.sm,
                      marginBottom: 4,
                      animation: 'pulse 2s infinite',
                      animationDelay: `${i * 0.1}s`
                    }} />
                    <div style={{
                      width: 80,
                      height: 16,
                      backgroundColor: "#374151",
                      borderRadius: RADIUS.sm,
                      animation: 'pulse 2s infinite',
                      animationDelay: `${i * 0.1 + 0.2}s`
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!preferredOrderId || !order) {
    return (
      <div className="electric-page">
        <TopBar
          title={pageTitle}
          breadcrumbs={[ORDER_ROUTE_META.orderList.title, pageTitle]}
        />
        <div className="app-page-container">
          <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, marginBottom: 6 }}>
              {preferredOrderId ? `Sipariş #${preferredOrderId} bulunamadı` : "Sipariş seçilmedi"}
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              Sipariş listesinden bir sipariş seçin.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentOrderId = String(preferredOrderId ?? order.id);
  const orderLabel = order.orderNo ?? currentOrderId;

  const handlePrint = () => {
    window.print();
  };

  const handleEdit = () => {
    navigateToAppPage("siparis-duzenleme", "siparis-fisi", currentOrderId);
  };

  const handleExportPDF = async () => {
    if (!exportAreaRef.current) {
      return;
    }

    await exportToPDF(exportAreaRef.current, `siparis-fisi-${orderLabel}.pdf`);
  };

  const handleEmail = () => {
    const subject = `Sipariş Fişi - ${orderLabel}`;
    const body = [
      `Sipariş No: ${orderLabel}`,
      `Müşteri: ${order.cust || "-"}`,
      `Telefon: ${order.phone || "-"}`,
      `Malzeme: ${order.mat || "-"}`,
      `Durum: ${STATUS_LABEL[order.status] ?? order.status}`,
      `Parça Sayısı: ${order.parts}`,
      `Oluşturulma: ${new Date(order.date).toLocaleDateString("tr-TR")}`,
      `Güncelleme: ${new Date(order.upd).toLocaleDateString("tr-TR")}`,
      "",
      "Sipariş fişi OptiPlan360 üzerinden hazırlandı.",
    ].join("\n");

    window.open(
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const statusColor = STATUS_COLOR[order.status] ?? COLORS.muted;

  return (
    <div className="electric-page">
      {/* Toast Notification */}
      {notification && notification.visible && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          padding: '14px 18px',
          borderRadius: RADIUS.lg,
          boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)`,
          backgroundColor:
            notification.type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
            notification.type === 'info' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
            notification.type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
          maxWidth: 320,
          minHeight: 48,
          animation: 'slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          transform: 'translateX(0)',
          opacity: 1
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              animation: 'pulse 2s infinite'
            }}>
              {notification.type === 'success' ? '✓' :
               notification.type === 'info' ? 'ℹ' :
               notification.type === 'warning' ? '⚠' : '✕'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: '1.4' }}>
                {notification.message}
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 16,
                cursor: 'pointer',
                padding: 0,
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <TopBar
        title={pageTitle}
        subtitle={order.cust}
        breadcrumbs={[ORDER_ROUTE_META.orderList.title, pageTitle]}
      />
      <div ref={exportAreaRef} className="app-page-container" style={{ display: "grid", gap: 16 }}>

        {/* Sipariş Özet Başlığı */}
        <div style={{
          ...card,
          gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
          alignItems: "start",
          gap: isMobile ? 16 : 0
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: COLORS.text }}>
                {order.orderNo ?? `SIP-${String(order.id).padStart(4, "0")}`}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: `${statusColor}18`,
                  color: statusColor,
                  border: `1px solid ${statusColor}40`,
                }}
              >
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: `${PRIORITY_COLOR[order.priority]}18`,
                  color: PRIORITY_COLOR[order.priority],
                  border: `1px solid ${PRIORITY_COLOR[order.priority]}40`,
                }}
              >
                {PRIORITY_LABEL[order.priority] ?? order.priority}
              </span>
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              Oluşturulma: {new Date(order.date).toLocaleDateString("tr-TR")}
              {" · "}
              Güncelleme: {new Date(order.upd).toLocaleDateString("tr-TR")}
            </div>
          </div>
          <div style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            minWidth: isMobile ? "100%" : 200,
            marginTop: isMobile ? 16 : 0
          }}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleEdit}
              style={{
                fontSize: 12,
                padding: "8px 16px",
                flex: isMobile ? 1 : "auto",
                borderRadius: RADIUS.md,
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(59, 130, 246, 0.2)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
            >
              Düzenle
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              style={{
                fontSize: 12,
                padding: "8px 16px",
                flex: isMobile ? 1 : "auto",
                borderRadius: RADIUS.md,
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: 'rgba(249, 250, 251, 0.8)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.95)';
                e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.3)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
            >
              Yazdır
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleExportPDF()}
              style={{
                fontSize: 12,
                padding: "8px 16px",
                flex: isMobile ? 1 : "auto",
                borderRadius: RADIUS.md,
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: 'rgba(249, 250, 251, 0.8)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.95)';
                e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.3)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
            >
              PDF
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleEmail}
              style={{
                fontSize: 12,
                padding: "8px 16px",
                flex: isMobile ? 1 : "auto",
                borderRadius: RADIUS.md,
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: 'rgba(249, 250, 251, 0.8)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.95)';
                e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.backgroundColor = 'rgba(249, 250, 251, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(156, 163, 175, 0.3)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
            >
              E-posta
            </Button>
          </div>
        </div>

        {/* Müşteri Bilgileri */}
        <div
          style={enhancedCard}
          onMouseEnter={handleCardHover}
          onMouseLeave={handleCardLeave}
        >
          <div style={sectionTitle}>Müşteri Bilgileri</div>
          <div style={isMobile ? mobileFieldGrid : fieldGrid}>
            <div>
              <div style={label}>Müşteri Adı</div>
              <div style={value}>{order.cust || "—"}</div>
            </div>
            <div>
              <div style={label}>Telefon</div>
              <div style={value}>{order.phone || "—"}</div>
            </div>
          </div>
        </div>

        {/* Sipariş Durumu Timeline */}
        <div
          style={enhancedCard}
          onMouseEnter={handleCardHover}
          onMouseLeave={handleCardLeave}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={sectionTitle}>Sipariş Durumu</div>
            <ConnectionStatusIndicator />
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>
            Mevcut Durum: <span style={{ color: statusColor, fontWeight: 600 }}>{STATUS_LABEL[order.status] ?? order.status}</span>
          </div>
          <div style={{ overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? 8 : 0 }}>
            <StatusTimeline />
          </div>
        </div>

        {/* Malzeme Bilgileri */}
        <div
          style={enhancedCard}
          onMouseEnter={handleCardHover}
          onMouseLeave={handleCardLeave}
        >
          <div style={sectionTitle}>Malzeme Bilgileri</div>
          <div style={isMobile ? mobileFieldGrid : fieldGrid}>
            <div>
              <div style={label}>Malzeme</div>
              <div style={value}>{order.mat || "—"}</div>
            </div>
            <div>
              <div style={label}>Kalınlık</div>
              <div style={value}>{order.thick ? `${order.thick} mm` : "—"}</div>
            </div>
            <div>
              <div style={label}>Plaka Boyutu</div>
              <div style={value}>{order.plate || "—"}</div>
            </div>
            <div>
              <div style={label}>Grup</div>
              <div style={value}>{order.grp ?? "—"}</div>
            </div>
            <div>
              <div style={label}>Ağırlık</div>
              <div style={value}>{order.weight ? `${order.weight} kg` : "—"}</div>
            </div>
            <div>
              <div style={label}>Yoğunluk</div>
              <div style={value}>{order.density ? `${order.density} g/cm³` : "—"}</div>
            </div>
          </div>
        </div>

        {/* Parça Özeti */}
        <div
          style={enhancedCard}
          onMouseEnter={handleCardHover}
          onMouseLeave={handleCardLeave}
        >
          <div style={sectionTitle}>Parça Özeti</div>
          <div style={isMobile ? mobileFieldGrid : fieldGrid}>
            <div>
              <div style={label}>Toplam Parça</div>
              <div style={{ ...value, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.primary }}>
                {order.parts}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}