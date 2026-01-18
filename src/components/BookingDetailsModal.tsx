import { useState, useEffect } from 'react';
import { X, Calendar, MapPin, User, Phone, Mail, Car, AlertTriangle, FileText, Edit, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Booking, Vehicle, Branch, BookingDocument } from '../types/database';
import { formatDate, checkInsuranceExpiryDuringBooking } from '../lib/utils';
import { bookingDocumentService } from '../services/api';

interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  vehicle: Vehicle | null;
  branches: Branch[];
  onEdit?: () => void;
}

export function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
  vehicle,
  branches,
  onEdit,
}: BookingDetailsModalProps) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (isOpen && booking) {
      loadDocuments();
    }
  }, [isOpen, booking?.id]);

  const loadDocuments = async () => {
    if (!booking) return;
    try {
      setLoadingDocs(true);
      const data = await bookingDocumentService.getDocuments(booking.id);
      setDocuments(data || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      license: "Driver's License",
      contract: 'Signed Contract',
      id_document: 'ID Document',
      insurance: 'Insurance Document',
      other: 'Other Document',
    };
    return labels[type] || type;
  };

  if (!isOpen || !booking) return null;

  const vehicleBranch = branches.find(b => b.id === vehicle?.branch_id);
  const startLocationBranch = branches.find(b =>
    b.branch_name.toLowerCase().includes(booking.start_location.toLowerCase()) ||
    booking.start_location.toLowerCase().includes(b.branch_name.toLowerCase())
  );

  const hasLocationMismatch = vehicleBranch && startLocationBranch &&
    vehicleBranch.id !== startLocationBranch.id &&
    vehicle?.status !== 'On Hire';

  const daysUntilStart = Math.ceil(
    (new Date(booking.start_datetime).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const bookingType = booking.booking_type || 'self_drive';
  const startDate = new Date(booking.start_datetime);
  const endDate = new Date(booking.end_datetime);
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const hasInsuranceIssue = vehicle?.insurance_expiry &&
    (booking.status === 'Active' || booking.status === 'Confirmed') &&
    checkInsuranceExpiryDuringBooking(
      vehicle.insurance_expiry,
      booking.start_datetime,
      booking.end_datetime
    );

  const getBookingTypeBadge = () => {
    switch (bookingType) {
      case 'self_drive':
        return <span className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-100 text-blue-800">
          <Car className="w-4 h-4" />
          Self Drive
        </span>;
      case 'chauffeur':
        return <span className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-green-100 text-green-800">
          <User className="w-4 h-4" />
          Chauffeur
        </span>;
      case 'transfer':
        return <span className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full bg-orange-100 text-orange-800">
          <MapPin className="w-4 h-4" />
          Transfer
        </span>;
      default:
        return null;
    }
  };

  const getHealthBadgeColor = (health?: string) => {
    if (!health) return 'bg-gray-100 text-gray-600';
    switch (health) {
      case 'Excellent':
        return 'bg-green-100 text-green-800';
      case 'OK':
        return 'bg-yellow-100 text-yellow-800';
      case 'Grounded':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">
              {booking.booking_reference ? `Booking: ${booking.booking_reference}` : 'Booking Details'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                booking.status === 'Active' ? 'bg-green-100 text-green-800' :
                booking.status === 'Completed' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {booking.status}
              </span>
              {getBookingTypeBadge()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {hasInsuranceIssue && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 mb-1">Insurance Expiry Warning</p>
                <p className="text-sm text-red-700">
                  Vehicle insurance expires on <span className="font-semibold">{formatDate(vehicle.insurance_expiry)}</span> during this booking period.
                </p>
                <p className="text-sm text-red-600 mt-1 font-medium">
                  Insurance renewal required before or during booking.
                </p>
              </div>
            </div>
          )}

          {hasLocationMismatch && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900 mb-1">Location Mismatch Alert</p>
                <p className="text-sm text-orange-700">
                  Vehicle is currently at <span className="font-semibold">{vehicleBranch?.branch_name}</span>,
                  but pickup is scheduled at <span className="font-semibold">{booking.start_location}</span>
                  {daysUntilStart > 0 && ` in ${daysUntilStart} ${daysUntilStart === 1 ? 'day' : 'days'}`}.
                </p>
                <p className="text-sm text-orange-600 mt-1 font-medium">
                  Transfer required before booking start date.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Vehicle Information</h3>
                <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {vehicle ? (
                        <button
                          onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                          className="text-2xl font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {vehicle.reg_number}
                        </button>
                      ) : (
                        <p className="text-2xl font-bold text-gray-900">Unknown</p>
                      )}
                      <p className="text-sm text-gray-600">{vehicle?.make} {vehicle?.model}</p>
                    </div>
                    {booking.health_at_booking ? (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${getHealthBadgeColor(booking.health_at_booking)}`}>
                        {booking.health_at_booking}
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-500">
                        Not recorded
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Category:</span> {vehicle?.category || 'N/A'}</p>
                    <p><span className="font-medium">Colour:</span> {vehicle?.colour || 'N/A'}</p>
                    <p><span className="font-medium">Transmission:</span> {vehicle?.transmission || 'N/A'}</p>
                    <p><span className="font-medium">Current Branch:</span> {vehicleBranch?.branch_name || 'Not assigned'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Client Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Client Name</p>
                      <p className="font-semibold text-gray-900">{booking.client_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Contact Number</p>
                      <p className="font-semibold text-gray-900">{booking.contact}</p>
                    </div>
                  </div>
                  {booking.client_email && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-semibold text-gray-900">{booking.client_email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Booking Schedule</h3>
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-600 mb-1">Start Date & Time</p>
                        <p className="font-semibold text-gray-900">{formatDate(booking.start_datetime)}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{new Date(booking.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-600 mb-1">End Date & Time</p>
                        <p className="font-semibold text-gray-900">{formatDate(booking.end_datetime)}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{new Date(booking.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-center">
                    <p className="text-sm font-semibold text-blue-900">
                      Duration: {durationDays} {durationDays === 1 ? 'Day' : 'Days'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Location Details</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pickup Location</p>
                      <p className="font-semibold text-gray-900">{booking.start_location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Drop-off Location</p>
                      <p className="font-semibold text-gray-900">{booking.end_location}</p>
                    </div>
                  </div>
                </div>
              </div>

              {bookingType === 'chauffeur' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Chauffeur</h3>
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Assigned Chauffeur</p>
                      {booking.chauffeur_name ? (
                        <p className="font-semibold text-gray-900">{booking.chauffeur_name}</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <p className="font-semibold text-orange-700">Not Assigned</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {booking.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Additional Notes</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">{booking.notes}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Documents</h3>
                {loadingDocs ? (
                  <p className="text-sm text-gray-500">Loading documents...</p>
                ) : documents.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">
                              {doc.document_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{getDocumentTypeLabel(doc.document_type)}</span>
                              <span>•</span>
                              <span>{formatFileSize(doc.file_size)}</span>
                              {doc.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{doc.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <a
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Close
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Booking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
