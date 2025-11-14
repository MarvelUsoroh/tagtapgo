'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Trophy, Users, Gift, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { colors, iconSizes } from '@/lib/theme';
import { UI_CONFIG } from '@/lib/constants';
import { buttonPress } from '@/lib/animations';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/achievements', icon: Trophy, label: 'Badges' },
  { href: '/leaderboard', icon: Users, label: 'Ranks' },
  { href: '/rewards', icon: Gift, label: 'Rewards' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50" style={{ borderColor: colors.gray[200], paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-5xl mx-auto flex justify-around items-center" style={{ minHeight: `${UI_CONFIG.MIN_TOUCH_TARGET}px` }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <motion.div
              key={item.href}
              {...buttonPress}
              className="flex-1"
            >
              <Link
                href={item.href}
                className="flex flex-col items-center justify-center relative transition-all duration-300 ease-in-out"
                style={{ 
                  minWidth: `${UI_CONFIG.MIN_TOUCH_TARGET}px`,
                  minHeight: `${UI_CONFIG.MIN_TOUCH_TARGET}px`,
                  padding: '8px 4px'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-0 right-0"
                    style={{ 
                      height: '3px',
                      backgroundColor: colors.primary.DEFAULT
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <motion.div
                  animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Icon
                    size={iconSizes.md}
                    className="transition-colors duration-300"
                    style={{ 
                      color: isActive ? colors.primary.DEFAULT : colors.gray[400]
                    }}
                  />
                </motion.div>
                <span
                  className="text-xs mt-1 transition-all duration-300"
                  style={{ 
                    color: isActive ? colors.primary.DEFAULT : colors.gray[400],
                    fontWeight: isActive ? 600 : 400
                  }}
                >
                  {item.label}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
