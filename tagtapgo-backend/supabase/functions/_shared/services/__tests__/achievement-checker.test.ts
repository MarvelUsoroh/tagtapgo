/**
 * Achievement Checker Service Tests
 * 
 * Tests the achievement checking logic including:
 * - Progress calculation for various criteria types
 * - Achievement unlocking
 * - Bonus points awarding
 * - Progress tracking
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { checkAchievements, type Achievement } from '../achievement-checker.ts';

// Mock Supabase client
function createMockSupabase() {
  const achievementsData: Achievement[] = [
    {
      id: 'ach-1',
      name: 'First Day',
      description: 'Attend your first class',
      category: 'attendance',
      criteria: { type: 'attendance_count', target: 1 },
      points_reward: 10,
      rarity: 'common',
      created_at: '2024-10-26T00:00:00Z',
    },
    {
      id: 'ach-2',
      name: 'Fire Starter',
      description: 'Maintain a 3-day streak',
      category: 'streak',
      criteria: { type: 'streak_milestone', target: 3 },
      points_reward: 30,
      rarity: 'common',
      created_at: '2024-10-26T00:00:00Z',
    },
  ];
  
  const studentAchievementsData: any[] = [];
  const attendanceData: any[] = [
    { id: 'att-1', student_id: 'student-1', status: 'present' },
  ];
  const streaksData: any[] = [
    { student_id: 'student-1', current_streak: 3 },
  ];
  const pointsData: any[] = [];
  const notificationsData: any[] = [];
  
  return {
    from: (table: string) => ({
      select: (columns: string, options?: any) => {
        // Handle count queries with { count: 'exact', head: true }
        if (options?.count === 'exact' && options?.head === true) {
          return {
            eq: (column: string, value: any) => {
              if (table === 'attendance') {
                const count = attendanceData.filter(a => a[column] === value).length;
                return {
                  in: () => ({ count, error: null }),
                };
              }
              if (table === 'points' || table === 'redemptions') {
                return {
                  eq: () => ({ count: 0, error: null }),
                  in: () => ({ count: 0, error: null }),
                  not: () => ({ count: 0, error: null }),
                };
              }
              return { count: 0, error: null };
            },
          };
        }
        
        // Handle regular queries
        if (columns === '*') {
          if (table === 'achievements') {
            return { data: achievementsData, error: null };
          }
        }
        
        return {
          eq: (column: string, value: any) => {
            if (table === 'achievements') {
              return { data: achievementsData, error: null };
            }
            if (table === 'student_achievements') {
              const filtered = studentAchievementsData.filter(sa => sa[column] === value);
              return { data: filtered, error: null };
            }
            if (table === 'streaks') {
              const found = streaksData.find(s => s[column] === value);
              return {
                single: () => ({ data: found || null, error: found ? null : { code: 'PGRST116' } }),
              };
            }
            return { data: [], error: null };
          },
        };
      },
      insert: (records: any) => {
        if (table === 'student_achievements') {
          const newRecords = Array.isArray(records) ? records : [records];
          studentAchievementsData.push(...newRecords);
        }
        if (table === 'points') {
          const newRecords = Array.isArray(records) ? records : [records];
          pointsData.push(...newRecords);
        }
        if (table === 'notifications') {
          const newRecords = Array.isArray(records) ? records : [records];
          notificationsData.push(...newRecords);
        }
        return { error: null };
      },
      upsert: (records: any, options: any) => {
        if (table === 'student_achievements') {
          const newRecords = Array.isArray(records) ? records : [records];
          studentAchievementsData.push(...newRecords);
        }
        return { error: null };
      },
    }),
    _achievementsData: achievementsData,
    _studentAchievementsData: studentAchievementsData,
    _attendanceData: attendanceData,
    _streaksData: streaksData,
    _pointsData: pointsData,
    _notificationsData: notificationsData,
  };
}

Deno.test('Achievement Checker - Unlock attendance achievement', async () => {
  const supabase = createMockSupabase() as any;
  
  const results = await checkAchievements(supabase, ['student-1']);
  
  assertEquals(results.length, 1);
  assertEquals(results[0].student_id, 'student-1');
  assertEquals(results[0].achievements_unlocked.length, 2); // First Day + Fire Starter
  assertEquals(results[0].total_bonus_points, 40); // 10 + 30
});

Deno.test('Achievement Checker - Track progress', async () => {
  const supabase = createMockSupabase() as any;
  
  // Modify achievement to require 5 attendance
  supabase._achievementsData[0].criteria.target = 5;
  
  const results = await checkAchievements(supabase, ['student-1']);
  
  assertEquals(results.length, 1);
  assertEquals(results[0].achievements_progressed.length, 1);
  assertEquals(results[0].achievements_progressed[0].progress, 1);
  assertEquals(results[0].achievements_progressed[0].target, 5);
  assertEquals(results[0].achievements_progressed[0].percentage, 20);
});

Deno.test('Achievement Checker - Skip already unlocked', async () => {
  const supabase = createMockSupabase() as any;
  
  // Pre-populate unlocked achievement
  supabase._studentAchievementsData.push({
    student_id: 'student-1',
    achievement_id: 'ach-1',
    progress: { current: 1, target: 1 },
    unlocked: true,
    unlocked_at: '2024-10-25T00:00:00Z',
  });
  
  const results = await checkAchievements(supabase, ['student-1']);
  
  assertEquals(results.length, 1);
  // Should only unlock Fire Starter, not First Day (already unlocked)
  const unlockedNames = results[0].achievements_unlocked.map(a => a.achievement_name);
  assertEquals(unlockedNames.includes('First Day'), false);
  assertEquals(unlockedNames.includes('Fire Starter'), true);
});

Deno.test('Achievement Checker - Award bonus points', async () => {
  const supabase = createMockSupabase() as any;
  
  await checkAchievements(supabase, ['student-1']);
  
  // Check that points were inserted
  assertEquals(supabase._pointsData.length, 2); // One for each achievement
  assertEquals(supabase._pointsData[0].transaction_type, 'achievement');
  assertEquals(supabase._pointsData[0].points, 10);
});

Deno.test('Achievement Checker - Send notifications', async () => {
  const supabase = createMockSupabase() as any;
  
  await checkAchievements(supabase, ['student-1']);
  
  // Check that notifications were sent
  assertEquals(supabase._notificationsData.length, 2); // One for each achievement
  assertEquals(supabase._notificationsData[0].notification_type, 'achievement');
  assertEquals(supabase._notificationsData[0].data.trigger_confetti, true);
});

console.log('✓ All achievement checker tests passed');
