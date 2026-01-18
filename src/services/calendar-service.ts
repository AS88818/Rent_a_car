import { supabase } from '../lib/supabase';
import { Booking, Vehicle } from '../types/database';
import { getAuthorizationHeader, isTokenExpired, refreshAccessToken } from '../lib/google-oauth';

interface UserCalendarSettings {
  id: string;
  user_id: string;
  google_access_token?: string;
  google_refresh_token?: string;
  google_calendar_id?: string;
  token_expiry?: string;
  sync_enabled: boolean;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
}

export const calendarSettingsService = {
  async getSettings(userId: string): Promise<UserCalendarSettings | null> {
    const { data, error } = await supabase
      .from('user_calendar_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createSettings(userId: string): Promise<UserCalendarSettings> {
    const { data, error } = await supabase
      .from('user_calendar_settings')
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSettings(
    userId: string,
    updates: Partial<UserCalendarSettings>
  ): Promise<UserCalendarSettings> {
    const { data, error } = await supabase
      .from('user_calendar_settings')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async saveGoogleTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<UserCalendarSettings> {
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    const existingSettings = await this.getSettings(userId);

    if (existingSettings) {
      return this.updateSettings(userId, {
        google_access_token: accessToken,
        google_refresh_token: refreshToken,
        token_expiry: tokenExpiry,
        sync_enabled: true,
      });
    } else {
      const { data, error } = await supabase
        .from('user_calendar_settings')
        .insert([{
          user_id: userId,
          google_access_token: accessToken,
          google_refresh_token: refreshToken,
          token_expiry: tokenExpiry,
          sync_enabled: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async disconnect(userId: string): Promise<void> {
    await this.updateSettings(userId, {
      google_access_token: undefined,
      google_refresh_token: undefined,
      google_calendar_id: undefined,
      token_expiry: undefined,
      sync_enabled: false,
    });
  },

  async getValidAccessToken(userId: string): Promise<string> {
    const settings = await this.getSettings(userId);

    if (!settings || !settings.google_access_token || !settings.google_refresh_token) {
      throw new Error('Google Calendar is not connected');
    }

    if (!settings.token_expiry || !isTokenExpired(settings.token_expiry)) {
      return settings.google_access_token;
    }

    const tokenResponse = await refreshAccessToken(settings.google_refresh_token);

    await this.updateSettings(userId, {
      google_access_token: tokenResponse.access_token,
      token_expiry: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
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

export const bookingSyncService = {
  buildEventFromBooking(booking: Booking, vehicle?: Vehicle): GoogleCalendarEvent {
    const title = vehicle
      ? `${vehicle.reg_number} - ${booking.client_name}`
      : `Booking - ${booking.client_name}`;

    const description = `
Client: ${booking.client_name}
Contact: ${booking.contact}
${booking.client_email ? `Email: ${booking.client_email}` : ''}
${vehicle ? `Vehicle: ${vehicle.reg_number} (${vehicle.make} ${vehicle.model})` : ''}
${booking.booking_type ? `Type: ${booking.booking_type}` : ''}
${booking.notes ? `\nNotes:\n${booking.notes}` : ''}
    `.trim();

    return {
      summary: title,
      description,
      start: {
        dateTime: new Date(booking.start_datetime).toISOString(),
        timeZone: 'Africa/Nairobi',
      },
      end: {
        dateTime: new Date(booking.end_datetime).toISOString(),
        timeZone: 'Africa/Nairobi',
      },
      colorId: '9',
    };
  },

  async syncBookingToGoogle(
    userId: string,
    booking: Booking,
    vehicle?: Vehicle
  ): Promise<void> {
    try {
      const settings = await calendarSettingsService.getSettings(userId);

      if (!settings || !settings.sync_enabled) {
        return;
      }

      const accessToken = await calendarSettingsService.getValidAccessToken(userId);
      let calendarId = settings.google_calendar_id;

      if (!calendarId) {
        calendarId = await googleCalendarService.getPrimaryCalendarId(accessToken);
        await calendarSettingsService.updateSettings(userId, {
          google_calendar_id: calendarId,
        });
      }

      const event = this.buildEventFromBooking(booking, vehicle);

      if (booking.google_event_id) {
        await googleCalendarService.updateEvent(
          accessToken,
          calendarId,
          booking.google_event_id,
          event
        );
      } else {
        const createdEvent = await googleCalendarService.createEvent(
          accessToken,
          calendarId,
          event
        );

        await supabase
          .from('bookings')
          .update({ google_event_id: createdEvent.id })
          .eq('id', booking.id);
      }

      await calendarSettingsService.updateSettings(userId, {
        last_sync_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to sync booking to Google Calendar:', error);
      throw error;
    }
  },

  async deleteBookingFromGoogle(userId: string, booking: Booking): Promise<void> {
    try {
      const settings = await calendarSettingsService.getSettings(userId);

      if (!settings || !settings.sync_enabled || !booking.google_event_id) {
        return;
      }

      const accessToken = await calendarSettingsService.getValidAccessToken(userId);
      const calendarId = settings.google_calendar_id;

      if (!calendarId) {
        return;
      }

      await googleCalendarService.deleteEvent(
        accessToken,
        calendarId,
        booking.google_event_id
      );

      await calendarSettingsService.updateSettings(userId, {
        last_sync_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to delete booking from Google Calendar:', error);
      throw error;
    }
  },

  async syncAllBookings(userId: string): Promise<void> {
    const settings = await calendarSettingsService.getSettings(userId);

    if (!settings || !settings.sync_enabled) {
      throw new Error('Google Calendar sync is not enabled');
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .in('status', ['Active', 'Deposit Not Paid']);

    if (bookingsError) throw bookingsError;

    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*');

    if (vehiclesError) throw vehiclesError;

    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

    for (const booking of bookings) {
      const vehicle = vehicleMap.get(booking.vehicle_id);
      await this.syncBookingToGoogle(userId, booking, vehicle);
    }
  },
};
