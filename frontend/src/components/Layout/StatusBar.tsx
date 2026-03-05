import React from "react";
import "./statusBar.css";

export interface StatusBarData {
  xCoord?: number;
  yCoord?: number;
  serverStatus?: "BAĞLI" | "BAĞLANTIYI KAYBETTI";
  activeUser?: string;
  softwareVersion?: string;
}

interface StatusBarProps {
  data: StatusBarData;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  data = {
    xCoord: 0,
    yCoord: 0,
    serverStatus: "BAĞLI",
    activeUser: "ADMIN",
    softwareVersion: "v3.1.2",
  },
}) => {
  const isServerOnline = data.serverStatus === "BAĞLI";

  return (
    <div className="status-bar">
      <div className="status-section">
        <span className="status-label">SUNUCU:</span>
        <span className={`status-value ${isServerOnline ? "online" : "offline"}`}>
          {data.serverStatus || "BAĞLI"}
        </span>
      </div>

      <div className="status-divider" />

      <div className="status-section">
        <span className="status-label">KULLANICI:</span>
        <span className="status-value">{data.activeUser || "—"}</span>
      </div>

      <div className="status-divider" />

      <div className="status-section">
        <span className="status-label">VERSİON:</span>
        <span className="status-value">{data.softwareVersion || "—"}</span>
      </div>

      <div className="status-spacer" />
    </div>
  );
};
