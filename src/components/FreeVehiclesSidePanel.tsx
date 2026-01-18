import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Car, MapPin, Activity } from 'lucide-react';
import { Vehicle, VehicleCategory } from '../types/database';
import { getCategoryColor } from '../lib/calendar-utils';

interface FreeVehiclesSidePanelProps {
  date: string;
  vehicles: Vehicle[];
  categories: VehicleCategory[];
  onClose: () => void;
}

interface GroupedVehicles {
  category: VehicleCategory;
  vehicles: Vehicle[];
  color: ReturnType<typeof getCategoryColor>;
}

export function FreeVehiclesSidePanel({ date, vehicles, categories, onClose }: FreeVehiclesSidePanelProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVehicles = vehicles.filter(v =>
    v.reg_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedVehicles: GroupedVehicles[] = categories
    .map((category, idx) => ({
      category,
      vehicles: filteredVehicles.filter(v => v.category_id === category.id),
      color: getCategoryColor(category.category_name, idx)
    }))
    .filter(group => group.vehicles.length > 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'Green':
        return <div className="w-3 h-3 rounded-full bg-green-500" title="Green - Good condition"></div>;
      case 'Amber':
        return <div className="w-3 h-3 rounded-full bg-amber-500" title="Amber - Needs attention"></div>;
      case 'Red':
        return <div className="w-3 h-3 rounded-full bg-red-500" title="Red - Requires immediate service"></div>;
      default:
        return <div className="w-3 h-3 rounded-full bg-gray-400" title="Unknown status"></div>;
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Available Vehicles</h2>
              <p className="text-sm text-gray-600 mt-1">{formatDate(date)}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by registration..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mt-3 text-sm text-gray-600">
            <span className="font-semibold">{filteredVehicles.length}</span> vehicle{filteredVehicles.length !== 1 ? 's' : ''} available
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {groupedVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Car className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No available vehicles</p>
              {searchQuery && (
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your search
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedVehicles.map((group) => (
                <div key={group.category.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${group.color.dot}`}></div>
                    <h3 className="font-semibold text-gray-900">
                      {group.category.category_name}
                    </h3>
                    <span className="text-sm text-gray-500">
                      ({group.vehicles.length})
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className={`p-3 rounded-lg border-l-4 ${group.color.border} bg-white border border-gray-200 hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-gray-600" />
                            <button
                              onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                              className="font-bold text-gray-900 hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                            >
                              {vehicle.reg_number}
                            </button>
                          </div>
                          {getHealthIcon(vehicle.health_flag)}
                        </div>

                        {vehicle.make && vehicle.model && (
                          <div className="text-sm text-gray-600 mb-1">
                            {vehicle.make} {vehicle.model}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          {vehicle.branch_id && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>Branch ID: {vehicle.branch_id.substring(0, 8)}...</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            <span className="capitalize">{vehicle.status}</span>
                          </div>
                        </div>

                        {vehicle.current_mileage && (
                          <div className="text-xs text-gray-500 mt-1">
                            {vehicle.current_mileage.toLocaleString()} km
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Green - Good condition</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span>Amber - Needs attention</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Red - Immediate service required</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
