-- Clarify that the refundable security deposit is paid in addition to the 75% balance.

UPDATE public.email_templates
SET
  body = replace(
    body,
    '75% balance AND refundable deposits are due on day 1 of your rental',
    '75% balance PLUS refundable deposits are due on day 1 of your rental'
  ),
  updated_at = now()
WHERE template_key = 'quote_submission'
  AND body LIKE '%75% balance AND refundable deposits are due on day 1 of your rental%';
