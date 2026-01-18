import { X, CheckCircle, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Snag, MaintenanceLog, ResolutionMethod } from '../types/database';
import { PhotoUpload } from './PhotoUpload';

interface SnagResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (resolution: {
    snagId: string;
    resolutionMethod: ResolutionMethod;
    resolutionNotes: string;
    photoUrls?: string[];
    maintenanceLog?: Omit<MaintenanceLog, 'id' | 'created_at'>;
  }) => Promise<void>;
  snag: Snag | null;
  vehicleId?: string;
  currentMileage?: number;
  branchId?: string;
  submitting?: boolean;
}

export function SnagResolutionModal({
  isOpen,
  onClose,
  onSubmit,
  snag,
  vehicleId,
  currentMileage,
  branchId,
  submitting = false,
}: SnagResolutionModalProps) {
  const [resolutionMethod, setResolutionMethod] = useState<ResolutionMethod>('Repaired');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [createMaintenanceLog, setCreateMaintenanceLog] = useState(false);

  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [maintenancePhotoUrls, setMaintenancePhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (currentMileage) {
      setMileage(currentMileage.toString());
    }
  }, [currentMileage]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, submitting]);

  const handleClose = () => {
    setResolutionMethod('Repaired');
    setResolutionNotes('');
    setPhotoUrls([]);
    setCreateMaintenanceLog(false);
    setServiceDate(new Date().toISOString().split('T')[0]);
    setMileage(currentMileage?.toString() || '');
    setWorkDone('');
    setPerformedBy('');
    setMaintenanceNotes('');
    setMaintenancePhotoUrls([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snag) return;

    const resolution: any = {
      snagId: snag.id,
      resolutionMethod,
      resolutionNotes,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    };

    if (createMaintenanceLog && vehicleId && branchId) {
      resolution.maintenanceLog = {
        vehicle_id: vehicleId,
        service_date: serviceDate,
        mileage: parseInt(mileage),
        work_done: workDone,
        performed_by: performedBy,
        notes: maintenanceNotes || undefined,
        photo_urls: maintenancePhotoUrls.length > 0 ? maintenancePhotoUrls : undefined,
        branch_id: branchId,
      };
    }

    await onSubmit(resolution);
    handleClose();
  };

  if (!isOpen || !snag) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!submitting ? handleClose : undefined}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Resolve Snag</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Snag:</p>
              <p className="text-sm text-gray-900 font-medium">{snag.description}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution Method <span className="text-red-500">*</span>
              </label>
              <select
                value={resolutionMethod}
                onChange={e => setResolutionMethod(e.target.value as ResolutionMethod)}
                required
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Repaired">Repaired</option>
                <option value="Replaced Part">Replaced Part</option>
                <option value="Third Party Service">Third Party Service</option>
                <option value="No Action Needed">No Action Needed</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution Details <span className="text-red-500">*</span>
              </label>
              <textarea
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                required
                disabled={submitting}
                rows={4}
                placeholder="Describe how the snag was resolved..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resolution Photos (Optional)
              </label>
              <PhotoUpload
                onPhotosUploaded={setPhotoUrls}
                bucketName="maintenance-photos"
                disabled={submitting}
              />
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMaintenanceLog}
                    onChange={e => setCreateMaintenanceLog(e.target.checked)}
                    disabled={submitting}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Maintenance Log Entry
                  </span>
                </label>
              </div>

              {createMaintenanceLog && (
                <div className="space-y-4 bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={serviceDate}
                        onChange={e => setServiceDate(e.target.value)}
                        required={createMaintenanceLog}
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mileage <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={mileage}
                        onChange={e => setMileage(e.target.value)}
                        required={createMaintenanceLog}
                        disabled={submitting}
                        min="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Work Done <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={workDone}
                      onChange={e => setWorkDone(e.target.value)}
                      required={createMaintenanceLog}
                      disabled={submitting}
                      rows={2}
                      placeholder="Describe the work performed..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Performed By <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={performedBy}
                      onChange={e => setPerformedBy(e.target.value)}
                      required={createMaintenanceLog}
                      disabled={submitting}
                      placeholder="Mechanic or service provider name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      value={maintenanceNotes}
                      onChange={e => setMaintenanceNotes(e.target.value)}
                      disabled={submitting}
                      rows={2}
                      placeholder="Any additional notes..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maintenance Photos
                    </label>
                    <PhotoUpload
                      onPhotosUploaded={setMaintenancePhotoUrls}
                      bucketName="maintenance-photos"
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Resolving...' : 'Resolve & Close Snag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
