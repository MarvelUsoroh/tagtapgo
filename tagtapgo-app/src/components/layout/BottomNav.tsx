'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  HomeIconFilled,
  TrophyIcon,
  TrophyIconFilled,
  GiftIcon,
  GiftIconFilled,
  PersonIcon,
  PersonIconFilled,
} from '@/components/icons';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  activeIcon: React.ComponentType<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: HomeIcon,
    activeIcon: HomeIconFilled,
  },
  {
    path: '/leaderboard',
    label: 'Leaderboard',
    icon: TrophyIcon,
    activeIcon: TrophyIconFilled,
  },
  {
    path: '/rewards',
    label: 'Rewards',
    icon: GiftIcon,
    activeIcon: GiftIconFilled,
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: PersonIcon,
    activeIcon: PersonIconFilled,
  },
];

/**
 * BottomNav Component
 * Native-like bottom navigation for primary app sections
 * Highlights active route with brand color
 * Respects safe area insets
 * Hidden on auth/onboarding screens
 */
export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  
  // Hide bottom nav on auth and onboarding screens
  const hideNavRoutes = [
    '/login',
    '/signup',
    '/confirm',
    '/validate-code',
    '/reset-password',
    '/update-password',
    '/coming-soon',
    '/community', // Full-screen chat experience
    '/feedback', // Full-screen feedback experience
  ];
  
  const shouldHideNav = hideNavRoutes.some(route => pathname?.startsWith(route));
  
  if (shouldHideNav) {
    return null;
  }
  
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-base-white border-t border-neutral-200 pb-safe z-40"
      role="navigation"
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = isActive ? item.activeIcon : item.icon;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex flex-col items-center justify-center',
                'min-w-touch min-h-touch',
                'transition-colors',
                isActive
                  ? 'text-brand'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={24} className="mb-1" />
              <span className="text-xs font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
