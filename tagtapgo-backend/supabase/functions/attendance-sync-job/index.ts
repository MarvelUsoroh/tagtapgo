/**
 * Attendance Sync Job
 * 
 * Runs every 5 minutes to sync attendance data from SIS/LMS systems.
 * Uses the canonical schema from adapters to process data in a school-agnostic way.
 * 
 * Flow:
 * 1. Load university configurations
 * 2. For each university:
 *    a. Get/create adapter from registry
 *    b. Check adapter health
 *    c. Fetch data using canonical schema
 *    d. Process and upsert to database
 *    e. Log results
 * 3. Return sync summary
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AdapterRegistry, AdapterFactory } from '../_shared/adapters/index.ts';
import type { CanonicalSchema, CanonicalCourse } from '../_shared/types/canonical-schema.ts';
import {
  validateCourse,
  validateStudent,
  validateAttendance,
  validateSchedule,
  normalizeCourse,
  normalizeStudent,
  normalizeAttendance,
  normalizeSchedule,
  normalizeEnrollment,
  processBatches,
} from '../_shared/utils/data-processor.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Global adapter registry (persists across function invocations)
const registry = new AdapterRegistry();

interface SyncResult {
  universityId: string;
  universityName: string;
  success: boolean;
  coursesProcessed: number;
  studentsProcessed: number;
  attendanceProcessed: number;
  schedulesProcessed: number;
  error?: string;
  duration: number;
}

interface SyncSummary {
  totalUniversities: number;
  successCount: number;
  errorCount: number;
  results: SyncResult[];
  totalDuration: number;
}

serve(async (req) => {
  const startTime = Date.now();
  
  try {
    console.log('[SYNC JOB] Starting attendance sync job...');
    
    // Load university configurations
    const { data: universities, error: universitiesError } = await supabase
      .from('universities')
      .select('*')
      .eq('active', true);
    
    if (universitiesError) {
      throw new Error(`Failed to load universities: ${universitiesError.message}`);
    }
    
    if (!universities || universities.length === 0) {
      console.log('[SYNC JOB] No active universities found');
      return new Response(
        JSON.stringify({ message: 'No active universities to sync' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    console.log(`[SYNC JOB] Found ${universities.length} active universities`);
    
    // Process each university
    const results: SyncResult[] = [];
    
    for (const university of universities) {
      const uniStartTime = Date.now();
      
      try {
        console.log(`[SYNC JOB] Processing university: ${university.name} (${university.id})`);
        
        // Get or create adapter
        let adapter = registry.get(university.id);
        
        if (!adapter) {
          console.log(`[SYNC JOB] Creating new adapter for ${university.name}`);
          await registry.register(university.id, university.api_config);
          adapter = registry.get(university.id);
        }
        
        if (!adapter) {
          throw new Error('Failed to create adapter');
        }
        
        // Check adapter health
        const healthy = await registry.checkHealth(university.id);
        
        if (!healthy) {
          console.warn(`[SYNC JOB] Adapter unhealthy for ${university.name}, attempting recovery...`);
          const recovered = await registry.recover(university.id);
          
          if (!recovered) {
            throw new Error('Adapter unhealthy and recovery failed');
          }
        }
        
        // Get last sync time for incremental sync
        const lastSyncTime = university.last_sync_at 
          ? new Date(university.last_sync_at)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
        
        // Fetch data using canonical schema
        console.log(`[SYNC JOB] Fetching data since ${lastSyncTime.toISOString()}`);
        const schema: CanonicalSchema = await adapter.fetchAll(lastSyncTime);
        
        // Validate schema
        const { validateCanonicalSchema } = await import('../_shared/types/canonical-schema.ts');
        const validationErrors = validateCanonicalSchema(schema);
        
        if (validationErrors.length > 0) {
          throw new Error(`Invalid schema: ${validationErrors.join(', ')}`);
        }
        
        // Process data
        const processResult = await processCanonicalData(university.id, schema);
        
        // Update last sync time
        await supabase
          .from('universities')
          .update({ 
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'success'
          })
          .eq('id', university.id);
        
        // Log success
        await logSyncOperation(university.id, 'success', processResult, null);
        
        const duration = Date.now() - uniStartTime;
        
        results.push({
          universityId: university.id,
          universityName: university.name,
          success: true,
          coursesProcessed: processResult.coursesProcessed,
          studentsProcessed: processResult.studentsProcessed,
          attendanceProcessed: processResult.attendanceProcessed,
          schedulesProcessed: processResult.schedulesProcessed,
          duration,
        });
        
        console.log(`[SYNC JOB] ✓ Completed ${university.name} in ${duration}ms`);
        
      } catch (error) {
        const duration = Date.now() - uniStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[SYNC JOB] ✗ Failed ${university.name}:`, errorMessage);
        
        // Update last sync status
        await supabase
          .from('universities')
          .update({ 
            last_sync_status: 'error',
            last_sync_error: errorMessage
          })
          .eq('id', university.id);
        
        // Log error
        await logSyncOperation(university.id, 'error', null, errorMessage);
        
        results.push({
          universityId: university.id,
          universityName: university.name,
          success: false,
          coursesProcessed: 0,
          studentsProcessed: 0,
          attendanceProcessed: 0,
          schedulesProcessed: 0,
          error: errorMessage,
          duration,
        });
      }
    }
    
    // Build summary
    const totalDuration = Date.now() - startTime;
    const summary: SyncSummary = {
      totalUniversities: universities.length,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length,
      results,
      totalDuration,
    };
    
    console.log(`[SYNC JOB] Completed sync job in ${totalDuration}ms`);
    console.log(`[SYNC JOB] Success: ${summary.successCount}, Errors: ${summary.errorCount}`);
    
    return new Response(
      JSON.stringify(summary),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SYNC JOB] Fatal error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * Process canonical data and upsert to database
 */
async function processCanonicalData(
  universityId: string,
  schema: CanonicalSchema
): Promise<{
  coursesProcessed: number;
  studentsProcessed: number;
  attendanceProcessed: number;
  schedulesProcessed: number;
}> {
  let coursesProcessed = 0;
  let studentsProcessed = 0;
  let attendanceProcessed = 0;
  let schedulesProcessed = 0;
  
  // Process each course
  for (const course of schema.courses) {
    try {
      // Upsert course
      await upsertCourse(universityId, course);
      coursesProcessed++;
      
      // Upsert roster (batch processing for performance)
      if (schema.meta.capabilities.roster && course.roster.length > 0) {
        await processBatches(course.roster, 50, async (batch) => {
          for (const student of batch) {
            await upsertStudent(universityId, student);
            await upsertEnrollment(course.id, student.id);
            studentsProcessed++;
          }
        });
      }
      
      // Upsert attendance (batch processing for performance)
      if (schema.meta.capabilities.attendance && course.attendance.length > 0) {
        await processBatches(course.attendance, 100, async (batch) => {
          for (const attendance of batch) {
            await upsertAttendance(universityId, attendance);
            attendanceProcessed++;
          }
        });
      }
      
      // Upsert schedule (batch processing for performance)
      if (schema.meta.capabilities.schedule && course.schedule.length > 0) {
        await processBatches(course.schedule, 50, async (batch) => {
          for (const schedule of batch) {
            await upsertSchedule(universityId, schedule);
            schedulesProcessed++;
          }
        });
      }
      
    } catch (error) {
      console.error(`[SYNC JOB] Error processing course ${course.id}:`, error);
      // Continue with next course
    }
  }
  
  return {
    coursesProcessed,
    studentsProcessed,
    attendanceProcessed,
    schedulesProcessed,
  };
}

/**
 * Upsert course (idempotent)
 */
async function upsertCourse(universityId: string, course: CanonicalCourse): Promise<void> {
  // Validate course data
  const validationErrors = validateCourse(course);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid course data: ${validationErrors.join(', ')}`);
  }
  
  // Normalize course data (timezone conversion, sanitization)
  const normalizedData = normalizeCourse(universityId, course);
  
  // Upsert with conflict resolution
  const { error } = await supabase
    .from('courses')
    .upsert(normalizedData, {
      onConflict: 'id',
    });
  
  if (error) {
    throw new Error(`Failed to upsert course: ${error.message}`);
  }
}

/**
 * Upsert student (idempotent)
 */
async function upsertStudent(universityId: string, student: any): Promise<void> {
  // Validate student data
  const validationErrors = validateStudent(student);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid student data: ${validationErrors.join(', ')}`);
  }
  
  // Normalize student data
  const normalizedData = normalizeStudent(universityId, student);
  
  // Upsert with conflict resolution
  const { error } = await supabase
    .from('students')
    .upsert(normalizedData, {
      onConflict: 'id',
    });
  
  if (error) {
    throw new Error(`Failed to upsert student: ${error.message}`);
  }
}

/**
 * Upsert enrollment (idempotent)
 */
async function upsertEnrollment(courseId: number, studentId: number): Promise<void> {
  // Normalize enrollment data
  const normalizedData = normalizeEnrollment(courseId, studentId);
  
  // Upsert with conflict resolution
  const { error } = await supabase
    .from('enrollments')
    .upsert(normalizedData, {
      onConflict: 'course_id,student_id',
    });
  
  if (error) {
    throw new Error(`Failed to upsert enrollment: ${error.message}`);
  }
}

/**
 * Upsert attendance (idempotent)
 */
async function upsertAttendance(universityId: string, attendance: any): Promise<void> {
  // Validate attendance data
  const validationErrors = validateAttendance(attendance);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid attendance data: ${validationErrors.join(', ')}`);
  }
  
  // Normalize attendance data (timezone conversion to UTC)
  const normalizedData = normalizeAttendance(universityId, attendance);
  
  // Upsert with conflict resolution
  const { error } = await supabase
    .from('attendance')
    .upsert(normalizedData, {
      onConflict: 'id',
    });
  
  if (error) {
    throw new Error(`Failed to upsert attendance: ${error.message}`);
  }
}

/**
 * Upsert schedule (idempotent)
 */
async function upsertSchedule(universityId: string, schedule: any): Promise<void> {
  // Validate schedule data
  const validationErrors = validateSchedule(schedule);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid schedule data: ${validationErrors.join(', ')}`);
  }
  
  // Normalize schedule data
  const normalizedData = normalizeSchedule(universityId, schedule);
  
  // Upsert with conflict resolution
  const { error } = await supabase
    .from('class_schedules')
    .upsert(normalizedData, {
      onConflict: 'id',
    });
  
  if (error) {
    throw new Error(`Failed to upsert schedule: ${error.message}`);
  }
}

/**
 * Log sync operation to sync_logs table
 */
async function logSyncOperation(
  universityId: string,
  status: 'success' | 'error',
  result: any | null,
  error: string | null
): Promise<void> {
  await supabase
    .from('sync_logs')
    .insert({
      university_id: universityId,
      status,
      records_processed: result ? 
        result.coursesProcessed + result.studentsProcessed + 
        result.attendanceProcessed + result.schedulesProcessed : 0,
      error_message: error,
      created_at: new Date().toISOString(),
    });
}
