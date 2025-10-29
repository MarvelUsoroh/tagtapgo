# Achievement System

## Overview

The Achievement System rewards students for reaching milestones across various categories. When achievements are unlocked, students receive bonus points and a confetti celebration animation in the app.

## Achievement Categories

### 1. Attendance
Achievements based on total class attendance count.

**Examples:**
- First Day (1 class) - 10 points
- Getting Started (10 classes) - 50 points
- Dedicated Student (50 classes) - 200 points
- Century Club (100 classes) - 500 points

### 2. Streak
Achievements based on consecutive days of attendance.

**Examples:**
- Fire Starter (3-day streak) - 30 points
- Week Warrior (7-day streak) - 100 points
- Month Master (30-day streak) - 500 points
- Legendary Streak (100-day streak) - 2000 points

### 3. Time
Achievements based on punctuality and perfect attendance periods.

**Examples:**
- Early Bird (5 early arrivals) - 50 points
- Punctuality Pro (20 early arrivals) - 200 points
- Perfect Week (5/5 days) - 100 points
- Perfect Month (20/20 days) - 500 points

### 4. Social
Achievements based on feedback and social interactions.

**Examples:**
- Voice Heard (5 feedback submissions) - 50 points
- Course Critic (10 unique courses) - 100 points
- Feedback Champion (25 submissions) - 250 points
- Thoughtful Contributor (10 with comments) - 150 points

### 5. Reward
Achievements based on reward redemptions.

**Examples:**
- First Reward (1 redemption) - 25 points
- Reward Hunter (5 redemptions) - 100 points
- Reward Master (10 redemptions) - 250 points

## Rarity Levels

Achievements have rarity levels that affect their visual presentation:

- **Common** (white/gray) - Easy to achieve, low points
- **Rare** (blue) - Moderate difficulty, medium points
- **Epic** (purple) - Difficult to achieve, high points
- **Legendary** (gold) - Very difficult, very high points

## Achievement Criteria Types

### attendance_count
Counts total attendance records (present, late, excused).

```json
{
  "type": "attendance_count",
  "target": 10
}
```

### streak_milestone
Checks current streak value.

```json
{
  "type": "streak_milestone",
  "target": 7
}
```

### early_arrival_count
Counts early arrival bonus points transactions.

```json
{
  "type": "early_arrival_count",
  "target": 5
}
```

### perfect_week_count
Counts perfect week bonus points transactions.

```json
{
  "type": "perfect_week_count",
  "target": 1
}
```

### perfect_month_count
Counts perfect month bonus points transactions.

```json
{
  "type": "perfect_month_count",
  "target": 1
}
```

### feedback_count
Counts total feedback submissions.

```json
{
  "type": "feedback_count",
  "target": 5
}
```

### feedback_unique_courses
Counts unique courses with feedback.

```json
{
  "type": "feedback_unique_courses",
  "target": 10
}
```

### feedback_with_comments
Counts feedback submissions with comments.

```json
{
  "type": "feedback_with_comments",
  "target": 10
}
```

### reward_redemption_count
Counts reward redemptions (issued or used).

```json
{
  "type": "reward_redemption_count",
  "target": 5
}
```

## Database Schema

### Achievements Table

```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('attendance', 'streak', 'time', 'social', 'reward')),
  criteria JSONB NOT NULL,
  points_reward INTEGER NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_rarity ON achievements(rarity);
```

### Student Achievements Table

```sql
CREATE TABLE student_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, achievement_id)
);

CREATE INDEX idx_student_achievements_unlocked ON student_achievements(unlocked, student_id);
CREATE INDEX idx_student_achievements_progress ON student_achievements(student_id, progress);
```

## Usage

### Check Achievements

```typescript
import { checkAchievements } from '../_shared/services/achievement-checker.ts';

// Check achievements for students
const results = await checkAchievements(supabase, ['student-1', 'student-2']);

// Results:
// [
//   {
//     student_id: 'student-1',
//     achievements_unlocked: [
//       {
//         achievement_id: 'ach-123',
//         achievement_name: 'Fire Starter',
//         points_reward: 30,
//         rarity: 'common'
//       }
//     ],
//     achievements_progressed: [
//       {
//         achievement_id: 'ach-456',
//         achievement_name: 'Week Warrior',
//         progress: 5,
//         target: 7,
//         percentage: 71
//       }
//     ],
//     total_bonus_points: 30,
//     errors: []
//   }
// ]
```

### Add New Achievement

```sql
INSERT INTO achievements (
  id,
  name,
  description,
  category,
  criteria,
  points_reward,
  rarity
) VALUES (
  gen_random_uuid(),
  'Super Achiever',
  'Unlock 10 achievements',
  'social',
  '{"type": "achievement_count", "target": 10}',
  500,
  'epic'
);
```

## Achievement Flow

### 1. Trigger Event
Student performs an action (attends class, submits feedback, etc.)

### 2. Gamification Engine
Calls achievement checker after processing attendance/feedback

### 3. Progress Calculation
For each achievement:
- Calculate current progress based on criteria type
- Compare progress to target

### 4. Unlock or Update
If progress >= target:
- Mark achievement as unlocked
- Award bonus points
- Send notification with confetti trigger

If progress < target:
- Update progress in database
- Show progress bar in UI

### 5. Notification
Send push notification:
```json
{
  "notification_type": "achievement_unlocked",
  "title": "🏆 Achievement Unlocked!",
  "message": "You earned 'Fire Starter' (+30 points)",
  "data": {
    "achievement_id": "ach-123",
    "achievement_name": "Fire Starter",
    "points_reward": 30,
    "rarity": "common",
    "trigger_confetti": true
  }
}
```

### 6. Frontend Display
- Show confetti animation (canvas-confetti)
- Display achievement badge with glow effect
- Update achievements page
- Update points balance

## Integration

### Gamification Engine

```typescript
// In gamification-job/index.ts
import { checkAchievements } from '../_shared/services/achievement-checker.ts';

// After processing attendance and streaks
const studentIds = [...new Set(newAttendance.map(a => a.student_id))];
const achievementResults = await checkAchievements(supabase, studentIds);

console.log(`Unlocked ${achievementResults.reduce((sum, r) => sum + r.achievements_unlocked.length, 0)} achievements`);
```

## Frontend Integration

### Achievements Page

Display all achievements with states:

**Earned:**
- Full-color badge
- Glow effect
- Earned date
- Points awarded

**In Progress:**
- Partial color
- Progress bar (e.g., "5/10")
- Percentage complete

**Locked:**
- Grayscale badge
- Lock icon
- Requirements text

### Confetti Animation

```typescript
// When notification received with trigger_confetti: true
import confetti from 'canvas-confetti';

confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
  colors: ['#4ADE80', '#22C55E', '#86EFAC'], // Brand colors
});
```

## Performance Considerations

### Batch Processing
- Check achievements for multiple students in parallel
- Group by criteria type to minimize queries

### Caching
- Cache achievement definitions (rarely change)
- Cache student achievement progress for dashboard

### Indexes
Ensure these indexes exist:
- `achievements(category)` - For filtering
- `achievements(rarity)` - For sorting
- `student_achievements(student_id, unlocked)` - For queries
- `student_achievements(student_id, progress)` - For progress tracking

## Testing

Run tests with:

```bash
deno test tagtapgo-backend/supabase/functions/_shared/services/__tests__/achievement-checker.test.ts
```

Tests cover:
- Progress calculation for all criteria types
- Achievement unlocking
- Bonus points awarding
- Progress tracking
- Skip already unlocked
- Notification sending

## Future Enhancements

1. **Secret Achievements**: Hidden until unlocked
2. **Time-Limited Achievements**: Available only during events
3. **Tiered Achievements**: Bronze/Silver/Gold levels
4. **Achievement Chains**: Unlock one to reveal next
5. **Social Achievements**: Based on friend interactions
6. **Custom Icons**: Upload custom badge images
7. **Achievement Leaderboard**: Most achievements unlocked
8. **Retroactive Unlocking**: Check past data for new achievements

## Requirements Mapping

- **Requirement 4**: Recent Achievements Display
  - Show last 2-3 earned badges on dashboard
  - Staggered fade-in animation
  - Click to navigate to achievements page

- **Requirement 7**: Achievements Page
  - Grid layout with all achievements
  - Category filtering
  - Progress bars for in-progress
  - Confetti on unlock

## Related Documentation

- [Points Calculation](./POINTS_CALCULATION.md)
- [Streak System](./STREAK_SYSTEM.md)
- [Gamification Engine](./GAMIFICATION_ENGINE.md) (to be created)
- [Database Schema](./DATABASE_SCHEMA.md)
