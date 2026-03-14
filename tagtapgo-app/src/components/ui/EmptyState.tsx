import React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * EmptyState Component
 * Display when no data is available
 * Provides helpful messaging and optional action
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-lg',
        className
      )}
    >
      {icon && (
        <div className="mb-md text-neutral-400">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-neutral-900 mb-sm">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-neutral-600 mb-md max-w-sm">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-sm">
          {action}
        </div>
      )}
    </div>
  );
};
