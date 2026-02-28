/**
 * Icon Component - Unified icon system using Lucide React
 * Provides consistent icon usage across the application
 * 
 * Usage:
 * import { Icon } from '@/components/Shared/Icon'
 * <Icon name="edit" size="md" color={COLORS.primary[500]} />
 */

import * as Icons from 'lucide-react';
import { ICON_MAPPING, ICON_SIZES } from '../../config/iconMapping';

interface IconProps {
  name: keyof typeof ICON_MAPPING;
  size?: keyof typeof ICON_SIZES | number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}

export const Icon = ({ 
  name, 
  size = 'md', 
  color, 
  className,
  style,
  strokeWidth = 2,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden
}: IconProps) => {
  const iconName = ICON_MAPPING[name];
  const IconComponent = Icons[iconName as keyof typeof Icons] as React.ComponentType<{ size?: number | string; color?: string; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  
  if (!IconComponent) {
    console.error(`Icon "${name}" (${iconName}) not found in Lucide icons`);
    return null;
  }

  const iconSize = typeof size === 'number' ? size : ICON_SIZES[size];

  return (
    <IconComponent 
      size={iconSize}
      color={color}
      className={className}
      style={style}
      strokeWidth={strokeWidth}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
    />
  );
};

/**
 * Icon with Label - Accessible icon with text label
 */
interface IconWithLabelProps extends IconProps {
  label: string;
  labelPosition?: 'left' | 'right' | 'top' | 'bottom';
}

export const IconWithLabel = ({ 
  label, 
  labelPosition = 'right',
  ...iconProps 
}: IconWithLabelProps) => {
  const flexDirection = labelPosition === 'top' ? 'column' :
                       labelPosition === 'bottom' ? 'column-reverse' :
                       labelPosition === 'left' ? 'row-reverse' : 'row';
  
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexDirection }}>
      <Icon {...iconProps} aria-hidden={true} />
      <span>{label}</span>
    </span>
  );
};
