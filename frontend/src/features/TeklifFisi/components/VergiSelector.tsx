import React from 'react';
import type { VergiOrani } from '../types/teklif.types';

interface Props {
  value: VergiOrani;
  onChange: (value: VergiOrani) => void;
  disabled?: boolean;
}

export const VergiSelector: React.FC<Props> = ({ value, onChange, disabled = false }) => {
  // Vergi renkleri - chip/dot sistemi
  const getVergiStyles = (orani: VergiOrani): string => {
    switch (orani) {
      case 0:
        return 'bg-slate-700 text-slate-400 border-slate-600';
      case 10:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 20:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      default:
        return 'bg-slate-700 text-slate-400 border-slate-600';
    }
  };

  // Dropdown option renkleri
  const getOptionClass = (orani: VergiOrani): string => {
    switch (orani) {
      case 0:
        return 'text-slate-400';
      case 10:
        return 'text-blue-400';
      case 20:
        return 'text-amber-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as VergiOrani)}
      disabled={disabled}
      className={`w-full px-2 py-1 bg-slate-700 border rounded text-center text-sm font-medium focus:outline-none focus:border-blue-500 ${getVergiStyles(value)}`}
    >
      <option value={0} className={getOptionClass(0)}>0%</option>
      <option value={10} className={getOptionClass(10)}>%10</option>
      <option value={20} className={getOptionClass(20)}>%20</option>
    </select>
  );
};

/**
 * Vergi Chip/Dot versiyonu (inline gosterim icin)
 */
export const VergiChip: React.FC<{ oran: VergiOrani }> = ({ oran }) => {
  const styles = {
    0: 'bg-slate-700 text-slate-400 border-slate-600',
    10: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    20: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[oran]}`}>
      {oran === 0 ? '─' : `%${oran}`}
    </span>
  );
};
