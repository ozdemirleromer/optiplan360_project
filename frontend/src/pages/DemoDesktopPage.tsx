import React, { useEffect, useState } from "react";
import { HorizontalLayout } from "../components/Layout/HorizontalLayout";

/**
 * Standalone demo page for horizontal desktop UI
 * No store dependencies, no theme system
 */
export const DemoDesktopPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log("🚀 DemoDesktopPage mounted");
      setMounted(true);
    } catch (e) {
      console.error("Error:", e);
      setError(String(e));
    }
  }, []);

  if (error) {
    return (
      <div style={{
        padding: "40px",
        fontFamily: "monospace",
        color: "red",
        fontSize: "14px",
        lineHeight: "1.6",
        minHeight: "100vh",
        backgroundColor: "#f0f0f0"
      }}>
        <h1>⚠️ Rendering Error</h1>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div 
      style={{ 
        width: "100%", 
        height: "100vh", 
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#F0F0F0"
      }}
    >
      {/* Fallback header if HorizontalLayout doesn't render */}
      <div style={{
        padding: "12px 20px",
        backgroundColor: "#0078D4",
        color: "white",
        fontSize: "14px",
        fontFamily: "Segoe UI, sans-serif",
        fontWeight: "600"
      }}>
        OptiPlan 360 - Vektörel Desktop UI
      </div>
      
      {/* Main layout */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {mounted && <HorizontalLayout />}
      </div>
    </div>
  );
};
