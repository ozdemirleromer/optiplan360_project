import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

type PanState = { x: number; y: number };

type UsePhase2PreviewStateParams = {
  activeUuid: string | null;
  splitMin: number;
  splitMax: number;
  imageZoomMin: number;
  imageZoomMax: number;
  imageZoomStep: number;
  narrowBreakpoint: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function usePhase2PreviewState({
  activeUuid,
  splitMin,
  splitMax,
  imageZoomMin,
  imageZoomMax,
  imageZoomStep,
  narrowBreakpoint,
}: UsePhase2PreviewStateParams) {
  const [leftPanelRatio, setLeftPanelRatio] = useState(50);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1440));
  const [imageZoom, setImageZoom] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("phase2_image_zoom");
      return saved ? Number(saved) : 1;
    }
    return 1;
  });
  const [imagePan, setImagePan] = useState<PanState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("phase2_image_pan");
      return saved ? JSON.parse(saved) as PanState : { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  });
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const bboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const splitWrapRef = useRef<HTMLDivElement | null>(null);
  const isResizingSplitRef = useRef(false);
  const isPanningImageRef = useRef(false);
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 });

  const isNarrowViewport = viewportWidth < narrowBreakpoint;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const target = previewViewportRef.current;
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsPreviewVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPreviewVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.05 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeUuid]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("phase2_image_zoom", String(imageZoom));
    }
  }, [imageZoom]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("phase2_image_pan", JSON.stringify(imagePan));
    }
  }, [imagePan]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (isResizingSplitRef.current && !isNarrowViewport) {
        const wrap = splitWrapRef.current;
        if (!wrap) return;

        const rect = wrap.getBoundingClientRect();
        if (rect.width <= 0) return;

        setLeftPanelRatio(clamp(((event.clientX - rect.left) / rect.width) * 100, splitMin, splitMax));
      }

      if (isPanningImageRef.current && imageZoom > 1) {
        setImagePan({
          x: panStartRef.current.originX + (event.clientX - panStartRef.current.pointerX),
          y: panStartRef.current.originY + (event.clientY - panStartRef.current.pointerY),
        });
      }
    };

    const onPointerUp = () => {
      isResizingSplitRef.current = false;
      isPanningImageRef.current = false;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [imageZoom, isNarrowViewport, splitMin, splitMax]);

  const handleSplitKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isNarrowViewport) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setLeftPanelRatio((prev) => clamp(prev - 2, splitMin, splitMax));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setLeftPanelRatio((prev) => clamp(prev + 2, splitMin, splitMax));
    }
  }, [isNarrowViewport, splitMin, splitMax]);

  const applyImageZoom = useCallback((nextZoom: number) => {
    const safe = clamp(nextZoom, imageZoomMin, imageZoomMax);
    setImageZoom(safe);
    if (safe <= 1) {
      setImagePan({ x: 0, y: 0 });
    }
  }, [imageZoomMax, imageZoomMin]);

  const handlePreviewWheel = useCallback((deltaY: number) => {
    applyImageZoom(imageZoom + (deltaY < 0 ? imageZoomStep : -imageZoomStep));
  }, [applyImageZoom, imageZoom, imageZoomStep]);

  const beginImagePan = useCallback((clientX: number, clientY: number) => {
    if (imageZoom <= 1) return;
    isPanningImageRef.current = true;
    panStartRef.current = {
      pointerX: clientX,
      pointerY: clientY,
      originX: imagePan.x,
      originY: imagePan.y,
    };
  }, [imagePan.x, imagePan.y, imageZoom]);

  const beginSplitResize = useCallback(() => {
    if (isNarrowViewport) return;
    isResizingSplitRef.current = true;
  }, [isNarrowViewport]);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    const canvas = bboxCanvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
  }, []);

  const resetPreviewState = useCallback(() => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
  }, []);

  return {
    leftPanelRatio,
    isNarrowViewport,
    imageZoom,
    imagePan,
    isPreviewVisible,
    imageRef,
    bboxCanvasRef,
    previewViewportRef,
    splitWrapRef,
    isPanningImageRef,
    setImageZoom,
    setImagePan,
    handleSplitKeyDown,
    applyImageZoom,
    handlePreviewWheel,
    beginImagePan,
    beginSplitResize,
    handleImageLoad,
    resetPreviewState,
  };
}
