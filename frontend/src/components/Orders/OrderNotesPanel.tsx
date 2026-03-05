/**
 * OrderNotesPanel — Sipariş notları paneli
 * Notları listeler, yeni not eklenmesini ve kendi notunun silinmesini sağlar.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import type { OrderNote } from "../../types";
import { ordersService } from "../../services/ordersService";
import { useAuthStore } from "../../stores/authStore";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------
const MAX_NOTE_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Yardımcı: tarih formatla
// ---------------------------------------------------------------------------
function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface OrderNotesPanelProps {
  orderId: string;
  /** Panel dışarıda bir modal/drawer içinde gösteriliyorsa kapatma callback'i */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Bileşen
// ---------------------------------------------------------------------------
export function OrderNotesPanel({ orderId, onClose }: OrderNotesPanelProps) {
  const { user } = useAuthStore();
  const currentUserId = user ? Number((user as { id?: unknown }).id ?? 0) : 0;
  const isAdmin = user ? ((user as { role?: string }).role ?? "").toUpperCase() === "ADMIN" : false;

  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Notları yükle
  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ordersService.getNotes(orderId);
      setNotes(data);
    } catch {
      setError("Notlar yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // Not ekle
  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setSubmitLoading(true);
    setError(null);
    try {
      const created = await ordersService.addNote(orderId, text);
      setNotes((prev) => [created, ...prev]);
      setNewText("");
    } catch {
      setError("Not eklenirken hata oluştu.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Not sil
  const handleDelete = async (noteId: number) => {
    setDeleteId(noteId);
    setError(null);
    try {
      await ordersService.deleteNote(orderId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      setError("Not silinirken hata oluştu.");
    } finally {
      setDeleteId(null);
    }
  };

  // Textarea — Ctrl+Enter ile kaydet
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleAdd();
    }
  };

  // ESC ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      aria-label="Sipariş Notları"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 320,
        gap: 12,
      }}
    >
      {/* Başlık */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <MessageSquare size={18} aria-hidden="true" />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Notlar</h3>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Notlar panelini kapat"
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Hata mesajı */}
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: "#fff0f0",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Not ekleme formu */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor={`note-input-${orderId}`}
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          Yeni not ekle
        </label>
        <textarea
          id={`note-input-${orderId}`}
          ref={textareaRef}
          value={newText}
          onChange={(e) => setNewText(e.target.value.slice(0, MAX_NOTE_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Not metnini yazın… (Ctrl+Enter ile kaydedin)"
          aria-describedby={`note-char-${orderId}`}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 13,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div
          id={`note-char-${orderId}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {newText.length} / {MAX_NOTE_LENGTH}
          </span>
          <button
            onClick={() => void handleAdd()}
            disabled={submitLoading || !newText.trim()}
            aria-label="Notu kaydet"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 14px",
              minHeight: 44,
              borderRadius: 6,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              cursor: submitLoading || !newText.trim() ? "not-allowed" : "pointer",
              opacity: submitLoading || !newText.trim() ? 0.6 : 1,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {submitLoading ? (
              <Loader2 size={15} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Plus size={15} aria-hidden="true" />
            )}
            Kaydet
          </button>
        </div>
      </div>

      {/* Not listesi */}
      <div
        role="list"
        aria-label="Not listesi"
        style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#6b7280",
              fontSize: 13,
            }}
          >
            <Loader2 size={16} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
            Yükleniyor…
          </div>
        ) : notes.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
            Henüz not eklenmedi.
          </p>
        ) : (
          notes.map((note) => {
            const canDelete = isAdmin || note.userId === currentUserId;
            return (
              <div
                key={note.id}
                role="listitem"
                style={{
                  padding: "10px 12px",
                  background: "#f9fafb",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 6px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {note.noteText}
                    </p>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>
                      {note.createdByUsername
                        ? `${note.createdByUsername} — `
                        : ""}
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => void handleDelete(note.id)}
                      disabled={deleteId === note.id}
                      aria-label="Notu sil"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: deleteId === note.id ? "not-allowed" : "pointer",
                        color: "#ef4444",
                        minWidth: 44,
                        minHeight: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 6,
                        flexShrink: 0,
                        opacity: deleteId === note.id ? 0.5 : 1,
                      }}
                    >
                      {deleteId === note.id ? (
                        <Loader2 size={15} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
                      ) : (
                        <Trash2 size={15} aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CSS animasyonu */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

export default OrderNotesPanel;
