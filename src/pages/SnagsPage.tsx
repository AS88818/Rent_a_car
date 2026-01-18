import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { snagService, userService, vehicleService, snagAssignmentService, snagResolutionService } from '../services/api';
import { Snag, VehicleWithSnagCount, AuthUser } from '../types/database';
import { showToast } from '../lib/toast';
import { Plus, Filter, ArrowUpDown } from 'lucide-react';
import { VehicleSnagCard } from '../components/VehicleSnagCard';
import { SnagFormModal } from '../components/SnagFormModal';
import { SnagEditModal } from '../components/SnagEditModal';
import { SnagDeleteModal } from '../components/SnagDeleteModal';
import { AssignSnagModal } from '../components/AssignSnagModal';
import { SnagResolutionModal } from '../components/SnagResolutionModal';

type SortOption =
  | 'days_to_booking_asc'
  | 'snags_high_low'
  | 'snags_low_high'
  | 'dangerous_count'
  | 'reg_number'
  | 'health_grounded';

export function SnagsPage() {
  const { user, branchId } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithSnagCount[]>([]);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editSnag, setEditSnag] = useState<Snag | null>(null);
  const [deleteSnag, setDeleteSnag] = useState<Snag | null>(null);
  const [assignSnag, setAssignSnag] = useState<Snag | null>(null);
  const [resolveSnag, setResolveSnag] = useState<Snag | null>(null);

  const [sortBy, setSortBy] = useState<SortOption>('days_to_booking_asc');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterHealth, setFilterHealth] = useState('');
  const [showOnlyWithSnags, setShowOnlyWithSnags] = useState(true);
  const [showClosedSnags, setShowClosedSnags] = useState(false);
  const [showDeletedSnags, setShowDeletedSnags] = useState(false);

  useEffect(() => {
    fetchData();
  }, [branchId, showDeletedSnags]);

  const fetchData = async () => {
    try {
      const [vehiclesData, snagsData, usersData] = await Promise.all([
        snagService.getVehiclesWithSnagCounts(branchId || undefined),
        snagService.getSnags(undefined, branchId || undefined, showDeletedSnags),
        userService.getAllUsers(),
      ]);

      setVehicles(vehiclesData);
      setSnags(snagsData);
      setUsers(usersData);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      showToast(error.message || 'Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSnags = async (vehicleId: string, issues: Array<{ description: string; priority: string; photos: string[]; mileage?: number }>, providedBranchId?: string) => {
    setSubmitting(true);
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const vehicleBranchId = providedBranchId || vehicle?.branch_id || branchId;

      if (!vehicleBranchId) {
        throw new Error('Branch ID is required');
      }

      const newSnags = await Promise.all(
        issues.map(async issue => {
          const snag = await snagService.createSnag({
            vehicle_id: vehicleId,
            priority: (issue.priority || null) as 'Dangerous' | 'Important' | 'Nice to Fix' | 'Aesthetic' | null,
            status: 'Open',
            date_opened: new Date().toISOString().split('T')[0],
            description: issue.description,
            branch_id: vehicleBranchId,
            mileage_reported: issue.mileage,
          });

          if (issue.photos && issue.photos.length > 0) {
            await Promise.all(
              issue.photos.map(photoUrl =>
                snagService.addSnagPhoto(snag.id, photoUrl)
              )
            );
          }

          return snag;
        })
      );

      showToast(`${newSnags.length} snag(s) created successfully`, 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Failed to create snags', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSnag = async (updates: Partial<Snag>) => {
    if (!editSnag) return;

    setSubmitting(true);
    try {
      await snagService.updateSnag(editSnag.id, updates);
      showToast('Snag updated successfully', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Failed to update snag', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSnag = async (reason: string) => {
    if (!deleteSnag || !user?.id) return;

    setSubmitting(true);
    try {
      await snagService.deleteSnag(deleteSnag.id, user.id, reason);
      showToast('Snag deleted successfully', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete snag', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignSnag = async (assignment: {
    snagId: string;
    assignedTo: string;
    deadline?: string;
    notes?: string;
  }) => {
    if (!user?.id) return;

    setSubmitting(true);
    try {
      await snagAssignmentService.createAssignment({
        snag_id: assignment.snagId,
        assigned_to: assignment.assignedTo,
        assigned_by: user.id,
        deadline: assignment.deadline,
        assignment_notes: assignment.notes,
        status: 'assigned',
      });
      showToast('Snag assigned successfully', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Failed to assign snag', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveSnag = async (resolution: {
    snagId: string;
    resolutionMethod: any;
    resolutionNotes: string;
    photoUrls?: string[];
    maintenanceLog?: any;
  }) => {
    if (!user?.id) return;

    setSubmitting(true);
    try {
      if (resolution.maintenanceLog) {
        await snagResolutionService.createResolutionWithMaintenanceLog(
          {
            snag_id: resolution.snagId,
            resolution_method: resolution.resolutionMethod,
            resolution_notes: resolution.resolutionNotes,
            resolved_by: user.id,
            photo_urls: resolution.photoUrls,
          },
          resolution.maintenanceLog
        );
      } else {
        await snagResolutionService.createResolution({
          snag_id: resolution.snagId,
          resolution_method: resolution.resolutionMethod,
          resolution_notes: resolution.resolutionNotes,
          resolved_by: user.id,
          photo_urls: resolution.photoUrls,
        });
      }

      showToast('Snag resolved successfully', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Failed to resolve snag', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getSortedVehicles = () => {
    let filtered = [...vehicles];

    if (showOnlyWithSnags) {
      filtered = filtered.filter(v => v.snag_counts.total > 0);
    }

    if (filterVehicle) {
      filtered = filtered.filter(v => v.id === filterVehicle);
    }

    if (filterHealth) {
      filtered = filtered.filter(v => v.health_flag === filterHealth);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'days_to_booking_asc':
          if (a.days_to_next_booking === undefined) return 1;
          if (b.days_to_next_booking === undefined) return -1;
          return a.days_to_next_booking - b.days_to_next_booking;
        case 'snags_high_low':
          return b.snag_counts.total - a.snag_counts.total;
        case 'snags_low_high':
          return a.snag_counts.total - b.snag_counts.total;
        case 'dangerous_count':
          return b.snag_counts.dangerous - a.snag_counts.dangerous;
        case 'reg_number':
          return a.reg_number.localeCompare(b.reg_number);
        case 'health_grounded':
          const healthOrder = { Grounded: 0, OK: 1, Excellent: 2 };
          return healthOrder[a.health_flag] - healthOrder[b.health_flag];
        default:
          return 0;
      }
    });

    return filtered;
  };

  const sortedVehicles = getSortedVehicles();

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Snags</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Report Snag
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-2 flex-1">
            <ArrowUpDown className="w-5 h-5 text-gray-600" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="days_to_booking_asc">Days to Next Booking</option>
              <option value="snags_high_low">Snags: High to Low</option>
              <option value="snags_low_high">Snags: Low to High</option>
              <option value="dangerous_count">Dangerous Snags</option>
              <option value="reg_number">Registration (A-Z)</option>
              <option value="health_grounded">Health (Grounded First)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-5 h-5 text-gray-600" />
            <select
              value={filterVehicle}
              onChange={e => setFilterVehicle(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.reg_number}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterHealth}
              onChange={e => setFilterHealth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">All Health</option>
              <option value="Excellent">Excellent</option>
              <option value="OK">OK</option>
              <option value="Grounded">Grounded</option>
            </select>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyWithSnags}
                onChange={e => setShowOnlyWithSnags(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Only with snags</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showClosedSnags}
                onChange={e => setShowClosedSnags(e.target.checked)}
                disabled={showDeletedSnags}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-700">Show closed</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeletedSnags}
                onChange={e => {
                  setShowDeletedSnags(e.target.checked);
                  if (e.target.checked) setShowClosedSnags(false);
                }}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Show deleted</span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sortedVehicles.map(vehicle => (
          <VehicleSnagCard
            key={vehicle.id}
            vehicle={vehicle}
            snags={snags}
            onEditSnag={setEditSnag}
            onDeleteSnag={setDeleteSnag}
            onAssignSnag={setAssignSnag}
            onResolveSnag={setResolveSnag}
            showClosedSnags={showClosedSnags}
          />
        ))}
      </div>

      {sortedVehicles.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">No vehicles match your filters</p>
        </div>
      )}

      <SnagFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddSnags}
        vehicles={vehicles}
        submitting={submitting}
        userBranchId={branchId}
      />

      <SnagEditModal
        isOpen={editSnag !== null}
        onClose={() => setEditSnag(null)}
        onSubmit={handleEditSnag}
        snag={editSnag}
        submitting={submitting}
      />

      <SnagDeleteModal
        isOpen={deleteSnag !== null}
        onClose={() => setDeleteSnag(null)}
        onConfirm={handleDeleteSnag}
        snag={deleteSnag}
        loading={submitting}
      />

      <AssignSnagModal
        isOpen={assignSnag !== null}
        onClose={() => setAssignSnag(null)}
        onSubmit={handleAssignSnag}
        snag={assignSnag}
        users={users}
        submitting={submitting}
      />

      <SnagResolutionModal
        isOpen={resolveSnag !== null}
        onClose={() => setResolveSnag(null)}
        onSubmit={handleResolveSnag}
        snag={resolveSnag}
        vehicleId={resolveSnag?.vehicle_id}
        branchId={branchId || undefined}
        submitting={submitting}
      />
    </div>
  );
}
