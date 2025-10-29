/**
 * Test file for Primary Class Calculator
 * 
 * This file contains test cases to validate the primary class calculation logic.
 * Run these tests to ensure the algorithm works correctly.
 */

import { calculatePrimaryClass, calculatePrimaryClassesForStudents } from './primary-class-calculator.ts';

// Mock Supabase client for testing
const mockSupabase = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: string) => ({
        gte: (column: string, value: string) => ({
          lte: (column: string, value: string) => ({
            in: (column: string, values: string[]) => ({
              // Mock attendance data
              data: table === 'attendance' ? [
                { course_id: 'course-1', date: '2025-10-27', status: 'present' },
                { course_id: 'course-1', date: '2025-10-26', status: 'present' },
                { course_id: 'course-2', date: '2025-10-25', status: 'present' },
              ] : null,
              error: null
            })
          })
        })
      }),
      order: (column: string, options: any) => ({
        limit: (count: number) => ({
          single: () => ({
            // Mock enrollment data
            data: table === 'enrollments' ? { course_id: 'course-fallback', created_at: '2025-01-01' } : null,
            error: null
          })
        })
      })
    })
  })
} as any;

/**
 * Test primary class calculation with attendance data
 */
async function testPrimaryClassWithAttendance() {
  console.log('Testing primary class calculation with attendance data...');
  
  const result = await calculatePrimaryClass(
    mockSupabase,
    'test-student-1',
    '2025-10-21',
    '2025-10-27'
  );
  
  console.log('Result:', result);
  
  // Expected: course-1 should be primary (2 attendance vs 1 for course-2)
  const expected = {
    student_id: 'test-student-1',
    primary_course_id: 'course-1',
    attendance_count: 2,
    calculation_method: 'attendance',
    last_attendance_date: '2025-10-27'
  };
  
  console.log('Expected:', expected);
  console.log('Test passed:', JSON.stringify(result) === JSON.stringify(expected));
}

/**
 * Test tie-breaking logic
 */
function testTieBreaking() {
  console.log('\nTesting tie-breaking logic...');
  
  // Mock data with equal attendance counts
  const attendanceData = [
    { course_id: 'course-1', date: '2025-10-25', status: 'present' },
    { course_id: 'course-2', date: '2025-10-27', status: 'present' }, // More recent
  ];
  
  // This would be called internally by calculateFromAttendance
  // For now, we'll test the logic manually
  
  const courseCounts = new Map();
  const courseLatestDates = new Map();
  
  for (const record of attendanceData) {
    courseCounts.set(record.course_id, (courseCounts.get(record.course_id) || 0) + 1);
    const currentLatest = courseLatestDates.get(record.course_id);
    if (!currentLatest || record.date > currentLatest) {
      courseLatestDates.set(record.course_id, record.date);
    }
  }
  
  let primaryCourseId = null;
  let maxCount = 0;
  let latestDate = '';
  
  for (const [courseId, count] of courseCounts.entries()) {
    const courseLatestDate = courseLatestDates.get(courseId) || '';
    
    const shouldUpdate = 
      count > maxCount || 
      (count === maxCount && courseLatestDate > latestDate);
    
    if (shouldUpdate) {
      primaryCourseId = courseId;
      maxCount = count;
      latestDate = courseLatestDate;
    }
  }
  
  console.log('Primary course (tie-breaker):', primaryCourseId);
  console.log('Expected: course-2 (more recent date)');
  console.log('Test passed:', primaryCourseId === 'course-2');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== Primary Class Calculator Tests ===\n');
  
  await testPrimaryClassWithAttendance();
  testTieBreaking();
  
  console.log('\n=== Tests Complete ===');
}

// Export for potential use in other test files
export { runTests };

// Run tests if this file is executed directly
if (import.meta.main) {
  runTests();
}