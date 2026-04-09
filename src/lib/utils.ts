import { Vehicle, Snag, Booking } from '../types/database';

export function calculateVehicleHealth(snags: Snag[]): 'Excellent' | 'OK' | 'Grounded' {
  const openSnags = snags.filter(s => s.status === 'Open');
  const dangerousCount = openSnags.filter(s => s.priority === 'Dangerous').length;
  const importantCount = openSnags.filter(s => s.priority === 'Important').length;

  if (dangerousCount > 0) return 'Grounded';
  if (importantCount >= 3) return 'OK';
  return 'Excellent';
}

export function checkBookingConflict(
  bookings: Booking[],
  startDateTime: string,
  endDateTime: string,
  excludeBookingId?: string
): boolean {
  const newStart = new Date(startDateTime);
  const newEnd = new Date(endDateTime);

  return bookings.some(booking => {
    // Terminal statuses never block new bookings
    if (booking.status === 'Cancelled') return false;
    if (booking.status === 'Completed') return false;
    if (excludeBookingId && booking.id === excludeBookingId) return false;

    const existingStart = new Date(booking.start_datetime);
    const existingEnd = new Date(booking.end_datetime);

    // An Active booking whose end date is already in the past cannot conflict
    // with future bookings — treat it as effectively over so it doesn't block
    // new reservations after its end date.
    if (booking.status === 'Active' && existingEnd <= nowNaive()) return false;

    return newStart < existingEnd && newEnd > existingStart;
  });
}

export function isVehicleAvailable(
  vehicle: Vehicle,
  bookings: Booking[]
): boolean {
  if (vehicle.status === 'Grounded' || vehicle.health_flag === 'Grounded') {
    return false;
  }

  const activeBookings = bookings.filter(b => b.status === 'Active');
  const now = nowNaive();

  return !activeBookings.some(booking => {
    const start = new Date(booking.start_datetime);
    const end = new Date(booking.end_datetime);
    return now < end && now > start;
  });
}

export function getExpiryStatus(expiryDate: string): 'red' | 'orange' | 'green' {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 30) return 'red';
  if (daysUntilExpiry < 90) return 'orange';
  return 'green';
}

// The DB stores booking datetimes as Kenya local time with a misleading +00 offset
// (e.g. "09:00:00+00" means "9 AM Kenya", not "9 AM UTC"). All naive datetime
// values are therefore 3 hours ahead of their true UTC equivalent.
//
// Use nowNaive() anywhere you need to compare "right now" against a stored booking
// datetime, so the offset cancels out correctly.
export const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, no DST

export function nowNaive(): Date {
  return new Date(Date.now() + KENYA_OFFSET_MS);
}

// Parse a booking datetime string as Kenya local time.
// Stripping the timezone suffix before parsing makes JS treat the value as local
// time and display the stored digits as-is, regardless of the host timezone.
export function parseNaive(isoString: string): Date {
  const naive = String(isoString).replace(/(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/, '').replace(' ', 'T');
  return new Date(naive);
}

// Parse a plain date string (YYYY-MM-DD) as local midnight so the displayed
// date is never shifted by UTC offset regardless of the viewer's timezone.
function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string'
    ? (/^\d{4}-\d{2}-\d{2}$/.test(date) ? parseDateOnly(date) : parseNaive(date))
    : date;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseNaive(date) : date;
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours}:${mins}`;
}

// Format just the time portion of a booking datetime as Kenya local time
export function formatBookingTime(isoString: string): string {
  const d = parseNaive(isoString);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Format just the date portion of a booking datetime as Kenya local time
export function formatBookingDate(isoString: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseNaive(isoString);
  return d.toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getHealthColor(health: string): string {
  switch (health) {
    case 'Excellent':
      return 'bg-green-100 text-green-800';
    case 'OK':
      return 'bg-yellow-100 text-yellow-800';
    case 'Grounded':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Available':
      return 'bg-green-100 text-green-800';
    case 'On Hire':
      return 'bg-blue-100 text-blue-800';
    case 'Grounded':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Dangerous':
      return 'bg-red-100 text-red-800';
    case 'Important':
      return 'bg-orange-100 text-orange-800';
    case 'Nice to Fix':
      return 'bg-yellow-100 text-yellow-800';
    case 'Aesthetic':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function calculateBookingDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${hours}h`;
}

export function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate)
    ? parseDateOnly(expiryDate)
    : new Date(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAvailableVehicles(
  vehicles: Vehicle[],
  bookings: Booking[],
  startDateTime: string,
  endDateTime: string,
  excludeBookingId?: string
): Vehicle[] {
  return vehicles.filter(vehicle => {
    // Exclude personal cars from hire
    if (vehicle.is_personal) {
      return false;
    }

    // Grounded vehicles cannot be booked at all
    if (vehicle.status === 'Grounded' || vehicle.health_flag === 'Grounded') {
      return false;
    }

    // For 'On Hire' vehicles, don't reject outright — they may be available
    // for the requested date range if it doesn't overlap with existing bookings.
    // The overlap check below will correctly handle this.

    const vehicleBookings = bookings.filter(b =>
      b.vehicle_id === vehicle.id &&
      b.status !== 'Cancelled' &&
      b.status !== 'Completed' &&
      (!excludeBookingId || b.id !== excludeBookingId)
    );

    return !checkBookingConflict(vehicleBookings, startDateTime, endDateTime);
  });
}

export function checkInsuranceExpiryDuringBooking(
  insuranceExpiry: string,
  bookingStartDate: string,
  bookingEndDate: string
): boolean {
  const expiry = new Date(insuranceExpiry);
  const start = new Date(bookingStartDate);
  const end = new Date(bookingEndDate);

  return expiry >= start && expiry <= end;
}

export function checkLocationMismatch(
  vehicleLocation: string,
  pickupLocation: string,
  bookingStatus?: string,
  vehicleStatus?: string
): boolean {
  if (!vehicleLocation || !pickupLocation) return false;
  if (vehicleStatus === 'On Hire') return false;
  if (bookingStatus === 'Completed' || bookingStatus === 'Cancelled') return false;

  const vehicleLoc = vehicleLocation.toLowerCase().trim();
  const pickupLoc = pickupLocation.toLowerCase().trim();

  const locationsMatch = vehicleLoc === pickupLoc ||
    vehicleLoc.includes(pickupLoc) ||
    pickupLoc.includes(vehicleLoc);

  if (!locationsMatch) {
    const vehicleFirstWord = vehicleLoc.split(' ')[0];
    const pickupFirstWord = pickupLoc.split(' ')[0];
    if (vehicleFirstWord.length >= 3 && pickupFirstWord.length >= 3) {
      return vehicleFirstWord !== pickupFirstWord;
    }
  }

  return false;
}
