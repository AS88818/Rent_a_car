import { ChevronDown, ChevronUp, AlertTriangle, Wrench, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VehicleWithSnagCount, Snag } from '../types/database';
import { formatDate, getPriorityColor } from '../lib/utils';

interface VehicleSnagCardProps {
  vehicle: VehicleWithSnagCount;
  snags: Snag[];
  onEditSnag: (snag: Snag) => void;
  onDeleteSnag: (snag: Snag) => void;
  onAssignSnag: (snag: Snag) => void;
  onResolveSnag: (snag: Snag) => void;
  showClosedSnags?: boolean;
}

export function VehicleSnagCard({
  vehicle,
  snags,
  onEditSnag,
  onDeleteSnag,
  onAssignSnag,
  onResolveSnag,
  showClosedSnags = false,
}: VehicleSnagCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const getHealthBadgeColor = (health: string) => {
    switch (health) {
      case 'Excellent':
        return 'bg-green-100 text-green-800';
      case 'OK':
        return 'bg-yellow-100 text-yellow-800';
      case 'Grounded':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const vehicleSnags = snags.filter(s => {
    if (s.vehicle_id !== vehicle.id) return false;

    if (s.deleted_at) {
      return true;
    }

    return showClosedSnags ? s.status === 'Closed' : s.status === 'Open';
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/vehicles/${vehicle.id}`);
                }}
                className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                {vehicle.reg_number}
              </button>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${getHealthBadgeColor(vehicle.health_flag)}`}>
                {vehicle.health_flag}
              </span>
              {vehicle.days_to_next_booking !== undefined && (
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <Calendar className="w-3 h-3" />
                  {vehicle.days_to_next_booking === 0
                    ? 'Today'
                    : vehicle.days_to_next_booking === 1
                    ? 'Tomorrow'
                    : `${vehicle.days_to_next_booking} days`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                {vehicle.snag_counts.total} snag{vehicle.snag_counts.total !== 1 ? 's' : ''}
              </span>
              {vehicle.snag_counts.dangerous > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {vehicle.snag_counts.dangerous} Dangerous
                </span>
              )}
              {vehicle.snag_counts.important > 0 && (
                <span className="text-orange-600">
                  {vehicle.snag_counts.important} Important
                </span>
              )}
              {vehicle.snag_counts.nice_to_fix > 0 && (
                <span className="text-yellow-600">
                  {vehicle.snag_counts.nice_to_fix} Nice to Fix
                </span>
              )}
              {vehicle.snag_counts.aesthetic > 0 && (
                <span className="text-blue-600">
                  {vehicle.snag_counts.aesthetic} Aesthetic
                </span>
              )}
              {vehicle.snag_counts.unallocated > 0 && (
                <span className="text-gray-500">
                  {vehicle.snag_counts.unallocated} Unallocated
                </span>
              )}
            </div>
          </div>

          <button className="p-1 hover:bg-gray-200 rounded transition-colors">
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {expanded && vehicleSnags.length > 0 && (
        <div className="border-t border-gray-200">
          <div className="p-4 space-y-3">
            {vehicleSnags.map(snag => (
              <div
                key={snag.id}
                className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {snag.priority && (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(snag.priority)}`}>
                          {snag.priority}
                        </span>
                      )}
                      {snag.deleted_at ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-semibold">
                          Deleted
                        </span>
                      ) : snag.status === 'Closed' ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-semibold">
                          Closed
                        </span>
                      ) : snag.assigned_to ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                          Assigned
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-900 mb-1">{snag.description}</p>
                    <p className="text-xs text-gray-500">
                      Opened: {formatDate(snag.date_opened)}
                      {snag.mileage_reported && (
                        <>
                          {` • Reported at: ${snag.mileage_reported.toLocaleString()} km`}
                          {vehicle.current_mileage && vehicle.current_mileage > snag.mileage_reported && (
                            <span className="text-orange-600 font-medium">
                              {` (+${(vehicle.current_mileage - snag.mileage_reported).toLocaleString()} km ago)`}
                            </span>
                          )}
                        </>
                      )}
                      {snag.deleted_at && ` • Deleted: ${formatDate(snag.deleted_at)}${snag.deleted_by_user?.full_name ? ` by ${snag.deleted_by_user.full_name}` : ''}`}
                      {snag.date_closed && !snag.deleted_at && ` • Closed: ${formatDate(snag.date_closed)}`}
                      {snag.assignment_deadline && !snag.date_closed && !snag.deleted_at && ` • Deadline: ${formatDate(snag.assignment_deadline)}`}
                    </p>
                  </div>
                </div>

                {snag.status === 'Open' && !snag.deleted_at && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSnag(snag);
                      }}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignSnag(snag);
                      }}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                    >
                      {snag.assigned_to ? 'Reassign' : 'Assign'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (snag.assigned_to) {
                          onResolveSnag(snag);
                        }
                      }}
                      disabled={!snag.assigned_to}
                      title={!snag.assigned_to ? 'Snag must be assigned before it can be resolved' : 'Resolve this snag'}
                      className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                        snag.assigned_to
                          ? 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Wrench className="w-3 h-3" />
                      Resolve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSnag(snag);
                      }}
                      className="px-3 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && vehicleSnags.length === 0 && (
        <div className="border-t border-gray-200 p-4 text-center text-sm text-gray-500">
          No open snags for this vehicle
        </div>
      )}
    </div>
  );
}
