import { X, Calendar } from 'lucide-react';
import { Booking } from '../types/database';
import { formatDate } from '../lib/utils';

interface BookingHistoryModalProps {
  bookings: Booking[];
  vehicleReg: string;
  onClose: () => void;
}

export function BookingHistoryModal({ bookings, vehicleReg, onClose }: BookingHistoryModalProps) {
  const pastBookings = bookings
    .filter((b) => b.status === 'Completed' || b.status === 'Cancelled')
    .sort((a, b) => new Date(b.end_datetime).getTime() - new Date(a.end_datetime).getTime());

  const getStatusBadge = (status: Booking['status']) => {
    if (status === 'Completed') return 'bg-green-100 text-green-800';
    if (status === 'Cancelled') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Booking History</h2>
              <p className="text-sm text-gray-600">{vehicleReg}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {pastBookings.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No past bookings found</p>
          ) : (
            <div className="space-y-3">
              {pastBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-gray-900">{booking.client_name}</p>
                        {booking.booking_reference && (
                          <span className="text-xs font-mono text-gray-500">
                            #{booking.booking_reference}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getStatusBadge(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {formatDate(booking.start_datetime)} → {formatDate(booking.end_datetime)}
                      </p>
                      {(booking.start_location || booking.end_location) && (
                        <p className="text-xs text-gray-500">
                          {booking.start_location} → {booking.end_location}
                        </p>
                      )}
                    </div>
                    {booking.total_amount != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          €{booking.total_amount.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500">
          {pastBookings.length > 0 && `${pastBookings.length} past booking${pastBookings.length !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  );
}
