# F2 PRD: Customer Quotation And Booking Landing Page

Status: Draft v1  
Created: 2026-06-03  
Authoritative implementation reference: `C:\Users\Andrea\.claude\plans\what-s-important-at-this-lively-wreath.md`

## 1. Purpose

Build a customer-facing landing page and booking-request flow for Rent A Car In Kenya.

This is not a simple brochure page. It must connect cleanly to the backoffice data model, pricing engine, booking request approval flow, Pesapal deposit payment, customer records, transactional emails, and later customer portal access.

The landing page should let customers:

- Understand available vehicle categories and real vehicle options.
- Request a quote or booking using pickup/return date and time.
- See clear pricing, mileage allowance, security deposit, and payment requirements.
- Submit a booking request for staff review.
- Pay an approved booking deposit through Pesapal when eligible.
- Access their bookings through Supabase Auth magic-link login at `/my-bookings`.

## 2. Product Principles

- Booking request first, confirmed booking later.
- No vehicle is held until deposit is paid.
- Category is the contract; a specific vehicle is a preference only.
- Prices must separate rental, advance payment, balance, and refundable security deposit.
- Make the next action obvious on mobile.
- Reuse the existing backoffice and Supabase infrastructure. Do not create parallel systems.

## 3. Users

Primary users:

- International and local customers looking to rent a vehicle in Kenya.
- Customers comparing vehicle categories before contacting staff.
- Customers returning to view booking/payment status.

Internal users affected:

- Admin and office staff reviewing booking requests.
- Ops staff handling short-notice/manual bookings.
- Finance/admin users reconciling Pesapal payments and invoices.

## 4. Goals

Customer goals:

- Find a suitable vehicle/category quickly.
- Understand total cost and deposit obligations without ambiguity.
- Submit a booking request without needing to call first.
- Receive clear next steps by email and optional WhatsApp deep link.

Business goals:

- Increase qualified booking requests.
- Reduce back-and-forth caused by unclear dates, times, deposits, or locations.
- Keep staff in control of approval before payment.
- Capture customer and preference data in a structured way for future CRM/reporting.

## 5. Success Metrics

- Booking request completion rate.
- Form abandonment by step.
- Number of requests requiring staff clarification.
- Percentage of approved requests paid through Pesapal.
- Time from request submission to staff approval.
- Number of sub-48h requests routed correctly to manual handling.
- Number of customer questions about whether the security deposit is included in the rental price.

## 6. Scope

Implementation shape:

- The existing single-file landing page/prototype is a design reference only.
- The production implementation will be built later as a proper Vite/React app.
- The production app must use Supabase, shared TypeScript-friendly contracts, i18n, currency/FX handling, and the backend flows defined in this PRD.

In scope for v1:

- Public landing page.
- Backoffice-managed landing-page CMS for key public content.
- Vehicle/category browsing using real vehicle images.
- Multi-step booking request form.
- Date and time input for pickup and return.
- Branch selection: Nairobi and Nanyuki only.
- One-way rental support.
- Customer-declared add-ons.
- Currency toggle: KES, USD, GBP, EUR.
- Language support: EN, FR, DE, ES, IT.
- Booking request submission into `booking_requests`.
- Staff approval flow integration.
- Pesapal deposit payment for eligible approved requests.
- Request status page.
- Customer booking portal at `/my-bookings` using Supabase Auth `signInWithOtp()`.
- Email queue integration for non-auth transactional emails.
- WhatsApp click-to-message links.
- Vehicle feature/gadget options managed from the backoffice, with clear separation between informational features and priced add-ons.
- Blog / guides section, managed through the backoffice CMS, for search traffic and customer education.

Out of scope for v1:

- Stripe.
- WhatsApp Cloud API.
- Customer-side PWA.
- Guaranteed specific-vehicle reservation before deposit.
- Custom magic-link token tables or `/my-bookings/[token]`.
- Extra-driver add-on.
- Public document upload or heavy customer identity capture on the landing page.
- Digital handover/check-in forms.
- Damage photo/signature workflows.
- USD/GBP/EUR settlement at Pesapal. Settlement is KES-only in v1.
- Sub-48h Pesapal deposit flow. These are manual office bookings.
- A full general-purpose website builder. The CMS should manage defined landing-page/content fields, not arbitrary page layouts.

## 7. Design Requirements

Brand and visual direction:

- Use the locked landing-page theme as the base: olive `#3d5624`, amber `#c47d1a`, cream `#f8f5f0`, Inter font.
- The first viewport should show the brand, a clear rental offer, and the booking/request entry point.
- Avoid a marketing-only hero that pushes the booking action too far down the page.
- Use real vehicle images, not generic car illustrations.
- Keep the design mobile-first. WhatsApp traffic will likely be mobile-heavy.

UX rules:

- Use clear labels over clever copy.
- Use "Request booking", "Request this vehicle", or "Check availability"; avoid "Reserve now" before payment.
- Show "or similar" near any specific vehicle preference.
- Make security deposit wording visually separate from rental price.
- Do not hide key warnings in small print.

Accessibility:

- All form controls need labels.
- Error text must appear close to the failing field.
- Color cannot be the only way to communicate status.
- Keyboard navigation must work for form steps, language/currency controls, menus, and dialogs.
- Normal text contrast target: 4.5:1 or better.

## 8. Information Architecture

Primary public routes:

- `/` - landing page with booking entry, fleet preview, trust content, FAQ, WhatsApp CTA.
- `/request` - full booking request flow if not embedded on `/`.
- `/request/:id/status` - request status and next steps.
- `/payment/return` - Pesapal return page.
- `/my-bookings` - authenticated customer portal using Supabase Auth session.

Backoffice routes affected:

- Existing admin/booking area receives and manages landing-page booking requests.
- Existing emails section manages non-auth transactional email templates.
- Existing reports section consumes F2 data once `booking_requests` exists.

## 9. Public Landing Page Structure

Recommended sections:

1. Header
   - Logo/company name.
   - Language selector.
   - Currency selector.
   - WhatsApp/contact action.

2. Hero with booking card
   - Primary message: vehicle rental in Kenya.
   - Booking card fields: pickup branch, return branch/custom location, pickup date/time, return date/time.
   - Primary CTA: "Check availability" or "Start request".

3. Fleet/category preview
   - Real vehicle cards from `vehicle_images`.
   - Category, branch availability, rental type, estimated price range, deposit.
   - "Or similar" disclaimer.

4. How booking works
   - Request quote/booking.
   - Staff confirms availability and terms.
   - Pay approved deposit link if eligible.
   - Booking is confirmed.

5. Why rent with us
   - Practical trust points: branches, support, maintained fleet, transparent pricing.

6. FAQ
   - Deposit, mileage allowance, payment timing, vehicle substitution, short-notice bookings.

7. Final CTA
   - Repeat request CTA and WhatsApp contact.

## 10. Booking Request Flow

The flow should be multi-step on mobile, with a summary visible before submit.

Step 1: Trip details

- Pickup branch: Nairobi or Nanyuki.
- Pickup date and time.
- Return date and time.
- Return option:
  - same branch,
  - other branch,
  - custom location.
- Show outside-hours warning if pickup/drop-off is outside 09:00-18:00.
- Show cross-branch transfer guidance when relevant.

Step 2: Vehicle/category

- Show available categories and real vehicles matching the trip.
- Specific vehicle selection is stored as preference only.
- Must display "or similar in this category".
- Vehicles with no primary image must be hidden from public landing page.

Step 3: Add-ons and rental type

- Rental type:
  - self drive,
  - chauffeur,
  - transfer if supported by current pricing flow.
- Add-ons:
  - chauffeur,
  - child seat,
  - booster,
  - airport delivery for Nairobi only.
- No extra-driver add-on.

Step 4: Customer details

- Full name.
- Email or phone required. Prefer both.
- Preferred channel: email, WhatsApp, phone.
- Preferred language.
- Do not ask for KRA PIN, address, emergency contact, passport, ID, licence, or document uploads on the public request form in v1.
- Documents continue to be collected by staff on the day of rental/handover using the current process.

Step 5: Review and submit

- Show rental estimate.
- Show mileage allowance.
- Show 25% booking deposit.
- Show 75% balance due on day 1.
- Show refundable security deposit due on day 1.
- Show currency and FX snapshot note.
- Customer accepts terms and submits request.

Post-submit:

- Create `booking_requests` row with frozen pricing snapshot and tri-store monetary fields.
- Queue customer acknowledgment email.
- Show status page with "request received" and next steps.
- Notify backoffice users through existing notification/push infrastructure once F1 exists.

## 11. Pricing And Money Display

Customer-facing price summary must separate:

- Rental total.
- Included mileage allowance.
- 25% amount to book.
- 75% balance due on day 1.
- Refundable security deposit due on day 1.
- Optional charges/add-ons.
- Currency selected by customer.

Required wording pattern:

```text
Rental total: KES X
To book: 25% advance payment of KES Y
Due on day 1: 75% balance of KES Z PLUS refundable security deposit of KES D
```

Do not present the security deposit as included in rental price.

Backend rule:

- KES remains canonical.
- Customer-selected currency is stored as transactional currency.
- FX rate and snapshot timestamp are frozen at request submission and persisted through booking, invoice, and payment.

## 12. Availability And Reservation Rules

Availability display:

- Can show available category/branch counts.
- Must not imply a unit is reserved before deposit.
- Specific vehicle selection is a preference.

Confirmed reservation:

- Booking promotes from `booking_requests` to `bookings` only after approved deposit payment.
- If two customers pay for the last overlapping availability, DB transaction locks the candidate vehicle/category availability set. One promotes; the loser goes to refund/void handling.

Sub-48h rule:

- If pickup is less than 48 hours away, do not offer normal Pesapal payment.
- Route to office/manual handling.
- Customer copy should say staff will confirm manually due to short notice.

## 13. Backend Data Contracts

New or extended tables required by F2:

- `customers`
  - Real customer records.
  - Email-or-phone CHECK constraint.
  - Preferred language and preferred channel.

- `booking_requests`
  - Public request queue.
  - Separate from confirmed `bookings`.
  - Statuses: `submitted`, `edit_requested`, `approved`, `rejected`, `expired`, `lost_race_refund_pending`, `lost_race_refunded`, `lost_race_voided`, `promoted`.
  - Stores pricing snapshot JSON.
  - Stores selected currency, charged amount, FX rate, and FX snapshot timestamp.

- `email_queue`
  - Uses `context_type` and `context_id` for landing-page request emails.
  - Supabase Auth magic-link emails do not use this queue.

- `booking_payments`
  - Canonical payment table after normalization.
  - Pesapal advance payment rows must include tri-store payment fields.

- `bookings`
  - Receives `customer_id` and tri-store monetary fields when request promotes.

- `invoices`
  - Receives tri-store monetary fields when generated from booking.

Existing data to reuse:

- `vehicle_images` primary images.
- `vehicle_categories`.
- `category_pricing`.
- `pricing_config`.
- `quotes.quote_data` snapshot pattern.
- Existing reference generation RPCs.
- Existing `email_templates`, `email_queue`, and `process-email-queue`.
- Supabase Auth for magic-link login.

Document handling:

- `customer_documents` is not required for the F2 landing-page v1.
- Client decision: keep document upload as-is on the day of rental/handover so customers are not frustrated during the public request flow.
- If customer-level document history is added later, handle it as a separate CRM/backoffice enhancement, not as a public landing-page requirement.

## 14. Required Edge Functions And Jobs

New functions:

- `pesapal-create-payment`
  - Creates approved deposit payment link.
  - Uses selected currency where supported.
  - Blocks sub-48h requests.

- `pesapal-ipn-webhook`
  - Verifies payment notifications.
  - Promotes request after successful deposit payment.
  - Handles race result and post-commit refund/void path.

- `process-fx-rates`
  - Updates KES to USD/GBP/EUR rates daily at 06:00 EAT.
  - Stores history.
  - Alerts or flags variance above threshold if required.

- `expire-booking-requests`
  - Expires stale approved/submitted requests.
  - Queues expiry email.

Existing functions to extend:

- `process-email-queue`
  - Must support landing-page request emails using `context_type = 'booking_request'`.
  - Must continue supporting existing booking/invoice/report emails.

No custom magic-link Edge Function:

- Use Supabase Auth `signInWithOtp()`.
- Branded magic-link email lives in Supabase Dashboard Auth Email Templates.

## 15. Email And WhatsApp Requirements

Email:

- Always send official transactional emails by email.
- Non-auth transactional emails use existing `email_templates` and `email_queue`.
- Required template families:
  - request received,
  - edit requested,
  - request approved/payment link,
  - rejected/unavailable,
  - expired,
  - payment received/booking confirmed,
  - refund/void apology if race condition occurs.

WhatsApp:

- v1 uses click-to-WhatsApp deep links only.
- WhatsApp is additive, not the official system of record.
- WhatsApp FAB can exist on public pages.
- Transactional emails may include WhatsApp contact links.

## 16. Landing CMS And Admin Management

The landing page should have a controlled CMS inside the existing backoffice app. Do not build an open-ended website builder. The goal is to let the client update important public content without code changes while keeping booking/pricing logic safe.

Recommended backoffice sections:

- Landing Page CMS
  - Hero image.
  - Hero headline and supporting copy.
  - Primary CTA labels.
  - Trust/benefit blocks.
  - How-it-works steps.
  - FAQ items.
  - Testimonials/reviews.
  - SEO title, meta description, and social share image.

- Blog / Guides
  - Blog post title, slug, excerpt, body, hero image, author, language, tags.
  - Draft/published status.
  - Published date.
  - SEO metadata.
  - Included in launch scope. Drives search traffic and customer education.

- Vehicle Features And Options
  - Informational vehicle features, such as pop-up roof, fridge, roof rack, camping gear, 4x4, automatic/manual, seats, luggage capacity.
  - Priced add-ons, such as child seat, booster, chauffeur, airport delivery, or any approved gadget/feature charge.
  - Staff-reviewed options, where price cannot be auto-quoted and must be confirmed manually.

Important separation:

- Content CMS changes should affect public copy/images only.
- Vehicle feature/gadget pricing is operational pricing configuration, not ordinary page content.
- Pricing changes must go through admin-only controls, validation, and audit fields because they affect customer quotes and Pesapal payments.

CMS content states:

- Draft.
- Published.
- Archived.

CMS publishing rules:

- Public landing page reads only published content.
- Draft content should be previewable in backoffice.
- Media needs alt text and optional focal point/crop metadata.
- Content should support EN, FR, DE, ES, IT or at least have an English fallback.

Recommended backend additions:

- `landing_content_blocks`
  - Keyed content blocks for hero, benefits, how-it-works, FAQ, testimonials, and SEO.
  - Fields: `key`, `language`, `title`, `body`, `data jsonb`, `status`, `sort_order`, `published_at`, `updated_by`.

- `landing_media_assets`
  - Metadata for CMS images stored in Supabase Storage.
  - Fields: `storage_path`, `alt_text`, `focal_x`, `focal_y`, `status`, `updated_by`.

- `blog_posts`
  - Public posts/guides. Blog is launch scope.
  - Fields: `slug`, `language`, `title`, `excerpt`, `body`, `hero_media_id`, `status`, `published_at`, `seo_title`, `seo_description`.

- `vehicle_features`
  - Reusable feature labels and public display metadata.
  - Fields: `name`, `description`, `icon`, `is_public`, `sort_order`.

- `vehicle_feature_assignments`
  - Links features to specific vehicles.
  - Used for filtering/display, not necessarily pricing.

- `bookable_add_ons`
  - Priced or staff-reviewed customer options.
  - Fields: `name`, `description`, `pricing_type`, `amount`, `currency`, `applies_to_branch`, `applies_to_category`, `requires_staff_review`, `is_active`.

Design requirement:

- In the public UI, clearly separate included vehicle features from paid extras.
- Paid extras must show whether they are per-day, per-booking, or staff-reviewed.
- Staff-reviewed options should not be included in automatic Pesapal amounts until staff approves them.

## 17. Customer Portal

Route:

- `/my-bookings`

Authentication:

- Supabase Auth `signInWithOtp()`.
- Supabase parses token and establishes session.
- Do not build `/my-bookings/[token]`.
- Do not create custom magic-link token columns.

Portal v1 features:

- View booking requests and confirmed bookings for authenticated customer.
- View status and next steps.
- View payment status.
- View booking details and invoice links when available.

## 18. States And Edge Cases

Form states:

- Initial.
- Loading availability/pricing.
- Validation error.
- Submit loading.
- Submit success.
- Submit failure.

Availability states:

- Available category count.
- No available category.
- Vehicle has no image and is hidden.
- Preferred vehicle unavailable but category available.
- Cross-branch transfer warning.
- Custom drop-off requires staff review.

Payment states:

- Not yet approved.
- Approved, payment link pending.
- Payment pending.
- Payment successful, promotion pending.
- Confirmed.
- Lost race, refund/void pending.
- Lost race, refunded/voided.
- Sub-48h manual handling.

Customer communication states:

- Email sent.
- Email queued.
- Email failed.
- WhatsApp contact available.

Language/currency states:

- Missing translation falls back to English.
- FX rate unavailable: show KES only and block non-KES payment until resolved.

CMS states:

- Draft content.
- Published content.
- Missing translated content.
- Missing media alt text.
- Blog post unpublished.
- Add-on inactive.
- Add-on requires staff review.

## 19. Design Component Inventory

Core components:

- Header/nav.
- Language selector.
- Currency selector.
- Booking search card.
- Multi-step booking form.
- Date/time picker.
- Branch picker.
- Return location picker.
- Vehicle/category card.
- Availability badge.
- Price breakdown panel.
- Mileage allowance row.
- Security deposit explanation row.
- Add-on selector.
- Customer details form.
- Review summary.
- Terms acceptance.
- Status timeline.
- Payment CTA panel.
- WhatsApp floating action button.
- FAQ accordion.
- Error/empty state panels.
- CMS content editor.
- CMS media picker.
- Blog post editor.
- Vehicle feature/option admin table.
- Add-on pricing editor.

## 20. Content Rules

Use:

- "Request booking"
- "Check availability"
- "Preferred vehicle"
- "Or similar in this category"
- "Refundable security deposit"
- "Due on day 1"
- "Staff will confirm availability"

Avoid:

- "Reserve now" before deposit.
- "Guaranteed vehicle" before staff approval/deposit.
- "Deposit included" language.
- "Stripe".
- "Diani Branch".
- "Magic link token".

## 21. Analytics And Tracking

Track at minimum:

- Landing page view.
- Booking card started.
- Date/time selected.
- Vehicle/category selected.
- Add-ons selected.
- Customer details completed.
- Request submitted.
- Request submission failed.
- Payment link opened.
- Pesapal payment return success/fail.
- WhatsApp CTA clicked.
- Language changed.
- Currency changed.
- Blog post viewed.
- Feature/add-on clicked.

## 22. Acceptance Criteria

Design acceptance:

- Mobile flow can be completed without horizontal scrolling.
- First viewport makes the booking/request action obvious.
- Pricing separates rental, 25% deposit, 75% balance, and refundable security deposit.
- Real vehicle images are used.
- No page suggests a vehicle is reserved before payment.
- Public request form does not ask for document uploads, KRA PIN, address, or emergency contact.
- Language/currency controls are visible and usable.
- Hero image, core landing-page copy, FAQs, testimonials, and SEO metadata can be edited from backoffice without a code deploy.
- Blog posts can be drafted and published from the backoffice CMS. Blog is launch scope.

Backend acceptance:

- Submitting a request creates `booking_requests`, not `bookings`.
- Request includes pricing snapshot and tri-store monetary values.
- Customer row is created or matched without asking "have you booked before?"
- Acknowledgment email queues through `email_queue`.
- Staff approval can generate a Pesapal payment link.
- Successful payment promotes the request to a booking.
- Race condition handling never performs external Pesapal calls inside DB locks.
- `/my-bookings` uses Supabase Auth, not custom token URLs.
- Public landing page reads only published CMS content.
- Pricing-affecting add-ons are managed separately from freeform page content.
- Staff-reviewed add-ons cannot be paid automatically until staff approval.

Regression acceptance:

- Existing backoffice booking creation still works.
- Existing quote calculator still works.
- Existing booking/invoice/report emails still process.
- Existing reference formats remain unchanged.

## 23. Open Questions Blocking Final Build

B1: Customer/document capture

- Resolved for F2 v1.
- Keep document upload as-is at rental/handover.
- Landing page only captures light customer contact details: name, email and/or phone, preferred channel, preferred language.
- Do not build public document upload for the landing page.

B2: Vehicle feature/gadget pricing model

- Confirm whether vehicle-specific features/gadgets are:
  - informational only,
  - priced add-ons,
  - staff-reviewed options.
- Confirm each priced add-on's pricing basis:
  - per day,
  - per booking,
  - per branch/location,
  - staff-reviewed/manual.

B2 is the remaining open question that affects the public pricing/add-on model. Blog is confirmed launch scope (no longer open).

## 24. Implementation Dependency Order

1. Resolve B2.
2. Build and test minimal customer/backfill schema on staging clone.
3. Add CMS tables/content admin (including `blog_posts`), `booking_requests`, tri-store fields, FX tables, email queue request support.
4. Complete Pesapal sandbox POC before building payment UI.
5. Build landing page as proper Vite/React app, using the old HTML only as visual reference.
6. Add i18n and currency handling.
7. Integrate request submission, status page, and emails.
8. Add approval/payment/promotion flow.
9. Add `/my-bookings` portal using Supabase Auth.
10. Run end-to-end tests for request, payment, promotion, refund/void race, CMS publishing, and FX persistence.
