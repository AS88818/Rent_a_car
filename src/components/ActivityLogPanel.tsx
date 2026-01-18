import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Activity, MapPin, Heart, Info, Calendar } from 'lucide-react';
import { activityLogService } from '../services/api';
import { VehicleActivityLog } from '../types/database';

interface ActivityLogPanelProps {
  vehicleId: string;
}

export function ActivityLogPanel({ vehicleId }: ActivityLogPanelProps) {
  const [logs, setLogs] = useState<VehicleActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);

  useEffect(() => {
    loadLogs();
  }, [vehicleId, filter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const fieldFilter = filter === 'all' ? undefined : filter;
      const data = await activityLogService.getActivityLogs(vehicleId, undefined, fieldFilter);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (fieldChanged: string) => {
    switch (fieldChanged) {
      case 'health_flag':
        return <Heart className="w-4 h-4" />;
      case 'branch_id':
        return <MapPin className="w-4 h-4" />;
      case 'deleted_at':
        return <Activity className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getColor = (fieldChanged: string) => {
    switch (fieldChanged) {
      case 'health_flag':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'branch_id':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'deleted_at':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatFieldName = (field: string) => {
    const fieldNames: Record<string, string> = {
      health_flag: 'Health Status',
      branch_id: 'Location',
      deleted_at: 'Deletion',
      mot_expiry: 'MOT Expiry',
      insurance_expiry: 'Insurance Expiry',
      current_mileage: 'Mileage',
      status: 'Vehicle Status',
    };
    return fieldNames[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const displayedLogs = logs.slice(0, displayCount);
  const hasMore = logs.length > displayCount;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Activity History</h3>
          <span className="text-sm text-gray-500">({logs.length} {logs.length === 1 ? 'entry' : 'entries'})</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Changes</option>
              <option value="health_flag">Health Updates</option>
              <option value="branch_id">Location Changes</option>
            </select>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading activity logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-600">No activity logs yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`border-l-4 pl-4 py-3 ${getColor(log.field_changed)} bg-opacity-50 rounded-r-lg`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`mt-0.5 ${getColor(log.field_changed)} rounded p-1`}>
                          {getIcon(log.field_changed)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">
                              {formatFieldName(log.field_changed)}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-sm text-gray-600">
                              by {log.user_name}
                            </span>
                            <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
                              {log.user_role}
                            </span>
                          </div>
                          {(log.old_value || log.new_value) && (
                            <div className="mt-1 text-sm text-gray-700">
                              {log.old_value && (
                                <span className="line-through text-gray-500">{log.old_value}</span>
                              )}
                              {log.old_value && log.new_value && (
                                <span className="mx-2 text-gray-400">→</span>
                              )}
                              {log.new_value && (
                                <span className="font-medium">{log.new_value}</span>
                              )}
                            </div>
                          )}
                          {log.notes && (
                            <div className="mt-2 text-sm text-gray-600 bg-white bg-opacity-60 p-2 rounded">
                              {log.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />
                        <span title={new Date(log.created_at).toLocaleString()}>
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <button
                    onClick={() => setDisplayCount(prev => prev + 10)}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
