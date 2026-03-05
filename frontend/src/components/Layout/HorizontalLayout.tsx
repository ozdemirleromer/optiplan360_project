import React, { useState } from "react";
import { RibbonBar, type RibbonTab } from "./RibbonBar";
import { MetaDataEntry, type MetaDataValues } from "./MetaDataEntry";
import { EngineeringGrid, type GridRow } from "./EngineeringGrid";
import { StatusBar, type StatusBarData } from "./StatusBar";
import "./layout.css";

interface LayoutProps {
  children?: React.ReactNode;
}

/**
 * Standalone horizontal desktop UI demo
 * With 4-strip vektörel layout: Ribbon (100px) | MetaData (70px) | Grid (flex) | Status (30px)
 */
export const HorizontalLayout: React.FC<LayoutProps> = () => {
  try {
    const [activeTab, setActiveTab] = useState<RibbonTab>("DOSYA");
  const [metaData, setMetaData] = useState<MetaDataValues>({
    customerCode: "",
    businessName: "",
    taxNo: "",
    address: "",
  });

  const [gridRows, setGridRows] = useState<GridRow[]>([
    {
      id: 1,
      name: "Panel A1",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 20,
      material: "Panel",
      edges: "",
    },
    {
      id: 2,
      name: "Panel Karapan",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 20,
      material: "Panel",
      edges: "",
    },
    {
      id: 3,
      name: "Panel 1",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 30,
      material: "Panel",
      edges: "TBL",
    },
    {
      id: 4,
      name: "Panel 2",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 30,
      material: "Panel",
      edges: "TBRL",
    },
    {
      id: 5,
      name: "Panel AZ",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 20,
      material: "Panel",
      edges: "",
    },
    {
      id: 6,
      name: "Panel A4",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 20,
      material: "Panel",
      edges: "",
    },
    {
      id: 7,
      name: "Panel B1",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 20,
      material: "Panel",
      edges: "",
    },
    {
      id: 8,
      name: "Panel B1",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 10,
      material: "Panel",
      edges: "",
      hasError: true,
      errorMessage: "Ölçü hatası",
    },
    {
      id: 9,
      name: "Panel B1",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 20,
      material: "Panel",
      edges: "",
    },
    {
      id: 10,
      name: "Panel A2",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 10,
      material: "Panel",
      edges: "",
    },
    {
      id: 11,
      name: "Panel A2",
      length: 2200.0,
      width: 600.0,
      height: 18.0,
      quantity: 10,
      material: "Panel",
      edges: "",
    },
    {
      id: 12,
      name: "Total",
      length: 2200.0,
      width: 600.0,
      quantity: 2,
      material: "Panel",
      edges: "",
    },
  ]);

  const [selectedRowId, setSelectedRowId] = useState<number | undefined>(3);
  
  const [statusData, setStatusData] = useState<StatusBarData>({
    xCoord: 145.22,
    yCoord: 890.75,
    serverStatus: "BAĞLI",
    activeUser: "ADMIN",
    softwareVersion: "v3.1.2",
  });

  const handleRibbonAction = (action: string) => {
    console.log("Ribbon action:", action);
  };

  const handleGridRowChange = (rowId: number, data: Partial<GridRow>) => {
    setGridRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, ...data } : row))
    );
  };

  return (
    <div className="horizontal-layout">
      {/* Ribbon (100px) */}
      <RibbonBar activeTab={activeTab} onTabChange={setActiveTab} onAction={handleRibbonAction} />

      {/* MetaData Entry (70px) */}
      <MetaDataEntry values={metaData} onChange={setMetaData} />

      {/* Engineering Grid (flex, expands) */}
      <EngineeringGrid
        rows={gridRows}
        onRowChange={handleGridRowChange}
        onRowSelect={setSelectedRowId}
        selectedRowId={selectedRowId}
      />

      {/* Status Bar (30px) */}
      <StatusBar data={statusData} />
    </div>
  );
  } catch (error) {
    console.error("HorizontalLayout error:", error);
    return (
      <div style={{ padding: "20px", color: "red", fontFamily: "monospace" }}>
        <h2>Layout Error</h2>
        <pre>{String(error)}</pre>
      </div>
    );
  }
};
