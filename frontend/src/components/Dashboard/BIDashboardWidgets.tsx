/**
 * BI Dashboard Widgets
 * Sürüklenebilir widget'lar ile gelişmiş dashboard
 */

// React hooks removed — not used in this module
import { 
  TrendingUp, TrendingDown, Activity,
  ArrowUpRight, ArrowDownRight, Clock, Target, Zap,
} from 'lucide-react';
import { COLORS, RADIUS } from '../Shared/constants';

// ============================================
// 1. CAPACITY GAUGE WIDGET
// ============================================
interface GaugeWidgetProps {
  value: number; // 0-100
  label: string;
  subtitle?: string;
}

export const CapacityGauge = ({ value, label, subtitle }: GaugeWidgetProps) => {
  const color = value < 70 ? COLORS.success.DEFAULT : value < 90 ? COLORS.warning.DEFAULT : COLORS.danger.DEFAULT;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div style={{
      padding: 20,
      borderRadius: RADIUS.lg,
      border: `1px solid ${COLORS.border}`,
      background: COLORS.bg.surface,
      textAlign: 'center',
    }}>
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 12px' }}>
        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="45" fill="none" stroke={`${COLORS.border}`} strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}%</span>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{label}</div>
      {subtitle && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
};

// ============================================
// 2. MINI CHART WIDGET (7 Gün Trend)
// ============================================
interface MiniChartProps {
  data: number[];
  labels?: string[];
  title: string;
  currentValue: number;
  previousValue: number;
  unit?: string;
}

export const MiniChart = ({ data, labels, title, currentValue, previousValue, unit = '' }: MiniChartProps) => {
  const max = Math.max(...data, 1);
  const trend = currentValue - previousValue;
  const trendPercent = previousValue > 0 ? ((trend / previousValue) * 100).toFixed(1) : '0';
  const isUp = trend >= 0;

  return (
    <div style={{
      padding: 20,
      borderRadius: RADIUS.lg,
      border: `1px solid ${COLORS.border}`,
      background: COLORS.bg.surface,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>
            {currentValue}{unit}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 12,
          background: isUp ? `${COLORS.success.DEFAULT}15` : `${COLORS.danger.DEFAULT}15`,
          color: isUp ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT,
          fontSize: 12, fontWeight: 600,
        }}>
          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trendPercent}%
        </div>
      </div>

      {/* Bar Chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
        {data.map((val, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%',
              height: `${(val / max) * 50}px`,
              minHeight: 4,
              borderRadius: 4,
              background: i === data.length - 1
                ? COLORS.primary.DEFAULT
                : `${COLORS.primary.DEFAULT}40`,
              transition: 'height 0.5s ease',
            }} />
            {labels && <span style={{ fontSize: 9, color: COLORS.muted }}>{labels[i]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// 3. AI INSIGHTS WIDGET
// ============================================
interface InsightItem {
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: string;
}

interface AIInsightsProps {
  insights: InsightItem[];
}

export const AIInsights = ({ insights }: AIInsightsProps) => {
  const iconMap = {
    warning: <Zap size={16} style={{ color: COLORS.warning.DEFAULT }} />,
    info: <Target size={16} style={{ color: COLORS.info.DEFAULT }} />,
    success: <TrendingUp size={16} style={{ color: COLORS.success.DEFAULT }} />,
  };

  const bgMap = {
    warning: `${COLORS.warning.DEFAULT}10`,
    info: `${COLORS.info.DEFAULT}10`,
    success: `${COLORS.success.DEFAULT}10`,
  };

  return (
    <div style={{
      padding: 20,
      borderRadius: RADIUS.lg,
      border: `1px solid ${COLORS.border}`,
      background: COLORS.bg.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Zap size={18} style={{ color: COLORS.primary.DEFAULT }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>AI Öneriler</span>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
          background: `${COLORS.primary.DEFAULT}20`, color: COLORS.primary.DEFAULT,
        }}>
          {insights.length} yeni
        </span>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {insights.map((insight, i) => (
          <div key={i} style={{
            padding: 12,
            borderRadius: RADIUS.md,
            background: bgMap[insight.type],
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ marginTop: 2, flexShrink: 0 }}>{iconMap[insight.type]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{insight.title}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, lineHeight: 1.5 }}>{insight.description}</div>
                {insight.action && (
                  <button style={{
                    marginTop: 8, padding: '4px 10px', borderRadius: 6,
                    background: `${COLORS.primary.DEFAULT}15`, border: `1px solid ${COLORS.primary.DEFAULT}30`,
                    color: COLORS.primary.DEFAULT, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {insight.action}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// 4. STATION STATUS GRID
// ============================================
interface StationInfo {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'idle';
  uptime?: string;
  currentJob?: string;
}

interface StationGridProps {
  stations: StationInfo[];
}

export const StationGrid = ({ stations }: StationGridProps) => {
  const statusColors = {
    online: COLORS.success.DEFAULT,
    offline: COLORS.danger.DEFAULT,
    warning: COLORS.warning.DEFAULT,
    idle: COLORS.gray[400],
  };

  const statusLabels = {
    online: 'Aktif',
    offline: 'Kapalı',
    warning: 'Uyarı',
    idle: 'Boşta',
  };

  return (
    <div style={{
      padding: 20,
      borderRadius: RADIUS.lg,
      border: `1px solid ${COLORS.border}`,
      background: COLORS.bg.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Activity size={18} style={{ color: COLORS.primary.DEFAULT }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>İstasyon Durumları</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {stations.map((station) => (
          <div key={station.id} style={{
            padding: 12,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg.main,
            textAlign: 'center',
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: statusColors[station.status],
              margin: '0 auto 8px',
              boxShadow: `0 0 8px ${statusColors[station.status]}60`,
              animation: station.status === 'online' ? 'pulse 2s infinite' : 'none',
            }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{station.name}</div>
            <div style={{ fontSize: 11, color: statusColors[station.status], marginTop: 4, fontWeight: 500 }}>
              {statusLabels[station.status]}
            </div>
            {station.uptime && (
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>{station.uptime}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// 5. CAPACITY TIMELINE WIDGET
// ============================================
interface TimeSlot {
  slot: string;
  demand: number;
  capacity: number;
  utilization: string;
  risk: 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik';
}

interface CapacityTimelineProps {
  slots: TimeSlot[];
}

export const CapacityTimeline = ({ slots }: CapacityTimelineProps) => {
  const riskColors = {
    'Düşük': COLORS.success.DEFAULT,
    'Orta': COLORS.warning.DEFAULT,
    'Yüksek': COLORS.danger.DEFAULT,
    'Kritik': '#dc2626',
  };

  return (
    <div style={{
      padding: 20,
      borderRadius: RADIUS.lg,
      border: `1px solid ${COLORS.border}`,
      background: COLORS.bg.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Clock size={18} style={{ color: COLORS.primary.DEFAULT }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>Kapasite Planı</span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {slots.map((slot, i) => {
          const utilNum = parseInt(slot.utilization);
          const barWidth = Math.min(utilNum, 120);

          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 60px 60px',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              borderBottom: i < slots.length - 1 ? `1px solid ${COLORS.border}` : 'none',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.text }}>{slot.slot}</div>

              <div style={{ position: 'relative', height: 20, borderRadius: 4, background: `${COLORS.bg.main}`, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(barWidth, 100)}%`,
                  borderRadius: 4,
                  background: riskColors[slot.risk],
                  opacity: 0.7,
                  transition: 'width 0.5s ease',
                }} />
                {utilNum > 100 && (
                  <div style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 9, fontWeight: 700, color: 'white',
                  }}>
                    AŞIM!
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, textAlign: 'right' }}>
                {slot.utilization}
              </div>

              <div style={{
                fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 8, textAlign: 'center',
                background: `${riskColors[slot.risk]}15`,
                color: riskColors[slot.risk],
              }}>
                {slot.risk}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// 6. QUICK STATS ROW
// ============================================
interface QuickStat {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

interface QuickStatsProps {
  stats: QuickStat[];
}

export const QuickStats = ({ stats }: QuickStatsProps) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`,
      gap: 12,
    }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          padding: 16,
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.bg.surface,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </div>
            {stat.trend && (
              <div style={{
                color: stat.trend === 'up' ? COLORS.success.DEFAULT : stat.trend === 'down' ? COLORS.danger.DEFAULT : COLORS.muted,
              }}>
                {stat.trend === 'up' ? <TrendingUp size={14} /> : stat.trend === 'down' ? <TrendingDown size={14} /> : <Activity size={14} />}
              </div>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, marginTop: 8 }}>
            {stat.value}
          </div>
          {stat.trendValue && (
            <div style={{
              fontSize: 11, marginTop: 4,
              color: stat.trend === 'up' ? COLORS.success.DEFAULT : stat.trend === 'down' ? COLORS.danger.DEFAULT : COLORS.muted,
            }}>
              {stat.trendValue}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default {
  CapacityGauge,
  MiniChart,
  AIInsights,
  StationGrid,
  CapacityTimeline,
  QuickStats,
};
