'use client';

import { motion } from 'framer-motion';
import { ReactNode, isValidElement } from 'react';
import type { ComponentType, CSSProperties } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { colors, animations } from '@/lib/theme';
import { useCountUp } from '@/hooks/useCountUp';

interface StatCardProps {
  icon: ReactNode | LucideIcon;
  value: string | number;
  label: string;
  color?: 'primary' | 'success' | 'gold' | 'danger';
  trend?: 'up' | 'down';
  animate?: boolean;
  className?: string;
}

// Map color names to theme colors
const colorMap = {
  primary: colors.primary.DEFAULT,
  success: colors.success,
  gold: colors.rank.gold,
  danger: colors.danger,
} as const;

export default function StatCard({ 
  icon, 
  value, 
  label, 
  color = 'primary',
  trend,
  animate: shouldAnimate = true,
  className 
}: StatCardProps) {
  // Determine if value is numeric for count-up animation
  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/,/g, ''));
  const isNumeric = !isNaN(numericValue);
  
  // Use count-up hook for numeric values - returns plain number
  const animatedValue = useCountUp(numericValue, {
    duration: 0.8,
    enabled: shouldAnimate && isNumeric,
  });
  
  // Render icon (handle both ReactNode and LucideIcon)
  const iconColor = colorMap[color];
  const iconElement = (() => {
    if (typeof icon === 'function') {
      const IconComponent = icon as LucideIcon;
      return <IconComponent size={24} style={{ color: iconColor }} />;
    }

    if (icon && typeof icon === 'object' && 'render' in icon) {
  const ForwardRefIcon = icon as unknown as ComponentType<{ size?: number; style?: CSSProperties }>;
      return <ForwardRefIcon size={24} style={{ color: iconColor }} />;
    }

    if (isValidElement(icon)) {
      return icon;
    }

    return <div style={{ color: iconColor }}>{icon}</div>;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: parseFloat(animations.duration.normal) / 1000 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'bg-white rounded-xl shadow-md p-4 text-center',
        'transition-shadow duration-300 hover:shadow-lg',
        'min-w-[120px] sm:min-w-[140px]', // Responsive sizing
        className
      )}
    >
      <div className="mx-auto mb-2 flex justify-center">
        {iconElement}
      </div>
      <div 
        className={cn(
          'text-2xl sm:text-3xl font-bold',
          'transition-colors duration-300'
        )}
        style={{ color: colors.gray[900] }}
      >
        {shouldAnimate && isNumeric ? animatedValue : (typeof value === 'number' ? formatNumber(value) : value)}
      </div>
      <div 
        className="text-xs sm:text-sm font-medium mt-1"
        style={{ color: colors.gray[600] }}
      >
        {label}
      </div>
      {trend && (
        <div className="mt-2 flex items-center justify-center gap-1">
          <span 
            className="text-xs font-semibold"
            style={{ 
              color: trend === 'up' ? colors.success : colors.danger 
            }}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
        </div>
      )}
    </motion.div>
  );
}
