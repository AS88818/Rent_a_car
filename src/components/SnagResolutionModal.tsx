import { X, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Snag, MaintenanceLog, ResolutionMethod, AuthUser } from '../types/database';
import { PhotoUpload } from './PhotoUpload';

interface SnagResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (resolution: {
    snagId: string;
    resolutionMethod: ResolutionMethod;
    resolutionNotes: string;
    assignedToUserId?: string;
    checkedByUserId?: string;
    photoUrls?: string[];
    maintenanceLog?: Omit<MaintenanceLog, 'id' | 'created_at'>;
  }) => Promise<void>;
  snag: Snag | null;
  vehicleId?: string;
  currentMileage?: number;
  branchId?: string;
  submitting?: boolean;
  users?: AuthUser[];
  currentUserId?: string;
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
  users = [],
}: SnagResolutionModalProps) {
  const [resolutionMethod, setResolutionMethod] = useState<ResolutionMethod>('Repaired');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [checkedByUserId, setCheckedByUserId] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [createMaintenanceLog, setCreateMaintenanceLog] = useState(false);

  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [workCategory, setWorkCategory] = useState('');
  const [performedByUserId, setPerformedByUserId] = useState('');
  const [performedByType, setPerformedByType] = useState<'registered' | 'other'>('registered');
  const [performedByOther, setPerformedByOther] = useState('');
  const [maintenanceCheckedByUserId, setMaintenanceCheckedByUserId] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [maintenancePhotoUrls, setMaintenancePhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (currentMileage) {
      setMileage(currentMileage.toString());
    }
  }, [currentMileage]);

  // When the maintenance log checkbox is first checked, pre-populate Performed By:
  // - for unassigned snags: use whoever was selected as the resolver
  // - for already-assigned snags: use the existing assignee
  useEffect(() => {
    if (createMaintenanceLog && performedByType === 'registered' && !performedByUserId) {
      const prefillUserId = assignedToUserId || snag?.assigned_to;
      if (prefillUserId) setPerformedByUserId(prefillUserId);
    }
  }, [createMaintenanceLog, assignedToUserId, snag?.assigned_to]);

  // Mirror the top-level "Work Checked By" into the maintenance log section
  useEffect(() => {
    if (createMaintenanceLog && checkedByUserId && !maintenanceCheckedByUserId) {
      setMaintenanceCheckedByUserId(checkedByUserId);
    }
  }, [createMaintenanceLog, checkedByUserId]);

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
    setAssignedToUserId('');
    setCheckedByUserId('');
    setPhotoUrls([]);
    setCreateMaintenanceLog(false);
    setServiceDate(new Date().toISOString().split('T')[0]);
    setMileage(currentMileage?.toString() || '');
    setWorkDone('');
    setWorkCategory('');
    setPerformedByUserId('');
    setPerformedByType('registered');
    setPerformedByOther('');
    setMaintenanceCheckedByUserId('');
    setMaintenanceNotes('');
    setMaintenancePhotoUrls([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snag) return;

    const needsAssignment = !snag.assigned_to;
    if (needsAssignment && !assignedToUserId) return;

    const resolution: any = {
      snagId: snag.id,
      resolutionMethod,
      resolutionNotes,
      assignedToUserId: needsAssignment ? assignedToUserId : undefined,
      checkedByUserId: checkedByUserId || undefined,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    };

    if (createMaintenanceLog && vehicleId && branchId) {
      let performedByName = '';
      let performedByUserIdValue: string | undefined = undefined;
      if (performedByType === 'other') {
        if (!performedByOther.trim()) return;
        performedByName = performedByOther.trim();
      } else {
        if (!performedByUserId) return;
        const performedByUser = users.find(u => u.id === performedByUserId);
        performedByName = performedByUser?.full_name || '';
        performedByUserIdValue = performedByUserId;
      }
      resolution.maintenanceLog = {
        vehicle_id: vehicleId,
        service_date: serviceDate,
        mileage: parseInt(mileage),
        work_done: workDone,
        performed_by: performedByName,
        performed_by_user_id: performedByUserIdValue,
        checked_by_user_id: maintenanceCheckedByUserId || undefined,
        notes: maintenanceNotes || undefined,
        photo_urls: maintenancePhotoUrls.length > 0 ? maintenancePhotoUrls : undefined,
        branch_id: branchId,
        work_items: [{ work_description: workDone, work_category: workCategory, photos: maintenancePhotoUrls }],
      };
    }

    await onSubmit(resolution);
    handleClose();
  };

  // Users available for "checked by" — exclude the resolver (can't check own work)
  const resolverUserId = snag?.assigned_to || assignedToUserId;
  const checkableUsers = users.filter(u => u.id !== resolverUserId);

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

            {!snag.assigned_to && users.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  This snag has no assignee. Who resolved it?
                </p>
                <select
                  value={assignedToUserId}
                  onChange={e => setAssignedToUserId(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none disabled:opacity-50 text-base bg-white"
                >
                  <option value="">— Select who resolved this snag —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution Method <span className="text-red-500">*</span>
              </label>
              <select
                value={resolutionMethod}
                onChange={e => setResolutionMethod(e.target.value as ResolutionMethod)}
                required
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none text-base"
              />
            </div>

            {checkableUsers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Checked By <span className="text-gray-400 text-xs font-normal">(optional — cannot be the resolver)</span>
                </label>
                <select
                  value={checkedByUserId}
                  onChange={e => setCheckedByUserId(e.target.value)}
                  disabled={submitting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  <option value="">— Not checked yet —</option>
                  {checkableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resolution Photos (Optional)
              </label>
              <PhotoUpload
                onUpload={url => setPhotoUrls(prev => [...prev, url])}
                disabled={submitting}
              />
              {photoUrls.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">{photoUrls.length} photo(s) uploaded</p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMaintenanceLog}
                    onChange={e => setCreateMaintenanceLog(e.target.checked)}
                    disabled={submitting}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 text-base"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 text-base"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 text-base"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 resize-none text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={workCategory}
                      onChange={e => setWorkCategory(e.target.value)}
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 text-base bg-white"
                    >
                      <option value="">No Category</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Body">Body</option>
                      <option value="Cooling">Cooling</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Engine / Fuel">Engine / Fuel</option>
                      <option value="Gearbox">Gearbox</option>
                      <option value="Service">Service</option>
                      <option value="Steering">Steering</option>
                      <option value="Suspension">Suspension</option>
                      <option value="Wheels">Wheels</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Performed By <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={performedByType === 'other' ? 'other' : performedByUserId}
                      onChange={e => {
                        const value = e.target.value;
                        if (value === 'other') {
                          setPerformedByType('other');
                          setPerformedByUserId('');
                        } else {
                          setPerformedByType('registered');
                          setPerformedByUserId(value);
                          setPerformedByOther('');
                        }
                      }}
                      required={createMaintenanceLog}
                      disabled={submitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 text-base bg-white"
                    >
                      <option value="">— Select mechanic or service provider —</option>
                      <optgroup label="Registered Users">
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                      </optgroup>
                      <optgroup label="External">
                        <option value="other">Other (External)</option>
                      </optgroup>
                    </select>

                    {performedByType === 'other' && (
                      <input
                        type="text"
                        placeholder="Enter name or service center"
                        value={performedByOther}
                        onChange={e => setPerformedByOther(e.target.value)}
                        required={createMaintenanceLog}
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 text-base mt-2"
                      />
                    )}
                  </div>

                  {checkableUsers.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Work Checked By <span className="text-gray-400 text-xs font-normal">(optional)</span>
                      </label>
                      <select
                        value={maintenanceCheckedByUserId}
                        onChange={e => setMaintenanceCheckedByUserId(e.target.value)}
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 text-base"
                      >
                        <option value="">— Not checked yet —</option>
                        {checkableUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  )}

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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 resize-none text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maintenance Photos
                    </label>
                    <PhotoUpload
                      onUpload={url => setMaintenancePhotoUrls(prev => [...prev, url])}
                      disabled={submitting}
                    />
                    {maintenancePhotoUrls.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">{maintenancePhotoUrls.length} photo(s) uploaded</p>
                    )}
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
