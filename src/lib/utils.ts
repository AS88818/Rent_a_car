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
    if (booking.status === 'Cancelled') return false;
    if (excludeBookingId && booking.id === excludeBookingId) return false;

    const existingStart = new Date(booking.start_datetime);
    const existingEnd = new Date(booking.end_datetime);

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
  const now = new Date();

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

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const expiry = new Date(expiryDate);
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

    // Exclude vehicles currently on hire
    if (vehicle.on_hire) {
      return false;
    }

    if (vehicle.status === 'Grounded' || vehicle.health_flag === 'Grounded') {
      return false;
    }

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
