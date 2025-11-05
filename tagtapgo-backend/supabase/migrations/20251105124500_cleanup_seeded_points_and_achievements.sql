-- Cleanup seeded points and achievements from test/seeding on 2025-11-05
-- Idempotent and conservative: scoped to creation/unlock date 2025-11-05 and orphaned references

DO $$
DECLARE
  v_deleted_points_today INT := 0;
  v_deleted_points_orphans INT := 0;
  v_deleted_student_achievements INT := 0;
BEGIN
  -- 1) Delete points created on 2025-11-05 (test day) across common gamification types
  DELETE FROM public.points p
  WHERE p.created_at::date = DATE '2025-11-05'
    AND p.transaction_type IN (
      'attendance','early_arrival','perfect_week','perfect_month','feedback','streak','achievement'
    );
  GET DIAGNOSTICS v_deleted_points_today = ROW_COUNT;

  -- 2) Delete orphaned attendance-linked points created on/after 2025-11-05
  --    (e.g., points issued for attendance rows that were later removed by cleanup)
  --    Only consider references that look like UUIDs to avoid touching non-attendance refs.
  DELETE FROM public.points p
  WHERE p.created_at >= DATE '2025-11-05'
    AND p.transaction_type IN ('attendance','early_arrival','perfect_week','perfect_month','feedback','streak')
    AND (
      p.reference_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance a WHERE a.id::text = p.reference_id
    );
  GET DIAGNOSTICS v_deleted_points_orphans = ROW_COUNT;

  -- 3) Delete student achievements unlocked/created on 2025-11-05 (test day)
  DELETE FROM public.student_achievements sa
  WHERE (
    COALESCE(sa.unlocked, false) = true AND sa.unlocked_at::date = DATE '2025-11-05'
  ) OR (
    (sa.created_at IS NOT NULL AND sa.created_at::date = DATE '2025-11-05')
  );
  GET DIAGNOSTICS v_deleted_student_achievements = ROW_COUNT;

  RAISE NOTICE 'Cleanup complete. Deleted points (today): %, orphaned points: %, student_achievements: %',
    v_deleted_points_today, v_deleted_points_orphans, v_deleted_student_achievements;
END $$;
