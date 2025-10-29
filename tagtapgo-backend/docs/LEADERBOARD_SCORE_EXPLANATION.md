# Leaderboard Score Calculation Explained

## The Score Formula

```
Score = (Current Streak × 100) + Points
```

This is a **hybrid scoring system** that prioritizes attendance consistency (streaks) over raw points.

## Your Example Breakdown

### Your Stats:
- **Current Streak**: 5 days
- **Total Points**: 80
- **Bonus Points from Achievement**: 10 (included in total)

### Score Calculation:
```
Score = (5 × 100) + 80
Score = 500 + 80
Score = 580 ✅
```

### Why This Makes Sense:
- Your 5-day streak contributes **500 points** to your score
- Your earned points contribute **80 points** to your score
- Total score: **580**

## Why Streaks Are Weighted So Heavily

The system is designed to reward **consistent attendance** more than one-time point gains:

1. **Attendance Consistency** = 100 points per day of streak
2. **Points** = 1:1 value

This means:
- A 5-day streak is worth the same as earning 500 points
- Maintaining streaks is more valuable than sporadic high-point activities

## Period Filtering (Weekly/Monthly/All-Time)

### How It Works:

**Points are filtered by period:**
- **Weekly**: Only points earned this week (Monday-Sunday)
- **Monthly**: Only points earned this month
- **All-Time**: All points ever earned

**Streaks are NOT filtered:**
- Current streak is always the same (it's a running count)
- This is intentional - your streak represents your current consistency

### Your Current Data:

All your points (80) were earned on **2025-10-28** (today), which means:
- ✅ **This Week**: 80 points (today is in this week)
- ✅ **This Month**: 80 points (today is in this month)
- ✅ **All-Time**: 80 points (all your points)

**This is why all three periods show the same score - it's correct!**

## When Filters Will Show Different Values

The filters will show different values when:

1. **You earn points in different weeks/months**
   - Example: If you earned 50 points last week and 30 this week:
     - Weekly: 30 points
     - Monthly: 80 points (if same month)
     - All-Time: 80 points

2. **Multiple students with different earning patterns**
   - Student A: Earned 100 points this week
   - Student B: Earned 50 points this week, 200 all-time
   - Weekly leaderboard will rank A higher
   - All-time leaderboard will rank B higher

## Testing the Filters

To see the filters work differently, you need:

1. **Historical data**: Points earned in previous weeks/months
2. **Multiple students**: Different earning patterns
3. **Time passage**: Wait for week/month boundaries to pass

## Example Scenarios

### Scenario 1: Same Week, Different Months
```
Student earned:
- September: 100 points
- October (this week): 50 points
- Current streak: 10 days

Weekly Score:  (10 × 100) + 50  = 1,050
Monthly Score: (10 × 100) + 50  = 1,050 (October only)
All-Time Score: (10 × 100) + 150 = 1,150
```

### Scenario 2: Streak vs Points Priority
```
Student A:
- Streak: 20 days
- Points: 50
- Score: 2,050

Student B:
- Streak: 5 days
- Points: 500
- Score: 1,000

Winner: Student A (streak is more valuable!)
```

## Why This Design?

The hybrid scoring system encourages:

1. **Consistent Attendance**: Showing up every day is rewarded heavily
2. **Long-term Engagement**: Maintaining streaks over time
3. **Balanced Competition**: Can't just "buy" your way to the top with one-time activities

## Ranking Tiebreakers

When two students have the same score:

1. **Primary**: Score (streak × 100 + points)
2. **Tiebreaker 1**: Current streak (higher wins)
3. **Tiebreaker 2**: Points (higher wins)

This ensures fair and deterministic rankings.

## Summary

Your score of **580** is correct:
- 5-day streak = 500 points
- 80 earned points = 80 points
- Total = 580

The filters are working correctly - all periods show 80 points because all your points were earned today (which is in this week, this month, and all-time).

To see different values across periods, you need to:
- Earn points in different time periods
- Wait for week/month boundaries to pass
- Have multiple students with varied earning patterns
