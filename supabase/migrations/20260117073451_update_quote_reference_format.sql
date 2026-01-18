/*
  # Update Quote Reference Format

  1. Changes
    - Update generate_quote_reference function to new format: TXXXX_CATEGORY_LOCATION_DATE_TYPE
    - Format examples:
      - EST0001_STD_NRB_24JAN26_SELF
      - EST0002_COMPACT_NYK_17JAN26_CHAUFFEUR

  2. Parameters
    - category_name: Vehicle category name
    - location: Pickup location
    - start_date: Start date of rental
    - hire_type: 'self_drive', 'chauffeur', or 'transfer'
*/

-- Helper function to abbreviate category names
CREATE OR REPLACE FUNCTION abbreviate_category(category_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE
    WHEN LOWER(category_name) LIKE '%standard%' OR LOWER(category_name) = 'std' THEN 'STD'
    WHEN LOWER(category_name) LIKE '%compact%' THEN 'COMPACT'
    WHEN LOWER(category_name) LIKE '%luxury%' OR LOWER(category_name) LIKE '%premium%' THEN 'LUX'
    WHEN LOWER(category_name) LIKE '%suv%' THEN 'SUV'
    WHEN LOWER(category_name) LIKE '%van%' OR LOWER(category_name) LIKE '%minibus%' THEN 'VAN'
    WHEN LOWER(category_name) LIKE '%4x4%' THEN '4X4'
    WHEN LOWER(category_name) LIKE '%executive%' OR LOWER(category_name) LIKE '%exec%' THEN 'EXEC'
    ELSE UPPER(SUBSTRING(category_name FROM 1 FOR 5))
  END;
END;
$$;

-- Helper function to abbreviate location
CREATE OR REPLACE FUNCTION abbreviate_location(location text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE
    WHEN LOWER(location) LIKE '%nairobi%' THEN 'NRB'
    WHEN LOWER(location) LIKE '%nanyuki%' THEN 'NYK'
    WHEN LOWER(location) LIKE '%mombasa%' THEN 'MBA'
    WHEN LOWER(location) LIKE '%kisumu%' THEN 'KSM'
    WHEN LOWER(location) LIKE '%eldoret%' THEN 'ELD'
    WHEN LOWER(location) LIKE '%nakuru%' THEN 'NAK'
    WHEN LOWER(location) LIKE '%airport%' THEN 'APT'
    WHEN LOWER(location) LIKE '%jkia%' THEN 'JKIA'
    ELSE UPPER(SUBSTRING(REGEXP_REPLACE(location, '[^a-zA-Z]', '', 'g') FROM 1 FOR 3))
  END;
END;
$$;

-- Update the quote reference generation function
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

  -- Determine hire type abbreviation
  hire_type_abbr := CASE
    WHEN p_hire_type = 'self_drive' THEN 'SELF'
    WHEN p_hire_type = 'chauffeur' THEN 'CHAUFFEUR'
    WHEN p_hire_type = 'transfer' THEN 'TRANSFER'
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

-- Note: Existing quotes keep their old references for historical accuracy
-- Only new quotes will use the new format
