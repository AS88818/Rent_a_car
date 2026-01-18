import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { categoryService, vehicleService, bookingService } from '../services/api';
import { VehicleCategory, Vehicle, Booking } from '../types/database';
import { showToast } from '../lib/toast';
import { ChevronLeft, ChevronRight, Settings, Printer, Download, Filter, X } from 'lucide-react';
import {
  getMonthCalendar,
  getMonthName,
  getDateRangeForPeriod,
  formatDateRange,
  getCategoryColor,
  getBookingStatusStyle,
  CalendarWeek,
  CalendarDay
} from '../lib/calendar-utils';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { BookingFormModal } from '../components/BookingFormModal';
import { CalendarSettingsModal } from '../components/CalendarSettingsModal';
import { FreeVehiclesSidePanel } from '../components/FreeVehiclesSidePanel';
import { exportCalendarToPDF } from '../lib/calendar-pdf-export';
import { branchService } from '../services/api';

interface DayBooking extends Booking {
  vehicle?: Vehicle;
  category?: VehicleCategory;
  categoryColor?: ReturnType<typeof getCategoryColor>;
}

export function CalendarPage() {
  const { branchId } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showFilters, setShowFilters] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [calendarWeeks, setCalendarWeeks] = useState<CalendarWeek[]>([]);
  const [quickPeriod, setQuickPeriod] = useState('this_month');
  const [highlightedDateRange, setHighlightedDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedDayForPanel, setSelectedDayForPanel] = useState<CalendarDay | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesData, vehiclesData, bookingsData, branchesData] = await Promise.all([
          categoryService.getCategories(),
          vehicleService.getVehicles(branchId || undefined),
          bookingService.getBookings(branchId || undefined),
          branchService.getBranches(),
        ]);

        setCategories(categoriesData);
        setVehicles(vehiclesData);
        setBookings(bookingsData);
        setBranches(branchesData);

        const allCategoryIds = categoriesData.map(c => c.id);
        setSelectedCategories(allCategoryIds);
      } catch (error) {
        showToast('Failed to fetch data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  useEffect(() => {
    const weeks = getMonthCalendar(currentYear, currentMonth);
    setCalendarWeeks(weeks);
  }, [currentYear, currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const handleEditBooking = () => {
    if (selectedBooking) {
      setEditingBooking(selectedBooking);
      setSelectedBooking(null);
      setShowEditModal(true);
    }
  };

  const handleSubmitBooking = async (bookingData: any) => {
    if (!editingBooking) return;

    setSubmitting(true);
    try {
      const updatedBooking = await bookingService.updateBooking(editingBooking.id, bookingData);
      setBookings(bookings.map(b => (b.id === editingBooking.id ? updatedBooking : b)));
      showToast('Booking updated successfully', 'success');
      setShowEditModal(false);
      setEditingBooking(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to update booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPeriod = (period: string) => {
    setQuickPeriod(period);
    const { start, end } = getDateRangeForPeriod(period);
    setHighlightedDateRange({ start, end });
    setCurrentMonth(start.getMonth());
    setCurrentYear(start.getFullYear());
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleAllCategories = () => {
    if (selectedCategories.length === categories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(categories.map(c => c.id));
    }
  };

  const getBookingsForDay = (day: CalendarDay): DayBooking[] => {
    if (!day.isCurrentMonth) return [];

    const dayStr = day.dateString;
    const filteredBookings = bookings.filter(b => {
      if (b.status === 'Cancelled') return false;

      const vehicle = vehicles.find(v => v.id === b.vehicle_id);
      if (!vehicle || !selectedCategories.includes(vehicle.category_id)) return false;

      const startDate = new Date(b.start_datetime).toISOString().split('T')[0];
      const endDate = new Date(b.end_datetime).toISOString().split('T')[0];

      return dayStr >= startDate && dayStr <= endDate;
    });

    return filteredBookings.map(booking => {
      const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
      const category = categories.find(c => c.id === vehicle?.category_id);
      const categoryIndex = categories.findIndex(c => c.id === vehicle?.category_id);

      return {
        ...booking,
        vehicle,
        category,
        categoryColor: getCategoryColor(category?.category_name || '', categoryIndex)
      };
    });
  };

  const getAvailableVehiclesCount = (day: CalendarDay): number => {
    if (!day.isCurrentMonth) return 0;

    const dayBookings = getBookingsForDay(day);
    const bookedVehicleIds = new Set(dayBookings.map(b => b.vehicle_id));

    const availableVehicles = vehicles.filter(v =>
      selectedCategories.includes(v.category_id) &&
      !v.is_personal &&
      !bookedVehicleIds.has(v.id)
    );

    return availableVehicles.length;
  };

  const isDateInHighlightedRange = (day: CalendarDay): boolean => {
    if (!highlightedDateRange || !day.isCurrentMonth) return false;
    const dayDate = new Date(day.dateString);
    dayDate.setHours(0, 0, 0, 0);
    const startDate = new Date(highlightedDateRange.start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(highlightedDateRange.end);
    endDate.setHours(0, 0, 0, 0);
    return dayDate >= startDate && dayDate <= endDate;
  };

  const getAvailableVehiclesForDay = (day: CalendarDay): Vehicle[] => {
    if (!day.isCurrentMonth) return [];

    const dayBookings = getBookingsForDay(day);
    const bookedVehicleIds = new Set(dayBookings.map(b => b.vehicle_id));

    return vehicles.filter(v =>
      selectedCategories.includes(v.category_id) &&
      !v.is_personal &&
      !bookedVehicleIds.has(v.id)
    );
  };

  const getBookingsGroupedByDate = () => {
    const grouped: { [date: string]: DayBooking[] } = {};

    calendarWeeks.forEach(week => {
      week.days.forEach(day => {
        if (day.isCurrentMonth) {
          const dayBookings = getBookingsForDay(day);
          if (dayBookings.length > 0) {
            grouped[day.dateString] = dayBookings;
          }
        }
      });
    });

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const getBookingsForDate = (date: Date): DayBooking[] => {
    const dateString = date.toISOString().split('T')[0];

    const day = calendarWeeks
      .flatMap(week => week.days)
      .find(d => d.dateString === dateString);

    if (!day) return [];
    return getBookingsForDay(day);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    try {
      exportCalendarToPDF({
        month: currentMonth,
        year: currentYear,
        categories,
        selectedCategories,
        vehicles,
        bookings,
        calendarWeeks,
        companyName: 'RENT A CAR IN KENYA',
        branchName: ''
      });
      showToast('PDF exported successfully', 'success');
    } catch (error) {
      showToast('Failed to export PDF', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>

        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {selectedCategories.length < categories.length && (
              <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {selectedCategories.length}
              </span>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Filter by Category</h3>
            <button onClick={() => setShowFilters(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCategories.length === categories.length}
                onChange={toggleAllCategories}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium">All Categories ({categories.length})</span>
            </label>

            <div className="pl-6 space-y-2">
              {categories.map((category, idx) => {
                const color = getCategoryColor(category.category_name, idx);
                return (
                  <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`w-3 h-3 rounded-full ${color.dot}`}></span>
                    <span>{category.category_name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6 print:shadow-none">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Period</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: 'this_week', label: 'This Week' },
                { value: 'next_week', label: 'Next Week' },
                { value: 'next_2_weeks', label: 'Next 2 Weeks' },
                { value: 'this_month', label: 'This Month' },
                { value: 'next_month', label: 'Next Month' }
              ].map(period => (
                <button
                  key={period.value}
                  onClick={() => handleQuickPeriod(period.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    quickPeriod === period.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors print:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            {getMonthName(currentMonth)} {currentYear}
          </h2>

          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors print:hidden"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="md:hidden">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {getMonthName(currentMonth)} {currentYear}
            </h2>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 bg-gray-50">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                  <div key={idx} className="py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarWeeks.map((week, weekIdx) =>
                  week.days.map((day, dayIdx) => {
                    const dayBookings = getBookingsForDay(day);
                    const hasBookings = dayBookings.length > 0;
                    const isSelected = day.dateString === selectedDate.toISOString().split('T')[0];
                    const isToday = day.isToday;

                    return (
                      <button
                        key={`${weekIdx}-${dayIdx}`}
                        onClick={() => day.isCurrentMonth && setSelectedDate(new Date(day.dateString))}
                        disabled={!day.isCurrentMonth}
                        className={`aspect-square p-1 border-b border-r border-gray-100 relative ${
                          !day.isCurrentMonth ? 'text-gray-300 bg-gray-50' : 'text-gray-900 hover:bg-gray-50 active:bg-gray-100'
                        } ${isSelected ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-700 text-white font-bold' : ''}
                        ${isToday && !isSelected ? 'bg-blue-50 font-bold text-blue-600' : ''}`}
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <span className="text-sm">{day.dayOfMonth}</span>
                          {hasBookings && day.isCurrentMonth && (
                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                              {dayBookings.slice(0, 3).map((booking, idx) => (
                                <div
                                  key={idx}
                                  className={`w-1 h-1 rounded-full ${
                                    isSelected ? 'bg-white' : booking.categoryColor?.dot.replace('bg-', 'bg-')
                                  }`}
                                />
                              ))}
                              {dayBookings.length > 3 && (
                                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-400'}`} />
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>
              {selectedDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] && (
                <span className="text-sm text-blue-600 font-medium">Today</span>
              )}
            </div>

            {getBookingsForDate(selectedDate).length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No bookings for this date</p>
              </div>
            ) : (
              <div className="space-y-2">
                {getBookingsForDate(selectedDate).map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => setSelectedBooking(booking)}
                    className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md active:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`${booking.categoryColor?.dot} w-3 h-3 rounded-full flex-shrink-0 mt-1`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-gray-900">
                              {booking.booking_reference || (booking.vehicle ? booking.vehicle.reg_number : 'Unknown')}
                            </div>
                            {booking.booking_reference && booking.vehicle && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/vehicles/${booking.vehicle!.id}`);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                ({booking.vehicle.reg_number})
                              </button>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            booking.status === 'Active' ? 'bg-green-100 text-green-800' :
                            booking.status === 'Advance Payment Not Paid' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status}
                          </span>
                        </div>

                        <div className="text-sm text-gray-900 font-medium mb-2">
                          {booking.client_name}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <div className="font-medium">
                            {new Date(booking.start_datetime).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                            {' - '}
                            {new Date(booking.end_datetime).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                          {booking.booking_type && (
                            <div className="capitalize">
                              {booking.booking_type.replace('_', ' ')}
                            </div>
                          )}
                        </div>

                        {booking.vehicle?.make && booking.vehicle?.model && (
                          <div className="text-xs text-gray-500 mt-1">
                            {booking.vehicle.make} {booking.vehicle.model}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const day = calendarWeeks
                .flatMap(week => week.days)
                .find(d => d.dateString === selectedDate.toISOString().split('T')[0]);

              if (!day) return null;

              const availableVehicles = getAvailableVehiclesForDay(day);

              if (availableVehicles.length === 0) return null;

              return (
                <button
                  onClick={() => setSelectedDayForPanel(day)}
                  className="w-full bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 active:bg-green-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-green-800 mb-1">
                        {availableVehicles.length} Available Vehicle{availableVehicles.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-sm text-green-700">
                        Tap to view free vehicles
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-green-600" />
                  </div>
                </button>
              );
            })()}
          </div>
        </div>

        <div className="hidden md:grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-2 text-center font-semibold text-gray-700 text-sm">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day[0]}</span>
            </div>
          ))}

          {calendarWeeks.map((week, weekIdx) => (
            week.days.map((day, dayIdx) => {
              const dayBookings = getBookingsForDay(day);
              const availableCount = getAvailableVehiclesCount(day);
              const visibleBookings = dayBookings.slice(0, 3);
              const moreCount = dayBookings.length - visibleBookings.length;
              const isHighlighted = isDateInHighlightedRange(day);

              return (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  className={`bg-white min-h-32 md:min-h-32 p-2 ${
                    !day.isCurrentMonth ? 'opacity-40' : ''
                  } ${day.isToday ? 'ring-2 ring-blue-500 ring-inset' : ''} ${
                    isHighlighted ? 'bg-blue-50 ring-1 ring-blue-200 ring-inset' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs md:text-sm font-medium ${
                      day.isToday ? 'text-blue-600 font-bold' :
                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {day.dayOfMonth}
                    </span>
                    {day.isCurrentMonth && availableCount > 0 && (
                      <button
                        onClick={() => setSelectedDayForPanel(day)}
                        className="text-xs text-green-600 font-medium hidden md:inline hover:text-green-700 hover:underline transition-colors"
                      >
                        {availableCount} free
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {visibleBookings.map(booking => (
                      <button
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-full text-left px-2 py-1.5 md:py-1 rounded ${
                          booking.categoryColor?.bg
                        } border-l-3 md:border-l-2 ${booking.categoryColor?.border} ${
                          getBookingStatusStyle(booking.status)
                        } hover:opacity-80 active:opacity-70 transition-opacity print:py-1 shadow-sm md:shadow-none`}
                        title={`${booking.booking_reference || booking.vehicle?.reg_number} - ${booking.client_name}`}
                      >
                        <div className="md:hidden flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`${booking.categoryColor?.dot} w-2 h-2 rounded-full flex-shrink-0`}></span>
                              <span className="font-bold text-xs truncate">{booking.booking_reference || booking.vehicle?.reg_number}</span>
                            </div>
                            <div className="text-xs text-gray-700 truncate font-medium">
                              {booking.client_name}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-[10px] text-gray-600 mt-0.5">
                            {new Date(booking.start_datetime).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                        </div>

                        <div className="hidden md:flex items-center gap-1">
                          <span className="font-medium">
                            {booking.booking_reference || booking.vehicle?.reg_number}
                          </span>
                        </div>

                        <div className="hidden print:block text-xs">
                          <div className="font-medium">{booking.client_name}</div>
                          <div className="text-gray-600">{booking.contact}</div>
                          {booking.booking_type && (
                            <div className="capitalize">{booking.booking_type.replace('_', ' ')}</div>
                          )}
                        </div>
                      </button>
                    ))}

                    {moreCount > 0 && (
                      <div className="text-xs text-gray-500 pl-1 md:pl-2">
                        +{moreCount} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((category, idx) => {
              if (!selectedCategories.includes(category.id)) return null;
              const color = getCategoryColor(category.category_name, idx);
              return (
                <div key={category.id} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${color.dot}`}></div>
                  <span className="text-sm text-gray-700">{category.category_name}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 border-2 border-gray-400 border-solid"></div>
              <span>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 border-2 border-gray-400 border-dashed"></div>
              <span>Draft</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-3 border-2 border-gray-400 border-dotted"></div>
              <span>Advance Payment Not Paid</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 print:shadow-none">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{selectedCategories.length}</div>
            <div className="text-sm text-gray-600">Categories Selected</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {vehicles.filter(v => selectedCategories.includes(v.category_id) && !v.is_personal).length}
            </div>
            <div className="text-sm text-gray-600">Total Vehicles</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {bookings.filter(b => {
                const vehicle = vehicles.find(v => v.id === b.vehicle_id);
                return vehicle && selectedCategories.includes(vehicle.category_id) && b.status !== 'Cancelled';
              }).length}
            </div>
            <div className="text-sm text-gray-600">Active Bookings</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {vehicles.filter(v =>
                selectedCategories.includes(v.category_id) &&
                !v.is_personal &&
                v.status === 'Available'
              ).length}
            </div>
            <div className="text-sm text-gray-600">Available Now</div>
          </div>
        </div>
      </div>

      {selectedBooking && (
        <BookingDetailsModal
          isOpen={!!selectedBooking}
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          vehicle={vehicles.find(v => v.id === selectedBooking.vehicle_id) || null}
          branches={branches}
          onEdit={handleEditBooking}
        />
      )}

      <BookingFormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingBooking(null);
        }}
        onSubmit={handleSubmitBooking}
        vehicles={vehicles}
        bookings={bookings}
        branches={branches}
        editingBooking={editingBooking}
        submitting={submitting}
      />

      {showSettings && (
        <CalendarSettingsModal onClose={() => setShowSettings(false)} />
      )}

      {selectedDayForPanel && (
        <FreeVehiclesSidePanel
          date={selectedDayForPanel.dateString}
          vehicles={getAvailableVehiclesForDay(selectedDayForPanel)}
          categories={categories}
          onClose={() => setSelectedDayForPanel(null)}
        />
      )}
    </div>
  );
}
