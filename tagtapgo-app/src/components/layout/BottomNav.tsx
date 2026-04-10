'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import {
  HomeIcon,
  HomeIconFilled,
  TrophyIcon,
  TrophyIconFilled,
  ChatIcon,
  ChatIconFilled,
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
    label: 'Home',
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
    path: '/community',
    label: 'Community',
    icon: ChatIcon,
    activeIcon: ChatIconFilled,
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
 * Modern icon-only bottom navigation inspired by Instagram/Twitter
 * 5 buttons with Community in center position
 * Outline icons that fill when active
 * Hidden on auth/onboarding screens
 */
export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const store = useStore();
  
  // Hide bottom nav on auth and onboarding screens
  const hideNavRoutes = [
    '/login',
    '/signup',
    '/confirm',
    '/validate-code',
    '/reset-password',
    '/update-password',
    '/coming-soon',
  ];
  
  const { isNotificationsPanelOpen } = useStore();

  const shouldHideNav = hideNavRoutes.some(route => pathname?.startsWith(route)) || isNotificationsPanelOpen;
  
  if (shouldHideNav) {
    return null;
  }
  
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-base-white border-t border-neutral-200 pb-safe z-40"
      role="navigation"
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = isActive ? item.activeIcon : item.icon;
          const showBadge = item.path === '/community' && store.unreadChatMentions > 0;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'relative flex items-center justify-center',
                'w-16 h-12',
                'transition-colors',
                isActive
                  ? 'text-brand'
                  : 'text-neutral-400 hover:text-neutral-600 active:text-neutral-700'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={28} />
              {showBadge && (
                <span className="absolute top-1 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {store.unreadChatMentions > 9 ? '9+' : store.unreadChatMentions}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
