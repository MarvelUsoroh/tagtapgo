'use client';

import { IoArrowBack } from 'react-icons/io5';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconType;
  variant?: 'white' | 'gradient';
  children?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  variant = 'white',
  children,
  actions,
  onBack,
}: PageHeaderProps) {
  const isGradient = variant === 'gradient';

  return (
    <header
      className={cn(
        'px-6 pb-6 safe-area-top',
        isGradient
          ? 'text-white'
          : 'bg-white border-b'
      )}
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        ...(isGradient ? { backgroundColor: colors.primary.dark } : { borderColor: colors.gray[200] })
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Title Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                style={{
                  backgroundColor: isGradient ? 'rgba(255, 255, 255, 0.1)' : undefined,
                }}
              >
                <IoArrowBack
                  size={20}
                  style={{ color: isGradient ? 'white' : colors.gray[600] }}
                />
              </button>
            )}
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
