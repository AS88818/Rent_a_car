/*
  # Update Email Templates to Plain Text Format

  1. Changes
    - Update invoice_receipt template to plain text format (matching booking emails)
    - Update quote_submission template to plain text format (matching booking emails)
    - Consistent branding with "Rent A Car In Kenya"

  2. Important Notes
    - Maintains all variables
    - Simpler format for better email client compatibility
*/

-- Update invoice_receipt template to plain text
UPDATE email_templates
SET
  subject = 'Payment Receipt - Invoice {{invoice_reference}} - Rent A Car In Kenya',
  body = 'Dear {{client_name}},

Thank you for your payment! This email confirms that your invoice has been marked as PAID.

Payment Details:
Invoice Number: {{invoice_reference}}
Payment Date: {{payment_date}}
Payment Method: {{payment_method}}
Amount Paid: KES {{total_amount}}

This is your official payment receipt. Please keep this for your records.

If you have any questions about this payment or need additional documentation, please don''t hesitate to contact us.

Best regards,
Rent A Car In Kenya
Premium Vehicle Rentals

Contact Information:
Email: info@rentacarinkenya.com
Nanyuki Branch - Tel: +254722513739
Nairobi Branch - Tel: +254721177642

---
This is an automated receipt from Rent A Car In Kenya.
Please do not reply directly to this email.'
WHERE template_key = 'invoice_receipt';

-- Update quote_submission template to plain text
UPDATE email_templates
SET
  subject = 'Your Vehicle Rental Quote - {{quote_reference}} - Rent A Car In Kenya',
  body = 'Dear {{client_name}},

Thank you for your interest in Rent A Car In Kenya! We are pleased to provide you with a detailed quotation for your vehicle rental needs.

Quote Details:
Quote Reference: {{quote_reference}}
Rental Period: {{start_date}} to {{end_date}}
Duration: {{duration}}
Pickup Location: {{pickup_location}}
Rental Type: {{rental_type}}

Please find your detailed quotation attached to this email as a PDF document.

This quote is valid for 7 days from the date of issue. To confirm your booking, please contact us with your quote reference number.

If you have any questions or need assistance, please don''t hesitate to reach out.

Best regards,
Rent A Car In Kenya
Premium Vehicle Rentals

Contact Information:
Email: info@rentacarinkenya.com
Nanyuki Branch - Tel: +254722513739
Nairobi Branch - Tel: +254721177642

---
This is an automated message from Rent A Car In Kenya.
Please do not reply directly to this email.'
WHERE template_key = 'quote_submission';

-- Also update booking emails to include contact info
UPDATE email_templates
SET
  body = 'Dear {{client_name}},

Thank you for choosing Rent A Car In Kenya! Your booking has been confirmed.

Booking Details:
Vehicle: {{vehicle_reg}}
Pickup Date: {{start_date}} at {{start_time}}
Dropoff Date: {{end_date}} at {{end_time}}
Pickup Location: {{start_location}}
Dropoff Location: {{end_location}}
Duration: {{duration}}

Important Information:
- Please arrive 15 minutes before your scheduled pickup time
- Bring a valid driver''s license and identification
- Contact us if you need to make any changes

If you have any questions or need assistance, please don''t hesitate to contact us.

Best regards,
Rent A Car In Kenya
Premium Vehicle Rentals

Contact Information:
Email: info@rentacarinkenya.com
Nanyuki Branch - Tel: +254722513739
Nairobi Branch - Tel: +254721177642

---
This is an automated message from Rent A Car In Kenya.
Please do not reply directly to this email.'
WHERE template_key = 'booking_confirmation';

UPDATE email_templates
SET
  body = 'Dear {{client_name}},

This is a friendly reminder that your vehicle pickup is scheduled for tomorrow.

Pickup Details:
Vehicle: {{vehicle_reg}}
Date: {{start_date}} at {{start_time}}
Location: {{start_location}}

Preparation Checklist:
- Valid driver''s license
- Government-issued ID
- Payment method (if applicable)
- Arrive 15 minutes early

Return Information:
Return Date: {{end_date}} at {{end_time}}
Return Location: {{end_location}}

Need to make changes or have questions? Contact us!

We look forward to serving you!

Best regards,
Rent A Car In Kenya
Premium Vehicle Rentals

Contact Information:
Email: info@rentacarinkenya.com
Nanyuki Branch - Tel: +254722513739
Nairobi Branch - Tel: +254721177642

---
This is an automated reminder from Rent A Car In Kenya.
Please do not reply directly to this email.'
WHERE template_key = 'pickup_reminder';

UPDATE email_templates
SET
  body = 'Dear {{client_name}},

This is a reminder that your vehicle return is scheduled for tomorrow.

Return Details:
Vehicle: {{vehicle_reg}}
Date: {{end_date}} at {{end_time}}
Location: {{end_location}}

Before Returning:
- Refuel the vehicle to the level indicated in your agreement
- Remove all personal belongings
- Note any damage or issues
- Clean the vehicle interior

Late Returns:
Please contact us immediately if you need to extend your rental or expect to be late.

Thank you for choosing Rent A Car In Kenya!

Best regards,
Rent A Car In Kenya
Premium Vehicle Rentals

Contact Information:
Email: info@rentacarinkenya.com
Nanyuki Branch - Tel: +254722513739
Nairobi Branch - Tel: +254721177642

---
This is an automated reminder from Rent A Car In Kenya.
Please do not reply directly to this email.'
WHERE template_key = 'dropoff_reminder';
