import { useRef, useState } from "react";
import { FileUp, Upload, X } from "lucide-react";
import { Button, Card, COLORS, RADIUS, TYPOGRAPHY } from "../Shared";

interface PriceUploadFormProps {
  uploading: boolean;
  onUpload: (file: File, supplier: string) => Promise<void>;
}

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".tiff") ||
    name.endsWith(".bmp")
  );
}

export function PriceUploadForm({ uploading, onUpload }: PriceUploadFormProps) {
  const [supplier, setSupplier] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && isSupportedFile(file)) {
      setSelectedFile(file);
      setValidationError(null);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (file && isSupportedFile(file)) {
      setSelectedFile(file);
      setValidationError(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleBrowseClick();
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setValidationError("Lütfen bir dosya seçiniz.");
      return;
    }
    if (!supplier.trim()) {
      setValidationError("Lütfen tedarikçi adını giriniz.");
      // Focus on supplier input if possible, or just show error
      const input = document.getElementById("supplier-input");
      if (input) input.focus();
      return;
    }

    setValidationError(null);

    try {
      await onUpload(selectedFile, supplier.trim());
      setSupplier("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Upload failed in form:", error);
    }
  };

  return (
    <Card title="Fiyat Listesi Yükleme" subtitle="Excel, PDF veya görsel dosyası">
      <div style={{ display: "grid", gap: 12 }}>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png,.tiff,.bmp"
          onChange={handleFileChange}
          aria-hidden="true"
        />

        <div>
          <label
            htmlFor="supplier-input"
            style={{
              display: "block",
              fontSize: 12,
              color: COLORS.muted,
              marginBottom: 6,
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
            }}
          >
            Tedarikçi <span style={{ color: COLORS.error.DEFAULT }}>*</span>
          </label>
          <input
            id="supplier-input"
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Örn: Yıldız MDF, ABC Profil"
            aria-label="Tedarikçi adı"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              fontSize: TYPOGRAPHY.fontSize.sm,
              outline: "none",
            }}
            disabled={uploading}
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={handleBrowseClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          style={{
            border: `1px dashed ${dragOver ? COLORS.primary.DEFAULT : COLORS.border}`,
            borderRadius: RADIUS.lg,
            minHeight: 120,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            padding: 16,
            background: dragOver ? "rgba(59,130,246,0.08)" : COLORS.bg.main,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
            transition: "all 0.2s ease",
          }}
          aria-label="Dosya yüklemek için tıklayın veya sürükleyip bırakın"
        >
          <div>
            <FileUp size={24} color={COLORS.primary.DEFAULT} style={{ margin: "0 auto" }} />
            <div style={{ marginTop: 8, fontSize: 13, color: COLORS.text, fontWeight: 500 }}>
              Dosyayı buraya bırakın veya seçmek için tıklayın
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: COLORS.muted }}>
              Desteklenen: XLSX, XLS, PDF, JPG, PNG
            </div>
          </div>
        </div>

        {selectedFile && (
          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              background: COLORS.bg.main,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
              <FileUp size={14} color={COLORS.muted} />
              <span>{selectedFile.name}</span>
              <span style={{ color: COLORS.muted }}>({Math.max(1, Math.round(selectedFile.size / 1024))} KB)</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label="Seçili dosyayı kaldır"
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: COLORS.muted,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {validationError && (
          <div style={{ fontSize: 13, color: COLORS.error.DEFAULT, fontWeight: 500 }}>
            {validationError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="primary"
            icon={<Upload size={14} />}
            onClick={handleSubmit}
            disabled={uploading} // Only disable when uploading
            loading={uploading}
          >
            {uploading ? "Yükleniyor..." : "Yükle ve İzle"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default PriceUploadForm;
