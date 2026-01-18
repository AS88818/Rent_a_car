/*
  # Update Quote Reference Trigger

  1. Changes
    - Update the set_quote_reference_trigger function to pass parameters to generate_quote_reference
    - Extract first category from quote_data to use in reference
    - Use pickup location and start date from quote
    - Determine if quote has chauffeur option
*/

CREATE OR REPLACE FUNCTION set_quote_reference_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  first_category text;
  pickup_location text;
  start_date date;
  hire_type text;
BEGIN
  IF NEW.quote_reference IS NULL THEN
    -- Extract the first category from quote_data (if available)
    IF NEW.quote_data IS NOT NULL AND jsonb_typeof(NEW.quote_data) = 'object' THEN
      -- Get the first key from the quote_data object (this is the category name)
      SELECT key INTO first_category
      FROM jsonb_object_keys(NEW.quote_data) AS key
      LIMIT 1;
    END IF;

    -- Use MULTCAT if no specific category or multiple categories
    IF first_category IS NULL THEN
      first_category := 'MULTCAT';
    END IF;

    -- Extract location from quote_inputs or use empty string
    IF NEW.quote_inputs IS NOT NULL AND NEW.quote_inputs ? 'pickupLocation' THEN
      pickup_location := NEW.quote_inputs->>'pickupLocation';
    ELSE
      pickup_location := '';
    END IF;

    -- Use the start_date from the quote
    start_date := NEW.start_date;
    IF start_date IS NULL THEN
      start_date := CURRENT_DATE;
    END IF;

    -- Determine hire type
    IF NEW.has_chauffeur THEN
      hire_type := 'chauffeur';
    ELSE
      hire_type := 'self_drive';
    END IF;

    -- Generate the reference with all parameters
    NEW.quote_reference := generate_quote_reference(
      first_category,
      pickup_location,
      start_date,
      hire_type
    );
  END IF;
  RETURN NEW;
END;
$$;
