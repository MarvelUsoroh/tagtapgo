# Leaderboard System (Hybrid Streak-Based Scoring)

## Overview

The Leaderboard System calculates and maintains competitive rankings for students using a **hybrid scoring system** that prioritizes attendance streaks over points. This encourages consistent attendance behavior while still rewarding engagement activities.

### Scoring Formula

```
Score = (current_streak × 100) + points
```

**Example:**
- Student with 15-day streak + 250 points = **1,750 score**
- Student with 5-day streak + 800 points = **1,300 score**

The first student ranks higher despite having fewer points because their consistent attendance (15-day streak) is more valuable.

## Leaderboard Types

### 1. Class Leaderboard
Rankings within a specific class/course.

**Scope:** Students enrolled in the same course
**Use Case:** Compete with classmates in the same course

### 2. Year Leaderboard
Rankings within a year level (e.g., Freshman, Sophomore).

**Scope:** Students in the same year level
**Use Case:** Compete with peers in the same academic year

### 3. School Leaderboard
School-wide rankings across all students.

**Scope:** All students at the university
**Use Case:** See top performers across the entire school

### 4. Friend Leaderboard (Future)
Rankings among connected friends.

**Scope:** Student's friend network
**Use Case:** Compete with friends

## Time Periods

### Weekly
**Duration:** Monday 00:00 - Sunday 23:59
**Points:** Sum of points earned during the current week
**Reset:** Every Monday at 00:00

### Monthly
**Duration:** 1st 00:00 - Last day 23:59
**Points:** Sum of points earned during the current month
**Reset:** Every 1st of the month at 00:00

### All Time
**Duration:** Since account creation
**Points:** Total points earned ever
**Reset:** Never

## Ranking Rules

### Hybrid Ranking Logic

Students are ranked using a three-tier system:

1. **Primary Sort: Score (Descending)**
   - Score = (current_streak × 100) + points
   - Higher scores rank better

2. **Tiebreaker 1: Current Streak (Descending)**
   - If scores are equal, longer current streak wins
   - Rewards consistency over point accumulation

3. **Tiebreaker 2: Points (Descending)**
   - Final tiebreaker for identical streaks
   - Maintains value of engagement activities

### Tie Handling
When students have the same score:
- They receive the same rank
- Next rank skips accordingly

**Example:**
```
Rank 1: Alice (1,750 score)  🔥 15 days + 250 pts
Rank 2: Bob   (1,600 score)  🔥 12 days + 400 pts
Rank 2: Carol (1,600 score)  🔥 12 days + 400 pts  ← Tie (same score)
Rank 4: Dave  (1,300 score)  🔥  5 days + 800 pts  ← Skips rank 3
```

**Key Insight:** Alice ranks #1 despite having the fewest points (250) because her 15-day streak is worth 1,500 points in the scoring system.

### Rank Change Notifications

Notifications are sent when:
- Student moves up 5+ places
- Student enters top 3 (from outside top 3)

**Notification Examples:**
- "🥇 You're now #1 on the class weekly leaderboard!"
- "You moved up 7 places to #5 on the school monthly leaderboard!"

## Database Schema

### Leaderboards Table

```sql
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('class', 'year', 'school', 'friend')),
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'all_time')),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  score INTEGER GENERATED ALWAYS AS (current_streak * 100 + points) STORED,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, leaderboard_type, period, course_id, period_start)
);

CREATE INDEX idx_leaderboards_type_period ON leaderboards(leaderboard_type, period);
CREATE INDEX idx_leaderboards_rank ON leaderboards(rank);
CREATE INDEX idx_leaderboards_student ON leaderboards(student_id);
CREATE INDEX idx_leaderboards_course ON leaderboards(course_id);
CREATE INDEX idx_leaderboards_score ON leaderboards(leaderboard_type, period, score DESC, current_streak DESC);
CREATE INDEX idx_leaderboards_streak ON leaderboards(current_streak DESC, longest_streak DESC);
```

### Student Points Balance View

```sql
CREATE VIEW student_points_balance AS
SELECT 
  p.student_id,
  COALESCE(SUM(p.points), 0) AS total_points,
  COALESCE(s.current_streak, 0) AS current_streak,
  COALESCE(s.longest_streak, 0) AS longest_streak,
  (COALESCE(s.current_streak, 0) * 100 + COALESCE(SUM(p.points), 0)) AS score
FROM points p
LEFT JOIN streaks s ON p.student_id = s.student_id
GROUP BY p.student_id, s.current_streak, s.longest_streak;
```

## Usage

### Update All Leaderboards

```typescript
import { updateLeaderboards } from '../_shared/services/leaderboard-updater.ts';

// Update for all active students
const results = await updateLeaderboards(supabase);

// Update for specific students
const results = await updateLeaderboards(supabase, ['student-1', 'student-2']);

// Results:
// [
//   {
//     leaderboard_type: 'school',
//     period: 'weekly',
//     entries_updated: 150,
//     rank_changes: [
//       {
//         student_id: 'student-1',
//         old_rank: 10,
//         new_rank: 5,
//         points: 450
//       }
//     ],
//     errors: []
//   }
// ]
```

### Query Leaderboard

```typescript
// Get top 10 on school weekly leaderboard
const { data: leaderboard } = await supabase
  .from('leaderboards')
  .select(`
    rank,
    points,
    student:students(id, name, avatar_url)
  `)
  .eq('leaderboard_type', 'school')
  .eq('period', 'weekly')
  .eq('period_start', getCurrentWeekStart())
  .order('rank', { ascending: true })
  .limit(10);
```

### Get Student's Rank

```typescript
// Get student's rank on class leaderboard
const { data: myRank } = await supabase
  .from('leaderboards')
  .select('rank, points')
  .eq('student_id', studentId)
  .eq('leaderboard_type', 'class')
  .eq('period', 'weekly')
  .eq('course_id', courseId)
  .eq('period_start', getCurrentWeekStart())
  .single();
```

## Integration

### Gamification Engine

The leaderboard updater is called by the gamification engine after points are awarded:

```typescript
// In gamification-job/index.ts
import { updateLeaderboards } from '../_shared/services/leaderboard-updater.ts';

// After awarding points
const studentIds = [...new Set(pointsResults.map(r => r.student_id))];
const leaderboardResults = await updateLeaderboards(supabase, studentIds);

console.log(`Updated ${leaderboardResults.length} leaderboards`);
```

### Cron Jobs

**Leaderboard Update** (Every 10 minutes):
```sql
SELECT cron.schedule(
  'update-leaderboards',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/update-leaderboards',
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
  );
  $$
);
```

**Weekly Reset** (Monday at 00:00):
```sql
-- Leaderboards are automatically updated with new period_start
-- No explicit reset needed - old periods remain for history
```

## Frontend Integration

### Leaderboard Page

Display leaderboards with tabs and filters:

**Tabs:**
- My Class
- My Year
- School-Wide

**Filters:**
- This Week
- This Month
- All Time

**Podium Display (Top 3):**
```
     🥈              🥇              🥉
   Sarah            Alex           Marcus
   1,745 score      1,847 score    1,690 score
   🔥 12 days       🔥 15 days     🔥 10 days
```

**List View (4+):**
```
4. 🏅 Emma Davis      1,543 score  🔥 8 days
5. 🏅 You             1,450 score  🔥 7 days ⭐
6. 🏅 James Wilson    1,390 score  🔥 6 days
...
```

### Real-Time Updates

Subscribe to leaderboard changes:

```typescript
const channel = supabase
  .channel('leaderboard-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'leaderboards',
    filter: `student_id=eq.${studentId}`,
  }, (payload) => {
    // Update UI with new rank
    updateRankDisplay(payload.new.rank, payload.new.points);
  })
  .subscribe();
```

## Performance Considerations

### Batch Processing
- Update leaderboards for multiple students in parallel
- Group by leaderboard type to minimize queries

### Caching
- Cache leaderboard data for 5-10 minutes
- Use materialized views for heavy aggregations
- Cache student's rank separately

### Indexes
Ensure these indexes exist:
- `leaderboards(leaderboard_type, period)` - For filtering
- `leaderboards(rank)` - For sorting
- `leaderboards(student_id)` - For lookups
- `leaderboards(course_id)` - For class leaderboards

### Optimization Tips
1. **Incremental Updates**: Only update affected students
2. **Batch Inserts**: Use upsert for multiple entries
3. **Materialized Views**: Pre-calculate rankings for popular leaderboards
4. **Pagination**: Limit results to top 100 per leaderboard

## Testing

Run tests with:

```bash
deno test tagtapgo-backend/supabase/functions/_shared/services/__tests__/leaderboard-updater.test.ts
```

Tests cover:
- Ranking calculation
- Tie handling
- Rank change detection
- Period boundaries
- Multiple leaderboard types

## Edge Cases

### New Students
- Start with rank = total students + 1
- Move up as they earn points

### Tied for Last Place
- Multiple students can have rank = last
- All receive same rank

### Zero Points
- Students with 0 points still appear in leaderboard
- Ranked last (tied with others at 0)

### Course Enrollment Changes
- Student removed from course → removed from class leaderboard
- Student added to course → added to class leaderboard

### Period Transitions
- Weekly: New period starts Monday 00:00
- Monthly: New period starts 1st 00:00
- Old periods remain in database for history

## Benefits of Hybrid Scoring

### 1. Attendance-Driven Competition 🎯
- Students compete on consistency, not just engagement
- Aligns with primary goal: improve attendance rates
- One missed day has significant impact on ranking

### 2. Security Improvements 🔒
- Streaks come from validated attendance records
- Harder to manipulate than points system
- SIS/LMS integration provides authoritative data

### 3. Fairer Competition ⚖️
- New students can build streaks from day one
- Consistent attendance beats sporadic high engagement
- Everyone starts equal each semester

### 4. Clear Incentives 📈
- Students know exactly what drives rankings
- Simple message: "Attend class every day"
- Streak visualization motivates consistency

## Future Enhancements

1. **Friend Leaderboards**: Compete with connected friends
2. **Custom Leaderboards**: Create custom groups (study groups, clubs)
3. **Leaderboard Achievements**: Rewards for reaching top ranks
4. **Historical Rankings**: View past period rankings
5. **Rank Predictions**: Estimate score needed for next rank
6. **Leaderboard Challenges**: Time-limited competitive events
7. **Team Leaderboards**: Group rankings (e.g., dorms, departments)
8. **Streak Protection**: Freeze days for illness/emergencies
9. **Adjustable Multiplier**: Configure streak weight per university

## Requirements Mapping

- **Requirement 6**: Mini Leaderboard Preview
  - Display top 3 students on dashboard
  - Show user's rank if not in top 3
  - Real-time updates

- **Requirement 8**: Leaderboard Page
  - Tabs for class/year/school
  - Podium display for top 3
  - Scrollable list view
  - Time period filters
  - User highlight

## Related Documentation

- [Hybrid Leaderboard System](./HYBRID_LEADERBOARD_SYSTEM.md) - Detailed implementation guide
- [Points Calculation](./POINTS_CALCULATION.md)
- [Streak Calculation](./STREAK_CALCULATION.md)
- [Gamification Engine](./GAMIFICATION_ENGINE.md) (to be created)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Task 14 Progress](./TASK_14_PROGRESS.md)
