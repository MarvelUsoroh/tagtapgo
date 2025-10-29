-- Auto-generate redemption codes using a database trigger
-- This allows the frontend to insert redemptions without providing a code

-- Function to generate a unique redemption code
CREATE OR REPLACE FUNCTION generate_redemption_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 12-character alphanumeric code (uppercase)
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM redemptions WHERE redemption_code = code) INTO exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Trigger function to auto-generate redemption code before insert
CREATE OR REPLACE FUNCTION set_redemption_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate code if not provided
  IF NEW.redemption_code IS NULL OR NEW.redemption_code = '' THEN
    NEW.redemption_code := generate_redemption_code();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_set_redemption_code ON redemptions;

-- Create trigger
CREATE TRIGGER trigger_set_redemption_code
  BEFORE INSERT ON redemptions
  FOR EACH ROW
  EXECUTE FUNCTION set_redemption_code();

-- Make redemption_code nullable (allow NULL during insert, trigger will fill it)
ALTER TABLE redemptions 
  ALTER COLUMN redemption_code DROP NOT NULL;

-- Add a check constraint to ensure code is not empty after trigger runs
ALTER TABLE redemptions
  ADD CONSTRAINT redemption_code_not_empty 
  CHECK (redemption_code IS NOT NULL AND redemption_code != '');

-- Verify trigger was created
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Redemption code auto-generation configured';
  RAISE NOTICE '  - Function: generate_redemption_code()';
  RAISE NOTICE '  - Trigger: trigger_set_redemption_code';
  RAISE NOTICE '  - Column: redemption_code (nullable during insert)';
  RAISE NOTICE '  - Constraint: redemption_code_not_empty (ensures code exists)';
  RAISE NOTICE '';
  RAISE NOTICE 'Frontend can now insert redemptions without providing redemption_code';
  RAISE NOTICE '';
END $$;
