import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  children: React.ReactNode;
}

/**
 * Section Component
 * Provides consistent vertical spacing for content sections
 * Server Component compatible
 */
export const Section: React.FC<SectionProps> = ({
  title,
  className,
  children,
  ...props
}) => {
  return (
    <section
      className={cn('py-lg', className)}
      {...props}
    >
      {title && (
        <h2 className="text-xl font-semibold text-neutral-900 mb-md">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
};
