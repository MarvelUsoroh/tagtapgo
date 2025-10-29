/**
 * Get Sync Status API
 * 
 * Returns sync status and health metrics for all universities.
 * Used by admin dashboard to monitor sync job health.
 * 
 * Endpoints:
 * - GET /get-sync-status - Get all universities sync status
 * - GET /get-sync-status?universityId=xxx - Get specific university status
 * 
 * Returns:
 * - Last sync time per university
 * - Sync success/failure counts
 * - Error messages with context
 * - Health metrics (success rate, avg duration)
 * - Recent sync history
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UniversitySyncStatus {
  universityId: string;
  universityName: string;
  sisType: string;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'error' | 'never';
  lastSyncError: string | null;
  nextSyncAt: string;
  syncHealth: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    avgDuration: number;
    consecutiveFailures: number;
  };
  recentSyncs: Array<{
    syncedAt: string;
    status: string;
    recordsProcessed: number;
    duration: number;
    error: string | null;
  }>;
}

interface SyncStatusResponse {
  overall: {
    totalUniversities: number;
    healthyUniversities: number;
    unhealthyUniversities: number;
    lastJobRun: string | null;
    nextJobRun: string;
    jobHealth: {
      totalExecutions: number;
      successfulExecutions: number;
      failedExecutions: number;
      successRate: number;
      avgDuration: number;
    };
  };
  universities: UniversitySyncStatus[];
}

serve(async (req) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const universityId = url.searchParams.get('universityId');
    
    // Get overall job health
    const { data: jobHealth } = await supabase
      .from('cron_job_health')
      .select('*')
      .eq('job_name', 'attendance-sync-job')
      .single();
    
    // Get last job execution
    const { data: lastExecution } = await supabase
      .from('cron_job_executions')
      .select('*')
      .eq('job_name', 'attendance-sync-job')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    // Calculate next job run (every 5 minutes)
    const nextJobRun = lastExecution
      ? new Date(new Date(lastExecution.started_at).getTime() + 5 * 60 * 1000).toISOString()
      : new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    // Get universities
    let universitiesQuery = supabase
      .from('universities')
      .select('*')
      .eq('active', true);
    
    if (universityId) {
      universitiesQuery = universitiesQuery.eq('id', universityId);
    }
    
    const { data: universities, error: universitiesError } = await universitiesQuery;
    
    if (universitiesError) {
      throw new Error(`Failed to fetch universities: ${universitiesError.message}`);
    }
    
    // Get sync status for each university
    const universitiesStatus: UniversitySyncStatus[] = [];
    
    for (const university of universities || []) {
      // Get sync logs for this university
      const { data: syncLogs } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('university_id', university.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Calculate health metrics
      const recentLogs = syncLogs || [];
      const totalSyncs = recentLogs.length;
      const successfulSyncs = recentLogs.filter(log => log.status === 'success').length;
      const failedSyncs = recentLogs.filter(log => log.status === 'error').length;
      const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
      
      // Calculate average duration
      const successfulLogsWithDuration = recentLogs.filter(
        log => log.status === 'success' && log.duration_ms
      );
      const avgDuration = successfulLogsWithDuration.length > 0
        ? successfulLogsWithDuration.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / successfulLogsWithDuration.length
        : 0;
      
      // Calculate consecutive failures
      let consecutiveFailures = 0;
      for (const log of recentLogs) {
        if (log.status === 'error') {
          consecutiveFailures++;
        } else {
          break;
        }
      }
      
      // Format recent syncs
      const recentSyncs = recentLogs.slice(0, 5).map(log => ({
        syncedAt: log.created_at,
        status: log.status,
        recordsProcessed: log.records_processed || 0,
        duration: log.duration_ms || 0,
        error: log.error_message,
      }));
      
      universitiesStatus.push({
        universityId: university.id,
        universityName: university.name,
        sisType: university.sis_type,
        lastSyncAt: university.last_sync_at,
        lastSyncStatus: university.last_sync_status || 'never',
        lastSyncError: university.last_sync_error,
        nextSyncAt: nextJobRun,
        syncHealth: {
          totalSyncs,
          successfulSyncs,
          failedSyncs,
          successRate: Math.round(successRate * 100) / 100,
          avgDuration: Math.round(avgDuration),
          consecutiveFailures,
        },
        recentSyncs,
      });
    }
    
    // Build response
    const response: SyncStatusResponse = {
      overall: {
        totalUniversities: universities?.length || 0,
        healthyUniversities: universitiesStatus.filter(
          u => u.syncHealth.consecutiveFailures === 0 && u.lastSyncStatus === 'success'
        ).length,
        unhealthyUniversities: universitiesStatus.filter(
          u => u.syncHealth.consecutiveFailures >= 3 || u.lastSyncStatus === 'error'
        ).length,
        lastJobRun: lastExecution?.started_at || null,
        nextJobRun,
        jobHealth: {
          totalExecutions: jobHealth?.total_executions || 0,
          successfulExecutions: jobHealth?.successful_executions || 0,
          failedExecutions: jobHealth?.failed_executions || 0,
          successRate: jobHealth?.success_rate_percent || 0,
          avgDuration: Math.round(jobHealth?.avg_duration_ms || 0),
        },
      },
      universities: universitiesStatus,
    };
    
    return new Response(
      JSON.stringify(response),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GET SYNC STATUS] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
