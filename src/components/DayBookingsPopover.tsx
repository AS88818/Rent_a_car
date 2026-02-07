import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Vehicle, VehicleCategory, Booking } from '../types/database';
import { getCategoryColor, getBookingStatusStyle } from '../lib/calendar-utils';

interface DayBooking extends Booking {
  vehicle?: Vehicle;
  category?: VehicleCategory;
  categoryColor?: ReturnType<typeof getCategoryColor>;
}

interface DayBookingsPopoverProps {
  bookings: DayBooking[];
  dateLabel: string;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onSelectBooking: (booking: DayBooking) => void;
}

export function DayBookingsPopover({
  bookings,
  dateLabel,
  anchorRect,
  onClose,
  onSelectBooking,
}: DayBookingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const getPosition = (): React.CSSProperties => {
    if (!anchorRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const popoverWidth = 340;
    const popoverMaxHeight = 420;
    const gap = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
    let top = anchorRect.bottom + gap;

    if (left + popoverWidth > viewportW - 16) {
      left = viewportW - popoverWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    if (top + popoverMaxHeight > viewportH - 16) {
      top = anchorRect.top - popoverMaxHeight - gap;
      if (top < 16) {
        top = 16;
      }
    }

    return { top: `${top}px`, left: `${left}px` };
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/20" />
      <div
        ref={popoverRef}
        className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 w-[340px] max-h-[420px] flex flex-col animate-in fade-in zoom-in-95"
        style={getPosition()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{dateLabel}</h3>
            <p className="text-xs text-gray-500">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {bookings.map(booking => (
            <button
              key={booking.id}
              onClick={() => onSelectBooking(booking)}
              className={`w-full text-left px-3 py-2 rounded-lg ${
                booking.categoryColor?.bg
              } border-l-3 ${booking.categoryColor?.border} ${
                getBookingStatusStyle(booking.status)
              } hover:opacity-80 transition-opacity`}
            >
              <div className="flex items-start gap-2">
                <div className={`${booking.categoryColor?.dot} w-2 h-2 rounded-full flex-shrink-0 mt-1.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-gray-900 break-all leading-tight">
                      {booking.booking_reference || booking.vehicle?.reg_number}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      booking.status === 'Active' ? 'bg-green-100 text-green-700' :
                      booking.status === 'Advance Payment Not Paid' ? 'bg-amber-100 text-amber-700' :
                      booking.status === 'Draft' ? 'bg-gray-100 text-gray-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {booking.status === 'Advance Payment Not Paid' ? 'Unpaid' : booking.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-700 font-medium truncate mt-0.5">
                    {booking.client_name}
                  </div>
                  {booking.vehicle && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {booking.vehicle.reg_number}
                      {booking.vehicle.make && booking.vehicle.model
                        ? ` - ${booking.vehicle.make} ${booking.vehicle.model}`
                        : ''}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
