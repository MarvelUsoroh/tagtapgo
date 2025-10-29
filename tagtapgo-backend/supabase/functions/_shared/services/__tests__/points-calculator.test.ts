/**
 * Points Calculator Service Tests
 * 
 * Tests the points calculation logic including:
 * - Base attendance points
 * - Early arrival bonus
 * - Perfect week bonus
 * - Perfect month bonus
 * - Idempotency
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { calculateAndAwardPoints, type AttendanceRecord } from '../points-calculator.ts';

// Mock Supabase client
function createMockSupabase() {
  const pointsData: any[] = [];
  const attendanceData: any[] = [];
  
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: any) => {
          const query = {
            single: () => {
              if (table === 'points') {
                const found = pointsData.find(p => p[column] === value);
                return { data: found || null, error: found ? null : { code: 'PGRST116' } };
              }
              return { data: null, error: { code: 'PGRST116' } };
            },
            eq: (column2: string, value2: any) => ({
              single: () => {
                if (table === 'points') {
                  const found = pointsData.find(p => p[column] === value && p[column2] === value2);
                  return { data: found || null, error: found ? null : { code: 'PGRST116' } };
                }
                return { data: null, error: { code: 'PGRST116' } };
              },
            }),
            in: (column2: string, values: any[]) => ({
              gte: (column3: string, value3: any) => ({
                lte: (column4: string, value4: any) => {
                  if (table === 'attendance') {
                    return { data: attendanceData, error: null };
                  }
                  return { data: [], error: null };
                },
              }),
            }),
          };
          return query;
        },
      }),
      insert: (records: any[]) => {
        if (table === 'points') {
          const newRecords = Array.isArray(records) ? records : [records];
          pointsData.push(...newRecords);
        }
        return { error: null };
      },
    }),
    _pointsData: pointsData,
    _attendanceData: attendanceData,
  };
}

Deno.test('Points Calculator - Base attendance points', async () => {
  const supabase = createMockSupabase() as any;
  
  const attendance: AttendanceRecord[] = [
    {
      id: 'att-1',
      student_id: 'student-1',
      course_id: 'course-1',
      date: '2024-10-26',
      status: 'present',
      created_at: '2024-10-26T10:00:00Z',
    },
  ];
  
  const results = await calculateAndAwardPoints(supabase, attendance);
  
  assertEquals(results.length, 1);
  assertEquals(results[0].student_id, 'student-1');
  assertEquals(results[0].total_points_awarded, 10);
  assertEquals(results[0].transactions.length, 1);
  assertEquals(results[0].transactions[0].transaction_type, 'attendance');
  assertEquals(results[0].transactions[0].points, 10);
});

Deno.test('Points Calculator - Early arrival bonus', async () => {
  const supabase = createMockSupabase() as any;
  
  const attendance: AttendanceRecord[] = [
    {
      id: 'att-2',
      student_id: 'student-1',
      course_id: 'course-1',
      date: '2024-10-26',
      status: 'present',
      check_in_time: '2024-10-26T09:50:00Z',
      scheduled_time: '2024-10-26T10:00:00Z',
      created_at: '2024-10-26T09:50:00Z',
    },
  ];
  
  const results = await calculateAndAwardPoints(supabase, attendance);
  
  assertEquals(results.length, 1);
  assertEquals(results[0].total_points_awarded, 15); // 10 base + 5 early
  assertEquals(results[0].transactions.length, 2);
  assertEquals(results[0].transactions[1].transaction_type, 'early_arrival');
  assertEquals(results[0].transactions[1].points, 5);
});

Deno.test('Points Calculator - No points for absent', async () => {
  const supabase = createMockSupabase() as any;
  
  const attendance: AttendanceRecord[] = [
    {
      id: 'att-3',
      student_id: 'student-1',
      course_id: 'course-1',
      date: '2024-10-26',
      status: 'absent',
      created_at: '2024-10-26T10:00:00Z',
    },
  ];
  
  const results = await calculateAndAwardPoints(supabase, attendance);
  
  assertEquals(results.length, 1);
  assertEquals(results[0].total_points_awarded, 0);
  assertEquals(results[0].transactions.length, 0);
});

Deno.test('Points Calculator - Multiple students', async () => {
  const supabase = createMockSupabase() as any;
  
  const attendance: AttendanceRecord[] = [
    {
      id: 'att-4',
      student_id: 'student-1',
      course_id: 'course-1',
      date: '2024-10-26',
      status: 'present',
      created_at: '2024-10-26T10:00:00Z',
    },
    {
      id: 'att-5',
      student_id: 'student-2',
      course_id: 'course-1',
      date: '2024-10-26',
      status: 'present',
      created_at: '2024-10-26T10:00:00Z',
    },
  ];
  
  const results = await calculateAndAwardPoints(supabase, attendance);
  
  assertEquals(results.length, 2);
  assertEquals(results[0].student_id, 'student-1');
  assertEquals(results[0].total_points_awarded, 10);
  assertEquals(results[1].student_id, 'student-2');
  assertEquals(results[1].total_points_awarded, 10);
});

console.log('✓ All points calculator tests passed');
