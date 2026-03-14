import React from 'react';
import { cn } from '@/lib/utils';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

/**
 * Container Component
 * Provides consistent horizontal padding and max-width
 * Server Component compatible
 */
export const Container: React.FC<ContainerProps> = ({
  maxWidth = 'lg',
  className,
  children,
  ...props
}) => {
  const maxWidthStyles = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    full: 'max-w-full',
  };
  
  return (
    <div
      className={cn(
        'w-full mx-auto px-md',
        maxWidthStyles[maxWidth],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
