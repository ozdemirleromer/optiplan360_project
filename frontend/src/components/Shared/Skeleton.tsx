import { CSSProperties } from "react";
import { COLORS, RADIUS } from "./constants";

// Skeleton Pulse Animation Style
const skeletonPulseStyle: CSSProperties = {
  background: `linear-gradient(
    90deg,
    ${COLORS.bg.main} 25%,
    ${COLORS.bg.surface} 50%,
    ${COLORS.bg.main} 75%
  )`,
  backgroundSize: "200% 100%",
  animation: "skeleton-pulse 1.5s ease-in-out infinite",
  borderRadius: RADIUS.md,
};

// Skeleton Card Component
interface SkeletonCardProps {
  height?: number;
  width?: string | number;
  className?: string;
}

export const SkeletonCard = ({ height = 120, width = "100%", className }: SkeletonCardProps) => {
  return (
    <div
      className={`skeleton-card ${className || ""}`}
      style={{
        height,
        width,
        ...skeletonPulseStyle,
        border: `1px solid ${COLORS.border}`,
        padding: 16,
      }}
    />
  );
};

// Skeleton Text Component
interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  width?: string | string[];
  className?: string;
}

export const SkeletonText = ({ lines = 3, lineHeight = 16, width = "100%", className }: SkeletonTextProps) => {
  const widths = Array.isArray(width) ? width : Array(lines).fill(width);
  
  return (
    <div className={`skeleton-text ${className || ""}`} style={{ display: "grid", gap: 8 }}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          style={{
            height: lineHeight,
            width: widths[index] || widths[widths.length - 1] || "100%",
            ...skeletonPulseStyle,
            borderRadius: RADIUS.sm,
          }}
        />
      ))}
    </div>
  );
};

// Skeleton Circle Component (for avatars, icons)
interface SkeletonCircleProps {
  size?: number;
  className?: string;
}

export const SkeletonCircle = ({ size = 40, className }: SkeletonCircleProps) => {
  return (
    <div
      className={`skeleton-circle ${className || ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        ...skeletonPulseStyle,
        border: `1px solid ${COLORS.border}`,
      }}
    />
  );
};

// Skeleton Row Component (for table rows)
interface SkeletonRowProps {
  columns?: number;
  height?: number;
  className?: string;
}

export const SkeletonRow = ({ columns = 4, height = 48, className }: SkeletonRowProps) => {
  return (
    <div
      className={`skeleton-row ${className || ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 12,
        height,
        alignItems: "center",
        padding: "0 16px",
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 16,
            width: index === 0 ? "80%" : index === columns - 1 ? "60%" : "100%",
            ...skeletonPulseStyle,
          }}
        />
      ))}
    </div>
  );
};

// Skeleton KPI Card
interface SkeletonKPICardProps {
  className?: string;
}

export const SkeletonKPICard = ({ className }: SkeletonKPICardProps) => {
  return (
    <div
      className={`skeleton-kpi-card ${className || ""}`}
      style={{
        padding: 20,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.bg.surface,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <SkeletonCircle size={36} />
        <SkeletonText lines={1} width="60%" lineHeight={14} />
      </div>
      <SkeletonText lines={1} width="40%" lineHeight={32} />
      <div style={{ marginTop: 12 }}>
        <SkeletonText lines={1} width="80%" lineHeight={12} />
      </div>
    </div>
  );
};

// Full Page Skeleton Loader
interface SkeletonPageProps {
  kpiCount?: number;
  rowCount?: number;
  className?: string;
}

export const SkeletonPage = ({ kpiCount = 4, rowCount = 5, className }: SkeletonPageProps) => {
  return (
    <div className={`skeleton-page ${className || ""}`} style={{ padding: 24 }}>
      {/* Header Skeleton */}
      <div style={{ marginBottom: 24 }}>
        <SkeletonText lines={2} width={["40%", "60%"]} lineHeight={24} />
      </div>

      {/* KPI Cards Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: kpiCount }).map((_, index) => (
          <SkeletonKPICard key={index} />
        ))}
      </div>

      {/* Table Skeleton */}
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
          background: COLORS.bg.surface,
        }}
      >
        {/* Table Header */}
        <div
          style={{
            height: 48,
            background: `${COLORS.bg.main}`,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            alignItems: "center",
            padding: "0 16px",
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: 14,
                width: index === 0 ? "80%" : "60%",
                ...skeletonPulseStyle,
              }}
            />
          ))}
        </div>
        
        {/* Table Rows */}
        {Array.from({ length: rowCount }).map((_, index) => (
          <SkeletonRow key={index} columns={4} />
        ))}
      </div>
    </div>
  );
};

// Export all skeleton components
export default {
  Card: SkeletonCard,
  Text: SkeletonText,
  Circle: SkeletonCircle,
  Row: SkeletonRow,
  KPICard: SkeletonKPICard,
  Page: SkeletonPage,
};
