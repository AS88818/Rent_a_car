import { useState, useEffect } from 'react';
import { CheckCircle, X, Car, MapPin, AlertCircle } from 'lucide-react';
import { quotationService, vehicleService, branchService } from '../services/api';
import { showToast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';

interface Quote {
  id: string;
  client_name: string;
  client_phone?: string;
  pickup_location?: string;
  dropoff_location?: string;
  start_date: string;
  end_date: string;
  quote_reference: string;
  status: string;
  quote_data: { [key: string]: any };
}

interface AcceptQuoteModalProps {
  quote: Quote;
  onClose: () => void;
  onSuccess: () => void;
}

interface Vehicle {
  id: string;
  reg_number: string;
  status: string;
  branch_id?: string;
}

interface Branch {
  id: string;
  branch_name: string;
}

interface BranchAvailability {
  branchId: string;
  branchName: string;
  availableCount: number;
  vehicleIds: string[];
}

interface VehicleWithBranch extends Vehicle {
  branchName?: string;
}

export function AcceptQuoteModal({ quote, onClose, onSuccess }: AcceptQuoteModalProps) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [availableVehicles, setAvailableVehicles] = useState<VehicleWithBranch[]>([]);
  const [availableBranches, setAvailableBranches] = useState<BranchAvailability[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const categories = Object.keys(quote.quote_data);
  const quoteData = quote.quote_data as { [key: string]: any };

  useEffect(() => {
    loadBranches();
    checkMissingFields();
  }, []);

  const checkMissingFields = () => {
    const missing: string[] = [];
    if (!quote.client_phone) missing.push('Phone Number');
    if (!quote.pickup_location) missing.push('Pickup Location');
    if (!quote.dropoff_location) missing.push('Dropoff Location');
    setMissingFields(missing);
  };

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches();
      setBranches(data);
    } catch (error) {
      console.error('Failed to load branches:', error);
      showToast('Failed to load branches', 'error');
    }
  };

  const loadAvailableVehiclesAndBranches = async (categoryName: string) => {
    if (!categoryName) return;

    setLoadingVehicles(true);
    setSelectedVehicle('');
    setSelectedBranch('');

    try {
      const categoryQuote = quoteData[categoryName];
      const branchAvailability: BranchAvailability[] = categoryQuote?.branchAvailability || [];

      if (branchAvailability.length === 0) {
        setAvailableVehicles([]);
        setAvailableBranches([]);
        showToast('No vehicles available for this category', 'error');
        return;
      }

      setAvailableBranches(branchAvailability);

      const allVehicleIds = branchAvailability.flatMap(b => b.vehicleIds);

      const vehicles = await Promise.all(
        allVehicleIds.map(async (id) => {
          try {
            const vehicle = await vehicleService.getVehicleById(id);
            const branchInfo = branchAvailability.find(b => b.vehicleIds.includes(id));
            return {
              ...vehicle,
              branchName: branchInfo?.branchName || 'Unknown'
            };
          } catch {
            return null;
          }
        })
      );

      const validVehicles = vehicles.filter((v): v is VehicleWithBranch => v !== null && v.status === 'Available');
      setAvailableVehicles(validVehicles);

      if (branchAvailability.length === 1) {
        setSelectedBranch(branchAvailability[0].branchId);
      }
    } catch (error) {
      console.error('Failed to load vehicles:', error);
      showToast('Failed to load available vehicles', 'error');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleCategoryChange = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedVehicle('');
    setSelectedBranch('');
    setAvailableVehicles([]);
    setAvailableBranches([]);
    if (categoryName) {
      loadAvailableVehiclesAndBranches(categoryName);
    }
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    setSelectedVehicle('');
  };

  const handleVehicleChange = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);

    const vehicle = availableVehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      const branchInfo = availableBranches.find(b => b.vehicleIds.includes(vehicleId));
      if (branchInfo && branchInfo.branchId !== selectedBranch) {
        setSelectedBranch(branchInfo.branchId);
      }
    }
  };

  const handleAccept = async () => {
    if (missingFields.length > 0) {
      showToast(`Missing required fields: ${missingFields.join(', ')}. Please update the quote first.`, 'error');
      return;
    }

    if (!selectedCategory) {
      showToast('Please select a vehicle category', 'error');
      return;
    }

    if (!selectedVehicle) {
      showToast('Please select a vehicle', 'error');
      return;
    }

    if (!selectedBranch) {
      showToast('Please select a branch', 'error');
      return;
    }

    const vehicle = availableVehicles.find(v => v.id === selectedVehicle);
    const vehicleBranch = availableBranches.find(b => b.vehicleIds.includes(selectedVehicle));

    if (vehicleBranch && vehicleBranch.branchId !== selectedBranch) {
      showToast(`Vehicle ${vehicle?.reg_number} is at ${vehicleBranch.branchName}, but you selected ${branches.find(b => b.id === selectedBranch)?.branch_name}. Please select the correct branch.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const booking = await quotationService.convertQuoteToBooking(
        quote.id,
        selectedCategory,
        selectedVehicle,
        selectedBranch
      );

      showToast('Quote accepted and booking created successfully!', 'success');
      onSuccess();
      onClose();

      setTimeout(() => {
        navigate(`/bookings`);
      }, 1000);
    } catch (error: any) {
      console.error('Failed to accept quote:', error);
      showToast(error.message || 'Failed to accept quote', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = selectedBranch
    ? availableVehicles.filter(v => {
        const branchInfo = availableBranches.find(b => b.vehicleIds.includes(v.id));
        return branchInfo?.branchId === selectedBranch;
      })
    : availableVehicles;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Accept Quote & Create Booking
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Quote Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Reference:</span>{' '}
                  <span className="font-medium">{quote.quote_reference}</span>
                </div>
                <div>
                  <span className="text-gray-600">Client:</span>{' '}
                  <span className="font-medium">{quote.client_name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Period:</span>{' '}
                  <span className="font-medium">
                    {quote.start_date} to {quote.end_date}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>{' '}
                  <span className="font-medium">{quote.client_phone || 'Not provided'}</span>
                </div>
              </div>
            </div>

            {missingFields.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900 mb-1">Missing Required Information</h4>
                    <p className="text-sm text-red-700 mb-2">
                      The following fields are required to create a booking:
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700">
                      {missingFields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                    <p className="text-sm text-red-700 mt-2">
                      Please load and update this quote before accepting it.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Vehicle Category *
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={missingFields.length > 0}
              >
                <option value="">Choose a category</option>
                {categories.map((category) => {
                  const categoryData = quoteData[category];
                  return (
                    <option key={category} value={category}>
                      {category} - KES {categoryData.grandTotal?.toLocaleString()}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedCategory && availableBranches.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Select Branch *
                  </div>
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={missingFields.length > 0 || availableBranches.length === 1}
                >
                  <option value="">Choose a branch</option>
                  {availableBranches.map((branch) => (
                    <option key={branch.branchId} value={branch.branchId}>
                      {branch.branchName} ({branch.availableCount} {branch.availableCount === 1 ? 'vehicle' : 'vehicles'})
                    </option>
                  ))}
                </select>
                {availableBranches.length === 1 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Only one branch has vehicles available for this category
                  </p>
                )}
              </div>
            )}

            {selectedCategory && selectedBranch && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Select Vehicle *
                  </div>
                </label>
                {loadingVehicles ? (
                  <div className="text-center py-4 text-gray-500">Loading available vehicles...</div>
                ) : filteredVehicles.length > 0 ? (
                  <div className="space-y-2">
                    {filteredVehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        onClick={() => handleVehicleChange(vehicle.id)}
                        className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                          selectedVehicle === vehicle.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{vehicle.reg_number}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {vehicle.branchName}
                            </p>
                          </div>
                          {selectedVehicle === vehicle.id && (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-red-600">
                    No vehicles available at this branch for the selected category
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={loading || missingFields.length > 0 || !selectedCategory || !selectedVehicle || !selectedBranch}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                'Creating Booking...'
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Accept & Create Booking
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
