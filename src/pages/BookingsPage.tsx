import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { bookingService, vehicleService, branchService } from '../services/api';
import { Booking, Vehicle, Branch } from '../types/database';
import { calculateBookingDuration, formatDateTime, getHealthColor } from '../lib/utils';
import { Plus, Edit } from 'lucide-react';
import { showToast } from '../lib/toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { BookingFormModal } from '../components/BookingFormModal';

export function BookingsPage() {
  const { branchId, userRole } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('Active');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsData, vehiclesData, branchesData] = await Promise.all([
          bookingService.getBookings(branchId || undefined),
          vehicleService.getVehicles(branchId || undefined),
          branchService.getBranches(),
        ]);

        setBookings(bookingsData);
        setVehicles(vehiclesData);
        setBranches(branchesData);
      } catch (error) {
        showToast('Failed to fetch bookings', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  const handleSubmitBooking = async (bookingData: {
    vehicle_id: string;
    client_name: string;
    contact: string;
    start_datetime: string;
    end_datetime: string;
    start_location: string;
    end_location: string;
    notes: string;
    booking_type: 'self_drive' | 'chauffeur' | 'transfer';
    chauffeur_id?: string;
    chauffeur_name?: string;
    invoice_number?: string;
  }) => {
    setSubmitting(true);

    try {
      const vehicle = vehicles.find(v => v.id === bookingData.vehicle_id);

      if (editingBooking) {
        const updatedBooking = await bookingService.updateBooking(editingBooking.id, bookingData);
        setBookings(bookings.map(b => (b.id === editingBooking.id ? updatedBooking : b)));
        showToast('Booking updated successfully', 'success');
      } else {
        const vehicleBranchId = vehicle?.branch_id || branchId;

        if (!vehicleBranchId) {
          throw new Error('Branch ID is required');
        }

        const newBooking = await bookingService.createBooking({
          ...bookingData,
          health_at_booking: vehicle?.health_flag,
          status: 'Active',
          branch_id: vehicleBranchId,
        });

        setBookings([...bookings, newBooking]);
        showToast('Booking created successfully', 'success');
      }

      setShowModal(false);
      setEditingBooking(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to save booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setShowModal(true);
  };

  const handleCancelBooking = async () => {
    if (!confirmCancel) return;

    setCancelling(true);
    try {
      await bookingService.updateBooking(confirmCancel, { status: 'Cancelled' });
      setBookings(
        bookings.map(b => (b.id === confirmCancel ? { ...b, status: 'Cancelled' } : b))
      );
      showToast('Booking cancelled', 'success');
      setConfirmCancel(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to cancel booking', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBooking(null);
  };

  const filteredBookings = bookings.filter(b =>
    !filterStatus || b.status === filterStatus
  );

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
        {userRole && ['admin', 'fleet_manager', 'basic_user'].includes(userRole) && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Booking
          </button>
        )}
      </div>


      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {['Active', 'Draft', 'Advance Payment Not Paid', 'Completed', 'Cancelled', ''].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredBookings.map(booking => {
          const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
          return (
            <div key={booking.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{booking.client_name}</h3>
                  <p className="text-sm text-gray-600">Vehicle: {vehicle?.reg_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getHealthColor(booking.health_at_booking || 'Excellent')}`}>
                    {booking.health_at_booking}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    booking.status === 'Active' ? 'bg-green-100 text-green-800' :
                    booking.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                    booking.status === 'Advance Payment Not Paid' ? 'bg-yellow-100 text-yellow-800' :
                    booking.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-600">Duration: {calculateBookingDuration(booking.start_datetime, booking.end_datetime)}</p>
                  <p className="text-gray-600">From: {formatDateTime(booking.start_datetime)}</p>
                  <p className="text-gray-600">To: {formatDateTime(booking.end_datetime)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Contact: {booking.contact}</p>
                  <p className="text-gray-600">From: {booking.start_location}</p>
                  <p className="text-gray-600">To: {booking.end_location}</p>
                </div>
              </div>

              {(booking.status === 'Active' || booking.status === 'Draft' || booking.status === 'Advance Payment Not Paid') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditBooking(booking)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmCancel(booking.id)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                  >
                    Cancel Booking
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredBookings.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">No bookings found</p>
        </div>
      )}

      <BookingFormModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmitBooking}
        vehicles={vehicles}
        bookings={bookings}
        branches={branches}
        editingBooking={editingBooking}
        submitting={submitting}
      />

      <ConfirmModal
        isOpen={confirmCancel !== null}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Yes, Cancel Booking"
        cancelText="No, Keep Booking"
        variant="danger"
        onConfirm={handleCancelBooking}
        onCancel={() => setConfirmCancel(null)}
        loading={cancelling}
      />
    </div>
  );
}
