/*
  # Shorten Reference Abbreviations

  1. Changes
    - Update hire type abbreviations to shorter versions for better display:
      - CHAUFFEUR -> CHF
      - TRANSFER -> TR
      - SELF remains SELF
    - Update location abbreviations:
      - NAIROBI -> NRB
      - NANYUKI -> NYK

  2. Impact
    - Applies to both quote and booking references going forward
    - Existing references remain unchanged for historical accuracy
*/

-- Update generate_quote_reference function with shorter abbreviations
CREATE OR REPLACE FUNCTION generate_quote_reference(
  p_category_name text DEFAULT 'MULTCAT',
  p_location text DEFAULT '',
  p_start_date date DEFAULT CURRENT_DATE,
  p_hire_type text DEFAULT 'self_drive'
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  counter integer;
  category_abbr text;
  location_abbr text;
  date_str text;
  hire_type_abbr text;
  new_reference text;
BEGIN
  -- Get next value from sequence
  counter := nextval('quote_counter_seq');

  -- Abbreviate category
  category_abbr := abbreviate_category(p_category_name);

  -- Abbreviate location
  location_abbr := abbreviate_location(p_location);
  IF location_abbr = '' THEN
    location_abbr := 'LOC';
  END IF;

  -- Format date as DDMMMYY (e.g., 24JAN26)
  date_str := TO_CHAR(p_start_date, 'DDMON');
  date_str := date_str || SUBSTRING(TO_CHAR(p_start_date, 'YY') FROM 1 FOR 2);
  date_str := UPPER(date_str);

  -- Determine hire type abbreviation (shortened versions)
  hire_type_abbr := CASE
    WHEN p_hire_type = 'self_drive' THEN 'SELF'
    WHEN p_hire_type = 'chauffeur' THEN 'CHF'
    WHEN p_hire_type = 'transfer' THEN 'TR'
    ELSE 'SELF'
  END;

  -- Format: EST0001_CATEGORY_LOCATION_DATE_TYPE
  new_reference := 'EST' || LPAD(counter::text, 4, '0') || '_' ||
                   category_abbr || '_' ||
                   location_abbr || '_' ||
                   date_str || '_' ||
                   hire_type_abbr;

  RETURN new_reference;
END;
$$;

-- Update generate_booking_reference function with shorter abbreviations
CREATE OR REPLACE FUNCTION generate_booking_reference(
  p_vehicle_id uuid,
  p_start_location text DEFAULT '',
  p_start_date date DEFAULT CURRENT_DATE,
  p_booking_type text DEFAULT 'self_drive'
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  counter integer;
  category_name text;
  category_abbr text;
  location_abbr text;
  date_str text;
  booking_type_abbr text;
  new_reference text;
BEGIN
  -- Get next value from sequence
  counter := nextval('booking_counter_seq');

  -- Get vehicle category name
  SELECT vc.category_name INTO category_name
  FROM vehicles v
  JOIN vehicle_categories vc ON v.category_id = vc.id
  WHERE v.id = p_vehicle_id;

  -- Default to UNKNOWN if vehicle or category not found
  IF category_name IS NULL THEN
    category_name := 'UNKNOWN';
  END IF;

  -- Abbreviate category using the existing function
  category_abbr := abbreviate_category(category_name);

  -- Abbreviate location using the existing function
  location_abbr := abbreviate_location(p_start_location);
  IF location_abbr = '' THEN
    location_abbr := 'LOC';
  END IF;

  -- Format date as DDMMMYY (e.g., 25JAN26)
  date_str := TO_CHAR(p_start_date, 'DDMON');
  date_str := date_str || SUBSTRING(TO_CHAR(p_start_date, 'YY') FROM 1 FOR 2);
  date_str := UPPER(date_str);

  -- Determine booking type abbreviation (shortened versions)
  booking_type_abbr := CASE
    WHEN p_booking_type = 'self_drive' THEN 'SELF'
    WHEN p_booking_type = 'chauffeur' THEN 'CHF'
    WHEN p_booking_type = 'transfer' THEN 'TR'
    ELSE 'SELF'
  END;

  -- Format: BKXXXX_CATEGORY_LOCATION_DATE_TYPE
  new_reference := 'BK' || LPAD(counter::text, 4, '0') || '_' ||
                   category_abbr || '_' ||
                   location_abbr || '_' ||
                   date_str || '_' ||
                   booking_type_abbr;

  RETURN new_reference;
END;
$$;

-- Set search path for security
ALTER FUNCTION public.generate_quote_reference(text, text, date, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_booking_reference(uuid, text, date, text) SET search_path = public, pg_temp;
