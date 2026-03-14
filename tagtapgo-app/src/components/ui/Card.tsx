import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'none' | 'sm' | 'md';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  children: React.ReactNode;
}

/**
 * Card Component
 * Reusable card container with consistent styling
 * Can be used as a Server Component (no client-side interactivity by default)
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      elevation = 'sm',
      padding = 'md',
      interactive = false,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'bg-base-white rounded-lg';
    
    const elevationStyles = {
      none: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
    };
    
    const paddingStyles = {
      none: '',
      sm: 'p-sm',
      md: 'p-md',
      lg: 'p-lg',
    };
    
    const interactiveStyles = interactive
      ? 'cursor-pointer transition-shadow hover:shadow-md active:shadow-sm'
      : '';
    
    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          elevationStyles[elevation],
          paddingStyles[padding],
          interactiveStyles,
          className
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
