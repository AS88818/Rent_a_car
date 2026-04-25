import { useEffect, useState } from 'react';
import { X, Gauge, Loader2 } from 'lucide-react';
import { MileageLog } from '../types/database';
import { mileageService } from '../services/api';
import { formatDate } from '../lib/utils';

interface MileageHistoryModalProps {
  vehicleId: string;
  vehicleReg: string;
  onClose: () => void;
}

export function MileageHistoryModal({ vehicleId, vehicleReg, onClose }: MileageHistoryModalProps) {
  const [logs, setLogs] = useState<MileageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mileageService.getMileageLog(vehicleId)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [vehicleId]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Gauge className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Mileage History</h2>
              <p className="text-sm text-gray-600">{vehicleReg}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No mileage records found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4 text-right">Reading (km)</th>
                  <th className="pb-3 pr-4 text-right">Since Last (km)</th>
                  <th className="pb-3 pr-4 text-right">Days</th>
                  <th className="pb-3 text-right">km/day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 text-gray-900">{formatDate(log.reading_datetime)}</td>
                    <td className="py-3 pr-4 text-right font-medium text-gray-900">
                      {log.mileage_reading.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-600">
                      {log.km_since_last != null ? `+${log.km_since_last.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-600">
                      {log.days_since_last != null ? log.days_since_last : '—'}
                    </td>
                    <td className="py-3 text-right text-gray-600">
                      {log.km_per_day != null ? log.km_per_day.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500">
          {!loading && logs.length > 0 && `${logs.length} record${logs.length !== 1 ? 's' : ''} total`}
        </div>
      </div>
    </div>
  );
}
