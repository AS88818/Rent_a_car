import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { vehicleService, bookingService, snagService, branchService, categoryService, imageService, alertSnoozeService } from '../services/api';
import { Vehicle, Booking, Snag, Branch, VehicleCategory, VehicleImage } from '../types/database';
import { daysUntilExpiry, formatDate, checkInsuranceExpiryDuringBooking } from '../lib/utils';
import {
  AlertCircle,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Plus,
  Zap,
  List,
  ChevronDown,
  ChevronUp,
  Calculator,
  Car,
  LayoutGrid,
  Table,
  MapPin,
  User,
  Users,
  ArrowRightLeft,
  BellOff,
  Eye,
  X,
  Bell
} from 'lucide-react';
import { showToast } from '../lib/toast';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { BookingFormModal } from '../components/BookingFormModal';
import { VehicleTypeBadge } from '../components/VehicleTypeBadge';

interface VehicleWithBranch extends Vehicle {
  branch_name?: string;
}

interface SnagCount {
  vehicle_id: string;
  dangerous_count: number;
  important_count: number;
}

interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  total: number;
  available: number;
  onHire: number;
  grounded: number;
  byBranch: Record<string, {
    total: number;
    available: number;
    onHire: number;
    grounded: number;
  }>;
}

export function DashboardPage() {
  const { branchId, userRole } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleWithBranch[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [vehicleImages, setVehicleImages] = useState<Map<string, VehicleImage[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snoozedAlerts, setSnoozedAlerts] = useState<any[]>([]);
  const [showSnoozedModal, setShowSnoozedModal] = useState(false);

  const [alertsExpanded, setAlertsExpanded] = useState(() => {
    const saved = localStorage.getItem('dashboard_alerts_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const [bookingsExpanded, setBookingsExpanded] = useState(() => {
    const saved = localStorage.getItem('dashboard_bookings_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const [categoryView, setCategoryView] = useState<'cards' | 'table'>(() => {
    const saved = localStorage.getItem('dashboard_category_view');
    return (saved as 'cards' | 'table') || 'cards';
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Mechanics should see ALL snags across all branches (cross-branch access)
        // Other roles see only their branch
        const snagBranchFilter = userRole === 'mechanic' ? undefined : (branchId || undefined);

        // Mechanics should see ALL vehicles across all branches
        const vehicleBranchFilter = userRole === 'mechanic' ? undefined : (branchId || undefined);

        const [vehiclesData, bookingsData, snagsData, branchesData, categoriesData] = await Promise.all([
          vehicleService.getVehicles(vehicleBranchFilter),
          bookingService.getBookings(branchId || undefined),
          snagService.getSnags(undefined, snagBranchFilter),
          branchService.getBranches(),
          categoryService.getCategories(),
        ]);

        const vehiclesWithBranch = vehiclesData.map(v => ({
          ...v,
          branch_name: v.on_hire ? 'On Hire' : (branchesData.find(b => b.id === v.branch_id)?.branch_name || 'Not assigned')
        }));

        setVehicles(vehiclesWithBranch);
        setBookings(bookingsData);
        setSnags(snagsData);
        setBranches(branchesData);
        setCategories(categoriesData);

        const imagesMap = new Map<string, VehicleImage[]>();
        await Promise.all(
          vehiclesData.map(async (vehicle) => {
            try {
              const images = await imageService.getVehicleImages(vehicle.id);
              if (images.length > 0) {
                imagesMap.set(vehicle.id, images);
              }
            } catch (error) {
              console.error(`Failed to fetch images for vehicle ${vehicle.id}`);
            }
          })
        );
        setVehicleImages(imagesMap);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        showToast('Failed to load dashboard data. Please try again.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]);

  useEffect(() => {
    localStorage.setItem('dashboard_alerts_expanded', String(alertsExpanded));
  }, [alertsExpanded]);

  useEffect(() => {
    localStorage.setItem('dashboard_bookings_expanded', String(bookingsExpanded));
  }, [bookingsExpanded]);

  useEffect(() => {
    localStorage.setItem('dashboard_category_view', categoryView);
  }, [categoryView]);

  useEffect(() => {
    const fetchSnoozedAlerts = async () => {
      try {
        await alertSnoozeService.cleanupExpiredSnoozed();
        const snoozes = await alertSnoozeService.getActiveSnoozedAlerts();
        setSnoozedAlerts(snoozes);
      } catch (error) {
        console.error('Failed to fetch snoozed alerts:', error);
      }
    };
    fetchSnoozedAlerts();
  }, []);

  const handleEditBooking = () => {
    if (selectedBooking) {
      setEditingBooking(selectedBooking);
      setIsDetailsModalOpen(false);
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
      setSelectedBooking(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to update booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded-lg w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const businessVehicles = vehicles.filter(v => !v.is_personal);
  const totalVehicles = businessVehicles.length;
  // A vehicle is grounded if health_flag is 'Grounded' (primary indicator)
  const groundedVehicles = businessVehicles.filter(v => v.health_flag === 'Grounded').length;
  const onHireVehicles = businessVehicles.filter(v => v.on_hire && v.health_flag !== 'Grounded').length;
  const availableVehicles = businessVehicles.filter(v =>
    v.status === 'Available' && !v.on_hire && v.health_flag !== 'Grounded'
  ).length;

  const branchBreakdown = branches
    .filter(branch => branch.branch_name !== 'On Hire')
    .map(branch => {
      // All vehicles belonging to this branch (including on-hire)
      const branchVehicles = businessVehicles.filter(v => v.branch_id === branch.id);

      return {
        id: branch.id,
        name: branch.branch_name,
        shortName: branch.branch_name.includes('Nairobi') ? 'NRB' : 'NYK',
        total: branchVehicles.length,
        available: branchVehicles.filter(v => v.status === 'Available' && !v.on_hire && v.health_flag !== 'Grounded').length,
        onHire: branchVehicles.filter(v => v.on_hire && v.health_flag !== 'Grounded').length,
        grounded: branchVehicles.filter(v => v.health_flag === 'Grounded').length,
      };
    });

  const categoryBreakdown: CategoryBreakdown[] = categories.map(category => {
    const categoryVehicles = businessVehicles.filter(v => v.category_id === category.id);

    const byBranch: Record<string, { total: number; available: number; onHire: number; grounded: number }> = {};
    branches.filter(b => b.branch_name !== 'On Hire').forEach(branch => {
      // All vehicles in this category belonging to this branch
      const branchCategoryVehicles = categoryVehicles.filter(v => v.branch_id === branch.id);

      byBranch[branch.id] = {
        total: branchCategoryVehicles.length,
        available: branchCategoryVehicles.filter(v => v.status === 'Available' && !v.on_hire && v.health_flag !== 'Grounded').length,
        onHire: branchCategoryVehicles.filter(v => v.on_hire && v.health_flag !== 'Grounded').length,
        grounded: branchCategoryVehicles.filter(v => v.health_flag === 'Grounded').length,
      };
    });

    return {
      category_id: category.id,
      category_name: category.category_name,
      total: categoryVehicles.length,
      available: categoryVehicles.filter(v => v.status === 'Available' && !v.on_hire && v.health_flag !== 'Grounded').length,
      onHire: categoryVehicles.filter(v => v.on_hire && v.health_flag !== 'Grounded').length,
      grounded: categoryVehicles.filter(v => v.health_flag === 'Grounded').length,
      byBranch,
    };
  }).filter(cat => cat.total > 0);

  // Helper function to check if an alert is snoozed - defined early as it's used below
  const isAlertSnoozed = (alertType: string, vehicleId?: string, bookingId?: string) => {
    return snoozedAlerts.some(snooze =>
      snooze.alert_type === alertType &&
      (vehicleId ? snooze.vehicle_id === vehicleId : snooze.booking_id === bookingId)
    );
  };

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
  const fiveDaysFromNow = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000));

  const bookingsNeedingDriverAllocation = bookings.filter(b => {
    if (b.status === 'Completed' || b.status === 'Cancelled') return false;
    if (b.booking_type !== 'chauffeur' && b.booking_type !== 'transfer') return false;
    if (b.chauffeur_name) return false;
    if (isAlertSnoozed('driver_allocation', undefined, b.id)) return false;

    const startDate = new Date(b.start_datetime);
    return startDate >= threeDaysFromNow && startDate <= fiveDaysFromNow;
  });

  const upcomingBookings = bookings
    .filter(b => {
      // Show all non-completed and non-cancelled bookings
      if (b.status === 'Completed' || b.status === 'Cancelled') return false;
      const endDate = new Date(b.end_datetime);
      // Only show bookings that haven't ended yet
      return endDate >= now;
    })
    .sort((a, b) => {
      const aStart = new Date(a.start_datetime);
      const bStart = new Date(b.start_datetime);
      const aIsCurrent = aStart <= now;
      const bIsCurrent = bStart <= now;

      // Current bookings (already started) come first
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      // Within same category, sort by start date
      return aStart.getTime() - bStart.getTime();
    })
    .slice(0, 10);

  // Handler for snoozing an alert
  const handleSnoozeAlert = async (
    alertType: 'health_flag' | 'snag' | 'spare_key' | 'driver_allocation',
    vehicleId?: string,
    bookingId?: string
  ) => {
    try {
      await alertSnoozeService.snoozeAlert(alertType, vehicleId, bookingId);

      // Refresh snoozed alerts list
      const snoozes = await alertSnoozeService.getActiveSnoozedAlerts();
      setSnoozedAlerts(snoozes);

      showToast('Alert snoozed for 7 days', 'success');
    } catch (error) {
      console.error('Failed to snooze alert:', error);
      showToast('Failed to snooze alert', 'error');
    }
  };

  const handleUnsnoozeAlert = async (snoozeId: string) => {
    try {
      await alertSnoozeService.unsnoozeAlert(snoozeId);

      // Refresh snoozed alerts list
      const snoozes = await alertSnoozeService.getActiveSnoozedAlerts();
      setSnoozedAlerts(snoozes);

      showToast('Alert restored', 'success');
    } catch (error) {
      console.error('Failed to unsnooze alert:', error);
      showToast('Failed to restore alert', 'error');
    }
  };

  // Helper to get display info for snoozed alerts
  const getSnoozedAlertInfo = (snooze: any) => {
    const vehicle = snooze.vehicle_id ? vehicles.find(v => v.id === snooze.vehicle_id) : null;
    const booking = snooze.booking_id ? bookings.find(b => b.id === snooze.booking_id) : null;

    const alertTypeLabels: Record<string, string> = {
      'health_flag': 'Grounded Vehicle',
      'snag': 'Vehicle Snag',
      'spare_key': 'Missing Spare Key',
      'driver_allocation': 'Driver Not Assigned',
    };

    return {
      label: alertTypeLabels[snooze.alert_type] || snooze.alert_type,
      identifier: vehicle?.reg_number || booking?.client_name || 'Unknown',
      expiresAt: new Date(snooze.snoozed_until),
    };
  };

  const vehiclesWithHealthFlag = vehicles.filter(v => v.health_flag === 'Grounded' && !isAlertSnoozed('health_flag', v.id));

  const snagCounts: Map<string, SnagCount> = new Map();
  snags.filter(s => s.status === 'Open').forEach(snag => {
    const existing = snagCounts.get(snag.vehicle_id) || {
      vehicle_id: snag.vehicle_id,
      dangerous_count: 0,
      important_count: 0,
    };

    if (snag.priority === 'Dangerous') {
      existing.dangerous_count++;
    } else if (snag.priority === 'Important') {
      existing.important_count++;
    }

    snagCounts.set(snag.vehicle_id, existing);
  });

  const vehiclesWithSevereSnags = Array.from(snagCounts.values())
    .filter(sc => sc.dangerous_count > 0 || sc.important_count >= 3)
    .filter(sc => !isAlertSnoozed('snag', sc.vehicle_id))
    .map(sc => {
      const vehicle = vehicles.find(v => v.id === sc.vehicle_id);
      return { ...sc, vehicle };
    })
    .filter(item => item.vehicle);

  const vehiclesWithoutSpareKey = vehicles.filter(v => !v.spare_key && !v.is_personal && !isAlertSnoozed('spare_key', v.id));

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

  const vehiclesDueForService = vehicles
    .filter(v => v.next_service_mileage)
    .map(v => {
      const serviceDueAt = v.next_service_mileage!;
      const kmLeft = serviceDueAt - v.current_mileage;

      return {
        ...v,
        serviceDueAt,
        kmLeft,
        isOverdue: kmLeft < 0
      };
    })
    .filter(v => v.kmLeft < 1000)
    .sort((a, b) => a.kmLeft - b.kmLeft);

  const insuranceExpiringSoon = vehicles
    .map(v => ({
      ...v,
      daysLeft: daysUntilExpiry(v.insurance_expiry)
    }))
    .filter(v => v.daysLeft >= 0 && v.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const totalAlerts =
    vehiclesWithHealthFlag.length +
    vehiclesWithSevereSnags.length +
    vehiclesWithoutSpareKey.length +
    bookingsNeedingDriverAllocation.length;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold text-neutral-900">Dashboard</h1>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${userRole !== 'mechanic' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {userRole !== 'mechanic' && (
          <button
            onClick={() => navigate('/bookings/create')}
            className="flex items-center justify-center gap-3 bg-lime-500 hover:bg-lime-600 text-neutral-900 rounded-xl p-6 transition-all duration-200 min-h-[100px] shadow-card hover:shadow-hover active:scale-95 transform"
          >
            <Plus className="w-8 h-8" />
            <span className="text-lg font-semibold">New Booking</span>
          </button>
        )}

        <button
          onClick={() => navigate('/quick-actions')}
          className="flex items-center justify-center gap-3 bg-white hover:bg-cream-100 text-neutral-900 rounded-xl p-6 transition-all duration-200 min-h-[100px] shadow-card hover:shadow-hover active:scale-95 transform border border-gray-200"
        >
          <Zap className="w-8 h-8" />
          <span className="text-lg font-semibold">Quick Actions</span>
        </button>

        <button
          onClick={() => navigate('/vehicles')}
          className="flex items-center justify-center gap-3 bg-white hover:bg-cream-100 text-neutral-900 rounded-xl p-6 transition-all duration-200 min-h-[100px] shadow-card hover:shadow-hover active:scale-95 transform border border-gray-200"
        >
          <List className="w-8 h-8" />
          <span className="text-lg font-semibold">Vehicle List</span>
        </button>

        {userRole !== 'mechanic' && (
          <button
            onClick={() => navigate('/quotation')}
            className="flex items-center justify-center gap-3 bg-white hover:bg-cream-100 text-neutral-900 rounded-xl p-6 transition-all duration-200 min-h-[100px] shadow-card hover:shadow-hover active:scale-95 transform border border-gray-200"
          >
            <Calculator className="w-8 h-8" />
            <span className="text-lg font-semibold">Quotation Calculator</span>
          </button>
        )}
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">Fleet Status Snapshot</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-cream-50 rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2 font-medium">Total Vehicles</p>
            <p className="text-4xl font-bold text-neutral-900">{totalVehicles}</p>
          </div>

          <div className="bg-cream-50 rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2 font-medium">Available</p>
            <p className="text-4xl font-bold text-green-600">{availableVehicles}</p>
          </div>

          <div className="bg-cream-50 rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2 font-medium">On Hire</p>
            <p className="text-4xl font-bold text-sky-600">{onHireVehicles}</p>
          </div>

          <div className="bg-cream-50 rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2 font-medium">Grounded</p>
            <p className="text-4xl font-bold text-red-600">{groundedVehicles}</p>
          </div>
        </div>

        {branchBreakdown.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">By Branch</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branchBreakdown.map(branch => (
                <div key={branch.id} className="bg-cream-50 rounded-xl p-5 border border-gray-200">
                  <h4 className="font-semibold text-neutral-900 mb-4">
                    {branch.name} ({branch.shortName})
                  </h4>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-600 font-medium mb-1">Total</p>
                      <p className="text-xl font-bold text-neutral-900">{branch.total}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium mb-1">Available</p>
                      <p className="text-xl font-bold text-green-600">{branch.available}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium mb-1">On Hire</p>
                      <p className="text-xl font-bold text-sky-600">{branch.onHire}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium mb-1">Grounded</p>
                      <p className="text-xl font-bold text-red-600">{branch.grounded}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {categoryBreakdown.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">By Category</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setCategoryView('cards')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    categoryView === 'cards'
                      ? 'bg-lime-500 text-neutral-900 shadow-soft'
                      : 'bg-cream-100 text-gray-700 hover:bg-cream-200'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  onClick={() => setCategoryView('table')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    categoryView === 'table'
                      ? 'bg-lime-500 text-neutral-900 shadow-soft'
                      : 'bg-cream-100 text-gray-700 hover:bg-cream-200'
                  }`}
                >
                  <Table className="w-4 h-4" />
                  <span className="hidden sm:inline">Table</span>
                </button>
              </div>
            </div>

            {categoryView === 'cards' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {categoryBreakdown.map(cat => (
                    <div key={cat.category_id} className="bg-cream-50 rounded-xl p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2 truncate" title={cat.category_name}>
                        {cat.category_name}
                      </p>
                      <p className="text-3xl font-bold text-neutral-900 mb-3">{cat.total}</p>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="text-green-600">{cat.available}A</span>
                        <span className="text-sky-600">{cat.onHire}H</span>
                        {cat.grounded > 0 && (
                          <span className="text-red-600">{cat.grounded}G</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {branches.filter(b => b.branch_name !== 'On Hire').map(branch => (
                  <details key={branch.id} className="bg-gray-50 rounded-lg">
                    <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between p-3 hover:bg-gray-100 rounded-lg transition-colors">
                      <span>{branch.branch_name}</span>
                      <ChevronDown className="w-4 h-4" />
                    </summary>
                    <div className="p-3 pt-0 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {categoryBreakdown.map(cat => {
                        const branchData = cat.byBranch[branch.id];
                        if (!branchData || branchData.total === 0) return null;
                        return (
                          <div key={cat.category_id} className="bg-white rounded p-2 border border-gray-200">
                            <p className="text-xs text-gray-600 truncate" title={cat.category_name}>
                              {cat.category_name}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs mt-1">
                              <span className="text-green-600">{branchData.available}A</span>
                              <span className="text-sky-600">{branchData.onHire}H</span>
                              {branchData.grounded > 0 && (
                                <span className="text-red-600">{branchData.grounded}G</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
                <p className="text-xs text-gray-500 mt-2">* Excludes personal vehicles</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-blue-50">
                      <th className="text-left p-3 font-bold sticky left-0 bg-blue-50 z-10">Status</th>
                      <th className="text-center p-3 font-bold min-w-[80px]">TOTAL</th>
                      {categoryBreakdown.map(cat => (
                        <th key={cat.category_id} className="text-center p-3 font-bold min-w-[100px]">
                          {cat.category_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white z-10">ON HIRE</td>
                      <td className="text-center p-3 font-bold text-sky-700">{onHireVehicles}</td>
                      {categoryBreakdown.map(cat => (
                        <td key={cat.category_id} className="text-center p-3 text-sky-600">
                          {cat.onHire || '-'}
                        </td>
                      ))}
                    </tr>

                    {branches.filter(b => b.branch_name !== 'On Hire').map(branch => {
                      const branchAvailableTotal = categoryBreakdown.reduce((sum, cat) =>
                        sum + (cat.byBranch[branch.id]?.available || 0), 0
                      );
                      const branchGroundedTotal = categoryBreakdown.reduce((sum, cat) =>
                        sum + (cat.byBranch[branch.id]?.grounded || 0), 0
                      );

                      return (
                        <React.Fragment key={branch.id}>
                          <tr className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white z-10">
                              AVAILABLE {branch.branch_name.includes('Nairobi') ? 'NRB' : 'NYK'}
                            </td>
                            <td className="text-center p-3 font-bold text-green-700">
                              {branchAvailableTotal || '-'}
                            </td>
                            {categoryBreakdown.map(cat => {
                              const branchData = cat.byBranch[branch.id];
                              return (
                                <td key={cat.category_id} className="text-center p-3 text-green-600">
                                  {branchData?.available || '-'}
                                </td>
                              );
                            })}
                          </tr>
                          <tr className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white z-10">
                              GROUNDED {branch.branch_name.includes('Nairobi') ? 'NRB' : 'NYK'}
                            </td>
                            <td className="text-center p-3 font-bold text-red-700">
                              {branchGroundedTotal || '-'}
                            </td>
                            {categoryBreakdown.map(cat => {
                              const branchData = cat.byBranch[branch.id];
                              return (
                                <td key={cat.category_id} className="text-center p-3 text-red-600">
                                  {branchData?.grounded || '-'}
                                </td>
                              );
                            })}
                          </tr>
                        </React.Fragment>
                      );
                    })}

                    <tr className="border-t-2 border-gray-300 bg-blue-50 font-bold">
                      <td className="p-3 text-gray-900 sticky left-0 bg-blue-50 z-10">Total Fleet</td>
                      <td className="text-center p-3 text-blue-700">{totalVehicles}</td>
                      {categoryBreakdown.map(cat => (
                        <td key={cat.category_id} className="text-center p-3 text-blue-700">
                          {cat.total}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">* Excludes personal vehicles</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">Service Due Soon (&lt;1000km)</h2>
        {vehiclesDueForService.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 font-semibold text-gray-700">Vehicle</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Current Km</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Service Due</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Km Left</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Location</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Next Rental Date</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Days to Next Rental</th>
                </tr>
              </thead>
              <tbody>
                {vehiclesDueForService.map(vehicle => {
                  const nextBooking = upcomingBookings.find(b => b.vehicle_id === vehicle.id);
                  const daysToNextRental = nextBooking
                    ? Math.ceil((new Date(nextBooking.start_datetime).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr
                      key={vehicle.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${vehicle.isOverdue ? 'bg-red-50' : ''}`}
                      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                    >
                      <td className="p-3 font-medium text-gray-900">{vehicle.reg_number}</td>
                      <td className="p-3 text-right text-gray-700">{vehicle.current_mileage.toLocaleString()}</td>
                      <td className="p-3 text-right text-gray-700">{vehicle.serviceDueAt.toLocaleString()}</td>
                      <td className={`p-3 text-right font-semibold ${vehicle.isOverdue ? 'text-red-700' : vehicle.kmLeft < 500 ? 'text-orange-700' : 'text-gray-700'}`}>
                        {vehicle.isOverdue ? `Overdue by ${Math.abs(vehicle.kmLeft)}` : vehicle.kmLeft.toLocaleString()}
                      </td>
                      <td className="p-3 text-gray-700">
                        {vehicle.status === 'On Hire' ? 'On Hire' : vehicle.branch_name}
                      </td>
                      <td className="p-3 text-gray-700">
                        {nextBooking ? formatDate(nextBooking.start_datetime) : '-'}
                      </td>
                      <td className="p-3 text-right text-gray-700">
                        {daysToNextRental !== null ? daysToNextRental : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {vehiclesDueForService.some(v => v.isOverdue) && (
              <p className="mt-3 text-sm text-red-700 font-medium">
                Note: Red rows indicate overdue service
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-600">No vehicles require service soon</p>
        )}
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">Insurance Expiring Soon</h2>
        {insuranceExpiringSoon.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 font-semibold text-gray-700">Vehicle</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Registration</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Expiry Date</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Days Left</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Location</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Next Rental Date</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Days to Next Rental</th>
                </tr>
              </thead>
              <tbody>
                {insuranceExpiringSoon.map(vehicle => {
                  const nextBooking = upcomingBookings.find(b => b.vehicle_id === vehicle.id);
                  const daysToNextRental = nextBooking
                    ? Math.ceil((new Date(nextBooking.start_datetime).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr
                      key={vehicle.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${vehicle.daysLeft <= 30 ? 'bg-red-50' : 'bg-orange-50'}`}
                      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                    >
                      <td className="p-3 font-medium text-gray-900">{vehicle.reg_number}</td>
                      <td className="p-3 text-gray-700">{vehicle.reg_number}</td>
                      <td className="p-3 text-gray-700">{formatDate(vehicle.insurance_expiry)}</td>
                      <td className={`p-3 text-right font-semibold ${vehicle.daysLeft <= 30 ? 'text-red-700' : 'text-orange-700'}`}>
                        {vehicle.daysLeft}
                      </td>
                      <td className="p-3 text-gray-700">
                        {vehicle.status === 'On Hire' ? 'On Hire' : vehicle.branch_name}
                      </td>
                      <td className="p-3 text-gray-700">
                        {nextBooking ? formatDate(nextBooking.start_datetime) : '-'}
                      </td>
                      <td className="p-3 text-right text-gray-700">
                        {daysToNextRental !== null ? daysToNextRental : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No insurance expiring soon</p>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between p-6">
          <button
            onClick={() => setAlertsExpanded(!alertsExpanded)}
            className="flex-1 flex items-center gap-3 hover:bg-cream-50 -m-2 p-2 rounded-lg transition-all duration-200"
          >
            <AlertCircle className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold text-neutral-900">Vehicle Health Alerts</h2>
            {totalAlerts > 0 && (
              <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                {totalAlerts}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2">
            {snoozedAlerts.length > 0 && (
              <button
                onClick={() => setShowSnoozedModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="View snoozed alerts"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">{snoozedAlerts.length} snoozed</span>
                <span className="sm:hidden">{snoozedAlerts.length}</span>
              </button>
            )}
            <button
              onClick={() => setAlertsExpanded(!alertsExpanded)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {alertsExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {alertsExpanded && (
          <div className="p-4 md:p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {vehiclesWithHealthFlag.length > 0 && (
              <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Grounded Vehicles (Health Flag)
                </h3>
                <div className="space-y-2">
                  {vehiclesWithHealthFlag.map(vehicle => {
                    const images = vehicleImages.get(vehicle.id) || [];
                    const primaryImage = images.find(img => img.is_primary) || images[0];

                    return (
                      <div
                        key={vehicle.id}
                        className="group relative bg-white rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-3"
                        onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                      >
                        {primaryImage ? (
                          <div className="w-12 h-12 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                            <img
                              src={primaryImage.image_url}
                              alt={vehicle.reg_number}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <Car className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-900">{vehicle.reg_number}</p>
                            <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                              Grounded
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">{vehicle.branch_name}</p>
                            <VehicleTypeBadge isPersonal={vehicle.is_personal} size="sm" showIcon={false} />
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSnoozeAlert('health_flag', vehicle.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-gray-100 rounded-md shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Snooze for 7 days"
                        >
                          <BellOff className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {vehiclesWithSevereSnags.length > 0 && (
              <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Vehicles with Severe Snags
                </h3>
                <div className="space-y-2">
                  {vehiclesWithSevereSnags.map(item => {
                    const images = vehicleImages.get(item.vehicle_id) || [];
                    const primaryImage = images.find(img => img.is_primary) || images[0];

                    return (
                      <div
                        key={item.vehicle_id}
                        className="group relative bg-white rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-3"
                        onClick={() => navigate(`/vehicles/${item.vehicle_id}`)}
                      >
                        {primaryImage ? (
                          <div className="w-12 h-12 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                            <img
                              src={primaryImage.image_url}
                              alt={item.vehicle?.reg_number}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <Car className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-900">{item.vehicle?.reg_number}</p>
                            <div className="flex gap-2">
                              {item.dangerous_count > 0 && (
                                <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                                  {item.dangerous_count} Dangerous
                                </span>
                              )}
                              {item.important_count >= 3 && (
                                <span className="bg-orange-600 text-white text-xs font-semibold px-2 py-1 rounded">
                                  {item.important_count} Important
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">{item.vehicle?.branch_name}</p>
                            {item.vehicle && <VehicleTypeBadge isPersonal={item.vehicle.is_personal} size="sm" showIcon={false} />}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSnoozeAlert('snag', item.vehicle_id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-gray-100 rounded-md shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Snooze for 7 days"
                        >
                          <BellOff className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {vehiclesWithoutSpareKey.length > 0 && (
              <div className="border-2 border-yellow-300 rounded-lg p-4 bg-yellow-50">
                <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Vehicles Without Spare Key ({vehiclesWithoutSpareKey.length})
                </h3>
                <div className="space-y-2">
                  {vehiclesWithoutSpareKey.map((vehicle) => {
                    const images = vehicleImages.get(vehicle.id) || [];
                    const primaryImage = images.find(img => img.is_primary) || images[0];

                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                        className="group relative flex items-center gap-3 bg-white p-3 rounded border border-yellow-200 hover:shadow-md transition-shadow cursor-pointer"
                      >
                        {primaryImage ? (
                          <div className="w-12 h-12 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                            <img
                              src={primaryImage.image_url}
                              alt={vehicle.reg_number}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <Car className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{vehicle.reg_number}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-gray-600">{vehicle.branch_name}</p>
                            <VehicleTypeBadge isPersonal={vehicle.is_personal} size="sm" showIcon={false} />
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${getHealthBadgeColor(vehicle.health_flag)}`}>
                          {vehicle.health_flag}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSnoozeAlert('spare_key', vehicle.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-gray-100 rounded-md shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Snooze for 7 days"
                        >
                          <BellOff className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-yellow-800 mt-3 italic">
                  These vehicles are missing spare keys. Consider obtaining spare keys for fleet backup.
                </p>
              </div>
            )}

            {bookingsNeedingDriverAllocation.length > 0 && (
              <div className="border-2 border-orange-300 rounded-lg p-4 bg-orange-50">
                <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Bookings Needing Driver Allocation (3-5 Days)
                </h3>
                <div className="space-y-2">
                  {bookingsNeedingDriverAllocation.map(booking => {
                    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
                    const startDate = new Date(booking.start_datetime);
                    const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div
                        key={booking.id}
                        className="group relative bg-white rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-medium text-gray-900 truncate max-w-[160px] sm:max-w-[200px]">
                            {booking.booking_reference || vehicle?.reg_number || 'Unknown'}
                          </p>
                          <span className="bg-orange-600 text-white text-xs font-semibold px-2 py-1 rounded flex-shrink-0">
                            {booking.booking_type === 'chauffeur' ? 'Chauffeur' : 'Transfer'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p className="mb-1">{booking.client_name}</p>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Starts in {daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''}</span>
                            <span>•</span>
                            <span>{startDate.toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSnoozeAlert('driver_allocation', undefined, booking.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-gray-100 rounded-md shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Snooze for 7 days"
                        >
                          <BellOff className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-orange-800 mt-3 italic">
                  These bookings need a driver assigned soon. Please allocate a chauffeur or driver before the start date.
                </p>
              </div>
            )}

            {totalAlerts === 0 && (
              <div className="col-span-full text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-lg font-semibold text-gray-900">All Clear!</p>
                <p className="text-gray-600 mt-1">No alerts at this time.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <button
          onClick={() => setBookingsExpanded(!bookingsExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-cream-50 transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-lime-600" />
            <h2 className="text-xl font-bold text-neutral-900">Current & Upcoming Bookings</h2>
            {upcomingBookings.length > 0 && (
              <span className="bg-lime-500 text-neutral-900 text-sm font-bold px-3 py-1 rounded-full">
                {upcomingBookings.length}
              </span>
            )}
          </div>
          {bookingsExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {bookingsExpanded && (
          <div className="p-4 md:p-6 pt-0">
            {upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.map(booking => {
                  const vehicle = vehicles.find(v => v.id === booking.vehicle_id);

                  // Find vehicle's branch - first by branch_id, then fallback to branch_name matching
                  let vehicleBranch = branches.find(b => b.id === vehicle?.branch_id);

                  // Fallback: if branch_id lookup failed but vehicle has a valid branch_name, match by name
                  if (!vehicleBranch && vehicle?.branch_name &&
                      !['On Hire', 'Not assigned', 'Unknown'].includes(vehicle.branch_name)) {
                    vehicleBranch = branches.find(b =>
                      b.branch_name.toLowerCase().trim() === vehicle.branch_name!.toLowerCase().trim() ||
                      b.branch_name.toLowerCase().includes(vehicle.branch_name!.toLowerCase()) ||
                      vehicle.branch_name!.toLowerCase().includes(b.branch_name.toLowerCase())
                    );
                  }

                  // Find the branch matching the booking's start location
                  // Handle various formats: full name, partial name, abbreviations
                  const startLocationBranch = booking.start_location ? branches.find(b => {
                    const branchName = b.branch_name.toLowerCase().trim();
                    const startLoc = booking.start_location.toLowerCase().trim();

                    // Direct match
                    if (branchName === startLoc) return true;

                    // Partial match (one contains the other)
                    if (branchName.includes(startLoc) || startLoc.includes(branchName)) return true;

                    // First word match (e.g., "Nanyuki" matches "Nanyuki Branch")
                    const branchFirstWord = branchName.split(' ')[0];
                    const locationFirstWord = startLoc.split(' ')[0];
                    if (branchFirstWord.length >= 3 && locationFirstWord.length >= 3 &&
                        branchFirstWord === locationFirstWord) return true;

                    return false;
                  }) : null;

                  // Show warning if vehicle location doesn't match pickup location
                  const hasLocationMismatch = vehicleBranch && startLocationBranch &&
                    vehicleBranch.id !== startLocationBranch.id;

                  const daysUntilStart = Math.ceil(
                    (new Date(booking.start_datetime).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );

                  const bookingType = booking.booking_type || 'self_drive';

                  const hasInsuranceIssue = vehicle?.insurance_expiry &&
                    (booking.status === 'Active' || booking.status === 'Confirmed') &&
                    checkInsuranceExpiryDuringBooking(
                      vehicle.insurance_expiry,
                      booking.start_datetime,
                      booking.end_datetime
                    );

                  return (
                    <div
                      key={booking.id}
                      onClick={() => {
                        setSelectedBooking(booking);
                        setIsDetailsModalOpen(true);
                      }}
                      className="border border-gray-200 rounded-xl p-5 hover:shadow-hover transition-all duration-200 cursor-pointer bg-white hover:bg-cream-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap min-w-0">
                            <p className="font-semibold text-gray-900 text-base sm:text-lg truncate max-w-[180px] sm:max-w-[280px]">
                              {booking.booking_reference || vehicle?.reg_number || 'Unknown'}
                            </p>
                            {booking.booking_reference && (
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                ({vehicle?.reg_number})
                              </span>
                            )}
                            {booking.health_at_booking && (
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${getHealthBadgeColor(booking.health_at_booking)}`}>
                                {booking.health_at_booking}
                              </span>
                            )}
                            {hasInsuranceIssue && (
                              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-800">
                                <AlertCircle className="w-3 h-3" />
                                <span className="hidden sm:inline">Insurance Expiry</span>
                              </span>
                            )}
                            {bookingType === 'self_drive' && (
                              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
                                <Car className="w-3 h-3" />
                                <span className="hidden sm:inline">Self Drive</span>
                              </span>
                            )}
                            {bookingType === 'chauffeur' && (
                              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
                                <User className="w-3 h-3" />
                                <span className="hidden sm:inline">Chauffeur</span>
                              </span>
                            )}
                            {bookingType === 'transfer' && (
                              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-orange-100 text-orange-800">
                                <ArrowRightLeft className="w-3 h-3" />
                                <span className="hidden sm:inline">Transfer</span>
                              </span>
                            )}
                          </div>

                          {hasLocationMismatch && (
                            <div className="flex items-start gap-2 mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-orange-900">Location Mismatch</p>
                                <p className="text-orange-700">
                                  Vehicle at {vehicleBranch?.branch_name}, pickup at {booking.start_location}
                                  {daysUntilStart > 0 && ` (${daysUntilStart} days)`}
                                </p>
                              </div>
                            </div>
                          )}

                          <p className="text-sm font-medium text-gray-700 mb-1">{booking.client_name}</p>

                          {bookingType === 'chauffeur' && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                              {booking.chauffeur_name ? (
                                <>
                                  <User className="w-3.5 h-3.5 text-green-600" />
                                  <span className="text-green-700 font-medium">{booking.chauffeur_name}</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                                  <span className="text-orange-700 font-medium">No chauffeur assigned</span>
                                </>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <span>{formatDate(booking.start_datetime)}</span>
                            <span>→</span>
                            <span>{formatDate(booking.end_datetime)}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{booking.start_location} → {booking.end_location}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {userRole !== 'mechanic' && (
                  <button
                    onClick={() => navigate('/bookings')}
                    className="w-full mt-4 py-3 text-lime-600 hover:text-lime-700 font-semibold text-sm hover:bg-lime-50 rounded-lg transition-all duration-200"
                  >
                    View All Bookings →
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No current or upcoming bookings</p>
                {userRole !== 'mechanic' && (
                  <button
                    onClick={() => navigate('/bookings/create')}
                    className="btn-primary mt-4 px-6 py-3"
                  >
                    Create New Booking
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <BookingDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        vehicle={selectedBooking ? vehicles.find(v => v.id === selectedBooking.vehicle_id) || null : null}
        branches={branches}
        onEdit={handleEditBooking}
      />

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

      {/* Snoozed Alerts Modal */}
      {showSnoozedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <BellOff className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Snoozed Alerts</h2>
                <span className="bg-gray-200 text-gray-700 text-sm font-medium px-2 py-0.5 rounded-full">
                  {snoozedAlerts.length}
                </span>
              </div>
              <button
                onClick={() => setShowSnoozedModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {snoozedAlerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No snoozed alerts</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {snoozedAlerts.map((snooze) => {
                    const info = getSnoozedAlertInfo(snooze);
                    const daysRemaining = Math.ceil((info.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                    return (
                      <div key={snooze.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                snooze.alert_type === 'health_flag' ? 'bg-red-100 text-red-700' :
                                snooze.alert_type === 'snag' ? 'bg-orange-100 text-orange-700' :
                                snooze.alert_type === 'spare_key' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {info.label}
                              </span>
                            </div>
                            <p className="font-medium text-gray-900">{info.identifier}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              Expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                              <span className="text-gray-400 ml-1">
                                ({info.expiresAt.toLocaleDateString()})
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => handleUnsnoozeAlert(snooze.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Bell className="w-4 h-4" />
                            Restore
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Snoozed alerts will automatically reappear when they expire
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
