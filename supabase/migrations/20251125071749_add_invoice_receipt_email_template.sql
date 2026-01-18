/*
  # Add Invoice Receipt Email Template

  1. New Template
    - Add an invoice receipt email template for paid invoices
    - Template includes invoice details and payment confirmation
    - Available variables: {{client_name}}, {{invoice_reference}}, {{total_amount}}, {{payment_date}}, {{payment_method}}
*/

-- Insert invoice receipt email template
INSERT INTO email_templates (
  template_key,
  template_name,
  subject,
  body,
  available_variables,
  is_active,
  schedule_type,
  schedule_value,
  schedule_unit,
  is_system_template,
  approval_status
) VALUES (
  'invoice_receipt',
  'Invoice Receipt - Payment Confirmation',
  'Payment Receipt - Invoice {{invoice_reference}}',
  E'<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .receipt-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .amount { font-size: 28px; font-weight: bold; color: #22c55e; text-align: center; margin: 15px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; color: #6b7280; font-size: 14px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">Payment Received</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for your payment</p>
    </div>
    
    <div class="content">
      <p>Dear {{client_name}},</p>
      
      <p>We have successfully received your payment. This email confirms that your invoice has been marked as <strong>PAID</strong>.</p>
      
      <div class="receipt-box">
        <h2 style="margin-top: 0; color: #22c55e; text-align: center;">✓ Payment Confirmed</h2>
        
        <div class="info-row">
          <span class="info-label">Invoice Number:</span>
          <span class="info-value">{{invoice_reference}}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Payment Date:</span>
          <span class="info-value">{{payment_date}}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Payment Method:</span>
          <span class="info-value">{{payment_method}}</span>
        </div>
        
        <div class="info-row" style="border-bottom: none;">
          <span class="info-label">Amount Paid:</span>
          <span class="info-value" style="font-weight: bold;">Ksh {{total_amount}}</span>
        </div>
      </div>
      
      <p>Please find your official invoice receipt attached to this email for your records.</p>
      
      <p>If you have any questions about this payment or need additional documentation, please don''t hesitate to contact us.</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Rent A Car In Kenya</strong><br>
        Premium Vehicle Rentals
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 10px 0;"><strong>Rent A Car In Kenya</strong></p>
      <p style="margin: 5px 0;">Email: info@rentacarinkenya.com | Tel: +254 XXX XXX XXX</p>
      <p style="margin: 5px 0; font-size: 12px;">This is an automated receipt. Please keep this for your records.</p>
    </div>
  </div>
</body>
</html>',
  ARRAY['{{client_name}}', '{{invoice_reference}}', '{{total_amount}}', '{{payment_date}}', '{{payment_method}}'],
  true,
  'immediate',
  0,
  'minutes',
  true,
  'approved'
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  available_variables = EXCLUDED.available_variables,
  is_active = EXCLUDED.is_active,
  schedule_type = EXCLUDED.schedule_type,
  schedule_value = EXCLUDED.schedule_value,
  schedule_unit = EXCLUDED.schedule_unit,
  is_system_template = EXCLUDED.is_system_template,
  approval_status = EXCLUDED.approval_status;
