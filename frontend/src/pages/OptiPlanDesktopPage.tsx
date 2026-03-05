/**
 * OptiPlan Desktop UI - Vektörel Tasarım Implementasyonu
 * 4 ana blok (Strip) düzeni: Ribbon (100px) | MetaData (70px) | Grid (flex) | Status (30px)
 */
import React from "react";
import { HorizontalLayout } from "../components/Layout/HorizontalLayout";

export const OptiPlanDesktopPage: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <HorizontalLayout />
    </div>
  );
};
