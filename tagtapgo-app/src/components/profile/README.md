# Profile Components

This directory contains components specific to the Profile screen.

## Components

### ProfileHeader

Displays user profile information including avatar, name, level, and points.

**Requirements:** 7.2, 7.3, 7.4, 7.5, 42.1-42.7

**Features:**
- Uses Avatar component (xl size - 80px)
- Displays user name with truncation for long names
- Shows level badge with Ionicon (RibbonIconFilled)
- Displays points with locale formatting
- Uses brand color (#4ADE80) for level indicator
- Applies design system spacing (xs: 4px, md: 16px)
- Circular avatar with border for definition
- Fallback avatar when no image is provided

**Props:**
```typescript
interface ProfileHeaderProps {
  avatarUrl?: string;  // Optional avatar image URL
  name: string;        // User's display name
  level: number;       // User's current level
  points: number;      // User's current points
  className?: string;  // Optional additional CSS classes
}
```

**Usage:**
```tsx
import { ProfileHeader } from '@/components/profile/ProfileHeader';

<ProfileHeader
  avatarUrl="https://example.com/avatar.jpg"
  name="John Doe"
  level={5}
  points={1250}
/>
```

**Design System Compliance:**
- ✅ Uses design system spacing tokens (xs, md)
- ✅ Uses brand color (#4ADE80) for level indicator
- ✅ Uses Ionicons (RibbonIconFilled) for level badge
- ✅ Uses Avatar component with xl size
- ✅ Applies subtle border to avatar (requirement 42.6)
- ✅ No gradients (flat design)
- ✅ Proper text hierarchy with font weights

### ProfileStats

Displays user statistics in a grid layout using StatCard components.

**Requirements:** 7.2, 7.3, 7.4

**Features:**
- Grid layout (2 columns) for statistics display
- Uses StatCard component for each statistic
- Uses Ionicons for stat icons (trendingUp, trophy, cash, gift)
- Applies design system spacing (gap-md: 16px)
- Displays attendance rate, achievements, points earned, and rewards redeemed
- Responsive grid layout

**Props:**
```typescript
interface ProfileStatsProps {
  attendanceRate: number;        // Attendance percentage (0-100)
  achievementsUnlocked: number;  // Number of unlocked achievements
  totalAchievements: number;     // Total available achievements
  rewardsRedeemed: number;       // Number of rewards redeemed
  totalPointsEarned: number;     // Total points earned (lifetime)
  className?: string;            // Optional additional CSS classes
}
```

**Usage:**
```tsx
import { ProfileStats } from '@/components/profile/ProfileStats';

<ProfileStats
  attendanceRate={85}
  achievementsUnlocked={12}
  totalAchievements={20}
  rewardsRedeemed={5}
  totalPointsEarned={2500}
/>
```

**Design System Compliance:**
- ✅ Uses design system spacing tokens (gap-md: 16px)
- ✅ Uses Ionicons for all stat icons
- ✅ Uses StatCard component for consistency
- ✅ Grid layout with proper spacing
- ✅ No gradients (flat design)
- ✅ Follows component composition pattern

## Future Components

- **ProfileActions**: Action buttons for profile management
