import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from './supabase';
import { CompanySettings } from '../types/database';

const DEFAULT_SETTINGS: CompanySettings = {
  id: '',
  company_name: 'Rent A Car In Kenya',
  tagline: 'Premium Vehicle Rentals',
  email: 'info@rentacarinkenya.com',
  phone_nanyuki: '+254722513739',
  phone_nairobi: '+254721177642',
  website_url: '',
  address: '',
  bank_name: 'Example Bank Kenya',
  bank_account: '1234567890',
  mpesa_till: '123456',
  logo_url: '/rent-a-car-in-kenya-logo-hd2-135x134.png',
  email_signature: '',
  currency_code: 'KES',
  currency_locale: 'en-KE',
  updated_at: '',
};

interface CompanySettingsContextType {
  settings: CompanySettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsContextType | undefined>(undefined);

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings_public')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load company settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const value = {
    settings,
    loading,
    refresh: fetchSettings,
  };

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export function useCompanySettings() {
  const context = useContext(CompanySettingsContext);
  if (context === undefined) {
    throw new Error('useCompanySettings must be used within CompanySettingsProvider');
  }
  return context;
}
