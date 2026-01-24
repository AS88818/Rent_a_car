import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { bookingService, vehicleService, branchService, categoryService, bookingDocumentService } from '../services/api';
import { Booking, Vehicle, Branch, VehicleCategory, BookingDocument } from '../types/database';
import { formatDateTime } from '../lib/utils';
import { Plus, X, Car, Calendar, MapPin, Phone, Edit2, XCircle, Eye, Search, FileText, Download } from 'lucide-react';
import { showToast } from '../lib/toast';
import { ConfirmModal } from '../components/ConfirmModal';

type BookingTimeFilter = 'upcoming' | 'past' | 'all';

interface BookingWithDetails extends Booking {
  vehicle?: Vehicle;
  branch_name?: string;
  category_id?: string;
}

export function BookingListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { branchId, userRole } = useAuth();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [filterBranch, setFilterBranch] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterHealth, setFilterHealth] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<BookingTimeFilter>('upcoming');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('vehicle') || '');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [formData, setFormData] = useState({
    vehicle_id: '',
    client_name: '',
    contact: '',
    start_datetime: '',
    end_datetime: '',
    start_location: '',
    end_location: '',
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsData, vehiclesData, branchesData, categoriesData] = await Promise.all([
          bookingService.getBookings(branchId || undefined),
          vehicleService.getVehicles(branchId || undefined),
          branchService.getBranches(),
          categoryService.getCategories(),
        ]);

        const bookingsWithDetails = bookingsData.map(booking => {
          const vehicle = vehiclesData.find(v => v.id === booking.vehicle_id);
          const vehicleBranch = branchesData.find(b => b.id === vehicle?.branch_id);
          return {
            ...booking,
            vehicle,
            branch_name: booking.branch_name || vehicleBranch?.branch_name,
            category_id: vehicle?.category_id,
          };
        });

        bookingsWithDetails.sort((a, b) =>
          new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
        );

        setBookings(bookingsWithDetails);
        setVehicles(vehiclesData);
        setBranches(branchesData);
        setCategories(categoriesData);
      } catch (error) {
        showToast('Failed to fetch bookings', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  // Load documents when a booking is selected
  useEffect(() => {
    const loadDocuments = async () => {
      if (!selectedBooking) {
        setDocuments([]);
        return;
      }

      setLoadingDocs(true);
      try {
        const docs = await bookingDocumentService.getBookingDocuments(selectedBooking.id);
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load documents:', error);
        setDocuments([]);
      } finally {
        setLoadingDocs(false);
      }
    };

    loadDocuments();
  }, [selectedBooking?.id]);

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBooking) return;

    try {
      const updatedBooking = await bookingService.updateBooking(selectedBooking.id, {
        vehicle_id: formData.vehicle_id,
        client_name: formData.client_name,
        contact: formData.contact,
        start_datetime: formData.start_datetime,
        end_datetime: formData.end_datetime,
        start_location: formData.start_location,
        end_location: formData.end_location,
        notes: formData.notes,
      });

      const vehicle = vehicles.find(v => v.id === updatedBooking.vehicle_id);
      const branch = branches.find(b => b.id === vehicle?.branch_id);

      const updatedBookingWithDetails = {
        ...updatedBooking,
        vehicle,
        branch_name: branch?.branch_name,
        category_id: vehicle?.category_id,
      };

      setBookings(bookings.map(b => (b.id === selectedBooking.id ? updatedBookingWithDetails : b)));
      showToast('Booking updated successfully', 'success');
      closeModal();
    } catch (error: any) {
      showToast(error.message || 'Failed to update booking', 'error');
    }
  };

  const handleCancelBooking = async () => {
    if (!confirmCancel) return;

    setCancelling(true);
    try {
      await bookingService.updateBooking(confirmCancel, { status: 'Cancelled' });
      setBookings(bookings.filter(b => b.id !== confirmCancel));
      showToast('Booking cancelled', 'success');
      setConfirmCancel(null);
      closeModal();
    } catch (error: any) {
      showToast(error.message || 'Failed to cancel booking', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const openBookingDetails = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setIsEditing(false);

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

    setFormData({
      vehicle_id: booking.vehicle_id,
      client_name: booking.client_name,
      contact: booking.contact,
      start_datetime: formatForDatetimeLocal(booking.start_datetime),
      end_datetime: formatForDatetimeLocal(booking.end_datetime),
      start_location: booking.start_location,
      end_location: booking.end_location,
      notes: booking.notes || '',
    });
  };

  const closeModal = () => {
    setSelectedBooking(null);
    setIsEditing(false);
    setFormData({
      vehicle_id: '',
      client_name: '',
      contact: '',
      start_datetime: '',
      end_datetime: '',
      start_location: '',
      end_location: '',
      notes: '',
    });
  };

  const getHealthBadgeColor = (health?: string) => {
    if (!health) return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const filteredBookings = bookings.filter(booking => {
    const now = new Date();
    const endDate = new Date(booking.end_datetime);
    const startDate = new Date(booking.start_datetime);

    if (timeFilter === 'upcoming') {
      if (booking.status === 'Cancelled' || booking.status === 'Completed') return false;
      if (endDate < now) return false;
    } else if (timeFilter === 'past') {
      if (endDate >= now && booking.status !== 'Completed' && booking.status !== 'Cancelled') return false;
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (startDate < fromDate) return false;
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (startDate > toDate) return false;
    }

    if (filterBranch && booking.vehicle?.branch_id !== filterBranch) return false;
    if (filterCategory && booking.category_id !== filterCategory) return false;
    if (filterHealth && booking.health_at_booking !== filterHealth) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesReference = booking.booking_reference?.toLowerCase().includes(query);
      const matchesVehicle = booking.vehicle?.reg_number.toLowerCase().includes(query);
      const matchesLocation =
        booking.start_location.toLowerCase().includes(query) ||
        booking.end_location.toLowerCase().includes(query);
      const matchesClient = booking.client_name.toLowerCase().includes(query);

      if (!matchesReference && !matchesVehicle && !matchesLocation && !matchesClient) return false;
    }

    return true;
  });

  const uniqueHealthValues = Array.from(new Set(bookings.map(b => b.health_at_booking).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-600 mt-1">
            {timeFilter === 'upcoming' && 'Current and upcoming bookings'}
            {timeFilter === 'past' && 'Past and cancelled bookings'}
            {timeFilter === 'all' && 'All bookings'}
          </p>
        </div>
        {userRole && ['admin', 'fleet_manager', 'basic_user'].includes(userRole) && (
          <button
            onClick={() => navigate('/bookings/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">New Booking</span>
          </button>
        )}
      </div>

      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setTimeFilter('upcoming')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              timeFilter === 'upcoming'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Current & Upcoming
          </button>
          <button
            onClick={() => setTimeFilter('past')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              timeFilter === 'past'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Past
          </button>
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              timeFilter === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vehicle reg, location, or client name..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="relative md:col-span-1">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From Date"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {dateFrom && (
            <button
              onClick={() => setDateFrom('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative md:col-span-1">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To Date"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {dateTo && (
            <button
              onClick={() => setDateTo('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <div className="text-sm font-medium text-gray-700 flex items-center mr-2">
          Filters:
        </div>

        {branches.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => setFilterBranch(filterBranch === branch.id ? '' : branch.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  filterBranch === branch.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {branch.branch_name}
                {filterBranch === branch.id && <X className="inline w-3 h-3 ml-1" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setFilterCategory(filterCategory === category.id ? '' : category.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filterCategory === category.id
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {category.category_name}
              {filterCategory === category.id && <X className="inline w-3 h-3 ml-1" />}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {uniqueHealthValues.map(health => (
            <button
              key={health}
              onClick={() => setFilterHealth(filterHealth === health ? '' : health)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filterHealth === health
                  ? 'bg-orange-600 text-white border-orange-600'
                  : `${getHealthBadgeColor(health)} border`
              }`}
            >
              {health}
              {filterHealth === health && <X className="inline w-3 h-3 ml-1" />}
            </button>
          ))}
        </div>

        {(filterBranch || filterCategory || filterHealth || searchQuery) && (
          <button
            onClick={() => {
              setFilterBranch('');
              setFilterCategory('');
              setFilterHealth('');
              setSearchQuery('');
            }}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {filteredBookings.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredBookings.length}</span> booking{filteredBookings.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {filteredBookings.map(booking => (
          <div
            key={booking.id}
            onClick={() => openBookingDetails(booking)}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-4 md:p-6 border border-gray-100"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Car className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-900">
                        {booking.booking_reference || booking.vehicle?.reg_number}
                      </h3>
                      {booking.booking_reference && (
                        <span className="text-sm text-gray-500">
                          ({booking.vehicle?.reg_number})
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-1 rounded border ${getHealthBadgeColor(booking.health_at_booking)}`}>
                        {booking.health_at_booking}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        booking.status === 'Active' ? 'bg-green-100 text-green-800' :
                        booking.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                        booking.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                        booking.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{booking.client_name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(booking.start_datetime).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-gray-600">
                        {new Date(booking.start_datetime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} → {new Date(booking.end_datetime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-900">{booking.start_location}</p>
                      <p className="text-gray-600 text-xs">→ {booking.end_location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-700">{booking.contact}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Branch:</span>
                    <span className="text-sm text-gray-700 font-medium">{booking.branch_name || 'Not assigned'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredBookings.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {timeFilter === 'upcoming' && 'No upcoming bookings found'}
            {timeFilter === 'past' && 'No past bookings found'}
            {timeFilter === 'all' && 'No bookings found'}
          </p>
          {(filterBranch || filterCategory || filterHealth || searchQuery) && (
            <button
              onClick={() => {
                setFilterBranch('');
                setFilterCategory('');
                setFilterHealth('');
                setSearchQuery('');
              }}
              className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Booking Details</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isEditing ? (
              <div className="p-6 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">Vehicle</p>
                      {selectedBooking.vehicle ? (
                        <button
                          onClick={() => navigate(`/vehicles/${selectedBooking.vehicle!.id}`)}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {selectedBooking.vehicle.reg_number}
                        </button>
                      ) : (
                        <p className="font-semibold text-gray-900">Unknown</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Health at Booking</p>
                      {selectedBooking.health_at_booking ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded border inline-block ${getHealthBadgeColor(selectedBooking.health_at_booking)}`}>
                          {selectedBooking.health_at_booking}
                        </span>
                      ) : (
                        <p className="text-sm text-gray-500">Not recorded</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Branch</p>
                      <p className="font-medium text-gray-900">{selectedBooking.branch_name || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Client</p>
                      <p className="font-medium text-gray-900">{selectedBooking.client_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Contact</p>
                      <p className="font-medium text-gray-900">{selectedBooking.contact}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Trip Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Start</p>
                        <p className="text-gray-700">{formatDateTime(selectedBooking.start_datetime)}</p>
                        <p className="text-gray-600 text-xs mt-1">{selectedBooking.start_location}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">End</p>
                        <p className="text-gray-700">{formatDateTime(selectedBooking.end_datetime)}</p>
                        <p className="text-gray-600 text-xs mt-1">{selectedBooking.end_location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedBooking.notes && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedBooking.notes}</p>
                  </div>
                )}

                {/* Documents Section */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Documents
                  </h3>
                  {loadingDocs ? (
                    <p className="text-sm text-gray-500">Loading documents...</p>
                  ) : documents.length > 0 ? (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                              <p className="text-xs text-gray-500">
                                {doc.document_type} • {(doc.file_size / 1024).toFixed(1)} KB
                                {doc.description && ` • ${doc.description}`}
                              </p>
                            </div>
                          </div>
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No documents uploaded</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/vehicles/${selectedBooking.vehicle_id}`)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Vehicle
                  </button>
                  {userRole && ['admin', 'fleet_manager', 'basic_user'].includes(userRole) && (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Booking
                      </button>
                      <button
                        onClick={() => setConfirmCancel(selectedBooking.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel Booking
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateBooking} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a vehicle</option>
                    {vehicles.filter(v => !v.is_personal).map(v => (
                      <option key={v.id} value={v.id}>
                        {v.reg_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                    <input
                      type="text"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                    <input
                      type="tel"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.start_datetime}
                      onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.end_datetime}
                      onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Location</label>
                    <input
                      type="text"
                      value={formData.start_location}
                      onChange={(e) => setFormData({ ...formData, start_location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Location</label>
                    <input
                      type="text"
                      value={formData.end_location}
                      onChange={(e) => setFormData({ ...formData, end_location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmCancel !== null}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        variant="danger"
        onConfirm={handleCancelBooking}
        onCancel={() => setConfirmCancel(null)}
        loading={cancelling}
      />
    </div>
  );
}
