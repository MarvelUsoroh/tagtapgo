import React from 'react';
import { cn } from '@/lib/utils';
import { AlertIcon } from '@/components/icons';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * ErrorState Component
 * Display when an error occurs
 * Provides retry action when applicable
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description = 'We encountered an error. Please try again.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-lg',
        className
      )}
      role="alert"
    >
      <div className="mb-md text-error">
        <AlertIcon size={48} />
      </div>
      
      <h3 className="text-lg font-semibold text-neutral-900 mb-sm">
        {title}
      </h3>
      
      <p className="text-sm text-neutral-600 mb-md max-w-sm">
        {description}
      </p>
      
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          Try Again
        </Button>
      )}
    </div>
  );
};
