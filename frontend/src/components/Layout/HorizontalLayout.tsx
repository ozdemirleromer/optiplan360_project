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
 * With 4-strip vektorel layout: Ribbon (100px) | MetaData (70px) | Grid (flex) | Status (30px)
 */
export const HorizontalLayout: React.FC<LayoutProps> = () => {
  const [activeTab, setActiveTab] = useState<RibbonTab>("DOSYA");
  const [metaData, setMetaData] = useState<MetaDataValues>({
    customerCode: "",
    businessName: "",
    taxNo: "",
    address: "",
  });

  const [gridRows, setGridRows] = useState<GridRow[]>([
    { id: 1, name: "Panel A1", length: 2200.0, width: 600.0, height: 18.0, quantity: 20, material: "Panel", edges: "" },
    { id: 2, name: "Panel Karapan", length: 2200.0, width: 600.0, height: 18.0, quantity: 20, material: "Panel", edges: "" },
    { id: 3, name: "Panel 1", length: 2200.0, width: 600.0, height: 18.0, quantity: 30, material: "Panel", edges: "TBL" },
    { id: 4, name: "Panel 2", length: 2200.0, width: 600.0, height: 18.0, quantity: 30, material: "Panel", edges: "TBRL" },
    { id: 5, name: "Panel AZ", length: 2200.0, width: 600.0, height: 18.0, quantity: 20, material: "Panel", edges: "" },
    { id: 6, name: "Panel A4", length: 2200.0, width: 600.0, height: 18.0, quantity: 20, material: "Panel", edges: "" },
    { id: 7, name: "Panel B1", length: 2200.0, width: 600.0, height: 18.0, quantity: 20, material: "Panel", edges: "" },
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
      errorMessage: "Olcu hatasi",
    },
    { id: 9, name: "Panel B1", length: 2200.0, width: 600.0, height: 18.0, quantity: 20, material: "Panel", edges: "" },
    { id: 10, name: "Panel A2", length: 2200.0, width: 600.0, height: 18.0, quantity: 10, material: "Panel", edges: "" },
    { id: 11, name: "Panel A2", length: 2200.0, width: 600.0, height: 18.0, quantity: 10, material: "Panel", edges: "" },
    { id: 12, name: "Total", length: 2200.0, width: 600.0, quantity: 2, material: "Panel", edges: "" },
  ]);

  const [selectedRowId, setSelectedRowId] = useState<number | undefined>(3);

  const [statusData] = useState<StatusBarData>({
    xCoord: 145.22,
    yCoord: 890.75,
    serverStatus: "BAGLI",
    activeUser: "ADMIN",
    softwareVersion: "v3.1.2",
  });

  const handleRibbonAction = (_action: string) => {
    // Placeholder for future ribbon actions.
  };

  const handleGridRowChange = (rowId: number, data: Partial<GridRow>) => {
    setGridRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...data } : row)));
  };

  return (
    <div className="horizontal-layout">
      <RibbonBar activeTab={activeTab} onTabChange={setActiveTab} onAction={handleRibbonAction} />
      <MetaDataEntry values={metaData} onChange={setMetaData} />
      <EngineeringGrid rows={gridRows} onRowChange={handleGridRowChange} onRowSelect={setSelectedRowId} selectedRowId={selectedRowId} />
      <StatusBar data={statusData} />
    </div>
  );
};
