-- Fix redemption_code to use DEFAULT instead of trigger
-- This is more maintainable and prevents constraint violations

-- 1. Drop the existing trigger (we'll use DEFAULT instead)
DROP TRIGGER IF EXISTS trigger_set_redemption_code ON public.redemptions;

-- 2. Drop the constraint that prevents NULL
ALTER TABLE public.redemptions 
DROP CONSTRAINT IF EXISTS redemption_code_not_empty;

-- 3. Add DEFAULT to the column
ALTER TABLE public.redemptions 
ALTER COLUMN redemption_code SET DEFAULT generate_redemption_code();

-- 4. Add a simpler constraint that allows NULL temporarily but not empty strings
-- (NULL is OK during insert, DEFAULT will set it immediately)
ALTER TABLE public.redemptions
ADD CONSTRAINT redemption_code_not_empty 
CHECK (redemption_code IS NULL OR redemption_code <> '');

-- 5. Update any existing NULL codes (shouldn't be any, but just in case)
UPDATE public.redemptions 
SET redemption_code = generate_redemption_code() 
WHERE redemption_code IS NULL;

-- 6. Now make it NOT NULL (after all existing rows have codes)
ALTER TABLE public.redemptions 
ALTER COLUMN redemption_code SET NOT NULL;

-- 7. Update the constraint to be strict again
ALTER TABLE public.redemptions
DROP CONSTRAINT redemption_code_not_empty;

ALTER TABLE public.redemptions
ADD CONSTRAINT redemption_code_not_empty 
CHECK (redemption_code <> '');

-- Note: The trigger function set_redemption_code() can be kept for backward compatibility
-- but it won't be used anymore since DEFAULT handles it
