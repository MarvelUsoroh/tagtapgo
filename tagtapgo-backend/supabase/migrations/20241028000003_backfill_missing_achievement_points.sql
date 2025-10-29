-- Migration: Backfill Missing Achievement Points
-- Date: 2024-10-28
-- Description: Add missing achievement points for achievements that were unlocked but failed to award points

-- This migration adds achievement points for achievements that were unlocked
-- but failed to award points due to the UUID reference_id error that was fixed.

-- Add missing achievement points for Fire Starter (100 points)
INSERT INTO public.points (
    student_id,
    points,
    transaction_type,
    reference_id,
    description,
    metadata,
    created_at
)
SELECT 
    sa.student_id,
    a.points_reward,
    'achievement',
    sa.achievement_id::text,  -- Cast UUID to TEXT for reference_id
    'Achievement unlocked: ' || a.name,
    jsonb_build_object(
        'achievement_id', a.id,
        'achievement_name', a.name,
        'rarity', a.rarity,
        'retroactive', true
    ),
    sa.unlocked_at
FROM public.student_achievements sa
JOIN public.achievements a ON sa.achievement_id = a.id
WHERE sa.unlocked = true
    AND sa.unlocked_at IS NOT NULL
    -- Only add points for achievements that don't already have a points transaction
    AND NOT EXISTS (
        SELECT 1 
        FROM public.points p 
        WHERE p.student_id = sa.student_id 
            AND p.reference_id = sa.achievement_id::text  -- Cast UUID to TEXT
            AND p.transaction_type = 'achievement'
    )
ON CONFLICT DO NOTHING;

-- Log the results
DO $$
DECLARE
    points_added INTEGER;
BEGIN
    SELECT COUNT(*) INTO points_added
    FROM public.points
    WHERE transaction_type = 'achievement'
        AND metadata->>'retroactive' = 'true';
    
    RAISE NOTICE 'Backfilled % achievement point transactions', points_added;
END $$;

-- Verify the fix
SELECT 
    s.id as student_id,
    s.name as student_name,
    COUNT(DISTINCT sa.id) as achievements_unlocked,
    COUNT(DISTINCT p.id) as achievement_points_transactions,
    COALESCE(SUM(a.points_reward), 0) as expected_bonus_points,
    COALESCE(SUM(p.points), 0) as actual_bonus_points
FROM public.students s
LEFT JOIN public.student_achievements sa ON s.id = sa.student_id AND sa.unlocked = true
LEFT JOIN public.achievements a ON sa.achievement_id = a.id
LEFT JOIN public.points p ON s.id = p.student_id AND p.transaction_type = 'achievement'
GROUP BY s.id, s.name
HAVING COUNT(DISTINCT sa.id) > 0
ORDER BY s.name;
