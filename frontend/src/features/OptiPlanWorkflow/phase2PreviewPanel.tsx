import type { CSSProperties, MutableRefObject } from "react";
import { useMemo } from "react";

import type { WorkflowRecord } from "../../services/optiplanWorkflowService";
import type { ConfidenceField } from "./phase2GridTypes";

type PanState = { x: number; y: number };

type Phase2PreviewPanelProps = {
  activeRecord: WorkflowRecord;
  cardStyle: CSSProperties;
  cardHeaderStyle: CSSProperties;
  cardTitleStyle: CSSProperties;
  zoomBtnStyle: CSSProperties;
  previewViewportRef: MutableRefObject<HTMLDivElement | null>;
  imageRef: MutableRefObject<HTMLImageElement | null>;
  bboxCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  imageZoom: number;
  imagePan: PanState;
  selectedRowId: string | null;
  selectedField: ConfidenceField | null;
  fieldLabel: Record<ConfidenceField, string>;
  imageObjectUrl: string | null;
  imageLoadError: boolean;
  isPanningImage: boolean;
  onApplyImageZoom: (nextZoom: number) => void;
  onSetImagePan: (nextPan: PanState) => void;
  onPreviewWheel: (deltaY: number) => void;
  onBeginImagePan: (clientX: number, clientY: number) => void;
  onImageLoad: () => void;
  onImageLoadError: () => void;
  imageZoomStep: number;
  colorBbox: string;
  sl200: string;
  sl400: string;
  sl700: string;
};

const zoomControlContainerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const zoomPercentStyle: CSSProperties = {
  fontSize: 11,
  minWidth: 44,
  textAlign: "center",
};

const previewViewportBaseStyle: CSSProperties = {
  padding: 12,
  minHeight: 320,
  position: "relative",
  overflow: "hidden",
  background: "#09101d",
};

const imageTransformContainerBaseStyle: CSSProperties = {
  position: "relative",
  transformOrigin: "center center",
};

const imageBaseStyle: CSSProperties = {
  width: "100%",
  height: "auto",
  borderRadius: 3,
  objectFit: "contain",
  maxHeight: 520,
};

const bboxCanvasStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  pointerEvents: "none",
};

const imageFallbackBaseStyle: CSSProperties = {
  minHeight: 180,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 3,
  fontSize: 13,
  padding: 20,
};

const noImageTextStyle: CSSProperties = {
  color: "#666",
  fontSize: 13,
};

export function Phase2PreviewPanel({
  activeRecord,
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  zoomBtnStyle,
  previewViewportRef,
  imageRef,
  bboxCanvasRef,
  imageZoom,
  imagePan,
  selectedRowId,
  selectedField,
  fieldLabel,
  imageObjectUrl,
  imageLoadError,
  isPanningImage,
  onApplyImageZoom,
  onSetImagePan,
  onPreviewWheel,
  onBeginImagePan,
  onImageLoad,
  onImageLoadError,
  imageZoomStep,
  colorBbox,
  sl200,
  sl400,
  sl700,
}: Phase2PreviewPanelProps) {
  const zoomPercentTextStyle = useMemo(
    () => ({
      ...zoomPercentStyle,
      color: sl400,
    }),
    [sl400]
  );

  const zoomInfoStyle = useMemo(
    () => ({
      fontSize: 11,
      fontWeight: 700,
      color: colorBbox,
    } as CSSProperties),
    [colorBbox]
  );

  const defaultInfoStyle = useMemo(
    () => ({
      fontSize: 11,
      color: sl400,
    } as CSSProperties),
    [sl400]
  );

  const panContainerStyle = useMemo(
    () => ({
      cursor: imageZoom > 1 ? "grab" : "default",
      userSelect: "none" as const,
      width: "100%",
    } as CSSProperties),
    [imageZoom]
  );

  const imageTransformStyle = useMemo(
    () => ({
      ...imageTransformContainerBaseStyle,
      transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
      transition: isPanningImage ? "none" : "transform .12s ease-out",
    } as CSSProperties),
    [imagePan.x, imagePan.y, imageZoom, isPanningImage]
  );

  const imageDisplayStyle = useMemo(
    () => ({
      ...imageBaseStyle,
      display: imageLoadError ? "none" : "block",
    } as CSSProperties),
    [imageLoadError]
  );

  const imageFallbackStyle = useMemo(
    () => ({
      ...imageFallbackBaseStyle,
      border: `1px dashed ${sl700}`,
      color: sl400,
    } as CSSProperties),
    [sl700, sl400]
  );

  return (
    <section style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={cardTitleStyle}>Orijinal Görsel</span>
        <div style={zoomControlContainerStyle}>
          <button
            type="button"
            aria-label="Görseli küçült"
            title="Zoom out"
            onClick={() => onApplyImageZoom(imageZoom - imageZoomStep)}
            style={zoomBtnStyle}
          >
            −
          </button>
          <span style={zoomPercentTextStyle}>
            %{Math.round(imageZoom * 100)}
          </span>
          <button
            type="button"
            aria-label="Görseli büyüt"
            title="Zoom in"
            onClick={() => onApplyImageZoom(imageZoom + imageZoomStep)}
            style={zoomBtnStyle}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Görsel görünümünü sıfırla"
            title="1:1"
            onClick={() => {
              onSetImagePan({ x: 0, y: 0 });
              onApplyImageZoom(1);
            }}
            style={zoomBtnStyle}
          >
            1:1
          </button>
          {selectedRowId ? (
            <span style={zoomInfoStyle}>
              {selectedField ? `Odak: ${fieldLabel[selectedField]} — bbox sarı` : "Satır seçili — bbox sarı"}
            </span>
          ) : (
            <span style={defaultInfoStyle}>
              Satıra tıklayın — OCR alanları gösterilir
            </span>
          )}
        </div>
      </div>

      <div
        ref={previewViewportRef}
        style={previewViewportBaseStyle}
      >
        {activeRecord.imageUrl ? (
          <div
            onWheel={(e) => {
              e.preventDefault();
              onPreviewWheel(e.deltaY);
            }}
            onPointerDown={(e) => {
              onBeginImagePan(e.clientX, e.clientY);
            }}
            style={panContainerStyle}
          >
            <div style={imageTransformStyle}>
              <img
                ref={imageRef}
                src={imageObjectUrl ?? undefined}
                alt={`OCR görseli: ${activeRecord.hamDosyaAdi}`}
                style={imageDisplayStyle}
                onLoad={onImageLoad}
                onError={onImageLoadError}
              />
              {!imageLoadError ? (
                <canvas
                  ref={bboxCanvasRef}
                  aria-hidden="true"
                  style={bboxCanvasStyle}
                />
              ) : null}
            </div>
            {imageLoadError ? (
              <div
                role="img"
                aria-label="Görsel yüklenemedi"
                style={imageFallbackStyle}
              >
                <span style={{ fontSize: 20, fontWeight: 700, color: sl200 }}>IMG</span>
                <span>Görsel yüklenemedi</span>
                <span style={{ fontSize: 11, color: sl400, wordBreak: "break-all", textAlign: "center", maxWidth: 220 }}>
                  {activeRecord.imageUrl}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={noImageTextStyle}>Görsel mevcut değil</div>
        )}
      </div>
    </section>
  );
}
