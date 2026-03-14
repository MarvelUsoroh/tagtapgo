import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader Component
 * Consistent page header with title, subtitle, and actions
 * Respects safe area insets for devices with notches
 * Server Component compatible
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className,
}) => {
  return (
    <header
      className={cn(
        'bg-base-white border-b border-neutral-200',
        'px-md py-md pt-safe-top',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-neutral-600 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="ml-md flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
