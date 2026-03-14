/**
 * SettingsItem Component
 * Individual setting item with different types (toggle, button, link)
 * Requirements: 11.3, 11.4, 11.5
 */

import React from 'react';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import { cn } from '@/lib/utils';

interface SettingsItemProps {
  icon?: IconName;
  iconColor?: string;
  iconBgColor?: string;
  label: string;
  description?: string;
  type?: 'button' | 'toggle' | 'link' | 'info';
  value?: boolean;
  onClick?: () => void;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * SettingsItem Component
 * 
 * Features:
 * - Supports button, toggle, and link types
 * - Ionicons for setting icons
 * - Brand color for active toggles
 * - 44px minimum touch target
 * - Design system spacing
 */
export const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  iconColor = '#6B7280',
  iconBgColor = '#F3F4F6',
  label,
  description,
  type = 'button',
  value = false,
  onClick,
  onChange,
  disabled = false,
  className,
}) => {
  const handleClick = () => {
    if (disabled) return;
    
    if (type === 'toggle' && onChange) {
      onChange(!value);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || type === 'info'}
      className={cn(
        'w-full flex items-center justify-between p-4 transition-colors text-left',
        type !== 'info' && 'hover:bg-gray-50 active:bg-gray-100',
        'min-h-[44px]',
        disabled && type !== 'info' && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Icon */}
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconBgColor }}
          >
            <Icon name={icon} size="sm" color={iconColor} />
          </div>
        )}

        {/* Label and Description */}
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium text-gray-900 truncate">{label}</p>
          {description && (
            <p className="text-sm text-gray-500 truncate">{description}</p>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 ml-3">
        {type === 'toggle' ? (
          <div
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              value ? 'bg-brand' : 'bg-gray-200'
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                value && 'transform translate-x-5'
              )}
            />
          </div>
        ) : type !== 'info' ? (
          <Icon name="arrowForward" size="sm" color="#9CA3AF" />
        ) : null}
      </div>
    </button>
  );
};
