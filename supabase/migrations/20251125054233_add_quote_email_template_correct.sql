/*
  # Add Quote Email Template

  1. New Template
    - Create a quote email template for sending quotations to clients
    - Template supports variables for quote details
    - Set as system template with approved status

  2. Benefits
    - Consistent quote email branding
    - Professional communication
    - Easy customization
*/

-- Insert quote email template if it doesn't exist
INSERT INTO email_templates (
  template_key,
  template_name,
  subject,
  body,
  available_variables,
  is_system_template,
  schedule_type,
  is_active,
  approval_status,
  created_by,
  approved_by,
  approved_at
)
SELECT
  'quote_submission',
  'Quote Submission',
  'Your Vehicle Rental Quote - Rent A Car In Kenya',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; }
    .quote-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .quote-details h3 { margin-top: 0; color: #1e40af; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-label { font-weight: 600; color: #4b5563; }
    .detail-value { color: #1f2937; }
    .cta-button { display: inline-block; background: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; }
    .attachment-note { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚗 Rent A Car In Kenya</div>
      <p style="margin: 0; font-size: 18px;">Your Vehicle Rental Quote</p>
    </div>
    
    <div class="content">
      <p>Dear {{client_name}},</p>
      
      <p>Thank you for your interest in Rent A Car In Kenya! We are pleased to provide you with a detailed quotation for your vehicle rental needs.</p>
      
      <div class="quote-details">
        <h3>Quote Summary</h3>
        <div class="detail-row">
          <span class="detail-label">Reference Number:</span>
          <span class="detail-value">{{quote_reference}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Rental Period:</span>
          <span class="detail-value">{{start_date}} to {{end_date}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Duration:</span>
          <span class="detail-value">{{duration}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pickup Location:</span>
          <span class="detail-value">{{pickup_location}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Rental Type:</span>
          <span class="detail-value">{{rental_type}}</span>
        </div>
      </div>
      
      <div class="attachment-note">
        <strong>📎 Attachment Included</strong><br>
        Please find your detailed quotation attached to this email as a PDF document. It includes pricing for all available vehicle categories.
      </div>
      
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Review the attached quotation carefully</li>
        <li>Choose your preferred vehicle category</li>
        <li>Contact us to confirm your booking</li>
        <li>Provide any special requirements or questions</li>
      </ul>
      
      <p>Our team is ready to assist you with your booking. Please feel free to reach out if you have any questions or need any clarifications.</p>
      
      <center>
        <a href="tel:+254700000000" class="cta-button">Call Us to Book Now</a>
      </center>
      
      <p>We look forward to serving you and ensuring you have an excellent rental experience!</p>
      
      <p>Best regards,<br>
      <strong>Rent A Car In Kenya Team</strong></p>
    </div>
    
    <div class="footer">
      <p>Rent A Car In Kenya<br>
      Premium Vehicle Rentals | Self-Drive & Chauffeur Services<br>
      Email: info@rentacarinkenya.com | Phone: +254 700 000 000</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 15px;">
        This is an automated email. Please do not reply directly to this message.
      </p>
    </div>
  </div>
</body>
</html>',
  ARRAY['client_name', 'quote_reference', 'start_date', 'end_date', 'duration', 'pickup_location', 'rental_type'],
  true,
  'immediate',
  true,
  'approved',
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE template_key = 'quote_submission'
);
