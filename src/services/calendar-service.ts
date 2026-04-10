import { supabase } from '../lib/supabase';
import { Booking, Vehicle } from '../types/database';
import { getAuthorizationHeader, isTokenExpired, refreshAccessToken } from '../lib/google-oauth';

interface GoogleCalendarReminder {
  method: 'email' | 'popup';
  minutes: number;
}

interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
  reminders?: {
    useDefault: boolean;
    overrides: GoogleCalendarReminder[];
  };
}

interface CompanyCalendarConfig {
  google_access_token: string;
  google_refresh_token: string;
  google_calendar_id?: string;
  google_token_expiry?: string;
  google_sync_enabled: boolean;
  google_last_sync_at?: string;
}

export const companyCalendarService = {
  async getConfig(): Promise<CompanyCalendarConfig | null> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('google_access_token, google_refresh_token, google_calendar_id, google_token_expiry, google_sync_enabled, google_last_sync_at')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as CompanyCalendarConfig;
  },

  async updateConfig(updates: Partial<CompanyCalendarConfig>): Promise<void> {
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) return;

    await supabase
      .from('company_settings')
      .update(updates)
      .eq('id', existing.id);
  },

  async saveGoogleTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<void> {
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    await this.updateConfig({
      google_access_token: accessToken,
      google_refresh_token: refreshToken,
      google_token_expiry: tokenExpiry,
      google_sync_enabled: true,
    });
  },

  async disconnect(): Promise<void> {
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) return;

    await supabase
      .from('company_settings')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_calendar_id: null,
        google_token_expiry: null,
        google_sync_enabled: false,
      })
      .eq('id', existing.id);
  },

  async getValidAccessToken(): Promise<string> {
    const config = await this.getConfig();

    if (!config || !config.google_access_token || !config.google_refresh_token) {
      throw new Error('Google Calendar is not connected');
    }

    if (!config.google_token_expiry || !isTokenExpired(config.google_token_expiry)) {
      return config.google_access_token;
    }

    const tokenResponse = await refreshAccessToken(config.google_refresh_token);

    await this.updateConfig({
      google_access_token: tokenResponse.access_token,
      google_token_expiry: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
    });

    return tokenResponse.access_token;
  },
};

export const googleCalendarService = {
  async createEvent(
    accessToken: string,
    calendarId: string,
    event: GoogleCalendarEvent
  ): Promise<any> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: getAuthorizationHeader(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create calendar event');
    }

    return await response.json();
  },

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: GoogleCalendarEvent
  ): Promise<any> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: getAuthorizationHeader(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update calendar event');
    }

    return await response.json();
  },

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: getAuthorizationHeader(accessToken),
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete calendar event');
    }
  },

  async getPrimaryCalendarId(accessToken: string): Promise<string> {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
      {
        headers: {
          Authorization: getAuthorizationHeader(accessToken),
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get primary calendar');
    }

    const data = await response.json();
    return data.id;
  },
};

function buildBookingDescription(booking: Booking, vehicle?: Vehicle): string {
  return [
    `Client: ${booking.client_name}`,
    `Contact: ${booking.contact}`,
    booking.client_email ? `Email: ${booking.client_email}` : '',
    vehicle ? `Vehicle: ${vehicle.reg_number} (${vehicle.make} ${vehicle.model})` : '',
    booking.booking_type ? `Type: ${booking.booking_type}` : '',
    booking.notes ? `\nNotes:\n${booking.notes}` : '',
  ].filter(Boolean).join('\n');
}

export const bookingSyncService = {
  buildStartEvent(booking: Booking, vehicle?: Vehicle): GoogleCalendarEvent {
    // The DB stores times as naive local (Kenya) time with a misleading +00 offset.
    // Strip any existing offset, keep the digit-only local time, then append +03:00
    // so the dateTime is unambiguous RFC3339: "09:00:00+03:00" = 9 AM Kenya.
    const naiveStart = String(booking.start_datetime).replace(/(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/, '').replace(' ', 'T');
    // Add 1 minute by treating digits as "UTC" for arithmetic, then re-apply +03:00.
    const naiveEnd = new Date(new Date(naiveStart + 'Z').getTime() + 60 * 1000).toISOString().slice(0, 19);
    return {
      summary: `START: ${booking.client_name} - ${vehicle?.reg_number ?? 'Vehicle'}`,
      description: buildBookingDescription(booking, vehicle),
      start: { dateTime: naiveStart + '+03:00', timeZone: 'Africa/Nairobi' },
      end:   { dateTime: naiveEnd   + '+03:00', timeZone: 'Africa/Nairobi' },
      colorId: '9',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 4320 },
          { method: 'popup', minutes: 1440 },
          { method: 'popup', minutes: 120  },
        ],
      },
    };
  },

  buildEndEvent(booking: Booking, vehicle?: Vehicle): GoogleCalendarEvent {
    // Strip the misleading +00 offset — stored digits are Kenya local time.
    const naiveEnd = String(booking.end_datetime).replace(/(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/, '').replace(' ', 'T');
    // Use the naive string parsed as "UTC" purely for millisecond arithmetic,
    // then re-apply the +03:00 Kenya offset for the RFC3339 string sent to Google.
    const endMs = new Date(naiveEnd + 'Z').getTime();
    const naiveEventEnd = new Date(endMs + 60 * 1000).toISOString().slice(0, 19);

    const overrides: GoogleCalendarReminder[] = [
      { method: 'popup', minutes: 1440 },
    ];

    // Compute 10 AM Kenya time on the return day (treating naive digits as UTC).
    const localMidnightMs = Math.floor(endMs / 86400000) * 86400000;
    const naive10amMs = localMidnightMs + 10 * 60 * 60 * 1000;

    if (endMs > naive10amMs) {
      const minsFrom10am = Math.round((endMs - naive10amMs) / 60000);
      overrides.push({ method: 'popup', minutes: minsFrom10am });
    }

    return {
      summary: `END: ${booking.client_name} - ${vehicle?.reg_number ?? 'Vehicle'}`,
      description: buildBookingDescription(booking, vehicle),
      start: { dateTime: naiveEnd      + '+03:00', timeZone: 'Africa/Nairobi' },
      end:   { dateTime: naiveEventEnd + '+03:00', timeZone: 'Africa/Nairobi' },
      colorId: '6',
      reminders: {
        useDefault: false,
        overrides,
      },
    };
  },

  async syncBookingToGoogle(
    booking: Booking,
    vehicle?: Vehicle
  ): Promise<void> {
    try {
      const config = await companyCalendarService.getConfig();
      if (!config || !config.google_sync_enabled) return;

      const accessToken = await companyCalendarService.getValidAccessToken();
      let calendarId = config.google_calendar_id;

      if (!calendarId) {
        calendarId = await googleCalendarService.getPrimaryCalendarId(accessToken);
        await companyCalendarService.updateConfig({ google_calendar_id: calendarId });
      }

      const startEvent = this.buildStartEvent(booking, vehicle);
      const endEvent   = this.buildEndEvent(booking, vehicle);

      const syncOneEvent = async (
        eventPayload: GoogleCalendarEvent,
        existingId: string | undefined
      ): Promise<string> => {
        if (existingId) {
          try {
            await googleCalendarService.updateEvent(accessToken, calendarId!, existingId, eventPayload);
            return existingId;
          } catch (err: any) {
            if (err.message?.includes('Not Found') || err.message?.includes('404')) {
              const created = await googleCalendarService.createEvent(accessToken, calendarId!, eventPayload);
              return created.id;
            }
            throw err;
          }
        } else {
          const created = await googleCalendarService.createEvent(accessToken, calendarId!, eventPayload);
          return created.id;
        }
      };

      const startId = await syncOneEvent(startEvent, booking.google_event_id);
      const endId   = await syncOneEvent(endEvent,   booking.google_event_id_end);

      const updates: Record<string, string> = {};
      if (startId !== booking.google_event_id)     updates.google_event_id     = startId;
      if (endId   !== booking.google_event_id_end) updates.google_event_id_end = endId;
      if (Object.keys(updates).length > 0) {
        await supabase.from('bookings').update(updates).eq('id', booking.id);
      }

      await companyCalendarService.updateConfig({ google_last_sync_at: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to sync booking to Google Calendar:', error);
      throw error;
    }
  },

  async deleteBookingFromGoogle(booking: Booking): Promise<void> {
    try {
      const config = await companyCalendarService.getConfig();
      if (!config || !config.google_sync_enabled) return;
      if (!booking.google_event_id && !booking.google_event_id_end) return;

      const accessToken = await companyCalendarService.getValidAccessToken();
      const calendarId = config.google_calendar_id;
      if (!calendarId) return;

      if (booking.google_event_id) {
        await googleCalendarService.deleteEvent(accessToken, calendarId, booking.google_event_id);
      }
      if (booking.google_event_id_end) {
        await googleCalendarService.deleteEvent(accessToken, calendarId, booking.google_event_id_end);
      }

      await companyCalendarService.updateConfig({ google_last_sync_at: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to delete booking from Google Calendar:', error);
      throw error;
    }
  },

  async syncAllBookings(): Promise<void> {
    const config = await companyCalendarService.getConfig();

    if (!config || !config.google_sync_enabled) {
      throw new Error('Google Calendar sync is not enabled');
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .in('status', ['Active', 'Advance Payment Not Paid']);

    if (bookingsError) throw bookingsError;

    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*');

    if (vehiclesError) throw vehiclesError;

    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

    for (const booking of bookings) {
      const vehicle = vehicleMap.get(booking.vehicle_id);
      await this.syncBookingToGoogle(booking, vehicle);
    }
  },
};

export async function autoSyncToCompanyCalendar(
  booking: Booking,
  vehicle?: Vehicle
): Promise<{ synced: boolean; error?: string }> {
  try {
    await bookingSyncService.syncBookingToGoogle(booking, vehicle);
    return { synced: true };
  } catch (error: any) {
    console.error('Auto-sync to Google Calendar failed:', error);
    return { synced: false, error: error.message || 'Calendar sync failed' };
  }
}

export async function autoDeleteFromCompanyCalendar(
  booking: Booking
): Promise<{ synced: boolean; error?: string }> {
  try {
    await bookingSyncService.deleteBookingFromGoogle(booking);
    return { synced: true };
  } catch (error: any) {
    console.error('Auto-delete from Google Calendar failed:', error);
    return { synced: false, error: error.message || 'Calendar sync failed' };
  }
}

// Keep backward-compatible exports
export const calendarSettingsService = companyCalendarService;
