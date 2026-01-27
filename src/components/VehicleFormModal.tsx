import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Vehicle, VehicleCategory, Branch } from '../types/database';
import { vehicleService } from '../services/api';
import { showToast } from '../lib/toast';

interface VehicleFormModalProps {
  mode: 'add' | 'edit';
  vehicle?: Vehicle | null;
  categories: VehicleCategory[];
  branches: Branch[];
  defaultBranchId?: string;
  onClose: () => void;
  onSuccess: (vehicle: Vehicle) => void;
}

export function VehicleFormModal({
  mode,
  vehicle,
  categories,
  branches,
  defaultBranchId,
  onClose,
  onSuccess,
}: VehicleFormModalProps) {
  const [formData, setFormData] = useState({
    reg_number: '',
    category_id: '',
    branch_id: defaultBranchId || '',
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
    chassis_number: '',
    owner_name: '',
    is_personal: false,
    mot_not_applicable: false,
    no_of_passengers: '',
    luggage_space: '',
    on_hire: false,
    on_hire_location: '',
  });
  const [submitting, setSubmitting] = useState(false);
  // Store the original branch_id to restore when toggling On Hire off
  const [originalBranchId, setOriginalBranchId] = useState<string>(defaultBranchId || '');

  useEffect(() => {
    if (mode === 'edit' && vehicle) {
      // Store the original branch_id before it might be cleared by On Hire toggle
      setOriginalBranchId(vehicle.branch_id || '');
      setFormData({
        reg_number: vehicle.reg_number || '',
        category_id: vehicle.category_id || '',
        branch_id: vehicle.branch_id || '',
        status: vehicle.health_flag || 'Excellent',
        insurance_expiry: vehicle.insurance_expiry || '',
        mot_expiry: vehicle.mot_expiry || '',
        current_mileage: vehicle.current_mileage?.toString() || '',
        last_mileage_update: vehicle.last_mileage_update || '',
        next_service_mileage: vehicle.next_service_mileage?.toString() || '',
        market_value: vehicle.market_value?.toString() || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        colour: vehicle.colour || '',
        fuel_type: vehicle.fuel_type || '',
        transmission: vehicle.transmission || '',
        spare_key: vehicle.spare_key || false,
        spare_key_location: vehicle.spare_key_location || '',
        chassis_number: vehicle.chassis_number || '',
        owner_name: vehicle.owner_name || '',
        is_personal: vehicle.is_personal || false,
        mot_not_applicable: vehicle.mot_not_applicable || false,
        no_of_passengers: vehicle.no_of_passengers?.toString() || '',
        luggage_space: vehicle.luggage_space || '',
        on_hire: vehicle.on_hire || false,
        on_hire_location: vehicle.on_hire_location || '',
      });
    }
  }, [mode, vehicle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const vehicleData = {
        reg_number: formData.reg_number,
        category_id: formData.category_id,
        branch_id: formData.branch_id || null,
        status: mode === 'add' ? 'Available' : vehicle?.status,
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
        chassis_number: formData.chassis_number || undefined,
        owner_name: formData.owner_name || undefined,
        is_personal: formData.is_personal,
        mot_not_applicable: formData.mot_not_applicable,
        no_of_passengers: formData.no_of_passengers ? parseInt(formData.no_of_passengers) : undefined,
        luggage_space: formData.luggage_space || undefined,
        on_hire: formData.on_hire,
        on_hire_location: formData.on_hire_location || undefined,
      };

      let result: Vehicle;
      if (mode === 'edit' && vehicle) {
        result = await vehicleService.updateVehicle(vehicle.id, vehicleData);
        showToast('Vehicle updated successfully', 'success');
      } else {
        result = await vehicleService.createVehicle(vehicleData);
        showToast('Vehicle added successfully', 'success');
      }

      onSuccess(result);
      onClose();
    } catch (error: any) {
      showToast(error.message || `Failed to ${mode} vehicle`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'edit' ? 'Edit Vehicle' : 'Add New Vehicle'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
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

            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="on_hire"
                  checked={formData.on_hire}
                  onChange={(e) => {
                    const isOnHire = e.target.checked;
                    if (isOnHire) {
                      // Store current branch_id before clearing it
                      setOriginalBranchId(formData.branch_id || originalBranchId);
                    }
                    setFormData({
                      ...formData,
                      on_hire: isOnHire,
                      // When unchecking On Hire, restore the original branch_id
                      branch_id: isOnHire ? '' : (originalBranchId || formData.branch_id)
                    });
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="on_hire" className="text-sm font-medium text-gray-700">
                  Vehicle is On Hire
                </label>
              </div>
              <p className="text-xs text-gray-500 ml-6">
                Check this if the vehicle is currently on hire (not at a branch location)
              </p>
            </div>

            {formData.on_hire ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  On Hire Location / Customer
                </label>
                <input
                  type="text"
                  placeholder="e.g., Customer Name or Location"
                  value={formData.on_hire_location}
                  onChange={(e) => setFormData({ ...formData, on_hire_location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Location *
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Health Status *
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
                Chassis Number
              </label>
              <input
                type="text"
                placeholder="e.g., 1HGBH41JXMN109186"
                value={formData.chassis_number}
                onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
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
                Number of Passengers
              </label>
              <input
                type="number"
                placeholder="e.g., 5"
                value={formData.no_of_passengers}
                onChange={(e) => setFormData({ ...formData, no_of_passengers: e.target.value })}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Luggage Space
              </label>
              <input
                type="text"
                placeholder="e.g., 2 Large bags"
                value={formData.luggage_space}
                onChange={(e) => setFormData({ ...formData, luggage_space: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
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
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : mode === 'edit' ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
