/**
 * SettingsSection Component
 * Groups related settings together with a title and description
 * Requirements: 11.2, 11.4, 11.7
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * SettingsSection Component
 * 
 * Features:
 * - Section title and optional description
 * - Groups related settings together
 * - Subtle dividers between sections
 * - Design system spacing
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <div className={cn('mb-6', className)}>
      {/* Section Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 mt-1">
            {description}
          </p>
        )}
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
};
