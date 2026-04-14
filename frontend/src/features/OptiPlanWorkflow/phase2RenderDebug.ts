export type Phase2RenderDebugWindow = Window & {
  __PHASE2_RENDER_DEBUG__?: boolean;
  __PHASE2_RENDER_DEBUG_EVERY__?: number;
  __PHASE2_RENDER_METRICS__?: Record<string, number>;
  __PHASE2_RENDER_FIELD_METRICS__?: Record<string, number>;
  __PHASE2_RESET_RENDER_METRICS__?: () => void;
  __PHASE2_GET_RENDER_METRICS__?: () => {
    rows: Record<string, number>;
    fields: Record<string, number>;
  };
};

export function ensurePhase2RenderDebugHelpers(debugWindow: Phase2RenderDebugWindow): void {
  debugWindow.__PHASE2_RENDER_METRICS__ ??= {};
  debugWindow.__PHASE2_RENDER_FIELD_METRICS__ ??= {};

  if (!debugWindow.__PHASE2_RESET_RENDER_METRICS__) {
    debugWindow.__PHASE2_RESET_RENDER_METRICS__ = () => {
      debugWindow.__PHASE2_RENDER_METRICS__ = {};
      debugWindow.__PHASE2_RENDER_FIELD_METRICS__ = {};
    };
  }

  if (!debugWindow.__PHASE2_GET_RENDER_METRICS__) {
    debugWindow.__PHASE2_GET_RENDER_METRICS__ = () => ({
      rows: { ...(debugWindow.__PHASE2_RENDER_METRICS__ ?? {}) },
      fields: { ...(debugWindow.__PHASE2_RENDER_FIELD_METRICS__ ?? {}) },
    });
  }
}
