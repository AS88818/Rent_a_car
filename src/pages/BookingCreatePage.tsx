import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { bookingService, vehicleService, categoryService, branchService } from '../services/api';
import { Vehicle, VehicleCategory, Branch, Booking } from '../types/database';
import { showToast } from '../lib/toast';
import { getAvailableVehicles, calculateBookingDuration, checkInsuranceExpiryDuringBooking, formatDate } from '../lib/utils';
import { ArrowLeft, Check, CheckCircle, Calendar, MapPin, AlertTriangle } from 'lucide-react';
import { BookingDocumentUpload } from '../components/BookingDocumentUpload';

interface VehicleWithBranch extends Vehicle {
  branch_name?: string;
}

export function BookingCreatePage() {
  const navigate = useNavigate();
  const { branchId } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [vehicles, setVehicles] = useState<VehicleWithBranch[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<VehicleWithBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingCreated, setBookingCreated] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithBranch | null>(null);

  const [formData, setFormData] = useState({
    client_name: '',
    contact: '',
    client_email: '',
    notes: '',
    start_datetime: '',
    end_datetime: '',
    start_location: '',
    end_location: '',
    booking_type: 'self_drive' as 'self_drive' | 'chauffeur' | 'transfer',
    chauffeur_name: '',
    invoice_number: '',
  });

  const [startLocationType, setStartLocationType] = useState<'branch' | 'other'>('branch');
  const [endLocationType, setEndLocationType] = useState<'branch' | 'other'>('branch');
  const [customStartLocation, setCustomStartLocation] = useState('');
  const [customEndLocation, setCustomEndLocation] = useState('');
  const [selectedStartBranchId, setSelectedStartBranchId] = useState('');
  const [selectedEndBranchId, setSelectedEndBranchId] = useState('');

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [locationWarning, setLocationWarning] = useState<string>('');
  const [outsideHoursCharges, setOutsideHoursCharges] = useState({
    startOutsideHours: false,
    endOutsideHours: false,
    startCharge: 0,
    endCharge: 0,
    totalExtraCharge: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesData, vehiclesData, branchesData, bookingsData] = await Promise.all([
          categoryService.getCategories(),
          vehicleService.getVehicles(branchId || undefined),
          branchService.getBranches(),
          bookingService.getBookings(branchId || undefined),
        ]);

        const vehiclesWithBranch = vehiclesData
          .filter(v => !v.is_personal)
          .map(v => ({
            ...v,
            branch_name: branchesData.find(b => b.id === v.branch_id)?.branch_name || 'Unknown'
          }));

        setCategories(categoriesData);
        setVehicles(vehiclesWithBranch);
        setBranches(branchesData);
        setBookings(bookingsData);
      } catch (error) {
        showToast('Failed to fetch data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  useEffect(() => {
    if (selectedCategory && formData.start_datetime && formData.end_datetime) {
      const categoryVehicles = vehicles.filter(v => v.category_id === selectedCategory);
      const available = getAvailableVehicles(
        categoryVehicles,
        bookings,
        formData.start_datetime,
        formData.end_datetime
      );
      setAvailableVehicles(available);
    } else if (selectedCategory) {
      const filtered = vehicles.filter(v =>
        v.category_id === selectedCategory &&
        !v.on_hire &&
        !v.is_personal &&
        v.status !== 'Grounded' &&
        v.health_flag !== 'Grounded'
      );
      setAvailableVehicles(filtered);
    } else {
      setAvailableVehicles([]);
    }
  }, [selectedCategory, vehicles, bookings, formData.start_datetime, formData.end_datetime]);

  useEffect(() => {
    if (selectedVehicle && selectedVehicle.current_location && formData.start_location) {
      if (selectedVehicle.current_location !== formData.start_location) {
        setLocationWarning(
          `Notice: Vehicle is currently at ${selectedVehicle.current_location}, but booking starts at ${formData.start_location}. Please ensure vehicle relocation is arranged.`
        );
      } else {
        setLocationWarning('');
      }
    } else {
      setLocationWarning('');
    }
  }, [selectedVehicle, formData.start_location]);

  useEffect(() => {
    if (currentStep === 4) {
      validateDateTime();
    }
  }, [currentStep]);

  const setDefaultTime = (dateValue: string, isStart: boolean): string => {
    if (!dateValue) return '';
    const date = dateValue.split('T')[0];
    const time = isStart ? '09:00' : '18:00';
    return `${date}T${time}`;
  };

  const validateDateTime = () => {
    const errors: string[] = [];

    if (formData.start_datetime && formData.end_datetime) {
      const start = new Date(formData.start_datetime);
      const end = new Date(formData.end_datetime);

      if (end <= start) {
        errors.push('End date/time must be after start date/time');
      }

      const startHour = start.getHours();
      const startMinute = start.getMinutes();
      const endHour = end.getHours();
      const endMinute = end.getMinutes();

      const startTimeDecimal = startHour + startMinute / 60;
      const endTimeDecimal = endHour + endMinute / 60;

      let startOutsideHours = false;
      let endOutsideHours = false;
      let startCharge = 0;
      let endCharge = 0;

      if (startTimeDecimal < 9 || startTimeDecimal >= 18) {
        startOutsideHours = true;
        startCharge = 1000;
      }

      if (endTimeDecimal < 9 || endTimeDecimal > 18) {
        endOutsideHours = true;
        endCharge = 1000;
      }

      const totalExtraCharge = startCharge + endCharge;

      setOutsideHoursCharges({
        startOutsideHours,
        endOutsideHours,
        startCharge,
        endCharge,
        totalExtraCharge,
      });
    } else {
      setOutsideHoursCharges({
        startOutsideHours: false,
        endOutsideHours: false,
        startCharge: 0,
        endCharge: 0,
        totalExtraCharge: 0,
      });
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (saveAsDraft = false) => {
    if (!selectedVehicle) {
      showToast('Please select a vehicle', 'error');
      return;
    }

    if (!saveAsDraft && !validateDateTime()) {
      const errorMessage = validationErrors.length > 0
        ? validationErrors.join('. ')
        : 'Please fix date/time validation errors';
      showToast(errorMessage, 'error');
      return;
    }

    if (!saveAsDraft && !formData.client_name) {
      showToast('Client name is required', 'error');
      return;
    }

    if (!saveAsDraft && !formData.contact && !formData.client_email) {
      showToast('Please enter either phone number or email address', 'error');
      return;
    }

    setSubmitting(true);

    try {
      // Use vehicle's branch_id, or auth context branch, or the selected start branch location
      const vehicleBranchId = selectedVehicle.branch_id || branchId || selectedStartBranchId;

      if (!vehicleBranchId) {
        throw new Error('Branch ID is required. Please select a start location.');
      }

      const createdBooking = await bookingService.createBooking({
        vehicle_id: selectedVehicle.id,
        client_name: formData.client_name || 'Draft Client',
        contact: formData.contact || 'N/A',
        client_email: formData.client_email || undefined,
        start_datetime: formData.start_datetime,
        end_datetime: formData.end_datetime,
        start_location: formData.start_location,
        end_location: formData.end_location,
        notes: formData.notes,
        health_at_booking: selectedVehicle.health_flag,
        status: saveAsDraft ? 'Draft' : 'Active',
        branch_id: vehicleBranchId,
        booking_type: formData.booking_type,
        chauffeur_name: formData.booking_type === 'chauffeur' ? formData.chauffeur_name : undefined,
        invoice_number: formData.invoice_number || undefined,
        outside_hours_charges: outsideHoursCharges.totalExtraCharge,
      });

      // Update vehicle's branch_id if it was null or different
      if (!selectedVehicle.branch_id || selectedVehicle.branch_id !== vehicleBranchId) {
        await vehicleService.updateVehicle(selectedVehicle.id, { branch_id: vehicleBranchId });
      }

      setCreatedBookingId(createdBooking.id);
      setBookingCreated(true);
      showToast(saveAsDraft ? 'Draft saved successfully' : 'Booking created successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to create booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getHealthBadgeColor = (health: string) => {
    switch (health) {
      case 'Excellent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'OK':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Grounded':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const canProceedToStep = (step: number) => {
    if (step === 2) return formData.start_datetime && formData.end_datetime && formData.start_location && formData.end_location && validationErrors.length === 0;
    if (step === 3) return selectedCategory !== '';
    if (step === 4) return selectedVehicle !== null;
    if (step === 5) return formData.client_name && (formData.contact || formData.client_email);
    return true;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (bookingCreated) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600 mb-6">Your booking has been created successfully.</p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <h2 className="font-semibold text-gray-900 mb-3">Booking Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Vehicle:</span>
                <span className="font-medium">{selectedVehicle?.reg_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Client:</span>
                <span className="font-medium">{formData.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Contact:</span>
                <span className="font-medium">{formData.contact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">{calculateBookingDuration(formData.start_datetime, formData.end_datetime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Start:</span>
                <span className="font-medium">{new Date(formData.start_datetime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">End:</span>
                <span className="font-medium">{new Date(formData.end_datetime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">From:</span>
                <span className="font-medium">{formData.start_location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">To:</span>
                <span className="font-medium">{formData.end_location}</span>
              </div>
            </div>
          </div>

          {createdBookingId && (
            <div className="mb-6">
              <h2 className="font-semibold text-gray-900 mb-3 text-left">Upload Documents (Optional)</h2>
              <div className="border border-gray-200 rounded-lg p-4">
                <BookingDocumentUpload bookingId={createdBookingId} />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-left">
                Upload driver's license, signed contract, or other relevant documents. You can also upload these later from the booking details page.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/bookings')}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View All Bookings
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const duration = formData.start_datetime && formData.end_datetime
    ? calculateBookingDuration(formData.start_datetime, formData.end_datetime)
    : null;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/bookings')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Booking</h1>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step, index) => (
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
                  {step === 1 && 'Dates & Location'}
                  {step === 2 && 'Category'}
                  {step === 3 && 'Vehicle'}
                  {step === 4 && 'Client Details'}
                </span>
              </div>
              {index < 3 && (
                <div className={`h-1 flex-1 transition-colors ${
                  currentStep > step ? 'bg-green-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Step 1: Booking Details</h2>
            <p className="text-gray-600 mb-6">Choose the hire type, dates, and locations for this booking.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type of Hire <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, booking_type: 'self_drive' })}
                    className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.booking_type === 'self_drive'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    Self-Drive
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, booking_type: 'chauffeur' })}
                    className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.booking_type === 'chauffeur'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    Chauffeur-Driven
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, booking_type: 'transfer' })}
                    className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.booking_type === 'transfer'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    One-Way Transfer
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Start Date & Time <span className="text-red-600">*</span>
                    </div>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={formData.start_datetime.split('T')[0] || ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        const time = formData.start_datetime.split('T')[1] || '09:00';
                        setFormData({ ...formData, start_datetime: `${date}T${time}` });
                        validateDateTime();
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <select
                      value={formData.start_datetime.split('T')[1] || '09:00'}
                      onChange={(e) => {
                        const date = formData.start_datetime.split('T')[0] || new Date().toISOString().split('T')[0];
                        setFormData({ ...formData, start_datetime: `${date}T${e.target.value}` });
                        validateDateTime();
                      }}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      End Date & Time <span className="text-red-600">*</span>
                    </div>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={formData.end_datetime.split('T')[0] || ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        const time = formData.end_datetime.split('T')[1] || '18:00';
                        setFormData({ ...formData, end_datetime: `${date}T${time}` });
                        validateDateTime();
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <select
                      value={formData.end_datetime.split('T')[1] || '18:00'}
                      onChange={(e) => {
                        const date = formData.end_datetime.split('T')[0] || new Date().toISOString().split('T')[0];
                        setFormData({ ...formData, end_datetime: `${date}T${e.target.value}` });
                        validateDateTime();
                      }}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
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
              </div>

              {duration && validationErrors.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Booking Duration:</span> {duration}
                  </p>
                </div>
              )}

              {outsideHoursCharges.totalExtraCharge > 0 && validationErrors.length === 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-900 mb-2">Outside Office Hours Charges</h4>
                      <div className="space-y-1 text-sm text-amber-800">
                        {outsideHoursCharges.startOutsideHours && (
                          <p>• Pickup outside office hours: <span className="font-semibold">KES {outsideHoursCharges.startCharge.toLocaleString()}</span></p>
                        )}
                        {outsideHoursCharges.endOutsideHours && (
                          <p>• Drop-off outside office hours: <span className="font-semibold">KES {outsideHoursCharges.endCharge.toLocaleString()}</span></p>
                        )}
                        <p className="font-semibold pt-1 border-t border-amber-300 mt-2">
                          Total Extra Charges: KES {outsideHoursCharges.totalExtraCharge.toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs text-amber-700 mt-2">
                        Office hours: 9:00 AM - 6:00 PM. Pickups/drop-offs outside these hours incur additional charges.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  {validationErrors.map((error, index) => (
                    <p key={index} className="text-sm text-red-700">{error}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Start Location <span className="text-red-600">*</span>
                    </div>
                  </label>
                  <select
                    value={startLocationType === 'other' ? 'other' : selectedStartBranchId}
                    onChange={(e) => {
                      if (e.target.value === 'other') {
                        setStartLocationType('other');
                        setSelectedStartBranchId('');
                        setFormData({ ...formData, start_location: customStartLocation });
                      } else {
                        setStartLocationType('branch');
                        setSelectedStartBranchId(e.target.value);
                        const branch = branches.find(b => b.id === e.target.value);
                        setFormData({ ...formData, start_location: branch?.branch_name || '' });
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select start location</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                    ))}
                    <option value="other">Other</option>
                  </select>
                  {startLocationType === 'other' && (
                    <input
                      type="text"
                      value={customStartLocation}
                      onChange={(e) => {
                        setCustomStartLocation(e.target.value);
                        setFormData({ ...formData, start_location: e.target.value });
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                      placeholder="Enter custom start location"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      End Location <span className="text-red-600">*</span>
                    </div>
                  </label>
                  <select
                    value={endLocationType === 'other' ? 'other' : selectedEndBranchId}
                    onChange={(e) => {
                      if (e.target.value === 'other') {
                        setEndLocationType('other');
                        setSelectedEndBranchId('');
                        setFormData({ ...formData, end_location: customEndLocation });
                      } else {
                        setEndLocationType('branch');
                        setSelectedEndBranchId(e.target.value);
                        const branch = branches.find(b => b.id === e.target.value);
                        setFormData({ ...formData, end_location: branch?.branch_name || '' });
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select end location</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                    ))}
                    <option value="other">Other</option>
                  </select>
                  {endLocationType === 'other' && (
                    <input
                      type="text"
                      value={customEndLocation}
                      onChange={(e) => {
                        setCustomEndLocation(e.target.value);
                        setFormData({ ...formData, end_location: e.target.value });
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                      placeholder="Enter custom end location"
                      required
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => navigate('/bookings')}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!canProceedToStep(2)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Select Category
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Step 2: Select Vehicle Category</h2>
            <p className="text-gray-600 mb-6">Choose the type of vehicle you need for this booking.</p>

            {duration && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div><span className="font-medium">Duration:</span> {duration}</div>
                  <div><span className="font-medium">From:</span> {formData.start_location}</div>
                  <div className="col-span-2"><span className="font-medium">To:</span> {formData.end_location}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(category => {
                const categoryVehicles = vehicles.filter(v => v.category_id === category.id);
                const available = getAvailableVehicles(
                  categoryVehicles,
                  bookings,
                  formData.start_datetime,
                  formData.end_datetime
                );

                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSelectedVehicle(null);
                    }}
                    className={`p-6 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                      selectedCategory === category.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <h3 className="font-semibold text-lg text-gray-900">{category.category_name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {available.length} available for selected dates
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between gap-3 mt-8">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!canProceedToStep(3)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Select Vehicle
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Step 3: Select Vehicle</h2>
            <p className="text-gray-600 mb-6">Choose an available vehicle from the selected category.</p>

            {duration && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div><span className="font-medium">Duration:</span> {duration}</div>
                  <div><span className="font-medium">From:</span> {formData.start_location}</div>
                  <div className="col-span-2"><span className="font-medium">To:</span> {formData.end_location}</div>
                </div>
              </div>
            )}

            {locationWarning && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-800">{locationWarning}</p>
              </div>
            )}

            {availableVehicles.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-yellow-800 font-medium mb-1">No vehicles available</p>
                <p className="text-sm text-yellow-700">
                  There are no vehicles available in this category for the selected dates. Try a different category or different dates.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableVehicles.map(vehicle => {
                  const hasInsuranceIssue = vehicle.insurance_expiry && checkInsuranceExpiryDuringBooking(
                    vehicle.insurance_expiry,
                    formData.start_datetime,
                    formData.end_datetime
                  );

                  return (
                    <button
                      key={vehicle.id}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className={`p-6 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                        selectedVehicle?.id === vehicle.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-xl text-gray-900">{vehicle.reg_number}</h3>
                        <span className={`text-xs font-semibold px-2 py-1 rounded border ${getHealthBadgeColor(vehicle.health_flag)}`}>
                          {vehicle.health_flag}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Branch:</span> {vehicle.branch_name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Make/Model:</span> {vehicle.make} {vehicle.model}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Mileage:</span> {vehicle.current_mileage.toLocaleString()} km
                      </p>
                      {hasInsuranceIssue && (
                        <div className="flex items-center gap-1.5 mt-3 p-2 bg-red-50 border border-red-200 rounded">
                          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          <p className="text-xs text-red-700 font-medium">
                            Insurance expires {formatDate(vehicle.insurance_expiry)} during booking
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between gap-3 mt-8">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                disabled={!canProceedToStep(4)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Client Details
              </button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Step 4: Client Details</h2>
            <p className="text-gray-600 mb-6">Enter the client information to complete the booking.</p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Booking Summary</h3>
              <div className="space-y-1 text-sm text-gray-700">
                <p><span className="font-medium">Vehicle:</span> {selectedVehicle?.reg_number}</p>
                <p><span className="font-medium">Duration:</span> {duration}</p>
                <p><span className="font-medium">From:</span> {formData.start_location}</p>
                <p><span className="font-medium">To:</span> {formData.end_location}</p>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-red-800 mb-2">Please fix these issues before creating the booking:</p>
                {validationErrors.map((error, index) => (
                  <p key={index} className="text-sm text-red-700">• {error}</p>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter client name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number {!formData.client_email && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="tel"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter contact number"
                />
                <p className="text-xs text-gray-500 mt-1">Required if email not provided</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address {!formData.contact && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address for booking confirmation"
                />
                <p className="text-xs text-gray-500 mt-1">Required if phone not provided. We'll send booking confirmation and reminders to this email</p>
              </div>

              {formData.booking_type === 'chauffeur' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chauffeur Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.chauffeur_name}
                    onChange={(e) => setFormData({ ...formData, chauffeur_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter chauffeur name"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter invoice number if applicable"
                />
                <p className="text-xs text-gray-500 mt-1">Link this booking to an existing invoice</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Any additional notes or special requirements"
                />
              </div>
            </div>

            <div className="flex justify-between gap-3 mt-8">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {submitting ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={!canProceedToStep(5) || submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {submitting ? 'Creating Booking...' : 'Confirm & Create Booking'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
