import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Calculator, Copy, RotateCcw, Save, MapPin, FileText, Share2, MessageCircle, Mail, FolderOpen, Trash2, Clock, Receipt, Check, CheckCircle, Plus, X, Car, User, ArrowRightLeft } from 'lucide-react';
import { quotationService, vehicleService, bookingService, branchService, categoryService } from '../services/api';
import { CategoryPricing, SeasonRule, CategoryQuoteResult, Branch, PricingConfig, Quote, VehicleCategory } from '../types/database';
import { showToast } from '../lib/toast';
import { useAuth } from '../lib/auth-context';
import { generateQuotePDFBase64, companySettingsToPDFInfo } from '../lib/pdf-utils';
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
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
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
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  const getSeasonForDate = (date: Date): 'Peak' | 'Off Peak' => {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if ((month === 4 && day >= 6) || (month === 5)) {
      return 'Off Peak';
    }
    if ((month === 10) || (month === 11) || (month === 12 && day <= 4)) {
      return 'Off Peak';
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
    ];

    let remainingDays = totalDays;
    let totalCost = 0;
    const breakdown: Array<{ tier: number; days: number; rate: number; discount: number; amount: number }> = [];
    let previousMax = 0;

    for (let i = 0; i < bands.length && remainingDays > 0; i++) {
      const band = bands[i];
      const bandCapacity = band.max - previousMax;
      let tierDays = Math.min(bandCapacity, remainingDays);

      if (i === 0 && addHalfDay) {
        tierDays += 0.5;
      }

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
        remainingDays -= (i === 0 && addHalfDay) ? tierDays - 0.5 : tierDays;
      }

      previousMax = band.max;
    }

    return { totalCost, breakdown };
  };

  const checkVehicleAvailability = async (categoryName: string): Promise<{
    available: boolean;
    branchAvailability: Array<{
      branchId: string;
      branchName: string;
      availableCount: number;
      vehicleIds: string[];
    }>;
  }> => {
    try {
      // Validate dates
      if (!inputs.startDateTime || !inputs.endDateTime) {
        console.warn('No dates provided for availability check');
        return { available: false, branchAvailability: [] };
      }

      // Find the category ID from the category name
      const category = vehicleCategories.find(c => c.category_name === categoryName);
      if (!category) {
        console.warn(`Category ${categoryName} not found`);
        return { available: false, branchAvailability: [] };
      }

      // Get all vehicles in this category
      const allVehicles = await vehicleService.getVehicles();
      const categoryVehicles = allVehicles.filter(
        v => v.category_id === category.id && v.status === 'Available' && !v.is_personal
      );

      if (categoryVehicles.length === 0) {
        return { available: false, branchAvailability: [] };
      }

      // Get all active bookings
      const allBookings = await bookingService.getBookings();
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

        const isAvailable = !vehicleBookings.some(booking => {
          const bookingStart = new Date(booking.start_datetime);
          const bookingEnd = new Date(booking.end_datetime);
          // Check if date ranges overlap
          return start <= bookingEnd && end >= bookingStart;
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
      const results: CategoryQuoteResult[] = [];

      for (const pricing of categoryPricing) {
        let rentalFee = 0;

        if (offPeakDays > 0) {
          const offPeakCalc = calculateTieredPricing(
            offPeakDays,
            pricing.off_peak_rate,
            pricing,
            inputs.hasHalfDay && offPeakDays >= 1
          );
          rentalFee += offPeakCalc.totalCost;
        }

        if (peakDays > 0) {
          const peakCalc = calculateTieredPricing(
            peakDays,
            pricing.peak_rate,
            pricing,
            inputs.hasHalfDay && offPeakDays === 0
          );
          rentalFee += peakCalc.totalCost;
        }

        const totalDays = totalRentalDays + (inputs.hasHalfDay ? 0.5 : 0);
        const chauffeurFee = inputs.hasChauffeur ? totalDays * chauffeurFeePerDay : 0;

        // Use manually entered outside hours charge if outside office hours
        const outsideHoursCharge = isOutsideOfficeHours() ? (inputs.outsideHoursCharge || 0) : 0;

        const differentLocationFee = inputs.differentLocationCharge || 0;
        const otherFee1 = inputs.otherFee1Amount || 0;
        const otherFee2 = inputs.otherFee2Amount || 0;
        const dynamicOtherFeesTotal = inputs.otherFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);

        const subtotal = rentalFee + chauffeurFee + outsideHoursCharge + differentLocationFee + otherFee1 + otherFee2 + dynamicOtherFeesTotal;
        const vat = subtotal * 0.16;
        const grandTotal = Math.ceil((subtotal + vat) / 10) * 10;

        const availabilityResult = await checkVehicleAvailability(pricing.category_name);

        // Security deposit: Fixed amount for self-drive only (refundable, held against damage)
        const securityDepositValue = !inputs.hasChauffeur ? pricing.self_drive_deposit : 0;

        // Advance payment: 25% of grand total for ALL bookings (goes toward total cost)
        const advancePaymentValue = Math.ceil((grandTotal * 0.25) / 10) * 10;

        results.push({
          categoryName: pricing.category_name,
          rentalFee,
          chauffeurFee,
          otherFee1,
          otherFee2,
          subtotal,
          vat,
          grandTotal,
          securityDeposit: securityDepositValue,
          advancePayment: advancePaymentValue,
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
  };

  const formatQuoteMessage = () => {
    const rentalDays = calculateRentalDays() + (inputs.hasHalfDay ? 0.5 : 0);
    const filteredResults = results.filter(r => visibleCategories.includes(r.categoryName));

    let message = `*Rent-A-Car Kenya - Vehicle Rental Quote*\n\n`;

    if (savedQuoteReference) {
      message += `*Reference:* ${savedQuoteReference}\n`;
    }

    message += `*Client:* ${inputs.clientName}\n`;
    message += `*Period:* ${inputs.startDateTime.split('T')[0]} ${inputs.startDateTime.split('T')[1]} to ${inputs.endDateTime.split('T')[0]} ${inputs.endDateTime.split('T')[1]}\n`;
    message += `*Duration:* ${rentalDays} day${rentalDays !== 1 ? 's' : ''}\n`;
    message += `*Pickup:* ${inputs.pickupLocation || 'TBD'}\n`;
    message += `*Drop-off:* ${inputs.dropoffLocation || 'TBD'}\n`;
    message += `*Type:* ${inputs.quoteType === 'self_drive' ? 'Self Drive' : inputs.quoteType === 'chauffeur' ? 'With Chauffeur' : 'Transfer'}\n\n`;

    message += `*Pricing Options:*\n\n`;

    filteredResults.forEach((r, index) => {
      message += `${index + 1}. *${r.categoryName}*\n`;
      message += `   Total: ${formatCurrency(r.grandTotal)}\n`;
      message += `   25% Advance Required: ${formatCurrency(r.advancePayment)}\n`;
      if (!inputs.hasChauffeur && r.securityDeposit > 0) {
        message += `   Security Deposit: ${formatCurrency(r.securityDeposit)} (Refundable)\n`;
      }
      if (r.branchAvailability && r.branchAvailability.length > 0) {
        message += `   *Availability:*\n`;
        r.branchAvailability.forEach(branch => {
          message += `      ${branch.branchName}: ${branch.availableCount} vehicle${branch.availableCount !== 1 ? 's' : ''}\n`;
        });
      } else {
        message += `   Subject to Availability\n`;
      }
      message += `\n`;
    });

    message += `\n_Terms & Conditions Apply_\n`;
    message += `\nFor booking or inquiries, please contact us.`;

    return message;
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
        categories: filteredResults.map(r => ({
          categoryName: r.categoryName,
          grandTotal: r.grandTotal,
          securityDeposit: r.securityDeposit,
          advancePayment: r.advancePayment,
          available: r.available,
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
        rentalType: inputs.quoteType === 'self_drive' ? 'Self Drive' : inputs.quoteType === 'chauffeur' ? 'With Chauffeur' : 'Transfer',
        pdfBase64,
      };

      const { data: result, error: invokeError } = await supabase.functions.invoke('send-quote-email', {
        body: payload,
      });

      if (invokeError) {
        console.error('Invoke error details:', {
          message: invokeError.message,
          name: invokeError.name,
          stack: invokeError.stack,
        });
        throw new Error(invokeError.message || 'Failed to send email');
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
                setSavedQuoteReference(null);
                setCurrentStep(1);
                setResults([]);
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={inputs.startDateTime.split('T')[1] || '09:00'}
                onChange={(e) => {
                  const date = inputs.startDateTime.split('T')[0] || new Date().toISOString().split('T')[0];
                  setInputs({ ...inputs, startDateTime: `${date}T${e.target.value}` });
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                onChange={(e) => {
                  const date = e.target.value;
                  const time = inputs.endDateTime.split('T')[1] || '18:00';
                  setInputs({ ...inputs, endDateTime: `${date}T${time}` });
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={inputs.endDateTime.split('T')[1] || '18:00'}
                onChange={(e) => {
                  const date = inputs.endDateTime.split('T')[0] || new Date().toISOString().split('T')[0];
                  setInputs({ ...inputs, endDateTime: `${date}T${e.target.value}` });
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
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
                className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Pickup or dropoff is outside operating hours (9 AM - 6 PM). Enter surcharge amount.
              </p>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Fee description"
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      value={fee.amount || ''}
                      onChange={(e) => updateOtherFee(fee.id, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{result.categoryName}</span>
                  {result.branchAvailability && result.branchAvailability.length > 0 ? (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {result.branchAvailability.reduce((sum, b) => sum + b.availableCount, 0)} available
                    </span>
                  ) : (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                      ?
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

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
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Save className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Quote Saved Successfully!</p>
                  <p className="text-lg font-bold text-green-700">{savedQuoteReference}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={shareViaWhatsApp}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                  title="Share via WhatsApp"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
                <button
                  onClick={shareViaEmail}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                  title="Share via Email"
                >
                  <Mail className="w-5 h-5" />
                  <span className="hidden sm:inline">Email</span>
                </button>
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
