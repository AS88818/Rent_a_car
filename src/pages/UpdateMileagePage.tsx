import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { vehicleService, mileageService, branchService, imageService, activityLogService } from '../services/api';
import { Vehicle, MileageLog, Branch, VehicleImage, VehicleActivityLog } from '../types/database';
import { showToast } from '../lib/toast';
import { ArrowLeft, ArrowUpDown, Save, X, History, Check, AlertCircle, Search, Car, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../lib/utils';

interface VehicleWithDetails extends Vehicle {
  branch_name?: string;
}

interface PendingUpdate {
  vehicle_id: string;
  new_mileage: number;
  error?: string;
}

interface EditHistoryModalData {
  vehicle: VehicleWithDetails;
  logs: MileageLog[];
  activityLogs: VehicleActivityLog[];
}

type SortField = 'reg_number' | 'branch_name' | 'current_mileage' | 'last_mileage_update';
type SortDirection = 'asc' | 'desc';

export function UpdateMileagePage() {
  const navigate = useNavigate();
  const { branchId, user, userRole } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicleImages, setVehicleImages] = useState<Map<string, VehicleImage[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, PendingUpdate>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_mileage_update');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [editHistoryModal, setEditHistoryModal] = useState<EditHistoryModalData | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editMileageValue, setEditMileageValue] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Mechanics should see ALL vehicles across all branches
        const vehicleBranchFilter = userRole === 'mechanic' ? undefined : (branchId || undefined);

        const [vehiclesData, branchesData] = await Promise.all([
          vehicleService.getVehicles(vehicleBranchFilter),
          branchService.getBranches(),
        ]);

        const vehiclesWithBranch = vehiclesData.map(v => ({
          ...v,
          branch_name: branchesData.find(b => b.id === v.branch_id)?.branch_name || 'Unknown'
        }));

        setVehicles(vehiclesWithBranch);
        setBranches(branchesData);

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
        showToast('Failed to fetch data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId, userRole]);

  const getDaysSinceUpdate = (lastUpdate?: string) => {
    if (!lastUpdate) return null;
    const days = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getRowHighlight = (vehicleId: string, daysSinceUpdate: number | null) => {
    if (pendingUpdates.has(vehicleId)) return 'bg-yellow-50 border-l-4 border-yellow-400';
    if (daysSinceUpdate === null) return '';
    if (daysSinceUpdate > 14) return 'bg-red-50';
    if (daysSinceUpdate > 7) return 'bg-amber-50';
    return '';
  };

  const handleMileageChange = (vehicleId: string, value: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    const newMileage = parseInt(value);
    const newPendingUpdates = new Map(pendingUpdates);

    if (!value || isNaN(newMileage)) {
      newPendingUpdates.delete(vehicleId);
    } else if (newMileage <= vehicle.current_mileage) {
      newPendingUpdates.set(vehicleId, {
        vehicle_id: vehicleId,
        new_mileage: newMileage,
        error: `Must be > ${vehicle.current_mileage.toLocaleString()} km`
      });
    } else {
      newPendingUpdates.set(vehicleId, {
        vehicle_id: vehicleId,
        new_mileage: newMileage
      });
    }

    setPendingUpdates(newPendingUpdates);
  };

  const handleSaveRow = async (vehicleId: string) => {
    const pendingUpdate = pendingUpdates.get(vehicleId);
    const vehicle = vehicles.find(v => v.id === vehicleId);

    if (!pendingUpdate || !vehicle || pendingUpdate.error) {
      showToast(pendingUpdate?.error || 'Invalid mileage value', 'error');
      return;
    }

    setSaving(new Set(saving).add(vehicleId));

    try {
      await mileageService.createMileageLog({
        vehicle_id: vehicleId,
        reading_datetime: new Date().toISOString(),
        mileage_reading: pendingUpdate.new_mileage,
        branch_id: vehicle.branch_id,
      });

      if (user) {
        await activityLogService.logActivity({
          vehicle_id: vehicleId,
          user_id: user.id,
          user_name: user.full_name || user.email,
          user_role: user.role,
          field_changed: 'current_mileage',
          old_value: vehicle.current_mileage.toString(),
          new_value: pendingUpdate.new_mileage.toString(),
          notes: `Mileage updated from ${vehicle.current_mileage.toLocaleString()} to ${pendingUpdate.new_mileage.toLocaleString()} km`
        });
      }

      setVehicles(vehicles.map(v =>
        v.id === vehicleId ? {
          ...v,
          current_mileage: pendingUpdate.new_mileage,
          last_mileage_update: new Date().toISOString()
        } : v
      ));

      const newPendingUpdates = new Map(pendingUpdates);
      newPendingUpdates.delete(vehicleId);
      setPendingUpdates(newPendingUpdates);

      showToast('Mileage updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update mileage', 'error');
    } finally {
      setSaving(prev => {
        const newSet = new Set(prev);
        newSet.delete(vehicleId);
        return newSet;
      });
    }
  };

  const handleSaveAll = async () => {
    const validUpdates = Array.from(pendingUpdates.values()).filter(u => !u.error);

    if (validUpdates.length === 0) {
      showToast('No valid updates to save', 'error');
      return;
    }

    for (const update of validUpdates) {
      await handleSaveRow(update.vehicle_id);
    }
  };

  const handleCancelRow = (vehicleId: string) => {
    const newPendingUpdates = new Map(pendingUpdates);
    newPendingUpdates.delete(vehicleId);
    setPendingUpdates(newPendingUpdates);
  };

  const handleCancelAll = () => {
    setPendingUpdates(new Map());
    showToast('All changes cancelled', 'success');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleOpenHistory = async (vehicle: VehicleWithDetails) => {
    try {
      const [logs, allActivityLogs] = await Promise.all([
        mileageService.getMileageLog(vehicle.id),
        activityLogService.getActivityLogs(vehicle.id, 100)
      ]);

      const activityLogs = allActivityLogs.filter(
        log => log.field_changed === 'current_mileage' || log.field_changed === 'mileage_correction'
      );

      setEditHistoryModal({ vehicle, logs, activityLogs });
    } catch (error) {
      showToast('Failed to load history', 'error');
    }
  };

  const handleEditLog = (log: MileageLog) => {
    setEditingLogId(log.id);
    setEditMileageValue(log.mileage_reading.toString());
    setEditNotes('');
  };

  const handleSaveEdit = async () => {
    if (!editHistoryModal || !editingLogId || !editNotes.trim()) {
      showToast('Please provide a reason for editing', 'error');
      return;
    }

    const newMileage = parseInt(editMileageValue);
    if (isNaN(newMileage) || newMileage <= 0) {
      showToast('Invalid mileage value', 'error');
      return;
    }

    try {
      const oldLog = editHistoryModal.logs.find(l => l.id === editingLogId);

      await vehicleService.updateVehicle(editHistoryModal.vehicle.id, {
        current_mileage: newMileage,
        last_mileage_update: new Date().toISOString()
      });

      if (user && oldLog) {
        await activityLogService.logActivity({
          vehicle_id: editHistoryModal.vehicle.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          user_role: user.role,
          field_changed: 'mileage_correction',
          old_value: oldLog.mileage_reading.toString(),
          new_value: newMileage.toString(),
          notes: `Correction: ${editNotes}`
        });
      }

      setVehicles(vehicles.map(v =>
        v.id === editHistoryModal.vehicle.id ? {
          ...v,
          current_mileage: newMileage,
          last_mileage_update: new Date().toISOString()
        } : v
      ));

      showToast('Mileage corrected successfully', 'success');
      setEditHistoryModal(null);
      setEditingLogId(null);
      setEditNotes('');
    } catch (error: any) {
      showToast(error.message || 'Failed to correct mileage', 'error');
    }
  };

  const filteredAndSortedVehicles = vehicles
    .filter(v => {
      const matchesSearch = !searchQuery ||
        v.reg_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.model?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBranch = !filterBranch || v.branch_id === filterBranch;
      return matchesSearch && matchesBranch;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'reg_number':
          aVal = a.reg_number;
          bVal = b.reg_number;
          break;
        case 'branch_name':
          aVal = a.branch_name || '';
          bVal = b.branch_name || '';
          break;
        case 'current_mileage':
          aVal = a.current_mileage;
          bVal = b.current_mileage;
          break;
        case 'last_mileage_update':
          aVal = a.last_mileage_update ? new Date(a.last_mileage_update).getTime() : 0;
          bVal = b.last_mileage_update ? new Date(b.last_mileage_update).getTime() : 0;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const pendingCount = pendingUpdates.size;
  const validPendingCount = Array.from(pendingUpdates.values()).filter(u => !u.error).length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Update Mileage</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedVehicles.length} vehicles
              {pendingCount > 0 && (
                <span className="ml-2 text-yellow-600 font-medium">
                  • {validPendingCount} pending update{validPendingCount !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleCancelAll}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel All
            </button>
            <button
              onClick={handleSaveAll}
              disabled={validPendingCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save All ({validPendingCount})
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by registration or make/model..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-700 border-b">Vehicle</th>
                <th
                  onClick={() => handleSort('reg_number')}
                  className="text-left p-3 font-semibold text-gray-700 border-b cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Registration
                    {sortField === 'reg_number' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('branch_name')}
                  className="text-left p-3 font-semibold text-gray-700 border-b cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Branch
                    {sortField === 'branch_name' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('current_mileage')}
                  className="text-right p-3 font-semibold text-gray-700 border-b cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-end gap-1">
                    Current Mileage
                    {sortField === 'current_mileage' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('last_mileage_update')}
                  className="text-left p-3 font-semibold text-gray-700 border-b cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Last Updated
                    {sortField === 'last_mileage_update' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="text-center p-3 font-semibold text-gray-700 border-b">Days</th>
                <th className="text-left p-3 font-semibold text-gray-700 border-b">New Mileage</th>
                <th className="text-center p-3 font-semibold text-gray-700 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedVehicles.map(vehicle => {
                const images = vehicleImages.get(vehicle.id) || [];
                const primaryImage = images.find(img => img.is_primary) || images[0];
                const daysSince = getDaysSinceUpdate(vehicle.last_mileage_update);
                const pending = pendingUpdates.get(vehicle.id);
                const isSaving = saving.has(vehicle.id);

                return (
                  <tr
                    key={vehicle.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${getRowHighlight(vehicle.id, daysSince)}`}
                  >
                    <td className="p-3">
                      {primaryImage ? (
                        <div className="w-12 h-12 rounded overflow-hidden border border-gray-200">
                          <img
                            src={primaryImage.image_url}
                            alt={vehicle.reg_number}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <Car className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div>
                        <button
                          onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          {vehicle.reg_number}
                        </button>
                        {vehicle.make && vehicle.model && (
                          <p className="text-sm text-gray-600">{vehicle.make} {vehicle.model}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-700">{vehicle.branch_name}</td>
                    <td className="p-3 text-right">
                      <span className="font-medium text-gray-900">
                        {vehicle.current_mileage.toLocaleString()} km
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {vehicle.last_mileage_update ? formatDate(vehicle.last_mileage_update) : 'Never'}
                    </td>
                    <td className="p-3 text-center">
                      {daysSince !== null && (
                        <span className={`text-sm font-medium ${
                          daysSince > 14 ? 'text-red-600' : daysSince > 7 ? 'text-amber-600' : 'text-gray-600'
                        }`}>
                          {daysSince}d
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        placeholder={`> ${vehicle.current_mileage}`}
                        value={pending?.new_mileage || ''}
                        onChange={(e) => handleMileageChange(vehicle.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && pending && !pending.error) {
                            handleSaveRow(vehicle.id);
                          }
                          if (e.key === 'Escape') {
                            handleCancelRow(vehicle.id);
                          }
                        }}
                        disabled={isSaving}
                        className={`w-32 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          pending?.error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {pending?.error && (
                        <p className="text-xs text-red-600 mt-1">{pending.error}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {pending && !pending.error && (
                          <>
                            <button
                              onClick={() => handleSaveRow(vehicle.id)}
                              disabled={isSaving}
                              className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleCancelRow(vehicle.id)}
                              disabled={isSaving}
                              className="p-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleOpenHistory(vehicle)}
                          className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          title="View/Edit History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedVehicles.length === 0 && (
          <div className="text-center py-12">
            <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No vehicles found</p>
          </div>
        )}
      </div>

      {editHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Mileage History</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {editHistoryModal.vehicle.reg_number} - Current: {editHistoryModal.vehicle.current_mileage.toLocaleString()} km
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditHistoryModal(null);
                    setEditingLogId(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Mileage Logs</h3>
              {editHistoryModal.logs.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {editHistoryModal.logs.slice(0, 1).map((log, idx) => {
                    const matchingActivity = editHistoryModal.activityLogs.find(
                      activity => activity.new_value === log.mileage_reading.toString()
                    );

                    return (
                      <div key={log.id} className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                        {editingLogId === log.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Corrected Mileage (km)
                              </label>
                              <input
                                type="number"
                                value={editMileageValue}
                                onChange={(e) => setEditMileageValue(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for Correction *
                              </label>
                              <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Explain why this correction is needed..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                disabled={!editNotes.trim()}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                Save Correction
                              </button>
                              <button
                                onClick={() => {
                                  setEditingLogId(null);
                                  setEditNotes('');
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">
                                  {formatDate(log.reading_datetime)} - {log.mileage_reading.toLocaleString()} km
                                </p>
                                {matchingActivity && (
                                  <span className="text-xs text-gray-500">
                                    by {matchingActivity.user_name}
                                  </span>
                                )}
                              </div>
                              {log.km_since_last && (
                                <p className="text-sm text-gray-600">
                                  +{log.km_since_last.toLocaleString()} km
                                  {log.days_since_last && ` in ${log.days_since_last} days`}
                                  {log.km_per_day && ` (${log.km_per_day.toFixed(1)} km/day)`}
                                </p>
                              )}
                            </div>
                            {idx === 0 && (
                              <button
                                onClick={() => handleEditLog(log)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                              >
                                <AlertCircle className="w-3 h-3" />
                                Edit Latest
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {editHistoryModal.logs.slice(1).map(log => {
                    const matchingActivity = editHistoryModal.activityLogs.find(
                      activity => activity.new_value === log.mileage_reading.toString()
                    );

                    return (
                      <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {formatDate(log.reading_datetime)} - {log.mileage_reading.toLocaleString()} km
                          </p>
                          {matchingActivity && (
                            <span className="text-xs text-gray-500">
                              by {matchingActivity.user_name}
                            </span>
                          )}
                        </div>
                        {log.km_since_last && (
                          <p className="text-sm text-gray-600">
                            +{log.km_since_last.toLocaleString()} km
                            {log.days_since_last && ` in ${log.days_since_last} days`}
                            {log.km_per_day && ` (${log.km_per_day.toFixed(1)} km/day)`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-6">No mileage logs available</p>
              )}

              <h3 className="font-semibold text-gray-900 mb-3">Activity Log</h3>
              {editHistoryModal.activityLogs.length > 0 ? (
                <div className="space-y-2">
                  {editHistoryModal.activityLogs.map(log => (
                    <div key={log.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {log.field_changed === 'mileage_correction' ? 'Corrected' : 'Updated'} by {log.user_name}
                          </p>
                          <p className="text-gray-600">
                            {formatDate(log.created_at)} • {log.old_value} km → {log.new_value} km
                          </p>
                          {log.notes && (
                            <p className="text-gray-700 mt-1 italic">{log.notes}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.field_changed === 'mileage_correction'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.field_changed === 'mileage_correction' ? 'Correction' : 'Update'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No activity logs available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
