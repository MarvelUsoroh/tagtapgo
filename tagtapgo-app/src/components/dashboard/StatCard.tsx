/**
 * StatCard Component
 * Displays a statistic with icon, value, and optional trend indicator
 */

'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import { colors } from '@/lib/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconName;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function StatCardComponent({ label, value, icon, trend, trendValue }: StatCardProps) {
  const getTrendColor = () => {
    if (!trend) return colors.gray[500];
    switch (trend) {
      case 'up':
        return colors.primary.DEFAULT;
      case 'down':
        return colors.danger;
      case 'neutral':
        return colors.gray[500];
    }
  };

  return (
    <Card padding="md" elevation="sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && trendValue && (
            <div className="flex items-center mt-2 space-x-1">
              <Icon 
                name={trend === 'up' ? 'trendingUp' : trend === 'down' ? 'trendingDown' : 'remove'} 
                size="sm" 
                color={getTrendColor()}
              />
              <span className="text-xs" style={{ color: getTrendColor() }}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div className="ml-3">
          <div 
            className="p-2 rounded-lg" 
            style={{ backgroundColor: `${colors.primary.DEFAULT}15` }}
          >
            <Icon name={icon} size="lg" color={colors.primary.DEFAULT} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export const StatCard = memo(StatCardComponent);
