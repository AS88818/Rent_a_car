import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Copy, RotateCcw, Save, MapPin, FileText, MessageCircle, Mail, Trash2, Clock, Check, CheckCircle, Plus, X, Car, User, ArrowRightLeft, AlertTriangle, Gauge } from 'lucide-react';
import { quotationService, vehicleService, bookingService, branchService, categoryService } from '../services/api';
import { CategoryPricing, SeasonRule, CategoryQuoteResult, Branch, PricingConfig, Quote, VehicleCategory, Vehicle, Booking } from '../types/database';
import { showToast } from '../lib/toast';
import { useAuth } from '../lib/auth-context';
import { generateQuotePDFBase64, companySettingsToPDFInfo } from '../lib/pdf-utils';
import { nowNaive } from '../lib/utils';
import { useCompanySettings } from '../lib/company-settings-context';
import { supabase } from '../lib/supabase';

interface OtherFee {
  id: string;
  description: string;
  amount: number;
}

interface QuoteInputs {
  startDateTime: string;
  endDateTime: string;
  hasHalfDay: boolean;
  hasChauffeur: boolean;
  quoteType: 'self_drive' | 'chauffeur' | 'transfer';
  chauffeurChargePerDay: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  pickupLocation: string;
  dropoffLocation: string;
  differentLocationCharge: number;
  outsideHoursCharge: number;
  otherFees: OtherFee[];
  additionalNotes: string;
  otherFee1Desc: string;
  otherFee1Amount: number;
  otherFee2Desc: string;
  otherFee2Amount: number;
}

export function QuotationCalculatorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const [categoryPricing, setCategoryPricing] = useState<CategoryPricing[]>([]);
  const [seasonRules, setSeasonRules] = useState<SeasonRule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<CategoryQuoteResult[]>([]);
  const [pickupLocationType, setPickupLocationType] = useState<'branch' | 'other'>('branch');
  const [dropoffLocationType, setDropoffLocationType] = useState<'branch' | 'other'>('branch');
  const [customPickupLocation, setCustomPickupLocation] = useState('');
  const [customDropoffLocation, setCustomDropoffLocation] = useState('');
  const [selectedPickupBranchId, setSelectedPickupBranchId] = useState('');
  const [selectedDropoffBranchId, setSelectedDropoffBranchId] = useState('');
  const [visibleCategories, setVisibleCategories] = useState<string[]>([]);
  const [savedQuoteReference, setSavedQuoteReference] = useState<string | null>(null);
  const [, setPricingConfig] = useState<PricingConfig | null>(null);
  const [draftQuotes, setDraftQuotes] = useState<Quote[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [quoteCreated, setQuoteCreated] = useState(false);
  const [loadedQuoteId, setLoadedQuoteId] = useState<string | null>(null);

  const [inputs, setInputs] = useState<QuoteInputs>({
    startDateTime: '',
    endDateTime: '',
    hasHalfDay: false,
    hasChauffeur: false,
    quoteType: 'self_drive',
    chauffeurChargePerDay: 4000,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    pickupLocation: '',
    dropoffLocation: '',
    differentLocationCharge: 0,
    outsideHoursCharge: 0,
    otherFees: [],
    additionalNotes: '',
    otherFee1Desc: '',
    otherFee1Amount: 0,
    otherFee2Desc: '',
    otherFee2Amount: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (location.state?.loadQuote) {
      const quote = location.state.loadQuote as Quote;
      const quoteInputs = quote.quote_inputs as any;

      setInputs({
        clientName: quote.client_name,
        clientEmail: quote.client_email || '',
        clientPhone: quote.client_phone || '',
        startDateTime: quote.start_date ? `${quote.start_date}T09:00` : '',
        endDateTime: quote.end_date ? `${quote.end_date}T18:00` : '',
        hasHalfDay: quote.has_half_day,
        hasChauffeur: quote.has_chauffeur,
        quoteType: quoteInputs?.quoteType || (quote.has_chauffeur ? 'chauffeur' : 'self_drive'),
        chauffeurChargePerDay: quoteInputs?.chauffeurChargePerDay || 4000,
        pickupLocation: quote.pickup_location || quoteInputs?.pickupLocation || '',
        dropoffLocation: quote.dropoff_location || quoteInputs?.dropoffLocation || '',
        differentLocationCharge: quoteInputs?.differentLocationCharge || 0,
        outsideHoursCharge: quote.outside_hours_charges || quoteInputs?.outsideHoursCharge || 0,
        otherFees: quoteInputs?.otherFees || [],
        additionalNotes: quoteInputs?.additionalNotes || '',
        otherFee1Desc: quote.other_fee_1_desc || '',
        otherFee1Amount: quote.other_fee_1_amount || 0,
        otherFee2Desc: quote.other_fee_2_desc || '',
        otherFee2Amount: quote.other_fee_2_amount || 0,
      });

      const quoteData = quote.quote_data as { [key: string]: CategoryQuoteResult };
      const loadedResults: CategoryQuoteResult[] = Object.values(quoteData);
      setResults(loadedResults);

      const categories = loadedResults.map(r => r.categoryName);
      setVisibleCategories(categories);

      setSavedQuoteReference(quote.quote_reference || null);
      setLoadedQuoteId(quote.id);
      setCurrentStep(2);
      showToast('Quote loaded successfully', 'success');

      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const loadData = async () => {
    try {
      const [pricing, rules, branchesData, config, drafts, categories] = await Promise.all([
        quotationService.getCategoryPricing(),
        quotationService.getSeasonRules(),
        branchService.getBranches(),
        quotationService.getPricingConfig(),
        quotationService.getDraftQuotes(user!.id),
        categoryService.getCategories(),
      ]);
      setCategoryPricing(pricing);
      setSeasonRules(rules);
      setBranches(branchesData);
      setPricingConfig(config);
      setDraftQuotes(drafts);
      setVehicleCategories(categories);
    } catch (error: any) {
      showToast(error.message || 'Failed to load pricing data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateRentalDays = () => {
    if (!inputs.startDateTime || !inputs.endDateTime) return 0;
    const start = new Date(inputs.startDateTime);
    const end = new Date(inputs.endDateTime);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return days;
  };

  const getSeasonForDate = (date: Date): 'Peak' | 'Off Peak' => {
    // Dates stored as "MM-DD" (no year) — compare as numeric month*100+day
    const dateMD = (date.getMonth() + 1) * 100 + date.getDate();

    for (const rule of seasonRules) {
      const [sm, sd] = rule.date_start.split('-').map(Number);
      const [em, ed] = rule.date_end.split('-').map(Number);
      const startMD = sm * 100 + sd;
      const endMD = em * 100 + ed;

      if (startMD <= endMD) {
        // Normal range within a year (e.g. 06-01 to 09-30)
        if (dateMD >= startMD && dateMD <= endMD) return rule.season_type;
      } else {
        // Crosses year boundary (e.g. 12-05 to 01-15)
        if (dateMD >= startMD || dateMD <= endMD) return rule.season_type;
      }
    }

    return 'Peak';
  };

  const splitDaysBySeason = () => {
    if (!inputs.startDateTime || !inputs.endDateTime) return { peakDays: 0, offPeakDays: 0 };

    const start = new Date(inputs.startDateTime);
    const end = new Date(inputs.endDateTime);
    let peakDays = 0;
    let offPeakDays = 0;

    const current = new Date(start);
    while (current <= end) {
      const season = getSeasonForDate(current);
      if (season === 'Peak') {
        peakDays++;
      } else {
        offPeakDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return { peakDays, offPeakDays };
  };

  const calculateTieredPricing = (
    totalDays: number,
    baseRate: number,
    pricing: CategoryPricing,
    addHalfDay: boolean
  ) => {
    const bands = [
      { max: pricing.tier1_days, discount: pricing.tier1_discount },
      { max: pricing.tier2_days, discount: pricing.tier2_discount },
      { max: pricing.tier3_days, discount: pricing.tier3_discount },
      { max: pricing.tier4_days, discount: pricing.tier4_discount },
      { max: pricing.tier5_days, discount: pricing.tier5_discount },
      { max: pricing.tier6_days, discount: pricing.tier6_discount },
      { max: pricing.tier7_days, discount: pricing.tier7_discount },
      { max: pricing.tier8_days, discount: pricing.tier8_discount },
      { max: pricing.tier9_days, discount: pricing.tier9_discount },
      { max: pricing.tier10_days, discount: pricing.tier10_discount },
      { max: pricing.tier11_days, discount: pricing.tier11_discount },
      { max: pricing.tier12_days, discount: pricing.tier12_discount },
      { max: pricing.tier13_days, discount: pricing.tier13_discount },
      { max: pricing.tier14_days, discount: pricing.tier14_discount },
      { max: pricing.tier15_days, discount: pricing.tier15_discount },
    ].filter(b => b.max > 0);

    // Add half-day to total upfront so it falls in the correct tier,
    // not always forced into tier 1 regardless of booking length.
    let remainingDays = addHalfDay ? totalDays + 0.5 : totalDays;
    let totalCost = 0;
    const breakdown: Array<{ tier: number; days: number; rate: number; discount: number; amount: number }> = [];
    let previousMax = 0;

    for (let i = 0; i < bands.length && remainingDays > 0; i++) {
      const band = bands[i];
      const bandCapacity = band.max - previousMax;
      const tierDays = Math.min(bandCapacity, remainingDays);

      const discountedRate = baseRate * (1 - band.discount);
      const tierCost = tierDays * discountedRate;

      if (tierDays > 0) {
        breakdown.push({
          tier: i + 1,
          days: tierDays,
          rate: baseRate,
          discount: band.discount,
          amount: tierCost,
        });
        totalCost += tierCost;
        remainingDays -= tierDays;
      }

      previousMax = band.max;
    }

    return { totalCost, breakdown };
  };

  const checkVehicleAvailability = (
    categoryName: string,
    allVehicles: Vehicle[],
    allBookings: Booking[]
  ): {
    available: boolean;
    branchAvailability: Array<{
      branchId: string;
      branchName: string;
      availableCount: number;
      vehicleIds: string[];
    }>;
  } => {
    try {
      // Validate dates
      if (!inputs.startDateTime || !inputs.endDateTime) {
        return { available: false, branchAvailability: [] };
      }

      const category = vehicleCategories.find(c => c.category_name === categoryName);
      if (!category) return { available: false, branchAvailability: [] };

      const categoryVehicles = allVehicles.filter(
        v => v.category_id === category.id && v.status !== 'Grounded' && !v.is_personal
      );

      if (categoryVehicles.length === 0) {
        return { available: false, branchAvailability: [] };
      }
      const start = new Date(inputs.startDateTime);
      const end = new Date(inputs.endDateTime);

      // Check availability for each vehicle and group by branch
      const branchAvailabilityMap = new Map<string, {
        branchId: string;
        branchName: string;
        vehicleIds: string[];
      }>();

      for (const vehicle of categoryVehicles) {
        const vehicleBookings = allBookings.filter(
          b => b.vehicle_id === vehicle.id && (b.status === 'Active' || b.status === 'Advance Payment Not Paid')
        );

        const now = nowNaive();
        const isAvailable = !vehicleBookings.some(booking => {
          const bookingStart = new Date(booking.start_datetime);
          const bookingEnd = new Date(booking.end_datetime);
          // Active booking already ended — treat as over, doesn't block
          if (booking.status === 'Active' && bookingEnd <= now) return false;
          return start < bookingEnd && end > bookingStart;
        });

        if (isAvailable) {
          const branchId = vehicle.branch_id || 'no-branch';
          const branch = branches.find(b => b.id === branchId);
          const branchName = branch ? branch.branch_name : 'No Branch Assigned';

          if (!branchAvailabilityMap.has(branchId)) {
            branchAvailabilityMap.set(branchId, {
              branchId,
              branchName,
              vehicleIds: [],
            });
          }

          branchAvailabilityMap.get(branchId)!.vehicleIds.push(vehicle.id);
        }
      }

      // Convert map to array with counts
      const branchAvailability = Array.from(branchAvailabilityMap.values()).map(branch => ({
        ...branch,
        availableCount: branch.vehicleIds.length,
      }));

      const totalAvailable = branchAvailability.reduce((sum, b) => sum + b.availableCount, 0);

      return {
        available: totalAvailable > 0,
        branchAvailability,
      };
    } catch (error) {
      console.error('Error checking availability:', error);
      return { available: false, branchAvailability: [] };
    }
  };

  const addOtherFee = () => {
    const newFee: OtherFee = {
      id: Date.now().toString(),
      description: '',
      amount: 0,
    };
    setInputs({ ...inputs, otherFees: [...inputs.otherFees, newFee] });
  };

  const removeOtherFee = (id: string) => {
    setInputs({ ...inputs, otherFees: inputs.otherFees.filter(fee => fee.id !== id) });
  };

  const updateOtherFee = (id: string, field: 'description' | 'amount', value: string | number) => {
    setInputs({
      ...inputs,
      otherFees: inputs.otherFees.map(fee =>
        fee.id === id ? { ...fee, [field]: value } : fee
      ),
    });
  };

  // Check if pickup or dropoff is outside office hours (9 AM - 6 PM inclusive)
  const isOutsideOfficeHours = () => {
    if (!inputs.startDateTime || !inputs.endDateTime) return false;

    const startTime = inputs.startDateTime.split('T')[1];
    const endTime = inputs.endDateTime.split('T')[1];

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // Convert to minutes for easier comparison
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    const officeStartMinutes = 9 * 60; // 9:00 AM
    const officeEndMinutes = 18 * 60; // 6:00 PM

    // Outside hours if before 9:00 AM or after 6:00 PM
    return startTotalMinutes < officeStartMinutes || startTotalMinutes > officeEndMinutes
        || endTotalMinutes < officeStartMinutes || endTotalMinutes > officeEndMinutes;
  };

  const calculateQuote = async (): Promise<boolean> => {
    if (!inputs.startDateTime || !inputs.endDateTime) {
      showToast('Please select start and end date/time', 'error');
      return false;
    }

    if (new Date(inputs.endDateTime) < new Date(inputs.startDateTime)) {
      showToast('End date/time must be after start date/time', 'error');
      return false;
    }

    if (!inputs.pickupLocation || !inputs.dropoffLocation) {
      showToast('Please select both pickup and drop-off locations', 'error');
      return false;
    }

    setCalculating(true);

    try {
      const { peakDays, offPeakDays } = splitDaysBySeason();
      const totalRentalDays = calculateRentalDays();
      const chauffeurFeePerDay = inputs.chauffeurChargePerDay || 4000;
      const dailyMileageAllowance = companySettings.daily_mileage_allowance_km || 250;
      const results: CategoryQuoteResult[] = [];

      // Hoist fetches outside the loop (PERF-2: single fetch for all categories)
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 90);
      const [allVehicles, allBookings] = await Promise.all([
        vehicleService.getVehicles(),
        bookingService.getBookings(undefined, dateFrom.toISOString()),
      ]);

      // Skip PERSONAL category and any category with only personal vehicles
      const nonPersonalCategoryNames = new Set(
        vehicleCategories
          .filter(cat =>
            cat.category_name.toUpperCase() !== 'PERSONAL' &&
            allVehicles.some(v => v.category_id === cat.id && !v.is_personal)
          )
          .map(cat => cat.category_name)
      );

      for (const pricing of categoryPricing) {
        if (!nonPersonalCategoryNames.has(pricing.category_name)) continue;
        let rentalFee = 0;

        const totalSeasonDays = offPeakDays + peakDays;
        const hybridRate = totalSeasonDays > 0
          ? (offPeakDays / totalSeasonDays) * pricing.off_peak_rate
            + (peakDays   / totalSeasonDays) * pricing.peak_rate
          : pricing.off_peak_rate;

        const rentalCalc = calculateTieredPricing(
          totalSeasonDays,
          hybridRate,
          pricing,
          inputs.hasHalfDay
        );
        rentalFee = rentalCalc.totalCost;

        const totalDays = totalRentalDays + (inputs.hasHalfDay ? 0.5 : 0);
        const chauffeurFee = inputs.hasChauffeur ? totalDays * chauffeurFeePerDay : 0;
        const totalMileageAllowance = Math.round(totalDays * dailyMileageAllowance);

        // Use manually entered outside hours charge if outside office hours
        const outsideHoursCharge = isOutsideOfficeHours() ? (inputs.outsideHoursCharge || 0) : 0;

        const differentLocationFee = inputs.differentLocationCharge || 0;
        const otherFee1 = inputs.otherFee1Amount || 0;
        const otherFee2 = inputs.otherFee2Amount || 0;
        const dynamicOtherFeesTotal = inputs.otherFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);

        const subtotal = rentalFee + chauffeurFee + outsideHoursCharge + differentLocationFee + otherFee1 + otherFee2 + dynamicOtherFeesTotal;
        const vat = subtotal * 0.16;
        const grandTotal = Math.ceil((subtotal + vat) / 10) * 10;

        const availabilityResult = checkVehicleAvailability(pricing.category_name, allVehicles, allBookings);

        // Security deposit: Fixed amount for self-drive only (refundable, held against damage)
        const securityDepositValue = !inputs.hasChauffeur ? pricing.self_drive_deposit : 0;

        // Advance payment: 25% of grand total for ALL bookings (goes toward total cost)
        const advancePaymentValue = Math.ceil((grandTotal * 0.25) / 10) * 10;

        results.push({
          categoryName: pricing.category_name,
          rentalFee,
          chauffeurFee,
          outsideHoursCharge,
          otherFee1,
          otherFee2,
          subtotal,
          vat,
          grandTotal,
          securityDeposit: securityDepositValue,
          advancePayment: advancePaymentValue,
          dailyMileageAllowance,
          totalMileageAllowance,
          available: availabilityResult.available,
          branchAvailability: availabilityResult.branchAvailability,
          breakdown: {
            peakDays,
            offPeakDays,
            tierBreakdown: [],
          },
        });
      }

      setResults(results);
      setVisibleCategories(results.map(r => r.categoryName));
      showToast('Quote calculated successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to calculate quote', 'error');
      return false;
    } finally {
      setCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const resetCalculator = () => {
    setInputs({
      startDateTime: '',
      endDateTime: '',
      hasHalfDay: false,
      hasChauffeur: false,
      quoteType: 'self_drive',
      chauffeurChargePerDay: 4000,
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      pickupLocation: '',
      dropoffLocation: '',
      differentLocationCharge: 0,
      outsideHoursCharge: 0,
      otherFees: [],
      additionalNotes: '',
      otherFee1Desc: '',
      otherFee1Amount: 0,
      otherFee2Desc: '',
      otherFee2Amount: 0,
    });
    setPickupLocationType('branch');
    setDropoffLocationType('branch');
    setCustomPickupLocation('');
    setCustomDropoffLocation('');
    setSelectedPickupBranchId('');
    setSelectedDropoffBranchId('');
    setResults([]);
    setVisibleCategories([]);
    setSavedQuoteReference(null);
    setCurrentStep(1);
  };

  const DEFAULT_QUOTE_TEMPLATE = `*{{company_name}} - Vehicle Rental Quote*

{{quote_reference}}*Client:* {{client_name}}
*Period:* {{period}}
*Duration:* {{duration}}
*Pickup:* {{pickup_location}}
*Drop-off:* {{dropoff_location}}
*Type:* {{rental_type}}

*Inclusions:*
{{mileage_allowance}}

*Available Options:*

{{pricing_options}}

*Notes:*

1. Prices include 16% VAT
2. Card payments accepted - 3% transaction fee applies
3. 25% to book; 75% balance PLUS refundable deposits are due on day 1 of your rental

_Terms & Conditions Apply_

For booking or inquiries, please contact us.`;

  const formatQuoteMessage = () => {
    const rentalDays = calculateRentalDays() + (inputs.hasHalfDay ? 0.5 : 0);
    const filteredResults = results.filter(r => visibleCategories.includes(r.categoryName));
    const firstResult = filteredResults[0];
    const dailyMileageAllowance = firstResult?.dailyMileageAllowance ?? companySettings.daily_mileage_allowance_km ?? 250;
    const totalMileageAllowance = firstResult?.totalMileageAllowance ?? Math.round(rentalDays * dailyMileageAllowance);
    const mileageAllowanceLine = firstResult
      ? `${totalMileageAllowance.toLocaleString()} km - ${rentalDays} day${rentalDays !== 1 ? 's' : ''} x ${dailyMileageAllowance.toLocaleString()} km/day`
      : '';

    const pricingOptionsBlock = filteredResults.map((r, index) => {
      let line = `${index + 1}.  ${r.categoryName} at ${formatCurrency(r.grandTotal)}/-`;
      if (!inputs.hasChauffeur && r.securityDeposit > 0) {
        line += ` PLUS a refundable security deposit of ${formatCurrency(r.securityDeposit)}/-`;
      }
      if ((r.outsideHoursCharge ?? 0) > 0) {
        line += ` (incl. out-of-hours surcharge of ${formatCurrency(r.outsideHoursCharge ?? 0)}/-)`;
      }
      if (r.branchAvailability && r.branchAvailability.length > 0) {
        const availStr = r.branchAvailability
          .map(b => `${b.branchName}: ${b.availableCount} unit${b.availableCount !== 1 ? 's' : ''}`)
          .join(', ');
        line += `\n   Availability: ${availStr}`;
      } else if (!r.available) {
        line += `\n   Availability: Subject to Availability`;
      }
      return line;
    }).join('\n\n');

    const rentalType = inputs.quoteType === 'self_drive' ? 'Self Drive'
      : inputs.quoteType === 'chauffeur' ? 'With Chauffeur'
      : 'Transfer';

    const period = `${inputs.startDateTime.split('T')[0]} ${inputs.startDateTime.split('T')[1]} to ${inputs.endDateTime.split('T')[0]} ${inputs.endDateTime.split('T')[1]}`;

    const vars: Record<string, string> = {
      company_name: companySettings.company_name || 'Rent-A-Car Kenya',
      quote_reference: savedQuoteReference ? `*Reference:* ${savedQuoteReference}\n` : '',
      client_name: inputs.clientName,
      period,
      duration: `${rentalDays} day${rentalDays !== 1 ? 's' : ''}`,
      pickup_location: inputs.pickupLocation || 'TBD',
      dropoff_location: inputs.dropoffLocation || 'TBD',
      rental_type: rentalType,
      mileage_allowance: mileageAllowanceLine,
      pricing_options: pricingOptionsBlock,
    };

    const template = companySettings.quote_whatsapp_template || DEFAULT_QUOTE_TEMPLATE;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
  };

  const shareViaWhatsApp = () => {
    const message = formatQuoteMessage();
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    showToast('Opening WhatsApp...', 'success');
  };

  const shareViaEmail = async () => {
    if (!inputs.clientEmail) {
      showToast('Please enter client email address', 'error');
      return;
    }

    if (!savedQuoteReference) {
      showToast('Please save the quote first', 'error');
      return;
    }

    if (results.length === 0) {
      showToast('Please calculate quote first', 'error');
      return;
    }

    try {
      const rentalDays = calculateRentalDays() + (inputs.hasHalfDay ? 0.5 : 0);
      const filteredResults = results.filter(r => visibleCategories.includes(r.categoryName));
      const firstResult = filteredResults[0];
      const dailyMileageAllowance = firstResult?.dailyMileageAllowance ?? companySettings.daily_mileage_allowance_km ?? 250;
      const totalMileageAllowance = firstResult?.totalMileageAllowance ?? Math.round(rentalDays * dailyMileageAllowance);
      const mileageAllowanceLine = firstResult
        ? `${totalMileageAllowance.toLocaleString()} km - ${rentalDays} day${rentalDays !== 1 ? 's' : ''} x ${dailyMileageAllowance.toLocaleString()} km/day`
        : '';

      const pdfData = {
        quoteReference: savedQuoteReference,
        clientName: inputs.clientName,
        startDate: inputs.startDateTime.split('T')[0],
        startTime: inputs.startDateTime.split('T')[1],
        endDate: inputs.endDateTime.split('T')[0],
        endTime: inputs.endDateTime.split('T')[1],
        duration: `${rentalDays} day${rentalDays !== 1 ? 's' : ''}`,
        pickupLocation: inputs.pickupLocation || 'TBD',
        dropoffLocation: inputs.dropoffLocation || 'TBD',
        rentalType: inputs.quoteType === 'self_drive' ? 'Self Drive' : inputs.quoteType === 'chauffeur' ? 'With Chauffeur' : 'Transfer',
        dailyMileageAllowance: firstResult ? dailyMileageAllowance : undefined,
        totalMileageAllowance: firstResult ? totalMileageAllowance : undefined,
        categories: filteredResults.map(r => ({
          categoryName: r.categoryName,
          grandTotal: r.grandTotal,
          securityDeposit: r.securityDeposit,
          advancePayment: r.advancePayment,
          available: r.available,
          effectiveDailyRate: rentalDays > 0 ? r.grandTotal / rentalDays : 0,
        })),
      };

      const pdfBase64 = generateQuotePDFBase64(pdfData, companySettingsToPDFInfo(companySettings));

      const payload = {
        clientEmail: inputs.clientEmail,
        clientName: inputs.clientName,
        quoteReference: savedQuoteReference,
        startDate: inputs.startDateTime.split('T')[0],
        startTime: inputs.startDateTime.split('T')[1],
        endDate: inputs.endDateTime.split('T')[0],
        endTime: inputs.endDateTime.split('T')[1],
        duration: `${rentalDays} day${rentalDays !== 1 ? 's' : ''}`,
        pickupLocation: inputs.pickupLocation || 'TBD',
        dropoffLocation: inputs.dropoffLocation || 'TBD',
        rentalType: inputs.quoteType === 'self_drive' ? 'Self Drive' : inputs.quoteType === 'chauffeur' ? 'With Chauffeur' : 'Transfer',
        mileageAllowance: mileageAllowanceLine,
        pdfBase64,
        vehicleOptions: filteredResults.map(r => ({
          name: r.categoryName,
          price: r.grandTotal,
          deposit: r.securityDeposit,
        })),
      };

      const { data: result, error: invokeError } = await supabase.functions.invoke('send-quote-email', {
        body: payload,
      });

      if (invokeError) {
        console.error('Invoke error details:', invokeError);
        // result may contain the actual error body from the function even on non-2xx
        const detail = (result as any)?.error || invokeError.message || 'Failed to send email';
        throw new Error(detail);
      }

      if (!result?.success) {
        console.error('Function returned error:', result);
        throw new Error(result?.error || 'Failed to send email');
      }

      showToast('Quote sent successfully via email!', 'success');
    } catch (error: any) {
      console.error('=== Error sending quote email ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error:', error);
      showToast(error.message || 'Failed to send email', 'error');
    }
  };

  const copyQuoteSummary = () => {
    const message = formatQuoteMessage();
    navigator.clipboard.writeText(message);
    showToast('Quote copied to clipboard!', 'success');
  };

  const saveQuote = async () => {
    if (!inputs.clientName) {
      showToast('Please enter client name', 'error');
      return;
    }

    if (!inputs.clientPhone && !inputs.clientEmail) {
      showToast('Please enter either phone number or email address', 'error');
      return;
    }

    if (results.length === 0) {
      showToast('Please calculate quote first', 'error');
      return;
    }

    if (visibleCategories.length === 0) {
      showToast('Please select at least one vehicle category to save', 'error');
      return;
    }

    try {
      const quoteData: { [key: string]: CategoryQuoteResult } = {};
      results
        .filter(r => visibleCategories.includes(r.categoryName))
        .forEach(r => {
          quoteData[r.categoryName] = r;
        });

      const savedQuote = await quotationService.createQuote({
        user_id: user!.id,
        client_name: inputs.clientName,
        client_email: inputs.clientEmail || undefined,
        client_phone: inputs.clientPhone || undefined,
        pickup_location: inputs.pickupLocation || undefined,
        dropoff_location: inputs.dropoffLocation || undefined,
        start_date: inputs.startDateTime.split('T')[0],
        end_date: inputs.endDateTime.split('T')[0],
        has_chauffeur: inputs.hasChauffeur,
        has_half_day: inputs.hasHalfDay,
        outside_hours_charges: isOutsideOfficeHours() ? inputs.outsideHoursCharge : undefined,
        other_fee_1_desc: inputs.otherFee1Desc || undefined,
        other_fee_1_amount: inputs.otherFee1Amount || undefined,
        other_fee_2_desc: inputs.otherFee2Desc || undefined,
        other_fee_2_amount: inputs.otherFee2Amount || undefined,
        quote_data: quoteData,
        quote_inputs: {
          ...inputs,
          pickupLocationType,
          dropoffLocationType,
        },
        status: 'Active' as const,
      });

      setSavedQuoteReference(savedQuote.quote_reference);
      showToast(`Quote saved! Reference: ${savedQuote.quote_reference}`, 'success');
      setCurrentDraftId(null);
      setLoadedQuoteId(null);
      setQuoteCreated(true);
    } catch (error: any) {
      showToast(error.message || 'Failed to save quote', 'error');
    }
  };

  const updateExistingQuote = async () => {
    if (!loadedQuoteId) return;

    if (!inputs.clientName) {
      showToast('Please enter client name', 'error');
      return;
    }

    if (!inputs.clientPhone && !inputs.clientEmail) {
      showToast('Please enter either phone number or email address', 'error');
      return;
    }

    if (results.length === 0) {
      showToast('Please calculate quote first', 'error');
      return;
    }

    if (visibleCategories.length === 0) {
      showToast('Please select at least one vehicle category to save', 'error');
      return;
    }

    try {
      const quoteData: { [key: string]: CategoryQuoteResult } = {};
      results
        .filter(r => visibleCategories.includes(r.categoryName))
        .forEach(r => {
          quoteData[r.categoryName] = r;
        });

      await quotationService.updateQuote(loadedQuoteId, {
        client_name: inputs.clientName,
        client_email: inputs.clientEmail || undefined,
        client_phone: inputs.clientPhone || undefined,
        pickup_location: inputs.pickupLocation || undefined,
        dropoff_location: inputs.dropoffLocation || undefined,
        start_date: inputs.startDateTime.split('T')[0],
        end_date: inputs.endDateTime.split('T')[0],
        has_chauffeur: inputs.hasChauffeur,
        has_half_day: inputs.hasHalfDay,
        outside_hours_charges: isOutsideOfficeHours() ? inputs.outsideHoursCharge : undefined,
        other_fee_1_desc: inputs.otherFee1Desc || undefined,
        other_fee_1_amount: inputs.otherFee1Amount || undefined,
        other_fee_2_desc: inputs.otherFee2Desc || undefined,
        other_fee_2_amount: inputs.otherFee2Amount || undefined,
        quote_data: quoteData,
        quote_inputs: {
          ...inputs,
          pickupLocationType,
          dropoffLocationType,
        },
      });

      showToast(`Quote updated successfully! Reference: ${savedQuoteReference}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update quote', 'error');
    }
  };

  const closeQuote = () => {
    setLoadedQuoteId(null);
    navigate('/quotes');
  };

  const saveDraft = async () => {
    if (!inputs.clientName) {
      showToast('Please enter client name', 'error');
      return;
    }

    if (!inputs.clientPhone && !inputs.clientEmail) {
      showToast('Please enter either phone number or email address', 'error');
      return;
    }

    try {
      const draftData = {
        user_id: user!.id,
        client_name: inputs.clientName,
        client_email: inputs.clientEmail || undefined,
        client_phone: inputs.clientPhone || undefined,
        pickup_location: inputs.pickupLocation || undefined,
        dropoff_location: inputs.dropoffLocation || undefined,
        start_date: inputs.startDateTime.split('T')[0],
        end_date: inputs.endDateTime.split('T')[0],
        has_chauffeur: inputs.hasChauffeur,
        has_half_day: inputs.hasHalfDay,
        outside_hours_charges: isOutsideOfficeHours() ? inputs.outsideHoursCharge : undefined,
        other_fee_1_desc: inputs.otherFee1Desc || undefined,
        other_fee_1_amount: inputs.otherFee1Amount || undefined,
        other_fee_2_desc: inputs.otherFee2Desc || undefined,
        other_fee_2_amount: inputs.otherFee2Amount || undefined,
        quote_data: {},
        quote_inputs: {
          ...inputs,
          pickupLocationType,
          dropoffLocationType,
          customPickupLocation,
          customDropoffLocation,
          selectedPickupBranchId,
          selectedDropoffBranchId,
        },
        status: 'Draft' as const,
      };

      if (currentDraftId) {
        await quotationService.updateQuote(currentDraftId, draftData);
        showToast('Draft updated successfully', 'success');
      } else {
        const draft = await quotationService.createQuote(draftData);
        setCurrentDraftId(draft.id);
        showToast('Draft saved successfully', 'success');
      }

      const drafts = await quotationService.getDraftQuotes(user!.id);
      setDraftQuotes(drafts);
    } catch (error: any) {
      showToast(error.message || 'Failed to save draft', 'error');
    }
  };

  const loadDraft = async (draft: Quote) => {
    try {
      const savedInputs = draft.quote_inputs;
      if (savedInputs) {
        setInputs({
          clientName: draft.client_name,
          clientEmail: draft.client_email || '',
          clientPhone: draft.client_phone || savedInputs.clientPhone || '',
          startDateTime: draft.start_date ? `${draft.start_date}T09:00` : '',
          endDateTime: draft.end_date ? `${draft.end_date}T18:00` : '',
          hasHalfDay: draft.has_half_day,
          hasChauffeur: draft.has_chauffeur,
          quoteType: savedInputs.quoteType || (draft.has_chauffeur ? 'chauffeur' : 'self_drive'),
          chauffeurChargePerDay: savedInputs.chauffeurChargePerDay || 4000,
          pickupLocation: draft.pickup_location || savedInputs.pickupLocation || '',
          dropoffLocation: draft.dropoff_location || savedInputs.dropoffLocation || '',
          differentLocationCharge: savedInputs.differentLocationCharge || 0,
          outsideHoursCharge: draft.outside_hours_charges || savedInputs.outsideHoursCharge || 0,
          otherFees: savedInputs.otherFees || [],
          additionalNotes: savedInputs.additionalNotes || '',
          otherFee1Desc: draft.other_fee_1_desc || '',
          otherFee1Amount: draft.other_fee_1_amount || 0,
          otherFee2Desc: draft.other_fee_2_desc || '',
          otherFee2Amount: draft.other_fee_2_amount || 0,
        });

        setPickupLocationType(savedInputs.pickupLocationType || 'branch');
        setDropoffLocationType(savedInputs.dropoffLocationType || 'branch');
        setCustomPickupLocation(savedInputs.customPickupLocation || '');
        setCustomDropoffLocation(savedInputs.customDropoffLocation || '');
        setSelectedPickupBranchId(savedInputs.selectedPickupBranchId || '');
        setSelectedDropoffBranchId(savedInputs.selectedDropoffBranchId || '');

        setCurrentDraftId(draft.id);
        setShowDrafts(false);
        showToast('Draft loaded successfully', 'success');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to load draft', 'error');
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      await quotationService.deleteQuote(draftId);
      const drafts = await quotationService.getDraftQuotes(user!.id);
      setDraftQuotes(drafts);
      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
      }
      showToast('Draft deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete draft', 'error');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pricing data...</div>
      </div>
    );
  }

  if (quoteCreated && savedQuoteReference) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Created Successfully!</h1>
          <p className="text-gray-600 mb-6">Your quote has been saved with reference number:</p>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-2xl font-bold text-blue-600">{savedQuoteReference}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/quotes')}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View All Quotes
            </button>
            <button
              onClick={() => {
                setQuoteCreated(false);
                resetCalculator();
              }}
              className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/quotes')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Quote</h1>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((step, index) => (
            <div key={step} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  currentStep > step
                    ? 'bg-green-600 text-white'
                    : currentStep === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step ? <Check className="w-5 h-5" /> : step}
                </div>
                <span className="text-xs mt-2 text-gray-600 hidden md:block">
                  {step === 1 && 'Client & Dates'}
                  {step === 2 && 'Calculate & Review'}
                  {step === 3 && 'Customize & Save'}
                </span>
              </div>
              {index < 2 && (
                <div className={`h-1 flex-1 transition-colors ${
                  currentStep > step ? 'bg-green-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {draftQuotes.length > 0 && currentStep === 1 && (
        <button
          onClick={() => setShowDrafts(!showDrafts)}
          className="mb-4 flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Drafts ({draftQuotes.length})</span>
        </button>
      )}

      {showDrafts && draftQuotes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Saved Drafts</h3>
          <div className="space-y-2">
            {draftQuotes.map(draft => (
              <div
                key={draft.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{draft.client_name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(draft.created_at).toLocaleDateString()} • {draft.start_date} to {draft.end_date}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadDraft(draft)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentDraftId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-700" />
          <p className="text-sm text-yellow-800">
            <strong>Working on draft.</strong> Changes auto-save when you click "Save Draft".
          </p>
        </div>
      )}

      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Step 1: Client & Quote Details</h2>
          <p className="text-gray-600 mb-6">Enter client information, rental dates, and location details.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Name *
            </label>
            <input
              type="text"
              value={inputs.clientName}
              onChange={e => setInputs({ ...inputs, clientName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              placeholder="Enter client name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Email {!inputs.clientPhone && <span className="text-red-600">*</span>}
            </label>
            <input
              type="email"
              value={inputs.clientEmail}
              onChange={e => setInputs({ ...inputs, clientEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              placeholder="client@example.com"
            />
            <p className="text-xs text-gray-500 mt-1">Required if phone not provided</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Phone {!inputs.clientEmail && <span className="text-red-600">*</span>}
            </label>
            <input
              type="tel"
              value={inputs.clientPhone}
              onChange={e => setInputs({ ...inputs, clientPhone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              placeholder="+254 XXX XXXXXX"
            />
            <p className="text-xs text-gray-500 mt-1">Required if email not provided</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Pickup Location
              </div>
            </label>
            <select
              value={pickupLocationType === 'other' ? 'other' : selectedPickupBranchId}
              onChange={(e) => {
                if (e.target.value === 'other') {
                  setPickupLocationType('other');
                  setSelectedPickupBranchId('');
                  setInputs({ ...inputs, pickupLocation: customPickupLocation });
                } else {
                  setPickupLocationType('branch');
                  setSelectedPickupBranchId(e.target.value);
                  const branch = branches.find(b => b.id === e.target.value);
                  setInputs({ ...inputs, pickupLocation: branch?.branch_name || '' });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            >
              <option value="">Select pickup location</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
              ))}
              <option value="other">Other</option>
            </select>
            {pickupLocationType === 'other' && (
              <input
                type="text"
                value={customPickupLocation}
                onChange={(e) => {
                  setCustomPickupLocation(e.target.value);
                  setInputs({ ...inputs, pickupLocation: e.target.value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2 text-base"
                placeholder="Enter custom pickup location"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Drop-off Location
              </div>
            </label>
            <select
              value={dropoffLocationType === 'other' ? 'other' : selectedDropoffBranchId}
              onChange={(e) => {
                if (e.target.value === 'other') {
                  setDropoffLocationType('other');
                  setSelectedDropoffBranchId('');
                  setInputs({ ...inputs, dropoffLocation: customDropoffLocation });
                } else {
                  setDropoffLocationType('branch');
                  setSelectedDropoffBranchId(e.target.value);
                  const branch = branches.find(b => b.id === e.target.value);
                  setInputs({ ...inputs, dropoffLocation: branch?.branch_name || '' });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            >
              <option value="">Select drop-off location</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
              ))}
              <option value="other">Other</option>
            </select>
            {dropoffLocationType === 'other' && (
              <input
                type="text"
                value={customDropoffLocation}
                onChange={(e) => {
                  setCustomDropoffLocation(e.target.value);
                  setInputs({ ...inputs, dropoffLocation: e.target.value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2 text-base"
                placeholder="Enter custom drop-off location"
              />
            )}
          </div>

          {inputs.pickupLocation && inputs.dropoffLocation && inputs.pickupLocation !== inputs.dropoffLocation && (
            <div className="md:col-span-2">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Different Location Charge
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  Pickup and drop-off locations are different. Add any applicable extra charges.
                </p>
                <input
                  type="number"
                  value={inputs.differentLocationCharge || ''}
                  onChange={e =>
                    setInputs({ ...inputs, differentLocationCharge: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  placeholder="Enter amount (e.g., 2000)"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rental Days (Inclusive)
            </label>
            <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-semibold">
              {calculateRentalDays() || 0} day{calculateRentalDays() !== 1 ? 's' : ''}
              {inputs.hasHalfDay && ' + 0.5 day'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date & Time *
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={inputs.startDateTime.split('T')[0] || ''}
                onChange={(e) => {
                  const date = e.target.value;
                  const time = inputs.startDateTime.split('T')[1] || '09:00';
                  setInputs({ ...inputs, startDateTime: `${date}T${time}` });
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
              <select
                value={inputs.startDateTime.split('T')[1] || '09:00'}
                onChange={(e) => {
                  const date = inputs.startDateTime.split('T')[0] || new Date().toISOString().split('T')[0];
                  setInputs({ ...inputs, startDateTime: `${date}T${e.target.value}` });
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              >
                <option value="06:00">6:00 AM</option>
                <option value="06:30">6:30 AM</option>
                <option value="07:00">7:00 AM</option>
                <option value="07:30">7:30 AM</option>
                <option value="08:00">8:00 AM</option>
                <option value="08:30">8:30 AM</option>
                <option value="09:00">9:00 AM</option>
                <option value="09:30">9:30 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="10:30">10:30 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="11:30">11:30 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="12:30">12:30 PM</option>
                <option value="13:00">1:00 PM</option>
                <option value="13:30">1:30 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="14:30">2:30 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="15:30">3:30 PM</option>
                <option value="16:00">4:00 PM</option>
                <option value="16:30">4:30 PM</option>
                <option value="17:00">5:00 PM</option>
                <option value="17:30">5:30 PM</option>
                <option value="18:00">6:00 PM</option>
                <option value="18:30">6:30 PM</option>
                <option value="19:00">7:00 PM</option>
                <option value="19:30">7:30 PM</option>
                <option value="20:00">8:00 PM</option>
                <option value="20:30">8:30 PM</option>
                <option value="21:00">9:00 PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Operating hours: 9:00 AM - 6:00 PM (Kenya Time)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date & Time *
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={inputs.endDateTime.split('T')[0] || ''}
                min={inputs.startDateTime.split('T')[0] || ''}
                onChange={(e) => {
                  const date = e.target.value;
                  const time = inputs.endDateTime.split('T')[1] || '18:00';
                  setInputs({ ...inputs, endDateTime: `${date}T${time}` });
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
              <select
                value={inputs.endDateTime.split('T')[1] || '18:00'}
                onChange={(e) => {
                  const date = inputs.endDateTime.split('T')[0] || new Date().toISOString().split('T')[0];
                  setInputs({ ...inputs, endDateTime: `${date}T${e.target.value}` });
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              >
                <option value="06:00">6:00 AM</option>
                <option value="06:30">6:30 AM</option>
                <option value="07:00">7:00 AM</option>
                <option value="07:30">7:30 AM</option>
                <option value="08:00">8:00 AM</option>
                <option value="08:30">8:30 AM</option>
                <option value="09:00">9:00 AM</option>
                <option value="09:30">9:30 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="10:30">10:30 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="11:30">11:30 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="12:30">12:30 PM</option>
                <option value="13:00">1:00 PM</option>
                <option value="13:30">1:30 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="14:30">2:30 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="15:30">3:30 PM</option>
                <option value="16:00">4:00 PM</option>
                <option value="16:30">4:30 PM</option>
                <option value="17:00">5:00 PM</option>
                <option value="17:30">5:30 PM</option>
                <option value="18:00">6:00 PM</option>
                <option value="18:30">6:30 PM</option>
                <option value="19:00">7:00 PM</option>
                <option value="19:30">7:30 PM</option>
                <option value="20:00">8:00 PM</option>
                <option value="20:30">8:30 PM</option>
                <option value="21:00">9:00 PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Operating hours: 9:00 AM - 6:00 PM (Kenya Time)</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type of Hire <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setInputs({ ...inputs, quoteType: 'self_drive', hasChauffeur: false })}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  inputs.quoteType === 'self_drive'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-blue-300 text-gray-600'
                }`}
              >
                <Car className="w-6 h-6" />
                <span className="text-sm font-medium">Self-Drive</span>
              </button>
              <button
                type="button"
                onClick={() => setInputs({ ...inputs, quoteType: 'chauffeur', hasChauffeur: true })}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  inputs.quoteType === 'chauffeur'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-green-300 text-gray-600'
                }`}
              >
                <User className="w-6 h-6" />
                <span className="text-sm font-medium">Chauffeur</span>
              </button>
              <button
                type="button"
                onClick={() => setInputs({ ...inputs, quoteType: 'transfer', hasChauffeur: true })}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  inputs.quoteType === 'transfer'
                    ? 'border-orange-600 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-orange-300 text-gray-600'
                }`}
              >
                <ArrowRightLeft className="w-6 h-6" />
                <span className="text-sm font-medium">Transfer</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {inputs.quoteType === 'self_drive' && 'Client drives the vehicle themselves. Security deposit required.'}
              {inputs.quoteType === 'chauffeur' && 'Vehicle comes with a professional driver. No security deposit required.'}
              {inputs.quoteType === 'transfer' && 'One-way transfer service with driver. No security deposit required.'}
            </p>
          </div>

          <div className="md:col-span-2 flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.hasHalfDay}
                onChange={e => setInputs({ ...inputs, hasHalfDay: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 text-base"
              />
              <span className="text-sm font-medium text-gray-700">
                Additional Half Day?
              </span>
            </label>
          </div>

          {inputs.quoteType === 'chauffeur' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chauffeur Charge Per Day (KES)
              </label>
              <input
                type="number"
                value={inputs.chauffeurChargePerDay || ''}
                onChange={e => setInputs({ ...inputs, chauffeurChargePerDay: parseFloat(e.target.value) || 0 })}
                className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                placeholder="4000"
              />
              <p className="text-xs text-gray-500 mt-1">Default: KES 4,000 per day</p>
            </div>
          )}

          {isOutsideOfficeHours() && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outside Office Hours Surcharge
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">KES</span>
                <input
                  type="number"
                  value={inputs.outsideHoursCharge || ''}
                  onChange={e => setInputs({ ...inputs, outsideHoursCharge: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>
              {(() => {
                const startTime = inputs.startDateTime?.split('T')[1];
                const endTime = inputs.endDateTime?.split('T')[1];
                const officeStart = 9 * 60;
                const officeEnd = 18 * 60;
                const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                const startMins = startTime ? toMins(startTime) : null;
                const endMins = endTime ? toMins(endTime) : null;
                const startOutside = startMins !== null && (startMins < officeStart || startMins > officeEnd);
                const endOutside = endMins !== null && (endMins < officeStart || endMins > officeEnd);
                return (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mt-1">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-amber-900 mb-2">Outside Office Hours Charges</h4>
                        <div className="space-y-1 text-sm text-amber-800">
                          {startOutside && <p>• Pickup outside office hours</p>}
                          {endOutside && <p>• Drop-off outside office hours</p>}
                        </div>
                        <p className="text-xs text-amber-700 mt-2">
                          Office hours: 9:00 AM - 6:00 PM. Pickups/drop-offs outside these hours incur additional charges.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Fee 1 (Description)
            </label>
            <input
              type="text"
              value={inputs.otherFee1Desc}
              onChange={e => setInputs({ ...inputs, otherFee1Desc: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              placeholder="e.g., Delivery Fee"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Fee 1 (Amount)
            </label>
            <input
              type="number"
              value={inputs.otherFee1Amount || ''}
              onChange={e =>
                setInputs({ ...inputs, otherFee1Amount: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Fee 2 (Description)
            </label>
            <input
              type="text"
              value={inputs.otherFee2Desc}
              onChange={e => setInputs({ ...inputs, otherFee2Desc: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              placeholder="e.g., Insurance Fee"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Fee 2 (Amount)
            </label>
            <input
              type="number"
              value={inputs.otherFee2Amount || ''}
              onChange={e =>
                setInputs({ ...inputs, otherFee2Amount: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Additional Fees
            </label>
            <button
              type="button"
              onClick={addOtherFee}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Fee
            </button>
          </div>

          {inputs.otherFees.length > 0 && (
            <div className="space-y-3">
              {inputs.otherFees.map((fee) => (
                <div key={fee.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={fee.description}
                      onChange={(e) => updateOtherFee(fee.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="Fee description"
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      value={fee.amount || ''}
                      onChange={(e) => updateOtherFee(fee.id, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOtherFee(fee.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            value={inputs.additionalNotes}
            onChange={(e) => setInputs({ ...inputs, additionalNotes: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base"
            placeholder="Add any additional information or special requirements for this quote..."
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={saveDraft}
            disabled={!inputs.clientName}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {currentDraftId ? 'Update Draft' : 'Save as Draft'}
          </button>
          <button
            onClick={async () => {
              const success = await calculateQuote();
              if (success) {
                setCurrentStep(2);
              }
            }}
            disabled={calculating || !inputs.clientName || !inputs.startDateTime || !inputs.endDateTime}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculating ? 'Calculating...' : 'Calculate & Continue'}
          </button>
        </div>
      </div>
      )}

      {currentStep === 2 && (
        <div>
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Step 2: Review & Customize Quote</h2>
            <p className="text-gray-600 mb-6">Review the calculated rates for all vehicle categories. Select which categories to include in the final quote and customize fees.</p>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline mr-2" />
                Back to Edit
              </button>
            </div>
          </div>

      {results.length > 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Show Categories:</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setVisibleCategories(results.map(r => r.categoryName))}
                  className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setVisibleCategories([])}
                  className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {results.map(result => (
                <label
                  key={result.categoryName}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleCategories.includes(result.categoryName)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibleCategories([...visibleCategories, result.categoryName]);
                      } else {
                        setVisibleCategories(visibleCategories.filter(c => c !== result.categoryName));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 text-base"
                  />
                  <span className="text-sm font-medium text-gray-700">{result.categoryName}</span>
                  {result.branchAvailability && result.branchAvailability.length > 0 ? (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {result.branchAvailability.reduce((sum, b) => sum + b.availableCount, 0)} available
                    </span>
                  ) : (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      0 available
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {visibleCategories.length > 0 && (() => {
            const firstResult = results.find(r => visibleCategories.includes(r.categoryName));
            if (!firstResult) return null;
            const rentalDays = calculateRentalDays() + (inputs.hasHalfDay ? 0.5 : 0);
            const dailyMileageAllowance = firstResult.dailyMileageAllowance ?? companySettings.daily_mileage_allowance_km ?? 250;
            const totalMileageAllowance = firstResult.totalMileageAllowance ?? Math.round(rentalDays * dailyMileageAllowance);
            return (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                    <Gauge className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Inclusions</h3>
                    <p className="text-sm text-gray-700 mt-1">
                      Mileage allowance: <span className="font-semibold">{totalMileageAllowance.toLocaleString()} km</span>
                      <span className="text-gray-500"> - {rentalDays} day{rentalDays !== 1 ? 's' : ''} x {dailyMileageAllowance.toLocaleString()} km/day</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b-2 border-gray-300 sticky left-0 bg-gray-50 z-10">
                      Item
                    </th>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                      <th
                        key={result.categoryName}
                        className="px-4 py-3 text-right text-sm font-semibold text-gray-900 border-b-2 border-gray-300 min-w-[140px]"
                      >
                        {result.categoryName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                      Rental Fee
                    </td>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                      <td key={result.categoryName} className="px-4 py-3 text-sm text-right">
                        {formatCurrency(result.rentalFee)}
                      </td>
                    ))}
                  </tr>

                  {inputs.hasChauffeur && (
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                        Chauffeur Fee
                      </td>
                      {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                        <td key={result.categoryName} className="px-4 py-3 text-sm text-right">
                          {formatCurrency(result.chauffeurFee)}
                        </td>
                      ))}
                    </tr>
                  )}

                  {inputs.differentLocationCharge > 0 && (
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                        Different Location Charge
                      </td>
                      {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                        <td key={result.categoryName} className="px-4 py-3 text-sm text-right">
                          {formatCurrency(inputs.differentLocationCharge)}
                        </td>
                      ))}
                    </tr>
                  )}

                  {inputs.otherFee1Desc && (
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                        {inputs.otherFee1Desc}
                      </td>
                      {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                        <td key={result.categoryName} className="px-4 py-3 text-sm text-right">
                          {formatCurrency(result.otherFee1)}
                        </td>
                      ))}
                    </tr>
                  )}

                  {inputs.otherFee2Desc && (
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                        {inputs.otherFee2Desc}
                      </td>
                      {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                        <td key={result.categoryName} className="px-4 py-3 text-sm text-right">
                          {formatCurrency(result.otherFee2)}
                        </td>
                      ))}
                    </tr>
                  )}

                  {inputs.otherFees.filter(fee => fee.description && fee.amount > 0).map(fee => (
                    <tr key={fee.id} className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                        {fee.description}
                      </td>
                      {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                        <td key={result.categoryName} className="px-4 py-3 text-sm text-right">
                          {formatCurrency(fee.amount)}
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">
                      Subtotal
                    </td>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                      <td
                        key={result.categoryName}
                        className="px-4 py-3 text-sm text-right font-semibold text-gray-900"
                      >
                        {formatCurrency(result.subtotal)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                      VAT (16%)
                    </td>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                      <td key={result.categoryName} className="px-4 py-3 text-sm text-right">
                        {formatCurrency(result.vat)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b-2 border-gray-300 bg-blue-50">
                    <td className="px-4 py-4 text-base font-bold text-gray-900 sticky left-0 bg-blue-50">
                      Grand Total
                    </td>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                      <td
                        key={result.categoryName}
                        className="px-4 py-4 text-base text-right font-bold text-blue-700"
                      >
                        {formatCurrency(result.grandTotal)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-gray-200 bg-blue-50/50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-700 sticky left-0 bg-blue-50/50">
                      Effective Daily Rate
                      <span className="text-xs text-gray-500 ml-1">(incl. VAT & fees)</span>
                    </td>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => {
                      const rentalDays = calculateRentalDays() + (inputs.hasHalfDay ? 0.5 : 0);
                      const dailyRate = rentalDays > 0 ? result.grandTotal / rentalDays : 0;
                      return (
                        <td
                          key={result.categoryName}
                          className="px-4 py-2 text-sm text-right font-semibold text-blue-600"
                        >
                          {formatCurrency(dailyRate)}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="border-b border-gray-200 bg-green-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-green-50">
                      <div className="flex items-center gap-2">
                        <span>25% Advance Payment</span>
                        <span className="text-xs text-gray-600">(Required to confirm)</span>
                      </div>
                    </td>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                      <td
                        key={result.categoryName}
                        className="px-4 py-3 text-sm text-right font-semibold text-green-700"
                      >
                        {formatCurrency(result.advancePayment)}
                      </td>
                    ))}
                  </tr>

                  {!inputs.hasChauffeur && (
                    <tr className="border-b border-gray-200 bg-yellow-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-yellow-50">
                        <div className="flex items-center gap-2">
                          <span>Security Deposit</span>
                          <span className="text-xs text-gray-600">(Refundable)</span>
                        </div>
                      </td>
                      {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                        <td
                          key={result.categoryName}
                          className="px-4 py-3 text-sm text-right font-medium text-gray-900"
                        >
                          {formatCurrency(result.securityDeposit)}
                        </td>
                      ))}
                    </tr>
                  )}

                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                      Availability
                    </td>
                    {results.filter(r => visibleCategories.includes(r.categoryName)).map(result => (
                      <td key={result.categoryName} className="px-4 py-3 text-sm">
                        {result.branchAvailability && result.branchAvailability.length > 0 ? (
                          <div className="space-y-1">
                            {result.branchAvailability.map((branch) => (
                              <div key={branch.branchId} className="flex items-center justify-end gap-2">
                                <span className="text-xs text-gray-600">{branch.branchName}:</span>
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  {branch.availableCount} {branch.availableCount === 1 ? 'vehicle' : 'vehicles'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Subject to Availability
                            </span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {inputs.additionalNotes && (
              <div className="p-4 bg-blue-50 border-t border-blue-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Additional Notes:</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{inputs.additionalNotes}</p>
              </div>
            )}
            <div className="p-4 flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
              <FileText className="w-4 h-4" />
              <p className="font-medium">Terms & Conditions Apply</p>
            </div>
          </div>

          {savedQuoteReference && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Save className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Quote Saved Successfully!</p>
                <p className="text-lg font-bold text-green-700">{savedQuoteReference}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={copyQuoteSummary}
              className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Copy className="w-5 h-5" />
              Copy
            </button>
            <button
              onClick={shareViaWhatsApp}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </button>
            <button
              onClick={shareViaEmail}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Mail className="w-5 h-5" />
              Email
            </button>
            <button
              onClick={resetCalculator}
              className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>

          {loadedQuoteId ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={updateExistingQuote}
                  disabled={!inputs.clientName || visibleCategories.length === 0}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  Save Changes
                </button>
                <button
                  onClick={closeQuote}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-4 rounded-lg hover:bg-gray-50 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Close
                </button>
              </div>
              <button
                onClick={saveQuote}
                disabled={!inputs.clientName || visibleCategories.length === 0}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                Save as New Quote
              </button>
            </div>
          ) : (
            <button
              onClick={saveQuote}
              disabled={!inputs.clientName || visibleCategories.length === 0}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              Save Quote & Get Reference Number
            </button>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
}
