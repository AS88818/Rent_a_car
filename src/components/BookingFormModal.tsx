import { X, ChevronLeft, ChevronRight, Calendar, MapPin, User, Phone, Mail, Car, Users as UsersIcon, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Vehicle, Booking, Branch, AuthUser } from '../types/database';
import { userService } from '../services/api';
import { getAvailableVehicles, calculateBookingDuration, getHealthColor, checkInsuranceExpiryDuringBooking, formatDate } from '../lib/utils';

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
  }) => Promise<void>;
  vehicles: Vehicle[];
  bookings: Booking[];
  branches: Branch[];
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
  editingBooking,
  submitting = false,
}: BookingFormModalProps) {
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
  });
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [startLocationType, setStartLocationType] = useState<'branch' | 'other'>('branch');
  const [endLocationType, setEndLocationType] = useState<'branch' | 'other'>('branch');
  const [customStartLocation, setCustomStartLocation] = useState('');
  const [customEndLocation, setCustomEndLocation] = useState('');
  const [selectedStartBranchId, setSelectedStartBranchId] = useState('');
  const [selectedEndBranchId, setSelectedEndBranchId] = useState('');
  const [users, setUsers] = useState<AuthUser[]>([]);

  useEffect(() => {
    if (editingBooking) {
      // Convert ISO datetime to local datetime-local format (YYYY-MM-DDThh:mm)
      const formatForDatetimeLocal = (isoString: string) => {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setStep(2);
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
      });

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
  }, [editingBooking, vehicles, bookings]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersData = await userService.getAllUsers();
        setUsers(usersData);
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
    });
    setAvailableVehicles([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientData.vehicle_id || !clientData.client_name || (!clientData.contact && !clientData.client_email)) {
      return;
    }

    await onSubmit({
      ...dateData,
      ...clientData,
    });

    handleClose();
  };

  if (!isOpen) return null;

  const duration = dateData.start_datetime && dateData.end_datetime
    ? calculateBookingDuration(dateData.start_datetime, dateData.end_datetime)
    : null;

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
              <div className={`flex items-center gap-2 text-sm ${step === 1 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span>Dates & Location</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`flex items-center gap-2 text-sm ${step === 2 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span>Vehicle & Details</span>
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
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
                    <input
                      type="datetime-local"
                      value={dateData.start_datetime}
                      onChange={e => setDateData({ ...dateData, start_datetime: e.target.value })}
                      required
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        End Date & Time <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <input
                      type="datetime-local"
                      value={dateData.end_datetime}
                      onChange={e => setDateData({ ...dateData, end_datetime: e.target.value })}
                      required
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    >
                      <option value="">Select start location</option>
                      {branches.filter(branch => branch.branch_name !== 'On Hire').map(branch => (
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    >
                      <option value="">Select end location</option>
                      {branches.filter(branch => branch.branch_name !== 'On Hire').map(branch => (
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        placeholder="Enter custom end location"
                        required
                      />
                    )}
                  </div>
                </div>
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

                  {availableVehicles.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                      <p className="text-yellow-800 font-medium mb-1">No vehicles available</p>
                      <p className="text-sm text-yellow-700">
                        There are no vehicles available for the selected dates. Try different dates or check vehicle status.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                      {availableVehicles.map(vehicle => {
                        const hasInsuranceIssue = vehicle.insurance_expiry && checkInsuranceExpiryDuringBooking(
                          vehicle.insurance_expiry,
                          dateData.start_datetime,
                          dateData.end_datetime
                        );

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
                                <p className="text-sm text-gray-600">{vehicle.category}</p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getHealthColor(vehicle.health_flag)}`}>
                                {vehicle.health_flag}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {vehicle.make} {vehicle.model}
                            </div>
                            {hasInsuranceIssue && (
                              <div className="flex items-center gap-1.5 mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                                <p className="text-xs text-red-700 font-medium">
                                  Insurance expires {formatDate(vehicle.insurance_expiry)} during booking
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
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
                      onClick={() => setClientData({ ...clientData, booking_type: 'transfer', chauffeur_id: '', chauffeur_name: '' })}
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

                  {clientData.booking_type === 'chauffeur' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <div className="flex items-center gap-2">
                          <UsersIcon className="w-4 h-4" />
                          Assign Chauffeur (Optional)
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select a chauffeur (optional)</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.full_name}</option>
                        ))}
                      </select>
                      {!clientData.chauffeur_id && (
                        <p className="text-xs text-gray-500 mt-1">You can assign a chauffeur later</p>
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-200">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
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
                type="button"
                onClick={handleStep1Next}
                disabled={!dateData.start_datetime || !dateData.end_datetime || !dateData.start_location || !dateData.end_location || submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Select Vehicle
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!clientData.vehicle_id || !clientData.client_name || (!clientData.contact && !clientData.client_email) || submitting}
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
