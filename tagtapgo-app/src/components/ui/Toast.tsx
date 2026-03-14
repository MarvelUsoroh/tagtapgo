'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon, CloseIcon, AlertIcon, InfoIcon } from '@/components/icons';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss: () => void;
}

/**
 * Toast Component
 * Temporary notification with auto-dismiss
 * Color-coded by type
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);
  
  const typeStyles = {
    success: 'bg-success text-white',
    error: 'bg-error text-white',
    warning: 'bg-warning text-white',
    info: 'bg-info text-white',
  };
  
  const icons = {
    success: <CheckIcon size={20} />,
    error: <CloseIcon size={20} />,
    warning: <AlertIcon size={20} />,
    info: <InfoIcon size={20} />,
  };
  
  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 mx-auto max-w-sm',
        'flex items-center gap-3 p-md rounded-lg shadow-lg',
        'animate-slide-up',
        typeStyles[type]
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      
      <p className="flex-1 text-sm font-medium">
        {message}
      </p>
      
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
};
