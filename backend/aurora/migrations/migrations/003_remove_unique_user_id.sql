-- Remove unique constraint on user_id column in territories table if it exists
DO $$
BEGIN
    -- Check if the unique constraint exists and drop it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'UNIQUE' 
        AND table_name = 'territories' 
        AND constraint_name LIKE '%user_id%'
    ) THEN
        -- Get the constraint name and drop it
        EXECUTE (
            SELECT 'ALTER TABLE territories DROP CONSTRAINT ' || constraint_name || ';'
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'UNIQUE' 
            AND table_name = 'territories' 
            AND constraint_name LIKE '%user_id%'
            LIMIT 1
        );
    END IF;
END $$;