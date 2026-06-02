-- Add Feature 6 mileage allowance support to the existing quote email template.

UPDATE email_templates
SET
  body = CASE
    WHEN body LIKE '%{{mileage_allowance}}%' THEN
      replace(body, 'Drop-off: {{pickup_location}}', 'Drop-off: {{dropoff_location}}')
    ELSE replace(
      replace(body, 'Drop-off: {{pickup_location}}', 'Drop-off: {{dropoff_location}}'),
      'Type: {{rental_type}}

Available Options:',
      'Type: {{rental_type}}

Inclusions:
{{mileage_allowance}}

Available Options:'
    )
  END,
  available_variables = (
    SELECT array_agg(DISTINCT variable ORDER BY variable)
    FROM unnest(available_variables || ARRAY['dropoff_location', 'mileage_allowance']) AS vars(variable)
  ),
  updated_at = now()
WHERE template_key = 'quote_submission';
