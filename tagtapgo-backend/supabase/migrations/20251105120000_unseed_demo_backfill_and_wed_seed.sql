-- Unseed demo backfill attendance and the one-off Wednesday English Composition seed
-- Idempotent cleanup: deletes rows inserted by migrations
--   20251105091500_backfill_demo_attendance_for_enrolled_schedules
--   20251105113000_seed_wed_english_class_attendance_and_feedback

DO $$
DECLARE
  v_deleted_attendance INT := 0;
  v_deleted_prompts INT := 0;
  v_deleted_notifications INT := 0;
  v_deleted_schedules INT := 0;
BEGIN
  -- Delete notifications created by the Wednesday seed (by fixed ID or by promptId in data)
  DELETE FROM public.notifications n
  WHERE n.id = 'e7f6d5c4-b3a2-4c1d-9e8f-7a6b5c4d3e2f'
     OR n.data->>'promptId' = '9b2d0f59-2f8d-4d4a-8c7e-1f2a3b4c5d6e';
  GET DIAGNOSTICS v_deleted_notifications = ROW_COUNT;

  -- Delete feedback prompts from the Wednesday seed (by fixed ID or metadata flag)
  DELETE FROM public.feedback_prompts fp
  WHERE fp.id = '9b2d0f59-2f8d-4d4a-8c7e-1f2a3b4c5d6e'
     OR (fp.metadata ? 'seeded_by_migration' AND fp.metadata->>'seeded_by_migration' = '20251105113000_seed_wed_english_class_attendance_and_feedback');
  GET DIAGNOSTICS v_deleted_prompts = ROW_COUNT;

  -- Delete attendance backfill rows (by metadata flag)
  DELETE FROM public.attendance a
  WHERE (a.metadata ? 'seeded_by_migration')
    AND a.metadata->>'seeded_by_migration' IN (
      '20251105091500_backfill_demo_attendance_for_enrolled_schedules',
      '20251105113000_seed_wed_english_class_attendance_and_feedback'
    );
  GET DIAGNOSTICS v_deleted_attendance = ROW_COUNT;

  -- Delete the one-off Wednesday class schedule (by fixed ID and metadata flag)
  DELETE FROM public.class_schedules cs
  WHERE cs.id = '7a9b6c18-6b31-4c3a-8a6a-1a2b3c4d5e60'
    AND (cs.metadata ? 'seeded_for_demo')
    AND (cs.metadata ? 'created_by_migration')
    AND cs.metadata->>'created_by_migration' = '20251105113000_seed_wed_english_class_attendance_and_feedback';
  GET DIAGNOSTICS v_deleted_schedules = ROW_COUNT;

  RAISE NOTICE 'Unseed complete. Deleted: % attendance, % prompts, % notifications, % schedules',
    v_deleted_attendance, v_deleted_prompts, v_deleted_notifications, v_deleted_schedules;
END $$;
