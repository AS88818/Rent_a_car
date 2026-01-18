import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { vehicleService, categoryService, branchService, imageService } from '../services/api';
import { Vehicle, VehicleCategory, Branch, VehicleImage } from '../types/database';
import { Search, Car, Gauge, Plus, X, ArrowUpDown } from 'lucide-react';
import { showToast } from '../lib/toast';
import { VehicleTypeBadge } from '../components/VehicleTypeBadge';

interface VehicleWithDetails extends Vehicle {
  category_name?: string;
  branch_name?: string;
}

export function VehiclesPage() {
  const { branchId, userRole } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicleImages, setVehicleImages] = useState<Map<string, VehicleImage[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHealth, setFilterHealth] = useState('');
  const [filterType, setFilterType] = useState('');

  const [sortField, setSortField] = useState<'reg_number' | 'branch_id' | 'current_mileage' | 'updated_at'>('reg_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    reg_number: '',
    category_id: '',
    branch_id: branchId || '',
    status: 'Excellent',
    insurance_expiry: '',
    mot_expiry: '',
    current_mileage: '',
    last_mileage_update: '',
    next_service_mileage: '',
    market_value: '',
    make: '',
    model: '',
    colour: '',
    fuel_type: '',
    transmission: '',
    spare_key: false,
    spare_key_location: '',
    owner_name: '',
    is_personal: false,
    mot_not_applicable: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vehiclesData, categoriesData, branchesData] = await Promise.all([
          vehicleService.getVehicles(branchId || undefined),
          categoryService.getCategories(),
          branchService.getBranches(),
        ]);

        const vehiclesWithDetails = vehiclesData.map(v => ({
          ...v,
          category_name: categoriesData.find(c => c.id === v.category_id)?.category_name,
          branch_name: v.on_hire ? 'On Hire' : branchesData.find(b => b.id === v.branch_id)?.branch_name,
        }));

        setVehicles(vehiclesWithDetails);
        setCategories(categoriesData);
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
  }, [branchId]);

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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'On Hire':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Grounded':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newVehicle = await vehicleService.createVehicle({
        reg_number: formData.reg_number,
        category_id: formData.category_id,
        branch_id: formData.branch_id,
        status: 'Available',
        health_flag: formData.status as 'Excellent' | 'OK' | 'Grounded',
        insurance_expiry: formData.insurance_expiry,
        mot_expiry: formData.mot_expiry,
        current_mileage: parseFloat(formData.current_mileage),
        last_mileage_update: formData.last_mileage_update || undefined,
        next_service_mileage: formData.next_service_mileage ? parseFloat(formData.next_service_mileage) : undefined,
        market_value: formData.market_value ? parseFloat(formData.market_value) : undefined,
        make: formData.make || undefined,
        model: formData.model || undefined,
        colour: formData.colour || undefined,
        fuel_type: formData.fuel_type || undefined,
        transmission: formData.transmission || undefined,
        spare_key: formData.spare_key,
        spare_key_location: formData.spare_key_location || undefined,
        owner_name: formData.owner_name || undefined,
        is_personal: formData.is_personal,
        mot_not_applicable: formData.mot_not_applicable,
      });

      const category = categories.find(c => c.id === newVehicle.category_id);
      const branch = branches.find(b => b.id === newVehicle.branch_id);

      setVehicles([
        ...vehicles,
        {
          ...newVehicle,
          category_name: category?.category_name,
          branch_name: branch?.branch_name,
        },
      ]);

      setFormData({
        reg_number: '',
        category_id: '',
        branch_id: branchId || '',
        status: 'Excellent',
        insurance_expiry: '',
        mot_expiry: '',
        current_mileage: '',
        last_mileage_update: '',
        next_service_mileage: '',
        market_value: '',
        make: '',
        model: '',
        colour: '',
        fuel_type: '',
        transmission: '',
        spare_key: false,
        spare_key_location: '',
        owner_name: '',
        is_personal: false,
        mot_not_applicable: false,
      });

      setShowAddModal(false);
      showToast('Vehicle added successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to add vehicle', 'error');
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredVehicles = vehicles
    .filter(v => {
      const matchesSearch =
        v.reg_number.toLowerCase().includes(search.toLowerCase()) ||
        v.category_name?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !filterCategory || v.category_id === filterCategory;
      const matchesBranch = !filterBranch || v.branch_id === filterBranch;
      const matchesStatus = !filterStatus || v.status === filterStatus;
      const matchesHealth = !filterHealth || v.health_flag === filterHealth;
      const matchesType = !filterType || (filterType === 'personal' ? v.is_personal : !v.is_personal);

      return matchesSearch && matchesCategory && matchesBranch && matchesStatus && matchesHealth && matchesType;
    })
    .sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'reg_number':
          aVal = a.reg_number.toLowerCase();
          bVal = b.reg_number.toLowerCase();
          break;
        case 'branch_id':
          aVal = a.branch_name?.toLowerCase() || '';
          bVal = b.branch_name?.toLowerCase() || '';
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

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Vehicle Directory</h1>
          <p className="text-sm text-gray-600 mt-1">{vehicles.length} vehicles total</p>
        </div>
        {userRole && ['admin', 'fleet_manager'].includes(userRole) && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">Add Vehicle</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by registration or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-gray-900"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.category_name}
                </option>
              ))}
            </select>

            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-gray-900"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-gray-900"
            >
              <option value="">All Status</option>
              <option value="Available">Available</option>
              <option value="On Hire">On Hire</option>
              <option value="Grounded">Grounded</option>
            </select>

            <select
              value={filterHealth}
              onChange={e => setFilterHealth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-gray-900"
            >
              <option value="">All Health</option>
              <option value="Excellent">Excellent</option>
              <option value="OK">OK</option>
              <option value="Grounded">Grounded</option>
            </select>

            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-gray-900"
            >
              <option value="">All Types</option>
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSort('reg_number')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'reg_number'
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>Registration</span>
                {sortField === 'reg_number' && (
                  <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>

              <button
                onClick={() => handleSort('branch_id')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'branch_id'
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>Location</span>
                {sortField === 'branch_id' && (
                  <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>

              <button
                onClick={() => handleSort('current_mileage')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'current_mileage'
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>Mileage</span>
                {sortField === 'current_mileage' && (
                  <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>

              <button
                onClick={() => handleSort('updated_at')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'updated_at'
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>Last Updated</span>
                {sortField === 'updated_at' && (
                  <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </div>
          </div>

          {(search || filterCategory || filterBranch || filterStatus || filterHealth || filterType) && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {filteredVehicles.length} of {vehicles.length} vehicles
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setFilterCategory('');
                  setFilterBranch('');
                  setFilterStatus('');
                  setFilterHealth('');
                  setFilterType('');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredVehicles.map(vehicle => {
          const images = vehicleImages.get(vehicle.id) || [];
          const primaryImage = images.find(img => img.is_primary) || images[0];

          return (
            <div
              key={vehicle.id}
              onClick={() => navigate(`/vehicles/${vehicle.id}`)}
              className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer border-2 overflow-hidden group ${
                vehicle.is_personal
                  ? 'border-amber-300 hover:border-amber-400'
                  : 'border-gray-100 hover:border-blue-200'
              }`}
            >
              {vehicle.is_personal && (
                <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1.5">
                  <p className="text-xs font-bold text-white text-center">PERSONAL VEHICLE</p>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {primaryImage ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <img
                          src={primaryImage.image_url}
                          alt={vehicle.reg_number}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center group-hover:bg-opacity-80 transition-colors flex-shrink-0 ${
                        vehicle.is_personal ? 'bg-amber-50' : 'bg-blue-50 group-hover:bg-blue-100'
                      }`}>
                        <Car className={`w-8 h-8 ${vehicle.is_personal ? 'text-amber-600' : 'text-blue-600'}`} />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{vehicle.reg_number}</h3>
                      <p className="text-sm text-gray-600">{vehicle.category_name}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${getHealthBadgeColor(vehicle.health_flag)}`}>
                    {vehicle.health_flag}
                  </span>
                </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium text-gray-900">
                    {vehicle.branch_name}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Type:</span>
                  <VehicleTypeBadge isPersonal={vehicle.is_personal} size="sm" />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusBadgeColor(vehicle.status)}`}>
                    {vehicle.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Gauge className="w-4 h-4" />
                    Mileage:
                  </span>
                  <span className="font-semibold text-gray-900">{vehicle.current_mileage.toLocaleString()} km</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button className="w-full py-2 text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                  View Details →
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No vehicles found</h3>
          <p className="text-gray-600 mb-4">
            {search || filterCategory || filterBranch || filterStatus || filterHealth
              ? 'Try adjusting your search or filters'
              : 'No vehicles available at the moment'}
          </p>
          {(search || filterCategory || filterBranch || filterStatus || filterHealth) && (
            <button
              onClick={() => {
                setSearch('');
                setFilterCategory('');
                setFilterBranch('');
                setFilterStatus('');
                setFilterHealth('');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add New Vehicle</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., ABC-123"
                    value={formData.reg_number}
                    onChange={(e) => setFormData({ ...formData, reg_number: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Location</option>
                    {branches
                      .filter((branch) => branch.branch_name !== 'On Hire')
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branch_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="OK">OK</option>
                    <option value="Grounded">Grounded</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_personal"
                      checked={formData.is_personal}
                      onChange={(e) => setFormData({ ...formData, is_personal: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="is_personal" className="text-sm font-medium text-gray-700">
                      Personal Vehicle (not available for hire)
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Personal vehicles will not appear on the dashboard or calendar for hire bookings
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Mileage (km) *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 50000"
                    value={formData.current_mileage}
                    onChange={(e) => setFormData({ ...formData, current_mileage: e.target.value })}
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Mileage Reading Date
                  </label>
                  <input
                    type="date"
                    value={formData.last_mileage_update}
                    onChange={(e) => setFormData({ ...formData, last_mileage_update: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Expiry *
                  </label>
                  <input
                    type="date"
                    value={formData.insurance_expiry}
                    onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MOT Expiry *
                  </label>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={formData.mot_expiry}
                      onChange={(e) => setFormData({ ...formData, mot_expiry: e.target.value })}
                      required={!formData.mot_not_applicable}
                      disabled={formData.mot_not_applicable}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="mot_not_applicable"
                        checked={formData.mot_not_applicable}
                        onChange={(e) => setFormData({ ...formData, mot_not_applicable: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="mot_not_applicable" className="text-xs text-gray-600">
                        MOT Not Applicable
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Next Service (km)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 60000"
                    value={formData.next_service_mileage}
                    onChange={(e) => setFormData({ ...formData, next_service_mileage: e.target.value })}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Make
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Toyota"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Corolla"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Colour
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., White"
                    value={formData.colour}
                    onChange={(e) => setFormData({ ...formData, colour: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fuel Type
                  </label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Fuel Type</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Electric">Electric</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transmission
                  </label>
                  <select
                    value={formData.transmission}
                    onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Transmission</option>
                    <option value="Manual">Manual</option>
                    <option value="Auto">Auto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., John Smith"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Market Value (£)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 15000"
                    value={formData.market_value}
                    onChange={(e) => setFormData({ ...formData, market_value: e.target.value })}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="spare_key"
                      checked={formData.spare_key}
                      onChange={(e) => setFormData({ ...formData, spare_key: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="spare_key" className="text-sm font-medium text-gray-700">
                      Spare Key Available
                    </label>
                  </div>
                  {formData.spare_key && (
                    <input
                      type="text"
                      placeholder="Spare key location (e.g., Office safe)"
                      value={formData.spare_key_location}
                      onChange={(e) => setFormData({ ...formData, spare_key_location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Vehicle
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
