import { X, ChevronLeft, ChevronRight, Calendar, MapPin, User, Phone, Mail, Car, Users as UsersIcon, ArrowRightLeft, AlertTriangle, Gauge } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Vehicle, Booking, Branch, AuthUser, VehicleCategory } from '../types/database';
import { userService } from '../services/api';
import { getAvailableVehicles, calculateBookingDuration, getHealthColor, checkInsuranceExpiryDuringBooking, daysUntilExpiry } from '../lib/utils';
import { showToast } from '../lib/toast';
import { useCompanySettings } from '../lib/company-settings-context';

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bookingData: {
    vehicle_id: string;
    client_name: string;
    contact: string;
    client_email?: string;
    start_datetime: string;
    end_datetime: string;
    start_location: string;
    end_location: string;
    notes: string;
    booking_type: 'self_drive' | 'chauffeur' | 'transfer';
    chauffeur_id?: string;
    chauffeur_name?: string;
    invoice_number?: string;
    handover_mileage?: number;
    return_mileage?: number;
  }) => Promise<void>;
  vehicles: Vehicle[];
  bookings: Booking[];
  branches: Branch[];
  categories?: VehicleCategory[];
  editingBooking?: Booking | null;
  submitting?: boolean;
}

export function BookingFormModal({
  isOpen,
  onClose,
  onSubmit,
  vehicles,
  bookings,
  branches,
  categories = [],
  editingBooking,
  submitting = false,
}: BookingFormModalProps) {
  const { settings } = useCompanySettings();
  const [step, setStep] = useState(1);
  const [dateData, setDateData] = useState({
    start_datetime: '',
    end_datetime: '',
    start_location: '',
    end_location: '',
  });
  const [clientData, setClientData] = useState({
    vehicle_id: '',
    client_name: '',
    contact: '',
    client_email: '',
    notes: '',
    booking_type: 'self_drive' as 'self_drive' | 'chauffeur' | 'transfer',
    chauffeur_id: '',
    chauffeur_name: '',
    invoice_number: '',
    handover_mileage: '',
    return_mileage: '',
  });
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [startLocationType, setStartLocationType] = useState<'branch' | 'other'>('branch');
  const [endLocationType, setEndLocationType] = useState<'branch' | 'other'>('branch');
  const [customStartLocation, setCustomStartLocation] = useState('');
  const [customEndLocation, setCustomEndLocation] = useState('');
  const [selectedStartBranchId, setSelectedStartBranchId] = useState('');
  const [selectedEndBranchId, setSelectedEndBranchId] = useState('');
  const [users, setUsers] = useState<AuthUser[]>([]);

  useEffect(() => {
    if (editingBooking) {
      // Extract date + snap time to nearest 30-min slot for the dropdown.
      // DB stores Kenya local time as naive UTC — no timezone conversion needed.
      const formatForDatetimeLocal = (isoString: string) => {
        const base = isoString.replace(' ', 'T').replace(/(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/, '').substring(0, 16);
        const [datePart, timePart] = base.split('T');
        if (!timePart) return base;
        const [h, m] = timePart.split(':').map(Number);
        const snappedMin = m < 15 ? 0 : m < 45 ? 30 : 0;
        const snappedHour = m >= 45 ? h + 1 : h;
        return `${datePart}T${String(snappedHour).padStart(2, '0')}:${String(snappedMin).padStart(2, '0')}`;
      };

      setStep(3);
      const editingVehicle = vehicles.find(v => v.id === editingBooking.vehicle_id);
      setSelectedCategoryId(editingVehicle?.category_id || '');
      setDateData({
        start_datetime: formatForDatetimeLocal(editingBooking.start_datetime),
        end_datetime: formatForDatetimeLocal(editingBooking.end_datetime),
        start_location: editingBooking.start_location,
        end_location: editingBooking.end_location,
      });
      setClientData({
        vehicle_id: editingBooking.vehicle_id,
        client_name: editingBooking.client_name,
        contact: editingBooking.contact,
        client_email: editingBooking.client_email || '',
        notes: editingBooking.notes || '',
        booking_type: editingBooking.booking_type || 'self_drive',
        chauffeur_id: editingBooking.chauffeur_id || '',
        chauffeur_name: editingBooking.chauffeur_name || '',
        invoice_number: editingBooking.invoice_number || '',
        handover_mileage: editingBooking.handover_mileage != null ? String(editingBooking.handover_mileage) : '',
        return_mileage: editingBooking.return_mileage != null ? String(editingBooking.return_mileage) : '',
      });

      // Restore location select state so the dropdowns show the correct pre-selected values
      const startBranch = branches.find(b => b.branch_name === editingBooking.start_location);
      if (startBranch) {
        setStartLocationType('branch');
        setSelectedStartBranchId(startBranch.id);
      } else {
        setStartLocationType('other');
        setCustomStartLocation(editingBooking.start_location);
      }

      const endBranch = branches.find(b => b.branch_name === editingBooking.end_location);
      if (endBranch) {
        setEndLocationType('branch');
        setSelectedEndBranchId(endBranch.id);
      } else {
        setEndLocationType('other');
        setCustomEndLocation(editingBooking.end_location);
      }

      const available = getAvailableVehicles(
        vehicles,
        bookings,
        editingBooking.start_datetime,
        editingBooking.end_datetime,
        editingBooking.id
      );
      const currentVehicle = vehicles.find(v => v.id === editingBooking.vehicle_id);
      if (currentVehicle && !available.find(v => v.id === currentVehicle.id)) {
        available.unshift(currentVehicle);
      }
      setAvailableVehicles(available);
    }
  }, [editingBooking, vehicles, bookings, branches]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersData = await userService.getAllUsers();
        const drivers = usersData.filter(u => u.role === 'driver');
        setUsers(drivers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, submitting]);

  const handleClose = () => {
    setStep(1);
    setDateData({
      start_datetime: '',
      end_datetime: '',
      start_location: '',
      end_location: '',
    });
    setClientData({
      vehicle_id: '',
      client_name: '',
      contact: '',
      client_email: '',
      notes: '',
      booking_type: 'self_drive',
      chauffeur_id: '',
      chauffeur_name: '',
      invoice_number: '',
      handover_mileage: '',
      return_mileage: '',
    });
    setAvailableVehicles([]);
    setSelectedCategoryId('');
    setStartLocationType('branch');
    setEndLocationType('branch');
    setCustomStartLocation('');
    setCustomEndLocation('');
    setSelectedStartBranchId('');
    setSelectedEndBranchId('');
    onClose();
  };

  const handleStep1Next = () => {
    if (!dateData.start_datetime || !dateData.end_datetime || !dateData.start_location || !dateData.end_location) {
      return;
    }

    const startDate = new Date(dateData.start_datetime);
    const endDate = new Date(dateData.end_datetime);

    if (endDate <= startDate) {
      return;
    }

    const available = getAvailableVehicles(
      vehicles,
      bookings,
      dateData.start_datetime,
      dateData.end_datetime,
      editingBooking?.id
    );
    setAvailableVehicles(available);
    setStep(2);
  };

  const parseMileageValue = (value: string) => {
    if (value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSubmit = async () => {
    if (!clientData.vehicle_id || !clientData.client_name || (!clientData.contact && !clientData.client_email)) {
      return;
    }

    const handoverMileage = parseMileageValue(clientData.handover_mileage);
    const returnMileage = parseMileageValue(clientData.return_mileage);

    if (handoverMileage === undefined) {
      showToast('Handover mileage is required to create a booking', 'error');
      return;
    }

    if (returnMileage !== undefined && handoverMileage === undefined) {
      showToast('Enter handover mileage before return mileage', 'error');
      return;
    }

    if (handoverMileage !== undefined && returnMileage !== undefined && returnMileage < handoverMileage) {
      showToast('Return mileage cannot be lower than handover mileage', 'error');
      return;
    }

    const mileageFields: { handover_mileage?: number; return_mileage?: number } = {};
    if (clientData.handover_mileage.trim() !== '' && handoverMileage !== undefined) {
      mileageFields.handover_mileage = handoverMileage;
    }
    if (clientData.return_mileage.trim() !== '' && returnMileage !== undefined) {
      mileageFields.return_mileage = returnMileage;
    }

    const {
      handover_mileage: _handoverMileageInput,
      return_mileage: _returnMileageInput,
      ...bookingClientData
    } = clientData;

    await onSubmit({
      ...dateData,
      ...bookingClientData,
      chauffeur_id: clientData.chauffeur_id || undefined,
      chauffeur_name: clientData.chauffeur_id ? clientData.chauffeur_name : undefined,
      ...mileageFields,
    });

    handleClose();
  };

  if (!isOpen) return null;

  const duration = dateData.start_datetime && dateData.end_datetime
    ? calculateBookingDuration(dateData.start_datetime, dateData.end_datetime)
    : null;
  const selectedVehicle = vehicles.find(v => v.id === clientData.vehicle_id);
  const bookingDays = dateData.start_datetime && dateData.end_datetime
    ? Math.max(1, Math.ceil((new Date(dateData.end_datetime).getTime() - new Date(dateData.start_datetime).getTime()) / 86400000))
    : 0;
  const dailyMileageAllowance = settings.daily_mileage_allowance_km || 250;
  const handoverMileageValue = clientData.handover_mileage.trim() === '' ? null : Number(clientData.handover_mileage);
  const returnMileageValue = clientData.return_mileage.trim() === '' ? null : Number(clientData.return_mileage);
  const hasValidHandoverMileage = handoverMileageValue !== null && Number.isFinite(handoverMileageValue);
  const hasValidReturnMileage = returnMileageValue !== null && Number.isFinite(returnMileageValue);
  const mileageDistance = hasValidHandoverMileage && hasValidReturnMileage
    ? returnMileageValue! - handoverMileageValue!
    : null;
  const totalMileageAllowance = bookingDays * dailyMileageAllowance;
  const excessMileage = mileageDistance !== null ? Math.max(0, mileageDistance - totalMileageAllowance) : null;
  const mileageInvalid = mileageDistance !== null && mileageDistance < 0;
  const submitDisabled = !clientData.vehicle_id ||
    !clientData.client_name ||
    (!clientData.contact && !clientData.client_email) ||
    clientData.handover_mileage.trim() === '' ||
    handoverMileageValue === null ||
    !Number.isFinite(handoverMileageValue) ||
    mileageInvalid ||
    (clientData.return_mileage.trim() !== '' && clientData.handover_mileage.trim() === '') ||
    submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!submitting ? handleClose : undefined}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingBooking ? 'Edit Booking' : 'Create New Booking'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <div className={`flex items-center gap-2 text-sm ${step === 1 ? 'text-blue-600 font-medium' : step > 1 ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 1 ? 'bg-blue-600 text-white' : step > 1 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span className="hidden sm:inline">Dates & Location</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`flex items-center gap-2 text-sm ${step === 2 ? 'text-blue-600 font-medium' : step > 2 ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 2 ? 'bg-blue-600 text-white' : step > 2 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="hidden sm:inline">Category</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`flex items-center gap-2 text-sm ${step === 3 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="hidden sm:inline">Vehicle & Details</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1">
            {step === 1 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Start Date & Time <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dateData.start_datetime.split('T')[0] || ''}
                        onChange={e => {
                          const date = e.target.value;
                          const time = dateData.start_datetime.split('T')[1] || '09:00';
                          const endDate = dateData.end_datetime.split('T')[0];
                          const endTime = dateData.end_datetime.split('T')[1] || '18:00';
                          const newEnd = !endDate || endDate < date
                            ? `${date}T${endTime}`
                            : dateData.end_datetime;
                          setDateData({ ...dateData, start_datetime: `${date}T${time}`, end_datetime: newEnd });
                        }}
                        required
                        disabled={submitting}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                      />
                      <select
                        value={dateData.start_datetime.split('T')[1] || '09:00'}
                        onChange={e => {
                          const date = dateData.start_datetime.split('T')[0] || new Date().toISOString().split('T')[0];
                          setDateData({ ...dateData, start_datetime: `${date}T${e.target.value}` });
                        }}
                        disabled={submitting}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
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
                        End Date & Time <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dateData.end_datetime.split('T')[0] || ''}
                        min={dateData.start_datetime.split('T')[0] || ''}
                        onChange={e => {
                          const date = e.target.value;
                          const time = dateData.end_datetime.split('T')[1] || '18:00';
                          setDateData({ ...dateData, end_datetime: `${date}T${time}` });
                        }}
                        required
                        disabled={submitting}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                      />
                      <select
                        value={dateData.end_datetime.split('T')[1] || '18:00'}
                        onChange={e => {
                          const date = dateData.end_datetime.split('T')[0] || new Date().toISOString().split('T')[0];
                          setDateData({ ...dateData, end_datetime: `${date}T${e.target.value}` });
                        }}
                        disabled={submitting}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
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

                {duration && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Booking Duration:</span> {duration}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Start Location <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <select
                      value={startLocationType === 'other' ? 'other' : selectedStartBranchId}
                      onChange={(e) => {
                        if (e.target.value === 'other') {
                          setStartLocationType('other');
                          setSelectedStartBranchId('');
                          setDateData({ ...dateData, start_location: customStartLocation });
                        } else {
                          setStartLocationType('branch');
                          setSelectedStartBranchId(e.target.value);
                          const branch = branches.find(b => b.id === e.target.value);
                          setDateData({ ...dateData, start_location: branch?.branch_name || '' });
                        }
                      }}
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
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
                          setDateData({ ...dateData, start_location: e.target.value });
                        }}
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-base"
                        placeholder="Enter custom start location"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        End Location <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <select
                      value={endLocationType === 'other' ? 'other' : selectedEndBranchId}
                      onChange={(e) => {
                        if (e.target.value === 'other') {
                          setEndLocationType('other');
                          setSelectedEndBranchId('');
                          setDateData({ ...dateData, end_location: customEndLocation });
                        } else {
                          setEndLocationType('branch');
                          setSelectedEndBranchId(e.target.value);
                          const branch = branches.find(b => b.id === e.target.value);
                          setDateData({ ...dateData, end_location: branch?.branch_name || '' });
                        }
                      }}
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
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
                          setDateData({ ...dateData, end_location: e.target.value });
                        }}
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-base"
                        placeholder="Enter custom end location"
                        required
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : step === 2 ? (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2">
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div><span className="font-medium">Duration:</span> {duration}</div>
                    <div><span className="font-medium">From:</span> {dateData.start_location}</div>
                    <div className="col-span-2"><span className="font-medium">To:</span> {dateData.end_location}</div>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-gray-900">Select Vehicle Category</h3>
                <p className="text-xs text-gray-500">Choose the type of vehicle you need for this booking.</p>

                {(() => {
                  const categoryGroups = categories
                    .filter(cat => cat.category_name.toUpperCase() !== 'PERSONAL' && vehicles.some(v => v.category_id === cat.id && !v.is_personal))
                    .map(cat => {
                      const catVehicles = availableVehicles.filter(v => v.category_id === cat.id);
                      const branchCounts: Record<string, number> = {};
                      catVehicles.forEach(v => {
                        const branchName = branches.find(b => b.id === v.branch_id)?.branch_name || 'Unknown';
                        branchCounts[branchName] = (branchCounts[branchName] || 0) + 1;
                      });
                      return { ...cat, count: catVehicles.length, branchCounts };
                    })
                    .sort((a, b) => a.category_name.localeCompare(b.category_name));

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {categoryGroups.map(cat => (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategoryId(cat.id);
                            setStep(3);
                          }}
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            cat.count === 0
                              ? 'border-gray-200 bg-gray-50 opacity-60'
                              : 'border-gray-200 hover:border-blue-300 bg-white hover:bg-blue-50'
                          }`}
                        >
                          <h4 className="font-semibold text-gray-900">{cat.category_name}</h4>
                          {cat.description && (
                            <p className="text-xs text-gray-500 mb-1">{cat.description}</p>
                          )}
                          <p className={`text-sm ${cat.count > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                            {cat.count} available for selected dates
                          </p>
                          {cat.count > 0 && Object.keys(cat.branchCounts).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(cat.branchCounts).map(([branch, count]) => (
                                <span key={branch} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                  {count} in {branch}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Booking Details</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Duration:</span> {duration}
                      </div>
                      <div>
                        <span className="font-medium">From:</span> {dateData.start_location}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">To:</span> {dateData.end_location}
                      </div>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Vehicle <span className="text-red-500">*</span>
                  </label>

                  {(() => {
                    const categoryVehicles = selectedCategoryId
                      ? availableVehicles.filter(v => v.category_id === selectedCategoryId)
                      : availableVehicles;

                    return categoryVehicles.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <p className="text-yellow-800 font-medium mb-1">No vehicles available</p>
                        <p className="text-sm text-yellow-700">
                          There are no vehicles available for the selected dates. Try different dates or check vehicle status.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                        {categoryVehicles.map(vehicle => {
                          const hasInsuranceIssue = vehicle.insurance_expiry && checkInsuranceExpiryDuringBooking(
                            vehicle.insurance_expiry,
                            dateData.start_datetime,
                            dateData.end_datetime
                          );

                          const kmToService = vehicle.next_service_mileage && vehicle.current_mileage
                            ? vehicle.next_service_mileage - vehicle.current_mileage
                            : null;

                          const daysToInsurance = vehicle.insurance_expiry ? daysUntilExpiry(vehicle.insurance_expiry) : null;

                          const relevantBookings = bookings.filter(
                            b => b.vehicle_id === vehicle.id &&
                            b.status === 'Active' &&
                            b.id !== editingBooking?.id
                          );
                          const lastBooking = relevantBookings
                            .filter(b => new Date(b.end_datetime) < new Date(dateData.start_datetime))
                            .sort((a, b) => new Date(b.end_datetime).getTime() - new Date(a.end_datetime).getTime())[0];
                          const nextBooking = relevantBookings
                            .filter(b => new Date(b.start_datetime) > new Date(dateData.end_datetime))
                            .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
                            .shift();

                          const daysSinceLastBooking = lastBooking
                            ? Math.ceil((new Date(dateData.start_datetime).getTime() - new Date(lastBooking.end_datetime).getTime()) / 86400000)
                            : null;

                          const daysToNextBooking = nextBooking
                            ? Math.ceil((new Date(nextBooking.start_datetime).getTime() - new Date(dateData.end_datetime).getTime()) / 86400000)
                            : null;

                          return (
                            <div
                              key={vehicle.id}
                              onClick={() => setClientData({ ...clientData, vehicle_id: vehicle.id })}
                              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                clientData.vehicle_id === vehicle.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{vehicle.reg_number}</h4>
                                  {(vehicle.make || vehicle.model) && (
                                    <p className="text-xs text-gray-500">{vehicle.make} {vehicle.model}</p>
                                  )}
                                  {vehicle.branch_id && (
                                    <p className="text-xs text-gray-500">
                                      {branches.find(b => b.id === vehicle.branch_id)?.branch_name || ''}
                                    </p>
                                  )}
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHealthColor(vehicle.health_flag)}`}>
                                  {vehicle.health_flag}
                                </span>
                              </div>

                              <div className="space-y-1 text-xs text-gray-500 mb-2">
                                <p>{vehicle.current_mileage.toLocaleString()} km</p>
                                {kmToService !== null && (
                                  <p className={kmToService <= 0 ? 'text-red-600 font-medium' : kmToService <= 500 ? 'text-orange-500 font-medium' : ''}>
                                    {kmToService > 0 ? `Service in ${kmToService.toLocaleString()} km` : '⚠️ SERVICE OVERDUE'}
                                  </p>
                                )}
                                {daysToInsurance !== null && (
                                  <p className={daysToInsurance <= 30 ? 'text-orange-600 font-medium' : ''}>
                                    Insurance: {daysToInsurance > 0 ? `${daysToInsurance}d left` : `${Math.abs(daysToInsurance)}d overdue`}
                                  </p>
                                )}
                                {daysSinceLastBooking !== null && <p>Last booking: {daysSinceLastBooking}d ago</p>}
                                {daysToNextBooking !== null && <p>Next booking: in {daysToNextBooking}d</p>}
                              </div>

                              {hasInsuranceIssue && (
                                <div className="flex items-center gap-1.5 mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                                  <p className="text-xs text-red-700 font-medium">
                                    Insurance expires during booking
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="w-4 h-4 text-gray-600" />
                      <h3 className="text-sm font-medium text-gray-700">Mileage</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Handover KM <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={clientData.handover_mileage}
                          onChange={e => setClientData({ ...clientData, handover_mileage: e.target.value })}
                          disabled={submitting}
                          placeholder={selectedVehicle ? String(Math.round(selectedVehicle.current_mileage || 0)) : '0'}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                        />
                        {selectedVehicle && (
                          <p className="text-xs text-gray-500 mt-1">
                            Vehicle currently shows {Math.round(selectedVehicle.current_mileage || 0).toLocaleString()} km
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Required before saving this booking.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return KM
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={clientData.return_mileage}
                          onChange={e => setClientData({ ...clientData, return_mileage: e.target.value })}
                          disabled={submitting}
                          placeholder="Enter when returned"
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base ${
                            mileageInvalid ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </div>

                    {mileageInvalid ? (
                      <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">Return mileage cannot be lower than handover mileage.</p>
                      </div>
                    ) : mileageDistance !== null ? (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Distance</p>
                          <p className="text-sm font-semibold text-gray-900">{mileageDistance.toLocaleString()} km</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Avg Daily</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {bookingDays > 0 ? Math.round(mileageDistance / bookingDays).toLocaleString() : 0} km/day
                          </p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Included</p>
                          <p className="text-sm font-semibold text-gray-900">{totalMileageAllowance.toLocaleString()} km</p>
                        </div>
                        <div className={`border rounded-lg p-3 ${excessMileage && excessMileage > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                          <p className="text-xs text-gray-500">Excess</p>
                          <p className={`text-sm font-semibold ${excessMileage && excessMileage > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                            {(excessMileage || 0).toLocaleString()} km
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">
                        Included allowance: {totalMileageAllowance.toLocaleString()} km ({bookingDays || 0} day{bookingDays === 1 ? '' : 's'} x {dailyMileageAllowance.toLocaleString()} km/day)
                      </p>
                    )}
                  </div>

                  <h3 className="text-sm font-medium text-gray-700 mb-3">Booking Type</h3>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => setClientData({ ...clientData, booking_type: 'self_drive', chauffeur_id: '', chauffeur_name: '' })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        clientData.booking_type === 'self_drive'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Car className="w-6 h-6" />
                      <span className="text-sm font-medium">Self Drive</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientData({ ...clientData, booking_type: 'chauffeur' })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        clientData.booking_type === 'chauffeur'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <User className="w-6 h-6" />
                      <span className="text-sm font-medium">Chauffeur</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientData({ ...clientData, booking_type: 'transfer' })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        clientData.booking_type === 'transfer'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <ArrowRightLeft className="w-6 h-6" />
                      <span className="text-sm font-medium">Transfer</span>
                    </button>
                  </div>

                  {(clientData.booking_type === 'chauffeur' || clientData.booking_type === 'transfer') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <div className="flex items-center gap-2">
                          <UsersIcon className="w-4 h-4" />
                          Assign Driver (Optional)
                        </div>
                      </label>
                      <select
                        value={clientData.chauffeur_id}
                        onChange={e => {
                          const selectedUser = users.find(u => u.id === e.target.value);
                          setClientData({
                            ...clientData,
                            chauffeur_id: e.target.value,
                            chauffeur_name: selectedUser?.full_name || ''
                          });
                        }}
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                      >
                        <option value="">Select a driver (optional)</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.full_name}</option>
                        ))}
                      </select>
                      {!clientData.chauffeur_id && (
                        <p className="text-xs text-gray-500 mt-1">You can assign a driver later</p>
                      )}
                    </div>
                  )}

                  <h3 className="text-sm font-medium text-gray-700 pt-4">Client Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Client Name <span className="text-red-500">*</span>
                        </div>
                      </label>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={clientData.client_name}
                        onChange={e => setClientData({ ...clientData, client_name: e.target.value })}
                        required
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Contact Number {!clientData.client_email && <span className="text-red-500">*</span>}
                        </div>
                      </label>
                      <input
                        type="tel"
                        placeholder="Phone number"
                        value={clientData.contact}
                        onChange={e => setClientData({ ...clientData, contact: e.target.value })}
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                      />
                      <p className="text-xs text-gray-500 mt-1">Required if email not provided</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Address {!clientData.contact && <span className="text-red-500">*</span>}
                      </div>
                    </label>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={clientData.client_email}
                      onChange={e => setClientData({ ...clientData, client_email: e.target.value })}
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">Required if phone not provided. We'll send booking confirmation to this email</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Link to invoice number"
                      value={clientData.invoice_number}
                      onChange={e => setClientData({ ...clientData, invoice_number: e.target.value })}
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      placeholder="Additional notes or requirements"
                      value={clientData.notes}
                      onChange={e => setClientData({ ...clientData, notes: e.target.value })}
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none text-base"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-200">
            {(step === 2 || step === 3) && (
              <button
                type="button"
                onClick={() => setStep(step === 3 ? 2 : 1)}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                key="next"
                type="button"
                onClick={handleStep1Next}
                disabled={!dateData.start_datetime || !dateData.end_datetime || !dateData.start_location || !dateData.end_location || submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Choose Category
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : step === 2 ? (
              <button
                key="next2"
                type="button"
                onClick={() => {
                  if (selectedCategoryId) setStep(3);
                }}
                disabled={!selectedCategoryId || submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Select Vehicle
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                key="submit"
                type="button"
                onClick={handleSubmit}
                disabled={submitDisabled}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : editingBooking ? 'Update Booking' : 'Create Booking'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
