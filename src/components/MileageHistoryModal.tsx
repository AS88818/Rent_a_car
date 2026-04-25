import { useEffect, useState } from 'react';
import { X, Gauge, Loader2, Wrench, Edit, AlertTriangle } from 'lucide-react';
import { MileageLog, MaintenanceLog, Snag } from '../types/database';
import { mileageService } from '../services/api';
import { formatDate } from '../lib/utils';

interface MileageHistoryModalProps {
  vehicleId: string;
  vehicleReg: string;
  maintenanceLogs: MaintenanceLog[];
  snags: Snag[];
  onClose: () => void;
}

type MileageEntry = {
  date: string;
  mileage: number;
  kmSinceLast?: number;
  daysSinceLast?: number;
  kmPerDay?: number;
  source: 'log' | 'maintenance' | 'snag';
  label?: string;
};

function buildEntries(logs: MileageLog[], maintenanceLogs: MaintenanceLog[], snags: Snag[]): MileageEntry[] {
  const entries: MileageEntry[] = [
    ...logs.map((l) => ({
      date: l.reading_datetime,
      mileage: l.mileage_reading,
      kmSinceLast: l.km_since_last,
      daysSinceLast: l.days_since_last,
      kmPerDay: l.km_per_day,
      source: 'log' as const,
    })),
    ...maintenanceLogs
      .filter((m) => m.mileage != null && m.mileage > 0)
      .map((m) => ({
        date: m.service_date,
        mileage: m.mileage,
        source: 'maintenance' as const,
        label: m.work_done,
      })),
    ...snags
      .filter((s) => s.mileage_reported != null && s.mileage_reported > 0)
      .map((s) => ({
        date: s.date_opened,
        mileage: s.mileage_reported!,
        source: 'snag' as const,
        label: s.description,
      })),
  ];

  // Sort newest first
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate km/day deltas for entries that don't have them
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].kmSinceLast == null && i + 1 < entries.length) {
      const newer = entries[i];
      const older = entries[i + 1];
      const kmDiff = newer.mileage - older.mileage;
      const daysDiff = Math.round(
        (new Date(newer.date).getTime() - new Date(older.date).getTime()) / 86400000
      );
      if (kmDiff >= 0) {
        entries[i] = {
          ...entries[i],
          kmSinceLast: kmDiff,
          daysSinceLast: daysDiff,
          kmPerDay: daysDiff > 0 ? parseFloat((kmDiff / daysDiff).toFixed(1)) : undefined,
        };
      }
    }
  }

  return entries;
}

export function MileageHistoryModal({ vehicleId, vehicleReg, maintenanceLogs, snags, onClose }: MileageHistoryModalProps) {
  const [logs, setLogs] = useState<MileageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mileageService.getMileageLog(vehicleId)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [vehicleId]);

  const entries = loading ? [] : buildEntries(logs, maintenanceLogs, snags);

  const SourceBadge = ({ entry }: { entry: MileageEntry }) => {
    if (entry.source === 'maintenance') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded" title={entry.label}>
          <Wrench className="w-3 h-3" />
          Service
        </span>
      );
    }
    if (entry.source === 'snag') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded" title={entry.label}>
          <AlertTriangle className="w-3 h-3" />
          Snag
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
        <Edit className="w-3 h-3" />
        Manual
      </span>
    );
  };

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
          ) : entries.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No mileage records found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-3 text-right">Reading (km)</th>
                  <th className="pb-3 pr-3 text-right">Since Last</th>
                  <th className="pb-3 pr-3 text-right">Days</th>
                  <th className="pb-3 pr-3 text-right">km/day</th>
                  <th className="pb-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 text-gray-900">{formatDate(entry.date)}</td>
                    <td className="py-3 pr-3 text-right font-medium text-gray-900">
                      {entry.mileage.toLocaleString()}
                    </td>
                    <td className="py-3 pr-3 text-right text-gray-600">
                      {entry.kmSinceLast != null ? `+${entry.kmSinceLast.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 pr-3 text-right text-gray-600">
                      {entry.daysSinceLast != null ? entry.daysSinceLast : '—'}
                    </td>
                    <td className="py-3 pr-3 text-right text-gray-600">
                      {entry.kmPerDay != null ? entry.kmPerDay : '—'}
                    </td>
                    <td className="py-3">
                      <SourceBadge entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500">
          {!loading && entries.length > 0 && `${entries.length} record${entries.length !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  );
}
