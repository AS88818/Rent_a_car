/*
  # Update Email Templates with New Branding

  1. Changes
    - Replace all instances of "FleetHub" with "Rent A Car In Kenya Fleet Hub"
    - Update email signatures and branding
    - Maintain template structure and variables
  
  2. Affected Templates
    - booking_confirmation
    - pickup_reminder
    - dropoff_reminder
  
  3. Important Notes
    - Only updates content, not structure
    - Preserves all variables and functionality
*/

-- Update booking_confirmation template
UPDATE email_templates
SET 
  subject = 'Your Booking Confirmation - Rent A Car In Kenya',
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
- Contact us if you need to make any changes: {{contact_number}}

If you have any questions or need assistance, please don''t hesitate to contact us.

Best regards,
Rent A Car In Kenya Fleet Hub Team
Contact: {{contact_number}}

---
This is an automated message from Rent A Car In Kenya Fleet Hub.
Please do not reply directly to this email.'
WHERE template_key = 'booking_confirmation';

-- Update pickup_reminder template
UPDATE email_templates
SET 
  subject = 'Pickup Reminder - Your Vehicle is Ready - Rent A Car In Kenya',
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

Need to make changes or have questions?
Contact us: {{contact_number}}

We look forward to serving you!

Best regards,
Rent A Car In Kenya Fleet Hub Team

---
This is an automated reminder from Rent A Car In Kenya Fleet Hub.'
WHERE template_key = 'pickup_reminder';

-- Update dropoff_reminder template
UPDATE email_templates
SET 
  subject = 'Vehicle Return Reminder - Rent A Car In Kenya',
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
Contact: {{contact_number}}

Thank you for choosing Rent A Car In Kenya!

Best regards,
Rent A Car In Kenya Fleet Hub Team

---
This is an automated reminder from Rent A Car In Kenya Fleet Hub.'
WHERE template_key = 'dropoff_reminder';
