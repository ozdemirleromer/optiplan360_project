import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationStore } from "../notificationStore";

beforeEach(() => {
  useNotificationStore.setState({ notifications: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNotificationStore", () => {
  it("varsayılan state boş notifications dizisi", () => {
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("addNotification id üretir ve listeye ekler", () => {
    useNotificationStore.getState().addNotification({ type: "success", message: "Kaydedildi" });
    const notifs = useNotificationStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("success");
    expect(notifs[0].message).toBe("Kaydedildi");
    expect(notifs[0].id).toMatch(/^notif-/);
  });

  it("birden fazla bildirim ardışık eklenebilir", () => {
    useNotificationStore.getState().addNotification({ type: "error", message: "Hata" });
    useNotificationStore.getState().addNotification({ type: "info", message: "Bilgi" });
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
  });

  it("removeNotification belirtilen id'yi çıkarır", () => {
    useNotificationStore.getState().addNotification({ type: "warning", message: "Uyarı" });
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().removeNotification(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("removeNotification bilinmeyen id'de listeyi bozmaz", () => {
    useNotificationStore.getState().addNotification({ type: "success", message: "OK" });
    useNotificationStore.getState().removeNotification("unknown-id");
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it("clearAll tüm bildirimleri temizler", () => {
    useNotificationStore.getState().addNotification({ type: "success", message: "A" });
    useNotificationStore.getState().addNotification({ type: "error", message: "B" });
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("duration=number sonrasında bildirim otomatik silinir", () => {
    useNotificationStore.getState().addNotification({ type: "info", message: "Geçici", duration: 2000 });
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    vi.advanceTimersByTime(2001);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("duration=0 otomatik silmez (sonsuz)", () => {
    useNotificationStore.getState().addNotification({ type: "warning", message: "Kalıcı", duration: 0 });
    vi.advanceTimersByTime(60000);
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });
});
