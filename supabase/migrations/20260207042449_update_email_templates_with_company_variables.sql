/*
  # Update Email Templates to Use Company Settings Variables

  1. Changes
    - Updates all 5 email templates to replace hard-coded company info with template variables
    - Replaces literal company name, email, phone numbers with {{company_name}}, {{company_email}}, etc.
    - Adds {{email_signature}} variable to all templates as the footer/signature block

  2. Templates Updated
    - invoice_receipt
    - quote_submission
    - booking_confirmation
    - pickup_reminder
    - dropoff_reminder

  3. New Variables Available
    - {{company_name}} - Company name from settings
    - {{company_tagline}} - Company tagline
    - {{company_email}} - Contact email
    - {{company_phone_nanyuki}} - Nanyuki branch phone
    - {{company_phone_nairobi}} - Nairobi branch phone
    - {{company_website}} - Company website
    - {{email_signature}} - Full email signature block
*/

UPDATE email_templates
SET body = 'Dear {{client_name}},

Thank you for your payment. Here are your receipt details:

Invoice Reference: {{invoice_reference}}
Amount Paid: {{total_amount}}
Payment Date: {{payment_date}}
Payment Method: {{payment_method}}

If you have any questions about this payment, please don''t hesitate to contact us.

Thank you for choosing {{company_name}}.

---
{{email_signature}}'
WHERE template_key = 'invoice_receipt';

UPDATE email_templates
SET body = 'Dear {{client_name}},

Thank you for your interest in {{company_name}}!

Please find attached your quotation with the following details:

Quote Reference: {{quote_reference}}
Rental Period: {{start_date}} to {{end_date}}
Duration: {{duration}}
Pickup Location: {{pickup_location}}
Rental Type: {{rental_type}}

Please review the attached PDF for detailed pricing information. To proceed with your booking, simply reply to this email or contact us directly.

We look forward to serving you!

---
{{email_signature}}'
WHERE template_key = 'quote_submission';

UPDATE email_templates
SET body = 'Dear {{client_name}},

Your booking has been confirmed! Here are the details:

Vehicle: {{vehicle_reg}}
Start: {{start_date}} at {{start_time}}
End: {{end_date}} at {{end_time}}
Pickup Location: {{start_location}}
Drop-off Location: {{end_location}}
Duration: {{duration}}

If you need to make any changes, please contact us as soon as possible.

Thank you for choosing {{company_name}}!

---
{{email_signature}}'
WHERE template_key = 'booking_confirmation';

UPDATE email_templates
SET body = 'Dear {{client_name}},

This is a friendly reminder that your vehicle pickup is scheduled:

Vehicle: {{vehicle_reg}}
Pickup Date: {{start_date}} at {{start_time}}
Pickup Location: {{start_location}}

Please ensure you have the following ready:
- Valid driving license
- National ID or passport
- Payment confirmation

If you need to reschedule, please contact us as soon as possible.

See you soon!

---
{{email_signature}}'
WHERE template_key = 'pickup_reminder';

UPDATE email_templates
SET body = 'Dear {{client_name}},

This is a friendly reminder that your vehicle drop-off is scheduled:

Vehicle: {{vehicle_reg}}
Drop-off Date: {{end_date}} at {{end_time}}
Drop-off Location: {{end_location}}

Please ensure the vehicle is returned with:
- Same fuel level as pickup
- All personal belongings removed
- Any damages reported

Thank you for renting with {{company_name}}!

---
{{email_signature}}'
WHERE template_key = 'dropoff_reminder';