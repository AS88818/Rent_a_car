import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { vehicleService, branchService, snagService } from '../services/api';
import { Vehicle, Branch } from '../types/database';
import { showToast } from '../lib/toast';
import { Car, MapPin, Gauge, Heart, AlertTriangle, ArrowUpDown, Check, Loader2 } from 'lucide-react';
import { SnagFormModal } from '../components/SnagFormModal';

type SortField = 'reg_number' | 'branch_id' | 'current_mileage' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export function QuickActionsPage() {
  const { branchId, user, userRole } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('reg_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [savingVehicleIds, setSavingVehicleIds] = useState<Set<string>>(new Set());
  const [savedVehicleIds, setSavedVehicleIds] = useState<Set<string>>(new Set());
  const [showSnagModal, setShowSnagModal] = useState(false);
  const [selectedVehicleForSnag, setSelectedVehicleForSnag] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submittingSnag, setSubmittingSnag] = useState(false);
  const [editingMileage, setEditingMileage] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchData();
  }, [branchId, userRole]);

  const fetchData = async () => {
    try {
      // Mechanics should see ALL vehicles across all branches
      const vehicleBranchFilter = userRole === 'mechanic' ? undefined : (branchId || undefined);

      const [vehiclesData, branchesData] = await Promise.all([
        vehicleService.getVehicles(vehicleBranchFilter),
        branchService.getBranches(),
      ]);

      setVehicles(vehiclesData.filter(v => !v.is_personal));
      setBranches(branchesData);
    } catch (error) {
      showToast('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedVehicles = () => {
    let filtered = vehicles;

    if (searchTerm) {
      filtered = vehicles.filter(v =>
        v.reg_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'reg_number':
          aVal = a.reg_number.toLowerCase();
          bVal = b.reg_number.toLowerCase();
          break;
        case 'branch_id':
          aVal = branches.find(br => br.id === a.branch_id)?.branch_name || '';
          bVal = branches.find(br => br.id === b.branch_id)?.branch_name || '';
          break;
        case 'current_mileage':
          aVal = a.current_mileage || 0;
          bVal = b.current_mileage || 0;
          break;
        case 'updated_at':
          aVal = new Date(a.updated_at || 0).getTime();
          bVal = new Date(b.updated_at || 0).getTime();
          break;
        default:
          aVal = a.reg_number;
          bVal = b.reg_number;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleLocationChange = async (vehicleId: string, newBranchId: string) => {
    if (!user || !userRole) return;

    setSavingVehicleIds(prev => new Set(prev).add(vehicleId));
    setSavedVehicleIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(vehicleId);
      return newSet;
    });

    try {
      const updatedVehicle = await vehicleService.updateVehicleLocation(
        vehicleId,
        newBranchId,
        {
          id: user.id,
          name: user.email || 'Unknown User',
          role: userRole,
        }
      );

      setVehicles(vehicles.map(v => (v.id === vehicleId ? updatedVehicle : v)));

      setSavedVehicleIds(prev => new Set(prev).add(vehicleId));
      setTimeout(() => {
        setSavedVehicleIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(vehicleId);
          return newSet;
        });
      }, 2000);

      showToast('Location updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update location', 'error');
    } finally {
      setSavingVehicleIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(vehicleId);
        return newSet;
      });
    }
  };

  const handleMileageChange = async (vehicleId: string, mileage: string) => {
    const mileageNum = parseInt(mileage, 10);
    if (isNaN(mileageNum) || mileageNum < 0) return;

    setSavingVehicleIds(prev => new Set(prev).add(vehicleId));
    setSavedVehicleIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(vehicleId);
      return newSet;
    });

    try {
      const updatedVehicle = await vehicleService.updateVehicle(vehicleId, {
        current_mileage: mileageNum,
      });

      setVehicles(vehicles.map(v => (v.id === vehicleId ? updatedVehicle : v)));

      setSavedVehicleIds(prev => new Set(prev).add(vehicleId));
      setTimeout(() => {
        setSavedVehicleIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(vehicleId);
          return newSet;
        });
      }, 2000);

      showToast('Mileage updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update mileage', 'error');
    } finally {
      setSavingVehicleIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(vehicleId);
        return newSet;
      });
    }
  };

  const handleHealthChange = async (vehicleId: string, healthFlag: string) => {
    if (!user || !userRole) return;

    setSavingVehicleIds(prev => new Set(prev).add(vehicleId));
    setSavedVehicleIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(vehicleId);
      return newSet;
    });

    try {
      const updatedVehicle = await vehicleService.updateVehicleHealth(
        vehicleId,
        healthFlag as Vehicle['health_flag'],
        `Health status updated via Quick Actions`,
        {
          id: user.id,
          name: user.email || 'Unknown User',
          role: userRole,
          branchId: branchId || undefined,
        }
      );

      setVehicles(vehicles.map(v => (v.id === vehicleId ? updatedVehicle : v)));

      setSavedVehicleIds(prev => new Set(prev).add(vehicleId));
      setTimeout(() => {
        setSavedVehicleIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(vehicleId);
          return newSet;
        });
      }, 2000);

      showToast('Health status updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update health status', 'error');
    } finally {
      setSavingVehicleIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(vehicleId);
        return newSet;
      });
    }
  };

  const handleReportSnag = (vehicle: Vehicle) => {
    setSelectedVehicleForSnag(vehicle);
    setShowSnagModal(true);
  };

  const handleSubmitSnag = async (vehicleId: string, issues: any[], selectedBranchId?: string) => {
    setSubmittingSnag(true);
    try {
      await snagService.createMultipleSnags(vehicleId, issues, selectedBranchId);
      showToast('Snag(s) reported successfully', 'success');
      setShowSnagModal(false);
      setSelectedVehicleForSnag(null);
      await fetchData();
    } catch (error: any) {
      showToast(error.message || 'Failed to report snag', 'error');
      throw error;
    } finally {
      setSubmittingSnag(false);
    }
  };

  const getHealthColor = (healthFlag?: string) => {
    switch (healthFlag?.toLowerCase()) {
      case 'excellent':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'ok':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'grounded':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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

  const sortedVehicles = getSortedVehicles();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quick Actions</h1>
            <p className="text-gray-600 mt-1">Update vehicle location, mileage, and health status</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by registration, make, or model..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Car className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Quick Update Tips</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>Changes are saved automatically as you make them</li>
                <li>Update location when a vehicle returns to your branch</li>
                <li>Enter the current odometer reading for mileage tracking</li>
                <li>Use the Report Snag button to document any issues found</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('reg_number')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>Vehicle</span>
                    <ArrowUpDown className="w-4 h-4" />
                    {sortField === 'reg_number' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('branch_id')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>Location</span>
                    <ArrowUpDown className="w-4 h-4" />
                    {sortField === 'branch_id' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('current_mileage')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    <span>Mileage</span>
                    <ArrowUpDown className="w-4 h-4" />
                    {sortField === 'current_mileage' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    <span>Health</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('updated_at')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>Last Updated</span>
                    <ArrowUpDown className="w-4 h-4" />
                    {sortField === 'updated_at' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedVehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'No vehicles found matching your search' : 'No vehicles available'}
                  </td>
                </tr>
              ) : (
                sortedVehicles.map((vehicle) => {
                  const isSaving = savingVehicleIds.has(vehicle.id);
                  const isSaved = savedVehicleIds.has(vehicle.id);

                  return (
                    <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Car className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="font-bold text-gray-900">{vehicle.reg_number}</div>
                            {vehicle.make && vehicle.model && (
                              <div className="text-sm text-gray-500">
                                {vehicle.make} {vehicle.model}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={vehicle.branch_id || ''}
                          onChange={(e) => handleLocationChange(vehicle.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          disabled={isSaving}
                        >
                          <option value="">Select location...</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.branch_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingMileage.get(vehicle.id) ?? vehicle.current_mileage ?? ''}
                            onFocus={(e) => {
                              const currentValue = vehicle.current_mileage?.toString() || '';
                              setEditingMileage(prev => new Map(prev).set(vehicle.id, currentValue));
                            }}
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              setEditingMileage(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(vehicle.id);
                                return newMap;
                              });
                              if (newValue && newValue !== String(vehicle.current_mileage)) {
                                handleMileageChange(vehicle.id, newValue);
                              }
                            }}
                            onChange={(e) => {
                              setEditingMileage(prev => new Map(prev).set(vehicle.id, e.target.value));
                            }}
                            placeholder="Enter mileage"
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            min="0"
                            disabled={isSaving}
                          />
                          <span className="text-sm text-gray-500">km</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={vehicle.health_flag || ''}
                          onChange={(e) => handleHealthChange(vehicle.id, e.target.value)}
                          className={`px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium ${getHealthColor(
                            vehicle.health_flag
                          )}`}
                          disabled={isSaving}
                        >
                          <option value="">Select health...</option>
                          <option value="Excellent">Excellent</option>
                          <option value="OK">OK</option>
                          <option value="Grounded">Grounded</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isSaving && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                          {isSaved && <Check className="w-4 h-4 text-green-600" />}
                          <span className="text-sm text-gray-500">
                            {vehicle.updated_at
                              ? new Date(vehicle.updated_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Never'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleReportSnag(vehicle)}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                          disabled={isSaving}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Report Snag</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Total Vehicles: {sortedVehicles.length}</span>
          <span>
            Sorted by:{' '}
            <span className="font-medium text-gray-900">
              {sortField === 'reg_number' && 'Registration'}
              {sortField === 'branch_id' && 'Location'}
              {sortField === 'current_mileage' && 'Mileage'}
              {sortField === 'updated_at' && 'Last Updated'}
            </span>{' '}
            ({sortDirection === 'asc' ? 'Ascending' : 'Descending'})
          </span>
        </div>
      </div>

      {showSnagModal && selectedVehicleForSnag && (
        <SnagFormModal
          isOpen={showSnagModal}
          onClose={() => {
            setShowSnagModal(false);
            setSelectedVehicleForSnag(null);
          }}
          onSubmit={handleSubmitSnag}
          vehicles={[selectedVehicleForSnag]}
          submitting={submittingSnag}
          userBranchId={branchId}
        />
      )}
    </div>
  );
}
