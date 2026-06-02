/*
  # Revoke direct execution of mileage trigger function

  Supabase Security Advisor flags SECURITY DEFINER functions that can be
  called directly by public or signed-in roles. This function is trigger-only:
  bookings updates should fire it, but clients should not call it manually.
*/

REVOKE EXECUTE ON FUNCTION public.update_vehicle_mileage_from_booking_return() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vehicle_mileage_from_booking_return() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_vehicle_mileage_from_booking_return() FROM authenticated;
