import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Gauge,
  Activity,
  Wrench,
  FileText,
  AlertTriangle,
  Shield,
  Calendar,
  MapPin,
  Edit,
  Heart,
  Trash2,
  Key,
  Users,
  User,
  Package,
  Hash,
  Image as ImageIcon,
  Plus,
  ChevronDown,
} from 'lucide-react';
import {
  vehicleService,
  bookingService,
  maintenanceService,
  snagService,
  categoryService,
  branchService,
  imageService,
  userService,
} from '../services/api';
import {
  Vehicle,
  Booking,
  MaintenanceLog,
  Snag,
  VehicleCategory,
  Branch,
  VehicleImage,
  AuthUser,
} from '../types/database';
import { showToast } from '../lib/toast';
import { formatDate, daysUntilExpiry } from '../lib/utils';
import { ActivityLogPanel } from '../components/ActivityLogPanel';
import { HealthUpdateModal } from '../components/HealthUpdateModal';
import { LocationUpdateModal } from '../components/LocationUpdateModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { ImageUpload } from '../components/ImageUpload';
import { VehicleFormModal } from '../components/VehicleFormModal';
import { SnagFormModal } from '../components/SnagFormModal';
import { canDeleteVehicle } from '../lib/permissions';
import { VehicleTypeBadge } from '../components/VehicleTypeBadge';
import { useAuth } from '../lib/auth-context';

export function VehicleDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { branchId } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [category, setCategory] = useState<VehicleCategory | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [images, setImages] = useState<VehicleImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSnagFormModal, setShowSnagFormModal] = useState(false);
  const [submittingSnag, setSubmittingSnag] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showImages, setShowImages] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, refreshKey]);

  const loadUser = async () => {
    try {
      const user = await userService.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const fetchData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [
        vehicleData,
        bookingsData,
        maintenanceData,
        snagsData,
        categoriesData,
        branchesData,
        imagesData,
      ] = await Promise.all([
        vehicleService.getVehicleById(id),
        bookingService.getBookingsByVehicle(id),
        maintenanceService.getMaintenanceLog(id),
        snagService.getSnags(id),
        categoryService.getCategories(),
        branchService.getBranches(),
        imageService.getVehicleImages(id),
      ]);

      setVehicle(vehicleData);
      setBookings(bookingsData);
      setMaintenanceLogs(maintenanceData);
      setSnags(snagsData);
      setImages(imagesData);
      setCategories(categoriesData);
      setBranches(branchesData);

      const vehicleCategory = categoriesData.find(
        (c) => c.id === vehicleData.category_id
      );
      const vehicleBranch = branchesData.find(
        (b) => b.id === vehicleData.branch_id
      );
      setCategory(vehicleCategory || null);
      setBranch(vehicleBranch || null);
    } catch (error) {
      showToast('Failed to fetch vehicle details', 'error');
      navigate('/vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleHealthUpdate = async (healthFlag: Vehicle['health_flag'], notes: string) => {
    if (!vehicle || !currentUser) return;

    try {
      await vehicleService.updateVehicleHealth(
        vehicle.id,
        healthFlag,
        notes,
        {
          id: currentUser.id,
          name: currentUser.full_name,
          role: currentUser.role,
          branchId: currentUser.branch_id,
        }
      );
      showToast('Health status updated successfully', 'success');
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      throw error;
    }
  };

  const handleLocationUpdate = async (branchId: string) => {
    if (!vehicle || !currentUser) return;

    try {
      await vehicleService.updateVehicleLocation(
        vehicle.id,
        branchId,
        {
          id: currentUser.id,
          name: currentUser.full_name,
          role: currentUser.role,
        }
      );
      showToast('Vehicle location updated successfully', 'success');
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      throw error;
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicle || !currentUser) return;

    setDeleting(true);
    try {
      await vehicleService.softDeleteVehicle(vehicle.id, {
        id: currentUser.id,
        name: currentUser.full_name,
        role: currentUser.role,
      });
      showToast('Vehicle deleted successfully', 'success');
      navigate('/vehicles');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete vehicle', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleAddSnags = async (
    vehicleId: string,
    issues: Array<{ description: string; priority: string; photos: string[]; mileage?: number }>,
    providedBranchId?: string
  ) => {
    setSubmittingSnag(true);
    try {
      const vehicleBranchId = providedBranchId || vehicle?.branch_id || branchId;

      if (!vehicleBranchId) {
        throw new Error('Branch ID is required');
      }

      const newSnags = await Promise.all(
        issues.map(async (issue) => {
          const snag = await snagService.createSnag({
            vehicle_id: vehicleId,
            priority: (issue.priority || null) as
              | 'Dangerous'
              | 'Important'
              | 'Nice to Fix'
              | 'Aesthetic'
              | null,
            status: 'Open',
            date_opened: new Date().toISOString().split('T')[0],
            description: issue.description,
            branch_id: vehicleBranchId,
            mileage_reported: issue.mileage,
          });

          if (issue.photos && issue.photos.length > 0) {
            await Promise.all(
              issue.photos.map((photoUrl) =>
                snagService.addSnagPhoto(snag.id, photoUrl)
              )
            );
          }

          return snag;
        })
      );

      showToast(`${newSnags.length} snag(s) created successfully`, 'success');
      setRefreshKey((prev) => prev + 1);
      setShowSnagFormModal(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to create snags', 'error');
    } finally {
      setSubmittingSnag(false);
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

  const getExpiryColor = (expiryDate: string) => {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return 'text-red-600';
    if (days <= 30) return 'text-orange-600';
    if (days <= 90) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-gray-600">Vehicle not found</p>
      </div>
    );
  }

  const now = new Date();

  const currentAndUpcomingBookings = bookings
    .filter((b) => {
      const endDate = new Date(b.end_datetime);
      const startDate = new Date(b.start_datetime);
      return (
        b.status !== 'Completed' &&
        b.status !== 'Cancelled' &&
        endDate >= now
      );
    })
    .sort((a, b) => {
      const aStart = new Date(a.start_datetime);
      const bStart = new Date(b.start_datetime);
      const aIsCurrent = aStart <= now;
      const bIsCurrent = bStart <= now;

      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      return aStart.getTime() - bStart.getTime();
    })
    .slice(0, 5);

  const recentMaintenance = maintenanceLogs
    .sort(
      (a, b) =>
        new Date(b.service_date).getTime() - new Date(a.service_date).getTime()
    )
    .slice(0, 3);

  const openSnags = snags.filter((s) => s.status === 'Open');
  const primaryImage = images.find(img => img.is_primary);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {vehicle.is_personal && (
        <div className="mb-6 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg shadow-lg border-2 border-amber-400">
          <div className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-full p-2">
                <User className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg">Personal Vehicle</h3>
                <p className="text-amber-50 text-sm">
                  This vehicle is marked as personal and is not available for hire
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/vehicles')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Vehicles</span>
        </button>
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Edit className="w-4 h-4" />
          <span>Edit Vehicle</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-shrink-0">
              {primaryImage ? (
                <img
                  src={primaryImage.image_url}
                  alt={vehicle.reg_number}
                  className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                  <ImageIcon className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold text-gray-900">
                    {vehicle.reg_number}
                  </h1>
                  {vehicle.is_draft && (
                    <span className="px-3 py-1 text-sm font-medium bg-orange-100 text-orange-800 border border-orange-300 rounded-lg">
                      Draft
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-gray-600">
                  <span className="text-lg">{category?.category_name}</span>
                  <span className="text-gray-400">•</span>
                  <button
                    onClick={() => setShowLocationModal(true)}
                    className="text-lg hover:text-blue-600 transition-colors flex items-center gap-1"
                    title="Click to change location"
                  >
                    <MapPin className="w-4 h-4" />
                    {branch?.branch_name}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <VehicleTypeBadge isPersonal={vehicle.is_personal} size="lg" />
                <button
                  onClick={() => setShowHealthModal(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border ${getHealthBadgeColor(
                    vehicle.health_flag
                  )} hover:opacity-80 transition-opacity cursor-pointer`}
                  title="Click to update health status"
                >
                  <Heart className="w-4 h-4 inline mr-1" />
                  {vehicle.health_flag}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Current Mileage</p>
              <p className="text-lg font-bold text-gray-900">
                {vehicle.current_mileage.toLocaleString()} km
              </p>
              {vehicle.last_mileage_update && (
                <p className="text-xs text-gray-500 mt-1">
                  Updated: {formatDate(vehicle.last_mileage_update)}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Next Service</p>
              <p className="text-lg font-bold text-gray-900">
                {vehicle.next_service_mileage
                  ? `${vehicle.next_service_mileage.toLocaleString()} km`
                  : 'Not set'}
              </p>
              {vehicle.next_service_mileage && (
                <p className="text-xs text-blue-600 mt-1">
                  {vehicle.next_service_mileage - vehicle.current_mileage > 0
                    ? `${(vehicle.next_service_mileage - vehicle.current_mileage).toLocaleString()} km remaining`
                    : 'Service overdue'}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Insurance Expiry</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatDate(vehicle.insurance_expiry)}
              </p>
              <p
                className={`text-xs font-medium mt-1 ${getExpiryColor(
                  vehicle.insurance_expiry
                )}`}
              >
                {daysUntilExpiry(vehicle.insurance_expiry)} days
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">MOT Expiry</p>
              {vehicle.mot_not_applicable ? (
                <p className="text-sm font-semibold text-gray-500">
                  N/A
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDate(vehicle.mot_expiry)}
                  </p>
                  <p
                    className={`text-xs font-medium mt-1 ${getExpiryColor(
                      vehicle.mot_expiry
                    )}`}
                  >
                    {daysUntilExpiry(vehicle.mot_expiry)} days
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Spare Key Status</h3>
            </div>
            {vehicle.spare_key ? (
              <div className="text-sm text-blue-800">
                <p className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Available</span>
                </p>
                {vehicle.spare_key_location && (
                  <p className="mt-1">
                    <span className="font-medium">Location:</span> {vehicle.spare_key_location}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No spare key available
              </p>
            )}
          </div>

          {(vehicle.chassis_number || vehicle.no_of_passengers || vehicle.luggage_space) && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {vehicle.chassis_number && (
                  <div className="flex items-start gap-2">
                    <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Chassis Number</p>
                      <p className="text-sm font-medium text-gray-900">{vehicle.chassis_number}</p>
                    </div>
                  </div>
                )}
                {vehicle.no_of_passengers && (
                  <div className="flex items-start gap-2">
                    <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Passengers</p>
                      <p className="text-sm font-medium text-gray-900">{vehicle.no_of_passengers}</p>
                    </div>
                  </div>
                )}
                {vehicle.luggage_space && (
                  <div className="flex items-start gap-2">
                    <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Luggage Space</p>
                      <p className="text-sm font-medium text-gray-900">{vehicle.luggage_space}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <button
          onClick={() => setShowImages(!showImages)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Vehicle Images ({images.length})
            </h2>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
              showImages ? 'transform rotate-180' : ''
            }`}
          />
        </button>
        {showImages && (
          <div className="px-6 pb-6">
            <ImageUpload
              vehicleId={vehicle.id}
              images={images}
              onImageUploaded={(newImage) => {
                setImages([...images, newImage]);
              }}
              onImageDeleted={(imageId) => {
                setImages(images.filter(img => img.id !== imageId));
              }}
              onPrimaryChanged={(imageId) => {
                setImages(images.map(img => ({
                  ...img,
                  is_primary: img.id === imageId
                })));
              }}
            />
          </div>
        )}
      </div>

      <ActivityLogPanel vehicleId={vehicle.id} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Current & Upcoming</h3>
            </div>
            <button
              onClick={() => navigate(`/bookings?vehicle=${vehicle.reg_number}`)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All
            </button>
          </div>
          {currentAndUpcomingBookings.length > 0 ? (
            <div className="space-y-3">
              {currentAndUpcomingBookings.map((booking) => {
                const startDate = new Date(booking.start_datetime);
                const endDate = new Date(booking.end_datetime);
                const isCurrent = startDate <= now && endDate >= now;

                return (
                  <button
                    key={booking.id}
                    onClick={() => navigate(`/bookings?vehicle=${vehicle.reg_number}`)}
                    className="w-full text-left border-l-4 border-blue-500 pl-3 py-2 hover:bg-gray-50 transition-colors rounded"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{booking.client_name}</p>
                      {isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDate(booking.start_datetime)} - {formatDate(booking.end_datetime)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {booking.start_location} → {booking.end_location}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No current or upcoming bookings</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Recent Maintenance</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/maintenance?vehicleId=${id}`)}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Report
              </button>
              <button
                onClick={() => navigate(`/maintenance?vehicleId=${id}`)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
          </div>
          {recentMaintenance.length > 0 ? (
            <div className="space-y-3">
              {recentMaintenance.map((log) => (
                <button
                  key={log.id}
                  onClick={() => navigate(`/maintenance?vehicleId=${id}`)}
                  className="w-full text-left border-l-4 border-blue-500 pl-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-gray-900">{log.work_done}</p>
                  <p className="text-sm text-gray-600">{formatDate(log.service_date)}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No maintenance records</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Open Snags</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSnagFormModal(true)}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Report
              </button>
              <button
                onClick={() => navigate('/snags')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
          </div>
          {openSnags.length > 0 ? (
            <div className="space-y-3">
              {openSnags.map((snag) => (
                <button
                  key={snag.id}
                  onClick={() => navigate('/snags')}
                  className="w-full text-left border-l-4 border-red-500 pl-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-gray-900">{snag.description}</p>
                  {snag.priority && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded mt-1 inline-block">
                      {snag.priority}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No open snags</p>
          )}
        </div>
      </div>

      {currentUser && canDeleteVehicle(currentUser.role) && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Vehicle
          </button>
        </div>
      )}

      {showHealthModal && (
        <HealthUpdateModal
          vehicle={vehicle}
          onClose={() => setShowHealthModal(false)}
          onConfirm={handleHealthUpdate}
        />
      )}

      {showLocationModal && (
        <LocationUpdateModal
          vehicle={vehicle}
          onClose={() => setShowLocationModal(false)}
          onConfirm={handleLocationUpdate}
        />
      )}

      {showDeleteModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Delete Vehicle"
          message={`Are you sure you want to delete ${vehicle.reg_number}? This action will soft delete the vehicle, preserving all historical data.`}
          confirmText="Delete Vehicle"
          variant="danger"
          onConfirm={handleDeleteVehicle}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      {showEditModal && (
        <VehicleFormModal
          mode="edit"
          vehicle={vehicle}
          categories={categories}
          branches={branches}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updatedVehicle) => {
            setVehicle(updatedVehicle);
            const vehicleCategory = categories.find(c => c.id === updatedVehicle.category_id);
            const vehicleBranch = branches.find(b => b.id === updatedVehicle.branch_id);
            setCategory(vehicleCategory || null);
            setBranch(vehicleBranch || null);
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {showSnagFormModal && vehicle && (
        <SnagFormModal
          isOpen={showSnagFormModal}
          onClose={() => setShowSnagFormModal(false)}
          onSubmit={handleAddSnags}
          vehicles={[{ id: vehicle.id, reg_number: vehicle.reg_number, branch_id: vehicle.branch_id }]}
          submitting={submittingSnag}
          userBranchId={branchId}
        />
      )}
    </div>
  );
}
