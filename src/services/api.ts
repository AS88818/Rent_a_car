import { supabase } from '../lib/supabase';
import {
  Vehicle,
  Booking,
  MileageLog,
  MaintenanceLog,
  Snag,
  Branch,
  VehicleCategory,
  CategoryPricing,
  SeasonRule,
  Quote,
  PricingConfig,
  AuthUser,
  UserRole,
  EmailTemplate,
  EmailQueue,
  Invoice,
  InvoiceFilters,
  InvoiceSelectedCategory,
  VehicleImage,
  VehicleActivityLog,
  SnagAssignment,
  SnagResolution,
  Notification,
  VehicleWithSnagCount,
} from '../types/database';
import { checkBookingConflict, calculateVehicleHealth } from '../lib/utils';

export const vehicleService = {
  async getVehicles(branchId?: string, includeDrafts: boolean = false) {
    let query = supabase
      .from('vehicles')
      .select('*')
      .is('deleted_at', null)
      .order('reg_number');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (!includeDrafts) {
      query = query.eq('is_draft', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Vehicle[];
  },

  async getDraftVehicles(branchId?: string) {
    let query = supabase
      .from('vehicles')
      .select('*')
      .is('deleted_at', null)
      .eq('is_draft', true)
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Vehicle[];
  },

  async getVehicleById(id: string) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error) throw error;
    return data as Vehicle;
  },

  async createVehicle(vehicle: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert([vehicle])
      .select()
      .single();
    if (error) throw error;
    return data as Vehicle;
  },

  async updateVehicle(id: string, updates: Partial<Vehicle>) {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error('Permission denied: You may need to refresh your session. Please log out and log back in.');
    }

    return data as Vehicle;
  },

  async updateVehicleHealth(
    id: string,
    healthFlag: Vehicle['health_flag'],
    notes: string,
    userInfo: { id: string; name: string; role: string; branchId?: string }
  ) {
    const vehicle = await this.getVehicleById(id);

    if (userInfo.role === 'mechanic' && vehicle.branch_id !== userInfo.branchId) {
      throw new Error('Mechanics can only update vehicles in their branch');
    }

    await activityLogService.logActivity({
      vehicle_id: id,
      user_id: userInfo.id,
      user_name: userInfo.name,
      user_role: userInfo.role,
      field_changed: 'health_flag',
      old_value: vehicle.health_flag,
      new_value: healthFlag,
      notes,
    });

    return await this.updateVehicle(id, { health_flag: healthFlag, health_override: true });
  },

  async updateVehicleLocation(
    id: string,
    branchId: string,
    userInfo: { id: string; name: string; role: string }
  ) {
    const vehicle = await this.getVehicleById(id);
    const branches = await branchService.getBranches();
    const oldBranch = branches.find(b => b.id === vehicle.branch_id);
    const newBranch = branches.find(b => b.id === branchId);

    const oldLocation = vehicle.on_hire ? 'On Hire' : (oldBranch?.branch_name || 'Unknown');
    const newLocation = newBranch?.branch_name || branchId;

    await activityLogService.logActivity({
      vehicle_id: id,
      user_id: userInfo.id,
      user_name: userInfo.name,
      user_role: userInfo.role,
      field_changed: 'branch_id',
      old_value: oldLocation,
      new_value: newLocation,
      notes: `Vehicle moved from ${oldLocation} to ${newLocation}`,
    });

    return await this.updateVehicle(id, {
      branch_id: branchId,
      on_hire: false,
      on_hire_location: null
    });
  },

  async publishDraft(id: string) {
    const vehicle = await this.getVehicleById(id);

    if (!vehicle.is_draft) {
      throw new Error('Vehicle is not a draft');
    }

    const requiredFields = [
      'reg_number',
      'category_id',
      'branch_id',
      'status',
      'health_flag',
      'insurance_expiry',
      'current_mileage',
    ];

    for (const field of requiredFields) {
      if (!vehicle[field as keyof Vehicle]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!vehicle.mot_not_applicable && !vehicle.mot_expiry) {
      throw new Error('MOT expiry is required unless MOT is not applicable');
    }

    return await this.updateVehicle(id, { is_draft: false });
  },

  async softDeleteVehicle(
    id: string,
    userInfo: { id: string; name: string; role: string }
  ) {
    const activeBookings = await supabase
      .from('bookings')
      .select('id')
      .eq('vehicle_id', id)
      .in('status', ['Active', 'Deposit Not Paid'])
      .maybeSingle();

    if (activeBookings.data) {
      throw new Error('Cannot delete vehicle with active or pending bookings');
    }

    const futureBookings = await supabase
      .from('bookings')
      .select('id')
      .eq('vehicle_id', id)
      .gte('start_datetime', new Date().toISOString())
      .maybeSingle();

    if (futureBookings.data) {
      throw new Error('Cannot delete vehicle with future bookings');
    }

    await activityLogService.logActivity({
      vehicle_id: id,
      user_id: userInfo.id,
      user_name: userInfo.name,
      user_role: userInfo.role,
      field_changed: 'deleted_at',
      old_value: undefined,
      new_value: new Date().toISOString(),
      notes: 'Vehicle soft deleted',
    });

    return await this.updateVehicle(id, { deleted_at: new Date().toISOString() });
  },
};

export const bookingService = {
  async getBookings(branchId?: string) {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        branch_name:branches(branch_name)
      `)
      .order('start_datetime', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Flatten the branch_name from nested object
    const bookings = data?.map((booking: any) => ({
      ...booking,
      branch_name: booking.branch_name?.branch_name || null
    })) || [];

    return bookings as Booking[];
  },

  async getBookingsByVehicle(vehicleId: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        branch_name:branches(branch_name)
      `)
      .eq('vehicle_id', vehicleId)
      .order('start_datetime', { ascending: false });
    if (error) throw error;

    // Flatten the branch_name from nested object
    const bookings = data?.map((booking: any) => ({
      ...booking,
      branch_name: booking.branch_name?.branch_name || null
    })) || [];

    return bookings as Booking[];
  },

  async getBookingById(id: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        branch_name:branches(branch_name)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;

    // Flatten the branch_name from nested object
    if (data) {
      return {
        ...data,
        branch_name: (data as any).branch_name?.branch_name || null
      } as Booking;
    }

    return data as Booking;
  },

  async createBooking(booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) {
    const existingBookings = await this.getBookingsByVehicle(booking.vehicle_id);

    if (checkBookingConflict(existingBookings, booking.start_datetime, booking.end_datetime)) {
      throw new Error('Booking conflicts with existing booking');
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert([booking])
      .select(`
        *,
        branch_name:branches(branch_name)
      `)
      .single();
    if (error) throw error;

    // Flatten the branch_name from nested object
    if (data) {
      return {
        ...data,
        branch_name: (data as any).branch_name?.branch_name || null
      } as Booking;
    }

    return data as Booking;
  },

  async updateBooking(id: string, updates: Partial<Booking>) {
    const booking = await this.getBookingById(id);
    const otherBookings = (await this.getBookingsByVehicle(booking.vehicle_id)).filter(
      b => b.id !== id
    );

    if (updates.start_datetime || updates.end_datetime) {
      const startDt = updates.start_datetime || booking.start_datetime;
      const endDt = updates.end_datetime || booking.end_datetime;
      if (checkBookingConflict(otherBookings, startDt, endDt)) {
        throw new Error('Booking conflicts with existing booking');
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        branch_name:branches(branch_name)
      `)
      .single();
    if (error) throw error;

    // Flatten the branch_name from nested object
    if (data) {
      return {
        ...data,
        branch_name: (data as any).branch_name?.branch_name || null
      } as Booking;
    }

    return data as Booking;
  },

  async recordDepositPayment(
    bookingId: string,
    amount: number,
    paymentDate: string,
    paymentMethod: PaymentMethod,
    referenceNumber?: string,
    notes?: string
  ) {
    const { data, error } = await supabase.rpc('record_booking_deposit', {
      p_booking_id: bookingId,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_payment_method: paymentMethod,
      p_reference_number: referenceNumber || null,
      p_notes: notes || null,
    });

    if (error) throw error;
    return data;
  },

  async getBookingDeposits(bookingId: string) {
    const { data, error } = await supabase
      .from('booking_deposits')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false});

    if (error) throw error;
    return data as BookingDeposit[];
  },
};

export const mileageService = {
  async getMileageLog(vehicleId: string) {
    const { data, error } = await supabase
      .from('mileage_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('reading_datetime', { ascending: false });
    if (error) throw error;
    return data as MileageLog[];
  },

  async createMileageLog(log: Omit<MileageLog, 'id' | 'created_at'>) {
    const previousLogs = await this.getMileageLog(log.vehicle_id);
    const latestLog = previousLogs[0];

    let kmSinceLast: number | undefined;
    let daysSinceLast: number | undefined;
    let kmPerDay: number | undefined;

    if (latestLog) {
      kmSinceLast = log.mileage_reading - latestLog.mileage_reading;
      const prevDate = new Date(latestLog.reading_datetime);
      const currDate = new Date(log.reading_datetime);
      daysSinceLast = Math.ceil(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      kmPerDay = daysSinceLast > 0 ? kmSinceLast / daysSinceLast : 0;
    }

    const { data, error } = await supabase
      .from('mileage_logs')
      .insert([
        {
          ...log,
          km_since_last: kmSinceLast,
          days_since_last: daysSinceLast,
          km_per_day: kmPerDay,
        },
      ])
      .select()
      .single();
    if (error) throw error;

    await vehicleService.updateVehicle(log.vehicle_id, {
      current_mileage: log.mileage_reading,
      last_mileage_update: log.reading_datetime,
    });

    return data as MileageLog;
  },
};

export const maintenanceService = {
  async getMaintenanceLog(vehicleId: string) {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('service_date', { ascending: false });
    if (error) throw error;
    return data as MaintenanceLog[];
  },

  async createMaintenanceLog(log: Omit<MaintenanceLog, 'id' | 'created_at'> & { work_items?: Array<{ work_description: string; work_category: string; photos: string[] }> }) {
    const { work_items, ...maintenanceLogData } = log;

    const { data: createdLog, error: logError } = await supabase
      .from('maintenance_logs')
      .insert([maintenanceLogData])
      .select()
      .single();

    if (logError) throw logError;

    if (work_items && work_items.length > 0) {
      const workItemsToInsert = work_items.map((item, index) => ({
        maintenance_log_id: createdLog.id,
        work_description: item.work_description,
        work_category: item.work_category || null,
        photo_urls: item.photos,
        order_index: index,
      }));

      const { error: itemsError } = await supabase
        .from('maintenance_work_items')
        .insert(workItemsToInsert);

      if (itemsError) throw itemsError;
    }

    return createdLog as MaintenanceLog;
  },
};

async function updateVehicleHealthFlag(vehicleId: string): Promise<void> {
  const vehicle = await vehicleService.getVehicleById(vehicleId);

  if (vehicle.health_override) {
    return;
  }

  const snags = await snagService.getSnags(vehicleId);
  const health = calculateVehicleHealth(snags);
  await vehicleService.updateVehicle(vehicleId, { health_flag: health });
}

export const snagService = {
  async getSnags(vehicleId?: string, branchId?: string, includeDeleted?: boolean) {
    let query = supabase
      .from('snags')
      .select(`
        *,
        deleted_by_user:users!deleted_by(full_name)
      `)
      .order('date_opened', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Snag[];
  },

  async createSnag(snag: Omit<Snag, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('snags')
      .insert([snag])
      .select()
      .single();
    if (error) throw error;

    await updateVehicleHealthFlag(snag.vehicle_id);
    return data as Snag;
  },

  async updateSnag(id: string, updates: Partial<Snag>) {
    const snag = await supabase
      .from('snags')
      .select('vehicle_id')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('snags')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (snag.data?.vehicle_id) {
      await updateVehicleHealthFlag(snag.data.vehicle_id);
    }

    return data as Snag;
  },

  async deleteSnag(id: string, userId: string, reason: string) {
    const { data: snagData, error: fetchError } = await supabase
      .from('snags')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error: logError } = await supabase
      .from('snag_deletions')
      .insert([
        {
          snag_id: id,
          vehicle_id: snagData.vehicle_id,
          priority: snagData.priority,
          status: snagData.status,
          description: snagData.description,
          date_opened: snagData.date_opened,
          date_closed: snagData.date_closed,
          deleted_by: userId,
          deletion_reason: reason,
          original_data: snagData,
          branch_id: snagData.branch_id,
        },
      ]);

    if (logError) throw logError;

    const { error: deleteError } = await supabase
      .from('snags')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id);

    if (deleteError) throw deleteError;

    await updateVehicleHealthFlag(snagData.vehicle_id);
  },

  async getVehiclesWithSnagCounts(branchId?: string): Promise<VehicleWithSnagCount[]> {
    const vehicles = await vehicleService.getVehicles(branchId, true);
    const snags = await this.getSnags(undefined, branchId);
    const bookings = await bookingService.getBookings(branchId);

    return vehicles.map(vehicle => {
      const vehicleSnags = snags.filter(s => s.vehicle_id === vehicle.id && s.status === 'Open');

      const snag_counts = {
        total: vehicleSnags.length,
        dangerous: vehicleSnags.filter(s => s.priority === 'Dangerous').length,
        important: vehicleSnags.filter(s => s.priority === 'Important').length,
        nice_to_fix: vehicleSnags.filter(s => s.priority === 'Nice to Fix').length,
        aesthetic: vehicleSnags.filter(s => s.priority === 'Aesthetic').length,
        unallocated: vehicleSnags.filter(s => !s.priority).length,
      };

      const futureBookings = bookings
        .filter(
          b =>
            b.vehicle_id === vehicle.id &&
            b.status !== 'Cancelled' &&
            new Date(b.start_datetime) > new Date()
        )
        .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

      const next_booking = futureBookings[0];
      const days_to_next_booking = next_booking
        ? Math.ceil(
            (new Date(next_booking.start_datetime).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : undefined;

      return {
        ...vehicle,
        snag_counts,
        next_booking,
        days_to_next_booking,
      };
    });
  },

  async addSnagPhoto(snagId: string, photoUrl: string) {
    const { data, error } = await supabase
      .from('snag_photos')
      .insert({
        snag_id: snagId,
        photo_url: photoUrl,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getSnagPhotos(snagId: string) {
    const { data, error } = await supabase
      .from('snag_photos')
      .select('*')
      .eq('snag_id', snagId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async deleteSnagPhoto(photoId: string) {
    const { error } = await supabase
      .from('snag_photos')
      .delete()
      .eq('id', photoId);
    if (error) throw error;
  },
};

export const quotationService = {
  async getCategoryPricing() {
    const { data, error } = await supabase
      .from('category_pricing')
      .select('*')
      .order('category_name');
    if (error) throw error;
    return data as CategoryPricing[];
  },

  async getSeasonRules() {
    const { data, error } = await supabase
      .from('season_rules')
      .select('*')
      .order('date_start');
    if (error) throw error;
    return data as SeasonRule[];
  },

  async getQuotes() {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Quote[];
  },

  async getDraftQuotes(userId: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'Draft')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Quote[];
  },

  async getQuoteById(id: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Quote;
  },

  async createQuote(quote: Omit<Quote, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('quotes')
      .insert([quote])
      .select()
      .single();
    if (error) throw error;
    return data as Quote;
  },

  async updateQuote(id: string, updates: Partial<Quote>) {
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Quote;
  },

  async updateExpiration(id: string, expirationDate: string) {
    const { data, error } = await supabase
      .from('quotes')
      .update({
        expiration_date: expirationDate,
        extended_expiration: true,
        status: 'Active',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Quote;
  },

  async deleteQuote(id: string) {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async updateCategoryPricing(id: string, updates: Partial<CategoryPricing>) {
    const { data, error } = await supabase
      .from('category_pricing')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CategoryPricing;
  },

  async getPricingConfig() {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as PricingConfig | null;
  },

  async updatePricingConfig(id: string, updates: Partial<PricingConfig>) {
    const { data, error } = await supabase
      .from('pricing_config')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as PricingConfig;
  },

  async convertQuoteToBooking(quoteId: string, categoryName: string, vehicleId: string, branchId: string) {
    const quote = await this.getQuoteById(quoteId);

    if (!quote.client_phone) {
      throw new Error('Phone number is required to create a booking. Please update the quote first.');
    }

    if (!quote.pickup_location || !quote.dropoff_location) {
      throw new Error('Pickup and dropoff locations are required to create a booking. Please update the quote first.');
    }

    if (quote.status === 'Converted') {
      throw new Error('This quote has already been converted to a booking.');
    }

    const quoteData = quote.quote_data as { [key: string]: CategoryQuoteResult };
    const categoryQuote = quoteData[categoryName];

    if (!categoryQuote) {
      throw new Error('Selected category not found in quote.');
    }

    const vehicle = await vehicleService.getVehicleById(vehicleId);

    const startDate = new Date(quote.start_date);
    const endDate = new Date(quote.end_date);
    startDate.setHours(9, 0, 0, 0);
    endDate.setHours(17, 0, 0, 0);

    const bookingData = {
      vehicle_id: vehicleId,
      client_name: quote.client_name,
      contact: quote.client_phone,
      client_email: quote.client_email || undefined,
      start_datetime: startDate.toISOString(),
      end_datetime: endDate.toISOString(),
      start_location: quote.pickup_location,
      end_location: quote.dropoff_location,
      status: 'Active' as const,
      branch_id: branchId,
      booking_type: quote.has_chauffeur ? 'chauffeur' as const : 'self_drive' as const,
      total_amount: categoryQuote.grandTotal,
      advance_payment_amount: categoryQuote.advancePayment,
      security_deposit_amount: categoryQuote.securityDeposit,
      health_at_booking: vehicle.health_flag,
      notes: `Created from quote ${quote.quote_reference}`,
    };

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([bookingData])
      .select(`
        *,
        branch_name:branches(branch_name)
      `)
      .single();

    if (bookingError) throw bookingError;

    // Flatten the branch_name from nested object
    const bookingWithBranchName = booking ? {
      ...booking,
      branch_name: (booking as any).branch_name?.branch_name || null
    } : booking;

    await this.updateQuote(quoteId, {
      status: 'Converted',
      booking_id: booking.id,
      converted_at: new Date().toISOString(),
    });

    return bookingWithBranchName as Booking;
  },
};

export const branchService = {
  async getBranches() {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('branch_name');
    if (error) throw error;
    return data as Branch[];
  },

  async createBranch(branch: Omit<Branch, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('branches')
      .insert([branch])
      .select()
      .single();
    if (error) throw error;
    return data as Branch;
  },

  async updateBranch(id: string, updates: Partial<Branch>) {
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Branch;
  },

  async deleteBranch(id: string) {
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const categoryService = {
  async getCategories() {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .select('*')
      .order('category_name');
    if (error) throw error;
    return data as VehicleCategory[];
  },

  async createCategory(category: Omit<VehicleCategory, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .insert([category])
      .select()
      .single();
    if (error) throw error;
    return data as VehicleCategory;
  },

  async updateCategory(id: string, updates: Partial<VehicleCategory>) {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as VehicleCategory;
  },

  async deleteCategory(id: string) {
    const { error } = await supabase
      .from('vehicle_categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const userService = {
  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AuthUser[];
  },

  async getUsers(branchId?: string) {
    if (branchId) {
      return this.getUsersByBranch(branchId);
    }
    return this.getAllUsers();
  },

  async getUsersByBranch(branchId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AuthUser[];
  },

  async getUserById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as AuthUser | null;
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return await this.getUserById(user.id);
  },

  async updateUser(id: string, updates: { full_name?: string; role?: UserRole; branch_id?: string | null }) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    const { error: metadataError } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: updates,
    });
    if (metadataError) throw metadataError;

    return data as AuthUser;
  },

  async deleteUser(id: string) {
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) throw authError;

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getUserStats() {
    const users = await this.getAllUsers();
    const totalUsers = users.length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const managerCount = users.filter(u => u.role === 'manager').length;
    const mechanicCount = users.filter(u => u.role === 'mechanic').length;
    const driverCount = users.filter(u => u.role === 'driver').length;

    return {
      totalUsers,
      adminCount,
      managerCount,
      mechanicCount,
      driverCount,
    };
  },
};

export const emailService = {
  async getEmailTemplates() {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('template_name');
    if (error) throw error;
    return data as EmailTemplate[];
  },

  async getEmailTemplateByKey(templateKey: string) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', templateKey)
      .maybeSingle();
    if (error) throw error;
    return data as EmailTemplate | null;
  },

  async createEmailTemplate(template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('email_templates')
      .insert([{
        ...template,
        created_by: user.id,
        approval_status: 'draft',
      }])
      .select()
      .single();
    if (error) throw error;
    return data as EmailTemplate;
  },

  async updateEmailTemplate(id: string, updates: Partial<EmailTemplate>) {
    const { error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('id', id);
    if (error) throw error;

    const { data: updated, error: fetchError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;
    return updated as EmailTemplate;
  },

  async deleteEmailTemplate(id: string) {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async submitTemplateForApproval(id: string) {
    return this.updateEmailTemplate(id, { approval_status: 'pending' });
  },

  async approveTemplate(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    return this.updateEmailTemplate(id, {
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: undefined,
    });
  },

  async rejectTemplate(id: string, reason: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    return this.updateEmailTemplate(id, {
      approval_status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    });
  },

  async duplicateTemplate(id: string, newName: string, newKey: string) {
    const original = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (original.error) throw original.error;
    if (!original.data) throw new Error('Template not found');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const template = original.data;
    const { data, error } = await supabase
      .from('email_templates')
      .insert([{
        template_key: newKey,
        template_name: newName,
        subject: template.subject,
        body: template.body,
        available_variables: template.available_variables,
        is_active: false,
        schedule_type: template.schedule_type,
        schedule_value: template.schedule_value,
        schedule_unit: template.schedule_unit,
        vehicle_ids: template.vehicle_ids || [],
        is_system_template: false,
        approval_status: 'draft',
        created_by: user.id,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as EmailTemplate;
  },

  async queueEmail(emailData: {
    bookingId: string;
    emailType: 'confirmation' | 'pickup_reminder' | 'dropoff_reminder';
    recipientEmail: string;
    recipientName: string;
    subject: string;
    body: string;
    scheduledFor: string;
  }) {
    const { data, error } = await supabase
      .from('email_queue')
      .insert([{
        booking_id: emailData.bookingId,
        email_type: emailData.emailType,
        recipient_email: emailData.recipientEmail,
        recipient_name: emailData.recipientName,
        subject: emailData.subject,
        body: emailData.body,
        scheduled_for: emailData.scheduledFor,
        status: 'pending',
      }])
      .select()
      .single();
    if (error) throw error;
    return data as EmailQueue;
  },

  async sendEmail(bookingId: string, emailType: 'confirmation' | 'pickup_reminder' | 'dropoff_reminder') {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bookingId, emailType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send email');
    }

    return await response.json();
  },

  async getEmailQueue(bookingId?: string) {
    let query = supabase
      .from('email_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (bookingId) {
      query = query.eq('booking_id', bookingId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as EmailQueue[];
  },

  async updateEmailQueue(id: string, updates: Partial<EmailQueue>) {
    const { data, error } = await supabase
      .from('email_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as EmailQueue;
  },

  async cancelQueuedEmail(id: string) {
    return this.updateEmailQueue(id, { status: 'cancelled' });
  },

  async sendEmailNow(id: string) {
    return this.updateEmailQueue(id, { scheduled_for: new Date().toISOString() });
  },
};

export const invoiceService = {
  async createInvoiceFromQuote(
    quoteId: string,
    selectedCategories: InvoiceSelectedCategory[],
    dueDate: string,
    paymentMethod?: string,
    notes?: string,
    advancePaymentAmount?: number,
    securityDepositAmount?: number
  ) {
    const { data: invoiceRef, error: refError } = await supabase
      .rpc('generate_invoice_reference');

    if (refError) throw refError;

    const quote = await quotationService.getQuoteById(quoteId);

    const subtotal = selectedCategories.reduce((sum, cat) => sum + cat.subtotal, 0);
    const vat = selectedCategories.reduce((sum, cat) => sum + cat.vat, 0);
    const total = selectedCategories.reduce((sum, cat) => sum + cat.total, 0);
    const advancePayment = advancePaymentAmount || Math.ceil((total * 0.25) / 10) * 10;
    const securityDeposit = securityDepositAmount || 0;

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('invoices')
      .insert([{
        invoice_reference: invoiceRef,
        quote_id: quoteId,
        client_name: quote.client_name,
        client_email: quote.client_email,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: dueDate,
        selected_categories: selectedCategories,
        subtotal,
        vat,
        total_amount: total,
        advance_payment_amount: advancePayment,
        security_deposit_amount: securityDeposit,
        amount_paid: 0,
        balance_due: total,
        payment_status: 'Pending',
        payment_method: paymentMethod,
        notes,
        created_by: user?.id,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Invoice;
  },

  async getInvoices(filters?: InvoiceFilters) {
    let query = supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('payment_status', filters.status);
    }

    if (filters?.paymentMethod && filters.paymentMethod !== 'all') {
      query = query.eq('payment_method', filters.paymentMethod);
    }

    if (filters?.dateFrom) {
      query = query.gte('invoice_date', filters.dateFrom);
    }

    if (filters?.dateTo) {
      query = query.lte('invoice_date', filters.dateTo);
    }

    if (filters?.searchQuery) {
      query = query.or(`client_name.ilike.%${filters.searchQuery}%,invoice_reference.ilike.%${filters.searchQuery}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Invoice[];
  },

  async getInvoiceById(id: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Invoice;
  },

  async getInvoicesByQuoteId(quoteId: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Invoice[];
  },

  async updateInvoiceStatus(
    id: string,
    status: string,
    paymentDate?: string,
    paymentMethod?: string,
    notes?: string
  ) {
    const updates: Partial<Invoice> = {
      payment_status: status as any,
      payment_date: paymentDate,
      payment_method: paymentMethod as any,
    };

    if (notes !== undefined) {
      updates.notes = notes;
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Invoice;
  },

  async updateInvoice(id: string, updates: Partial<Invoice>) {
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Invoice;
  },

  async deleteInvoice(id: string) {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async updateOverdueInvoices() {
    const { error } = await supabase.rpc('update_overdue_invoices');
    if (error) throw error;
  },

  async sendInvoiceReceipt(invoiceId: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId,
        emailType: 'invoice_receipt'
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invoice receipt');
    }

    return await response.json();
  },

  async recordDepositPayment(
    id: string,
    amount: number,
    paymentDate: string,
    paymentMethod: PaymentMethod,
    notes?: string
  ) {
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const newAmountPaid = (invoice.amount_paid || 0) + amount;

    const updates: Partial<Invoice> = {
      amount_paid: newAmountPaid,
      payment_method: paymentMethod,
    };

    if (amount >= (invoice.advance_payment_amount || 0) && !invoice.payment_date) {
      updates.payment_date = paymentDate;
    }

    if (notes) {
      updates.notes = invoice.notes ? `${invoice.notes}\n${notes}` : notes;
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Invoice;
  },

  async recordFullPayment(
    id: string,
    paymentDate: string,
    paymentMethod: PaymentMethod,
    notes?: string
  ) {
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const updates: Partial<Invoice> = {
      amount_paid: invoice.total_amount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
    };

    if (notes) {
      updates.notes = invoice.notes ? `${invoice.notes}\n${notes}` : notes;
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Invoice;
  },
};

export const activityLogService = {
  async logActivity(activity: Omit<VehicleActivityLog, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('vehicle_activity_logs')
      .insert([activity])
      .select()
      .single();
    if (error) throw error;
    return data as VehicleActivityLog;
  },

  async getActivityLogs(vehicleId: string, limit?: number, fieldFilter?: string) {
    let query = supabase
      .from('vehicle_activity_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });

    if (fieldFilter) {
      query = query.eq('field_changed', fieldFilter);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as VehicleActivityLog[];
  },

  async getRecentMoves(vehicleId: string, limit: number = 5) {
    return this.getActivityLogs(vehicleId, limit, 'branch_id');
  },
};

export const imageService = {
  async uploadVehicleImage(vehicleId: string, file: File) {
    const existingImages = await this.getVehicleImages(vehicleId);

    if (existingImages.length >= 2) {
      throw new Error('Maximum 2 images allowed per vehicle');
    }

    if (file.size > 4 * 1024 * 1024) {
      throw new Error('File size must be 4MB or less');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, and WebP images are allowed');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${vehicleId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('vehicle-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('vehicle-images')
      .getPublicUrl(fileName);

    const isPrimary = existingImages.length === 0;

    const { data, error } = await supabase
      .from('vehicle_images')
      .insert([{
        vehicle_id: vehicleId,
        image_url: publicUrl,
        is_primary: isPrimary,
        file_size: file.size,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as VehicleImage;
  },

  async getVehicleImages(vehicleId: string) {
    const { data, error } = await supabase
      .from('vehicle_images')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('is_primary', { ascending: false });
    if (error) throw error;
    return data as VehicleImage[];
  },

  async setPrimaryImage(imageId: string, vehicleId: string) {
    await supabase
      .from('vehicle_images')
      .update({ is_primary: false })
      .eq('vehicle_id', vehicleId);

    const { data, error } = await supabase
      .from('vehicle_images')
      .update({ is_primary: true })
      .eq('id', imageId)
      .select()
      .single();

    if (error) throw error;
    return data as VehicleImage;
  },

  async deleteVehicleImage(imageId: string) {
    const { data: image } = await supabase
      .from('vehicle_images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (!image) throw new Error('Image not found');

    const urlParts = image.image_url.split('/');
    const filePath = urlParts.slice(-2).join('/');

    const { error: storageError } = await supabase.storage
      .from('vehicle-images')
      .remove([filePath]);

    if (storageError) throw storageError;

    const { error } = await supabase
      .from('vehicle_images')
      .delete()
      .eq('id', imageId);

    if (error) throw error;
  },
};

export const snagAssignmentService = {
  async createAssignment(assignment: Omit<SnagAssignment, 'id' | 'created_at' | 'updated_at' | 'assigned_at'>) {
    const { data, error } = await supabase
      .from('snag_assignments')
      .insert([assignment])
      .select()
      .single();
    if (error) throw error;
    return data as SnagAssignment;
  },

  async getAssignmentsByUser(userId: string) {
    const { data, error } = await supabase
      .from('snag_assignments')
      .select(`
        *,
        snags (
          *,
          vehicles (
            reg_number,
            branch_id
          )
        )
      `)
      .eq('assigned_to', userId)
      .in('status', ['assigned', 'overdue'])
      .order('deadline', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  },

  async getAssignmentsBySnag(snagId: string) {
    const { data, error } = await supabase
      .from('snag_assignments')
      .select('*')
      .eq('snag_id', snagId)
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return data as SnagAssignment[];
  },

  async updateAssignment(id: string, updates: Partial<SnagAssignment>) {
    const { data, error } = await supabase
      .from('snag_assignments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SnagAssignment;
  },

  async completeAssignment(id: string) {
    const { data, error } = await supabase
      .from('snag_assignments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SnagAssignment;
  },
};

export const snagResolutionService = {
  async createResolution(resolution: Omit<SnagResolution, 'id' | 'created_at' | 'resolved_at'>) {
    const { data, error } = await supabase
      .from('snag_resolutions')
      .insert([resolution])
      .select()
      .single();
    if (error) throw error;

    await snagService.updateSnag(resolution.snag_id, {
      status: 'Closed',
      date_closed: new Date().toISOString().split('T')[0],
    });

    return data as SnagResolution;
  },

  async createResolutionWithMaintenanceLog(
    resolution: Omit<SnagResolution, 'id' | 'created_at' | 'resolved_at' | 'maintenance_log_id'>,
    maintenanceLog: Omit<MaintenanceLog, 'id' | 'created_at'>
  ) {
    const createdLog = await maintenanceService.createMaintenanceLog(maintenanceLog);

    const { data, error } = await supabase
      .from('snag_resolutions')
      .insert([
        {
          ...resolution,
          maintenance_log_id: createdLog.id,
        },
      ])
      .select()
      .single();
    if (error) throw error;

    await snagService.updateSnag(resolution.snag_id, {
      status: 'Closed',
      date_closed: new Date().toISOString().split('T')[0],
    });

    return { resolution: data as SnagResolution, maintenanceLog: createdLog };
  },

  async getResolutionBySnag(snagId: string) {
    const { data, error } = await supabase
      .from('snag_resolutions')
      .select(`
        *,
        maintenance_logs (*)
      `)
      .eq('snag_id', snagId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

export const notificationService = {
  async getNotifications(userId: string, unreadOnly: boolean = false) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Notification[];
  },

  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single();
    if (error) throw error;
    return data as Notification;
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  },

  async getUnreadCount(userId: string) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
    return count || 0;
  },
};

export const bookingDocumentService = {
  async getDocuments(bookingId: string) {
    const { data, error } = await supabase
      .from('booking_documents')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async uploadDocument(bookingId: string, file: File, documentType: string, notes?: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${bookingId}/${Date.now()}.${fileExt}`;
    const filePath = `booking-documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const { data: user } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('booking_documents')
      .insert({
        booking_id: bookingId,
        document_type: documentType,
        document_name: file.name,
        document_url: publicUrl,
        file_size: file.size,
        uploaded_by: user?.user?.id,
        notes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDocument(documentId: string) {
    const { data: doc } = await supabase
      .from('booking_documents')
      .select('document_url')
      .eq('id', documentId)
      .single();

    if (doc?.document_url) {
      const path = doc.document_url.split('/booking-documents/')[1];
      if (path) {
        await supabase.storage
          .from('documents')
          .remove([`booking-documents/${path}`]);
      }
    }

    const { error } = await supabase
      .from('booking_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },
};
