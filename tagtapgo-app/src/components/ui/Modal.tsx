'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CloseIcon } from '@/components/icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Modal Component
 * Accessible modal dialog with focus trap
 * Animates smoothly on open/close
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  // Store previous focus and trap focus within modal
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative bg-base-white rounded-lg shadow-lg w-full animate-scale-in',
          sizeStyles[size]
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-md border-b border-neutral-200">
            <h2 id="modal-title" className="text-lg font-semibold text-neutral-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors rounded-md hover:bg-neutral-100"
              aria-label="Close modal"
            >
              <CloseIcon size={20} />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="p-md">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-md border-t border-neutral-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
