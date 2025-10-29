/**
 * Logo Component
 * Reusable TagTapGo logo with Cal Sans font
 */

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'short'; // 'tagtapgo' or 'ttg'
  color?: 'primary' | 'white' | 'dark';
  animated?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
};

const colorClasses = {
  primary: 'text-primary',
  white: 'text-white',
  dark: 'text-gray-900',
};

export default function Logo({
  size = 'md',
  variant = 'full',
  color = 'primary',
  animated = false,
  className,
}: LogoProps) {
  const text = variant === 'full' ? 'tagtapgo' : 'ttg';

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.05 }}
        className={cn(
          'font-cal-sans font-bold tracking-tight',
          sizeClasses[size],
          colorClasses[color],
          className
        )}
      >
        {text}
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        'font-cal-sans font-bold tracking-tight',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    >
      {text}
    </div>
  );
}
