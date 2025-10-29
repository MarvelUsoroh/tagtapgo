#!/bin/bash

# ============================================================================
# pg_cron Setup Script
# ============================================================================
# 
# This script sets up pg_cron for the attendance sync job.
# 
# Usage:
#   ./scripts/setup-cron.sh
# 
# Prerequisites:
#   - Supabase CLI installed
#   - Project linked (supabase link)
#   - Environment variables set in .env
# 
# ============================================================================

set -e

echo "🚀 Setting up pg_cron for attendance sync job..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "❌ Supabase project not linked. Please run:"
    echo "   supabase link --project-ref your-project-ref"
    exit 1
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  .env file not found. Using default values."
fi

# Get Supabase URL and service role key
SUPABASE_URL=${SUPABASE_URL:-""}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing required environment variables:"
    echo "   SUPABASE_URL"
    echo "   SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "Please set them in .env file or export them:"
    echo "   export SUPABASE_URL='https://your-project-ref.supabase.co'"
    echo "   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    exit 1
fi

echo "✓ Environment variables loaded"
echo ""

# Apply migrations
echo "📦 Applying pg_cron migration..."
supabase db push

echo "✓ Migration applied"
echo ""

# Set configuration variables
echo "⚙️  Setting configuration variables..."

supabase db execute <<SQL
-- Set Supabase URL
ALTER DATABASE postgres SET app.settings.supabase_url = '$SUPABASE_URL';

-- Set service role key
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = '$SUPABASE_SERVICE_ROLE_KEY';
SQL

echo "✓ Configuration variables set"
echo ""

# Verify setup
echo "🔍 Verifying setup..."

RESULT=$(supabase db execute <<SQL
SELECT 
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname = 'attendance-sync-job';
SQL
)

if [ -z "$RESULT" ]; then
    echo "❌ Job not found. Setup may have failed."
    exit 1
fi

echo "✓ Job scheduled successfully"
echo ""

# Show job details
echo "📋 Job Details:"
supabase db execute <<SQL
SELECT 
  jobname AS "Job Name",
  schedule AS "Schedule",
  CASE WHEN active THEN '✓ Active' ELSE '✗ Inactive' END AS "Status"
FROM cron.job 
WHERE jobname = 'attendance-sync-job';
SQL

echo ""

# Show health status
echo "💚 Health Status:"
supabase db execute <<SQL
SELECT 
  COALESCE(job_name, 'attendance-sync-job') AS "Job Name",
  COALESCE(total_executions, 0) AS "Total Runs",
  COALESCE(successful_executions, 0) AS "Successful",
  COALESCE(failed_executions, 0) AS "Failed",
  COALESCE(success_rate_percent, 0) || '%' AS "Success Rate",
  COALESCE(TO_CHAR(last_execution_at, 'YYYY-MM-DD HH24:MI:SS'), 'Never') AS "Last Run"
FROM cron_job_health
WHERE job_name = 'attendance-sync-job'
UNION ALL
SELECT 
  'attendance-sync-job',
  0,
  0,
  0,
  '0%',
  'Never'
WHERE NOT EXISTS (
  SELECT 1 FROM cron_job_health WHERE job_name = 'attendance-sync-job'
);
SQL

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Deploy the attendance-sync-job Edge Function:"
echo "      supabase functions deploy attendance-sync-job"
echo ""
echo "   2. Configure universities in the database"
echo ""
echo "   3. Manually trigger the first sync:"
echo "      supabase db execute \"SELECT trigger_attendance_sync();\""
echo ""
echo "   4. Monitor job execution:"
echo "      supabase db execute \"SELECT * FROM cron_job_executions_recent;\""
echo ""
echo "📖 For more information, see docs/CRON_SETUP.md"
