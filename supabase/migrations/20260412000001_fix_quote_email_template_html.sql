/*
  # Fix Quote Email Template - Proper HTML Formatting

  Updates the quote_submission email template to use proper HTML formatting
  so it renders correctly in email clients instead of appearing as plain text.
*/

UPDATE email_templates
SET body = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
    .content { background: white; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; }
    .quote-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .quote-details h3 { margin-top: 0; color: #1e40af; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-label { font-weight: 600; color: #4b5563; }
    .detail-value { color: #1f2937; }
    .attachment-note { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Rent A Car In Kenya</div>
      <p style="margin: 0; font-size: 18px;">Your Vehicle Rental Quote</p>
    </div>
    <div class="content">
      <p>Dear {{client_name}},</p>
      <p>Thank you for your interest in {{company_name}}! Please find attached your quotation with the following details:</p>
      <div class="quote-details">
        <h3>Quote Summary</h3>
        <div class="detail-row">
          <span class="detail-label">Quote Reference:</span>
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
        <div class="detail-row" style="border-bottom: none;">
          <span class="detail-label">Rental Type:</span>
          <span class="detail-value">{{rental_type}}</span>
        </div>
      </div>
      <div class="attachment-note">
        <strong>Attachment Included</strong><br>
        Please review the attached PDF for detailed pricing information, including the effective daily rate for each vehicle category.
      </div>
      <p>To proceed with your booking, simply reply to this email or contact us directly. We look forward to serving you!</p>
      <p style="margin-top: 30px;">{{email_signature}}</p>
    </div>
    <div class="footer">
      <p style="margin: 0;">{{company_name}} | Premium Vehicle Rentals<br>
      Email: {{company_email}} &nbsp;|&nbsp; Nairobi: {{company_phone_nairobi}} &nbsp;|&nbsp; Nanyuki: {{company_phone_nanyuki}}</p>
    </div>
  </div>
</body>
</html>'
WHERE template_key = 'quote_submission';
