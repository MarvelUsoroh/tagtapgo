'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'white' | 'gradient';
  children?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  variant = 'white',
  children,
  actions,
}: PageHeaderProps) {
  const isGradient = variant === 'gradient';

  return (
    <header
      className={cn(
        'px-6 pb-6 safe-area-top',
        isGradient
          ? 'bg-gradient-to-br from-primary via-primary-dark to-success text-white'
          : 'bg-white border-b'
      )}
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        ...(isGradient ? {} : { borderColor: colors.gray[200] })
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Title Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className="p-3 rounded-xl"
                style={{
                  backgroundColor: isGradient
                    ? 'rgba(255, 255, 255, 0.1)'
                    : colors.primary.DEFAULT + '20',
                }}
              >
                <Icon
                  size={28}
                  style={{
                    color: isGradient ? 'white' : colors.primary.DEFAULT,
                  }}
                />
              </div>
            )}
            <div>
              <h1
                className="text-2xl font-bold"
                style={{
                  color: isGradient ? 'white' : colors.gray[900],
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className="text-sm"
                  style={{
                    color: isGradient ? 'rgba(255, 255, 255, 0.8)' : colors.gray[600],
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div>{actions}</div>}
        </div>

        {/* Custom Content */}
        {children && <div>{children}</div>}
      </div>
    </header>
  );
}
