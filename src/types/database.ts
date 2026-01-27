export type UserRole = 'admin' | 'manager' | 'mechanic' | 'driver';

export interface Branch {
  id: string;
  branch_name: string;
  location: string;
  contact_info?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleCategory {
  id: string;
  category_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  reg_number: string;
  category_id: string;
  branch_id?: string | null;
  status: 'Available' | 'On Hire' | 'Grounded';
  health_flag: 'Excellent' | 'OK' | 'Grounded';
  health_override?: boolean;
  insurance_expiry: string;
  mot_expiry: string;
  mot_not_applicable?: boolean;
  current_mileage: number;
  last_mileage_update?: string;
  service_interval_km?: number;
  last_service_mileage?: number;
  next_service_mileage?: number;
  market_value?: number;
  make?: string;
  model?: string;
  colour?: string;
  fuel_type?: string;
  transmission?: string;
  spare_key?: boolean;
  spare_key_location?: string;
  chassis_number?: string;
  no_of_passengers?: number;
  luggage_space?: string;
  owner_name?: string;
  is_personal?: boolean;
  current_location?: string;
  is_draft?: boolean;
  on_hire?: boolean;
  on_hire_location?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleImage {
  id: string;
  vehicle_id: string;
  image_url: string;
  is_primary: boolean;
  file_size: number;
  uploaded_at: string;
  created_at: string;
}

export interface VehicleActivityLog {
  id: string;
  vehicle_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  field_changed: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_reference?: string;
  vehicle_id: string;
  client_name: string;
  contact: string;
  client_email?: string;
  start_datetime: string;
  end_datetime: string;
  start_location: string;
  end_location: string;
  notes?: string;
  health_at_booking?: string;
  status: 'Draft' | 'Advance Payment Not Paid' | 'Active' | 'Completed' | 'Cancelled';
  branch_id: string;
  branch_name?: string;
  booking_type?: 'self_drive' | 'chauffeur' | 'transfer';
  chauffeur_id?: string;
  chauffeur_name?: string;
  invoice_number?: string;
  google_event_id?: string;
  total_amount?: number;
  advance_payment_amount?: number;
  advance_payment_paid?: boolean;
  advance_payment_date?: string;
  advance_payment_method?: string;
  security_deposit_amount?: number;
  security_deposit_collected?: boolean;
  security_deposit_collected_date?: string;
  security_deposit_refunded?: boolean;
  security_deposit_refunded_date?: string;
  security_deposit_notes?: string;
  balance_amount?: number;
  outside_hours_charges?: number;
  created_at: string;
  updated_at: string;
}

export interface BookingPayment {
  id: string;
  booking_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'Cash' | 'Bank Transfer' | 'Card' | 'Mobile Money' | 'Other';
  payment_type: 'advance_payment' | 'balance_payment' | 'security_deposit_collected' | 'security_deposit_refunded';
  reference_number?: string;
  notes?: string;
  recorded_by?: string;
  created_at: string;
}

// Legacy type alias for backward compatibility
export type BookingDeposit = BookingPayment;

export interface BookingDocument {
  id: string;
  booking_id: string;
  document_type: 'license' | 'contract' | 'id_document' | 'insurance' | 'other';
  document_name: string;
  document_url: string;
  file_size: number;
  uploaded_by?: string;
  uploaded_at: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MileageLog {
  id: string;
  vehicle_id: string;
  reading_datetime: string;
  mileage_reading: number;
  km_since_last?: number;
  days_since_last?: number;
  km_per_day?: number;
  branch_id: string;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  service_date: string;
  mileage: number;
  work_done: string;
  performed_by: string;
  performed_by_user_id?: string;
  checked_by_user_id?: string;
  work_category?: 'Engine / Fuel' | 'Gearbox' | 'Suspension' | 'Electrical' | 'Body' | 'Accessories';
  notes?: string;
  photo_urls?: string[];
  branch_id: string;
  created_at: string;
}

export interface MaintenanceWorkItem {
  id: string;
  maintenance_log_id: string;
  work_description: string;
  work_category?: string;
  photo_urls: string[];
  order_index: number;
  created_at: string;
}

export interface Snag {
  id: string;
  vehicle_id: string;
  priority: 'Dangerous' | 'Important' | 'Nice to Fix' | 'Aesthetic' | null;
  status: 'Open' | 'Closed';
  date_opened: string;
  date_closed?: string;
  description: string;
  branch_id: string;
  assigned_to?: string;
  assignment_deadline?: string;
  resolution_id?: string;
  deleted_at?: string;
  deleted_by?: string;
  deleted_by_user?: { full_name: string };
  mileage_reported?: number;
  created_at: string;
  updated_at: string;
}

export type SnagAssignmentStatus = 'assigned' | 'completed' | 'overdue' | 'reassigned';

export interface SnagAssignment {
  id: string;
  snag_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  deadline?: string;
  completed_at?: string;
  assignment_notes?: string;
  status: SnagAssignmentStatus;
  created_at: string;
  updated_at: string;
}

export interface SnagDeletion {
  id: string;
  snag_id: string;
  vehicle_id: string;
  priority?: string;
  status: string;
  description: string;
  date_opened: string;
  date_closed?: string;
  deleted_by: string;
  deleted_at: string;
  deletion_reason: string;
  original_data: Record<string, any>;
  branch_id: string;
}

export type ResolutionMethod =
  | 'Repaired'
  | 'Replaced Part'
  | 'Third Party Service'
  | 'No Action Needed'
  | 'Other';

export interface SnagResolution {
  id: string;
  snag_id: string;
  resolution_method: ResolutionMethod;
  resolution_notes: string;
  maintenance_log_id?: string;
  resolved_by: string;
  resolved_at: string;
  photo_urls?: string[];
  created_at: string;
}

export type NotificationType =
  | 'snag_assigned'
  | 'deadline_approaching'
  | 'snag_completed'
  | 'snag_overdue'
  | 'assignment_updated';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface VehicleWithSnagCount extends Vehicle {
  snag_counts: {
    total: number;
    dangerous: number;
    important: number;
    nice_to_fix: number;
    aesthetic: number;
    unallocated: number;
  };
  next_booking?: Booking;
  days_to_next_booking?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id?: string;
  status: string;
  deleted_at?: string;
}

export interface AppSettings {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  updated_at: string;
}

export interface CategoryPricing {
  id: string;
  category_name: string;
  off_peak_rate: number;
  peak_rate: number;
  self_drive_deposit: number;
  tier1_days: number;
  tier1_discount: number;
  tier2_days: number;
  tier2_discount: number;
  tier3_days: number;
  tier3_discount: number;
  tier4_days: number;
  tier4_discount: number;
  tier5_days: number;
  tier5_discount: number;
  tier6_days: number;
  tier6_discount: number;
  tier7_days: number;
  tier7_discount: number;
  tier8_days: number;
  tier8_discount: number;
  tier9_days: number;
  tier9_discount: number;
  created_at: string;
  updated_at: string;
}

export interface SeasonRule {
  id: string;
  season_name: string;
  date_start: string;
  date_end: string;
  season_type: 'Peak' | 'Off Peak';
  created_at: string;
}

export interface PricingConfig {
  id: string;
  chauffeur_fee_per_day: number;
  vat_percentage: number;
  updated_at: string;
  updated_by: string;
  created_at: string;
}

export interface Quote {
  id: string;
  quote_reference: string;
  user_id: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  pickup_location?: string;
  dropoff_location?: string;
  start_date: string;
  end_date: string;
  has_chauffeur: boolean;
  has_half_day: boolean;
  other_fee_1_desc?: string;
  other_fee_1_amount?: number;
  other_fee_2_desc?: string;
  other_fee_2_amount?: number;
  quote_data: QuoteData;
  quote_inputs?: any;
  status: 'Draft' | 'Active' | 'Accepted' | 'Converted' | 'Expired';
  expiration_date?: string;
  extended_expiration?: boolean;
  booking_id?: string;
  converted_at?: string;
  outside_hours_charges?: number;
  created_at: string;
}

export interface QuoteData {
  [categoryName: string]: CategoryQuoteResult;
}

export interface CategoryQuoteResult {
  categoryName: string;
  rentalFee: number;
  chauffeurFee: number;
  otherFee1: number;
  otherFee2: number;
  subtotal: number;
  vat: number;
  grandTotal: number;
  securityDeposit: number;
  advancePayment: number;
  available: boolean;
  branchAvailability?: Array<{
    branchId: string;
    branchName: string;
    availableCount: number;
    vehicleIds: string[];
  }>;
  breakdown: {
    peakDays: number;
    offPeakDays: number;
    tierBreakdown: Array<{
      tier: number;
      days: number;
      rate: number;
      discount: number;
      amount: number;
    }>;
  };
}

export type ScheduleType = 'immediate' | 'before_start' | 'after_start' | 'before_end' | 'after_end';
export type ScheduleUnit = 'minutes' | 'hours' | 'days';
export type TemplateApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject: string;
  body: string;
  available_variables: string[];
  is_active: boolean;
  schedule_type: ScheduleType;
  schedule_value: number;
  schedule_unit: ScheduleUnit;
  vehicle_ids: string[];
  is_system_template: boolean;
  approval_status: TemplateApprovalStatus;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailQueue {
  id: string;
  booking_id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  scheduled_for: string;
  sent_at?: string;
  error_message?: string;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Card' | 'Mobile Money' | 'Other';

export interface InvoiceSelectedCategory {
  categoryName: string;
  rentalFee: number;
  chauffeurFee: number;
  otherFees: number;
  subtotal: number;
  vat: number;
  total: number;
  securityDeposit: number;
  advancePayment: number;
  breakdown: string;
}

export interface Invoice {
  id: string;
  invoice_reference: string;
  quote_id?: string;
  client_name: string;
  client_email?: string;
  invoice_date: string;
  due_date: string;
  selected_categories: InvoiceSelectedCategory[];
  subtotal: number;
  vat: number;
  total_amount: number;
  advance_payment_amount?: number;
  security_deposit_amount?: number;
  amount_paid?: number;
  balance_due?: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface InvoiceFilters {
  status?: PaymentStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: PaymentMethod | 'all';
  searchQuery?: string;
}

export interface UserCalendarSettings {
  id: string;
  user_id: string;
  google_access_token?: string;
  google_refresh_token?: string;
  google_calendar_id?: string;
  token_expiry?: string;
  sync_enabled: boolean;
  last_sync_at?: string;
  calendar_preferences: {
    selectedCategories: string[];
    defaultView: 'month' | 'week';
    showWeekends: boolean;
    startOfWeek: number;
  };
  created_at: string;
  updated_at: string;
}

export interface AlertSnooze {
  id: string;
  user_id: string;
  alert_type: 'health_flag' | 'snag' | 'spare_key' | 'driver_allocation';
  vehicle_id?: string | null;
  booking_id?: string | null;
  snoozed_until: string;
  created_at: string;
}
