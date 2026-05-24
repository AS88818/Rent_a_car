-- Convert quote_submission email template from HTML to plain text
-- This makes it editable in the same simple way as other templates

UPDATE email_templates
SET
  body = '{{company_name}} - Vehicle Rental Quote

Client: {{client_name}}
Period: {{start_date}} to {{end_date}}
Duration: {{duration}}
Pickup: {{pickup_location}}
Drop-off: {{pickup_location}}
Type: {{rental_type}}

Available Options:

{{vehicle_options}}

Notes:

1. Prices include 16% VAT
2. Card payments accepted - 3% transaction fee applies
3. 25% to book; 75% balance AND refundable deposits are due on day 1 of your rental

Terms & Conditions Apply

For booking or inquiries, please contact us.',
  available_variables = ARRAY[
    'client_name',
    'quote_reference',
    'start_date',
    'end_date',
    'duration',
    'pickup_location',
    'rental_type',
    'vehicle_options',
    'company_name',
    'company_tagline',
    'company_email',
    'company_phone_nanyuki',
    'company_phone_nairobi',
    'company_website',
    'company_address',
    'email_signature'
  ],
  updated_at = NOW()
WHERE template_key = 'quote_submission';
