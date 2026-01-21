import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { maintenanceService, vehicleService, userService } from '../services/api';
import { MaintenanceLog, Vehicle, AuthUser } from '../types/database';
import { formatDate } from '../lib/utils';
import { Plus, Filter, X, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { showToast } from '../lib/toast';
import { PhotoUpload } from '../components/PhotoUpload';

interface WorkItem {
  work_description: string;
  work_category: string;
  photos: string[];
  performed_by: string;
  performed_by_user_id: string;
  performed_by_type: 'registered' | 'other';
  performed_by_other: string;
  checked_by_user_id: string;
}

export function MaintenancePage() {
  const { branchId, userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const vehicleIdFromUrl = searchParams.get('vehicleId');

  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mechanics, setMechanics] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedLog, setSelectedLog] = useState<MaintenanceLog | null>(null);
  const [formData, setFormData] = useState({
    service_date: '',
    mileage: '',
    notes: '',
  });
  const [workItems, setWorkItems] = useState<WorkItem[]>([
    {
      work_description: '',
      work_category: '',
      photos: [],
      performed_by: '',
      performed_by_user_id: '',
      performed_by_type: 'registered' as const,
      performed_by_other: '',
      checked_by_user_id: '',
    },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Mechanics should see ALL vehicles across all branches
        const vehicleBranchFilter = userRole === 'mechanic' ? undefined : (branchId || undefined);

        const vehiclesData = await vehicleService.getVehicles(vehicleBranchFilter);
        setVehicles(vehiclesData);

        try {
          // Also show all mechanics for mechanics role
          const userBranchFilter = userRole === 'mechanic' ? undefined : (branchId || undefined);
          const usersData = await userService.getUsers(userBranchFilter);
          const mechanicsOnly = usersData.filter(u => {
            const isActive = u.status === 'active' || !u.status;
            const isMechanic = u.role === 'mechanic';
            return isActive && isMechanic;
          });
          console.log('Loaded mechanics:', mechanicsOnly);
          setMechanics(mechanicsOnly);
        } catch (error) {
          console.error('Failed to fetch users:', error);
          showToast('Could not load mechanics list', 'warning');
        }

        const initialVehicleId = vehicleIdFromUrl || (vehiclesData.length > 0 ? vehiclesData[0].id : '');

        if (initialVehicleId) {
          setSelectedVehicle(initialVehicleId);
          const logsData = await maintenanceService.getMaintenanceLog(initialVehicleId);
          setLogs(logsData);
        }
      } catch (error: any) {
        console.error('Maintenance fetch error:', error);
        showToast(error.message || 'Failed to fetch maintenance data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId, userRole, vehicleIdFromUrl]);

  const handleVehicleChange = async (vehicleId: string) => {
    setSelectedVehicle(vehicleId);

    if (vehicleId) {
      setSearchParams({ vehicleId });
    } else {
      setSearchParams({});
    }

    if (!vehicleId) {
      setLogs([]);
      return;
    }

    try {
      const logsData = await maintenanceService.getMaintenanceLog(vehicleId);
      setLogs(logsData);
    } catch (error) {
      showToast('Failed to fetch maintenance logs', 'error');
    }
  };

  const handleAddWorkItem = () => {
    setWorkItems([
      ...workItems,
      {
        work_description: '',
        work_category: '',
        photos: [],
        performed_by: '',
        performed_by_user_id: '',
        performed_by_type: 'registered' as const,
        performed_by_other: '',
        checked_by_user_id: '',
      },
    ]);
  };

  const handleRemoveWorkItem = (index: number) => {
    if (workItems.length > 1) {
      setWorkItems(workItems.filter((_, i) => i !== index));
    }
  };

  const handleWorkItemChange = (index: number, field: keyof WorkItem, value: string) => {
    const newWorkItems = [...workItems];
    newWorkItems[index][field] = value as never;
    setWorkItems(newWorkItems);
  };

  const handleWorkItemPhotoUpload = (index: number, photoUrl: string) => {
    const newWorkItems = [...workItems];
    newWorkItems[index].photos.push(photoUrl);
    setWorkItems(newWorkItems);
  };

  const handleRemoveWorkItemPhoto = (workItemIndex: number, photoIndex: number) => {
    const newWorkItems = [...workItems];
    newWorkItems[workItemIndex].photos.splice(photoIndex, 1);
    setWorkItems(newWorkItems);
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();

    const validWorkItems = workItems.filter(item => item.work_description.trim() !== '');

    if (validWorkItems.length === 0) {
      showToast('Please add at least one work item', 'error');
      return;
    }

    for (let i = 0; i < validWorkItems.length; i++) {
      const item = validWorkItems[i];
      if (item.performed_by_type === 'registered' && !item.performed_by_user_id) {
        showToast(`Please select who performed work item ${i + 1}`, 'error');
        return;
      }
      if (item.performed_by_type === 'other' && !item.performed_by_other.trim()) {
        showToast(`Please enter who performed work item ${i + 1}`, 'error');
        return;
      }
    }

    try {
      const vehicle = vehicles.find(v => v.id === selectedVehicle);
      const vehicleBranchId = vehicle?.branch_id || branchId;

      if (!vehicleBranchId) {
        throw new Error('Branch ID is required');
      }

      const processedWorkItems = validWorkItems.map(item => {
        let performedBy = '';
        let performedByUserId: string | undefined = undefined;

        if (item.performed_by_type === 'registered') {
          const selectedMechanic = mechanics.find(m => m.id === item.performed_by_user_id);
          if (selectedMechanic) {
            performedBy = selectedMechanic.full_name;
            performedByUserId = selectedMechanic.id;
          }
        } else {
          performedBy = item.performed_by_other;
        }

        return {
          work_description: item.work_description,
          work_category: item.work_category,
          photos: item.photos,
          performed_by: performedBy,
          performed_by_user_id: performedByUserId,
          checked_by_user_id: item.checked_by_user_id || undefined,
        };
      });

      const workDoneSummary = validWorkItems
        .map((item, idx) => `${idx + 1}. ${item.work_description}`)
        .join('\n');

      const firstWorkItem = processedWorkItems[0];

      const newLog = await maintenanceService.createMaintenanceLog({
        vehicle_id: selectedVehicle,
        service_date: formData.service_date,
        mileage: parseFloat(formData.mileage),
        work_done: workDoneSummary,
        performed_by: firstWorkItem.performed_by,
        performed_by_user_id: firstWorkItem.performed_by_user_id,
        checked_by_user_id: firstWorkItem.checked_by_user_id,
        notes: formData.notes,
        branch_id: vehicleBranchId,
        work_items: processedWorkItems,
      });

      setLogs([newLog, ...logs]);
      setFormData({
        service_date: '',
        mileage: '',
        notes: '',
      });
      setWorkItems([
        {
          work_description: '',
          work_category: '',
          photos: [],
          performed_by: '',
          performed_by_user_id: '',
          performed_by_type: 'registered' as const,
          performed_by_other: '',
          checked_by_user_id: '',
        },
      ]);
      setShowForm(false);
      showToast('Maintenance log created', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to create log', 'error');
    }
  };

  const currentVehicle = vehicles.find(v => v.id === selectedVehicle);

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Maintenance</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Log Maintenance</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Maintenance Log</h2>
            <button
              onClick={() => {
                setShowForm(false);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleAddLog} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                <select
                  value={selectedVehicle}
                  onChange={e => {
                    setSelectedVehicle(e.target.value);
                    handleVehicleChange(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.reg_number} - {v.make} {v.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Date</label>
                <input
                  type="date"
                  value={formData.service_date}
                  onChange={e => setFormData({ ...formData, service_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mileage at Service</label>
                <input
                  type="number"
                  placeholder="Enter mileage"
                  value={formData.mileage}
                  onChange={e => setFormData({ ...formData, mileage: e.target.value })}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Work Performed <span className="text-red-500">*</span>
              </label>

              <div className="space-y-4">
                {workItems.map((workItem, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3 bg-gray-50">
                    <div className="flex gap-2 items-start justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">Work Item {index + 1}</h4>
                      {workItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkItem(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Description <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder={`Describe the work performed...`}
                          value={workItem.work_description}
                          onChange={e => handleWorkItemChange(index, 'work_description', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                        <select
                          value={workItem.work_category}
                          onChange={e => handleWorkItemChange(index, 'work_category', e.target.value)}
                          className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value="">No Category</option>
                          <option value="Engine / Fuel">Engine / Fuel</option>
                          <option value="Gearbox">Gearbox</option>
                          <option value="Suspension">Suspension</option>
                          <option value="Electrical">Electrical</option>
                          <option value="Body">Body</option>
                          <option value="Accessories">Accessories</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Performed By <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={workItem.performed_by_type === 'other' ? 'other' : workItem.performed_by_user_id}
                          onChange={e => {
                            const value = e.target.value;
                            const newWorkItems = [...workItems];
                            if (value === 'other') {
                              newWorkItems[index].performed_by_type = 'other';
                              newWorkItems[index].performed_by_user_id = '';
                              newWorkItems[index].performed_by_other = '';
                            } else {
                              newWorkItems[index].performed_by_type = 'registered';
                              newWorkItems[index].performed_by_user_id = value;
                              newWorkItems[index].performed_by_other = '';
                            }
                            setWorkItems(newWorkItems);
                          }}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value="">Select performer...</option>
                          <optgroup label="Registered Mechanics">
                            {mechanics.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.full_name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="External">
                            <option value="other">Other (External)</option>
                          </optgroup>
                        </select>

                        {workItem.performed_by_type === 'other' && (
                          <input
                            type="text"
                            placeholder="Enter name or service center"
                            value={workItem.performed_by_other}
                            onChange={e => {
                              const newWorkItems = [...workItems];
                              newWorkItems[index].performed_by_other = e.target.value;
                              setWorkItems(newWorkItems);
                            }}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mt-2"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Work Checked By <span className="text-gray-400">(Optional)</span>
                        </label>
                        <select
                          value={workItem.checked_by_user_id}
                          onChange={e => {
                            const newWorkItems = [...workItems];
                            newWorkItems[index].checked_by_user_id = e.target.value;
                            setWorkItems(newWorkItems);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value="">No quality check</option>
                          {mechanics.length > 0 && (
                            <optgroup label="Select Checker">
                              {mechanics.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.full_name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        <ImageIcon className="w-3 h-3 inline mr-1" />
                        Photos (optional)
                      </label>

                      {workItem.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {workItem.photos.map((photo, photoIndex) => (
                            <div key={photoIndex} className="relative">
                              <img
                                src={photo}
                                alt={`Work item ${index + 1} photo ${photoIndex + 1}`}
                                className="w-20 h-20 object-cover rounded border border-gray-300"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveWorkItemPhoto(index, photoIndex)}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <PhotoUpload
                        onUpload={(url) => handleWorkItemPhotoUpload(index, url)}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddWorkItem}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors w-full justify-center border border-blue-200 border-dashed"
                >
                  <Plus className="w-4 h-4" />
                  Add Work Item
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <textarea
                placeholder="Use the 'Report a Snag' function to report additional issues found during maintenance"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 sm:flex-none px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Log
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setWorkItems([
                    {
                      work_description: '',
                      work_category: '',
                      photos: [],
                      performed_by: '',
                      performed_by_user_id: '',
                      performed_by_type: 'registered' as const,
                      performed_by_other: '',
                      checked_by_user_id: '',
                    },
                  ]);
                  setFormData({
                    service_date: '',
                    mileage: '',
                    notes: '',
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filter by Vehicle</h2>
        </div>
        <select
          value={selectedVehicle}
          onChange={(e) => handleVehicleChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Vehicles</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.reg_number} - {v.make} {v.model}
            </option>
          ))}
        </select>

        {currentVehicle && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Current Mileage</p>
              <p className="text-lg font-semibold text-gray-900">
                {currentVehicle.current_mileage.toLocaleString()} km
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold text-gray-900">{currentVehicle.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Health</p>
              <p className={`text-lg font-semibold ${
                currentVehicle.health_flag === 'Excellent' ? 'text-green-600' :
                currentVehicle.health_flag === 'OK' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {currentVehicle.health_flag}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Logs</p>
              <p className="text-lg font-semibold text-gray-900">{logs.length}</p>
            </div>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 mb-1">Total Services</p>
              <p className="text-2xl font-bold text-blue-900">{logs.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 mb-1">Last Service</p>
              <p className="text-lg font-bold text-green-900">
                {logs.length > 0 ? formatDate(logs[0].service_date) : 'N/A'}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-yellow-600 mb-1">Last Mileage</p>
              <p className="text-lg font-bold text-yellow-900">
                {logs.length > 0 ? logs[0].mileage.toLocaleString() : 'N/A'} km
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">
              {selectedVehicle
                ? 'No maintenance logs found for this vehicle'
                : 'Select a vehicle to view maintenance history'}
            </p>
            {selectedVehicle && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Log
              </button>
            )}
          </div>
        ) : (
          logs.map(log => {
            const vehicle = vehicles.find(v => v.id === log.vehicle_id);
            return (
              <div
                key={log.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {vehicle ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/vehicles/${vehicle.id}`);
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {vehicle.reg_number}
                          </button>
                          {' - '}{vehicle.make} {vehicle.model}
                        </>
                      ) : (
                        'Unknown Vehicle'
                      )}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Service Date: {formatDate(log.service_date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm text-gray-600">Mileage</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {log.mileage.toLocaleString()} km
                    </p>
                  </div>
                </div>

                <div className="mb-4 pb-4 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Work Performed</h4>
                  <p className="text-gray-900">{log.work_done}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Performed By:</span>
                    <p className="font-medium text-gray-900">{log.performed_by}</p>
                  </div>
                  {log.checked_by_user_id && (
                    <div>
                      <span className="text-gray-600">Checked By:</span>
                      <p className="font-medium text-gray-900">
                        {(() => {
                          const checker = mechanics.find(m => m.id === log.checked_by_user_id);
                          return checker ? checker.full_name : 'Unknown';
                        })()}
                      </p>
                    </div>
                  )}
                  {log.work_category && (
                    <div>
                      <span className="text-gray-600">Category:</span>
                      <p className="font-medium text-gray-900">{log.work_category}</p>
                    </div>
                  )}
                  {log.photo_urls && log.photo_urls.length > 0 && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <ImageIcon className="w-4 h-4" />
                      <span>{log.photo_urls.length} photo{log.photo_urls.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {log.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Additional Notes</h4>
                    <p className="text-sm text-gray-600">{log.notes}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Maintenance Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                {(() => {
                  const vehicle = vehicles.find(v => v.id === selectedLog.vehicle_id);
                  return vehicle ? (
                    <button
                      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                      className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline mb-2 block"
                    >
                      {vehicle.reg_number}
                    </button>
                  ) : (
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Unknown Vehicle</h3>
                  );
                })()}
                <p className="text-sm text-gray-600">
                  Service Date: {formatDate(selectedLog.service_date)}
                </p>
                <p className="text-sm text-gray-600">
                  Mileage: {selectedLog.mileage.toLocaleString()} km
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Work Performed</h4>
                <p className="text-gray-900">{selectedLog.work_done}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Performed By</h4>
                <p className="text-gray-900">{selectedLog.performed_by}</p>
              </div>

              {selectedLog.checked_by_user_id && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Work Checked By</h4>
                  <p className="text-gray-900">
                    {(() => {
                      const checker = mechanics.find(m => m.id === selectedLog.checked_by_user_id);
                      return checker ? checker.full_name : 'Unknown';
                    })()}
                  </p>
                </div>
              )}

              {selectedLog.work_category && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Work Category</h4>
                  <p className="text-gray-900">{selectedLog.work_category}</p>
                </div>
              )}

              {selectedLog.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Notes</h4>
                  <p className="text-gray-900">{selectedLog.notes}</p>
                </div>
              )}

              {selectedLog.photo_urls && selectedLog.photo_urls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Photos</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedLog.photo_urls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={url}
                          alt={`Maintenance photo ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
