import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { PersonIcon } from '@/components/icons';

export interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackIcon?: React.ReactNode;
  border?: boolean;
  className?: string;
}

/**
 * Avatar Component
 * User avatar with fallback icon
 * Optimized with Next.js Image component
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'md',
  fallbackIcon,
  border = false,
  className,
}) => {
  const sizeStyles = {
    sm: 'w-8 h-8',    // 32px
    md: 'w-10 h-10',  // 40px
    lg: 'w-14 h-14',  // 56px
    xl: 'w-20 h-20',  // 80px
  };
  
  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 28,
    xl: 40,
  };

  const imageSizes = {
    sm: '32px',
    md: '40px',
    lg: '56px',
    xl: '80px',
  };
  
  const baseStyles = 'relative rounded-full overflow-hidden bg-brand/10 flex items-center justify-center';
  const borderStyles = border ? 'ring-2 ring-white ring-offset-2' : '';
  
  return (
    <div
      className={cn(
        baseStyles,
        sizeStyles[size],
        borderStyles,
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          quality={95}
          className="object-cover"
          sizes={imageSizes[size]}
        />
      ) : (
        <div className="text-brand">
          {fallbackIcon || <PersonIcon size={iconSizes[size]} />}
        </div>
      )}
    </div>
  );
};
