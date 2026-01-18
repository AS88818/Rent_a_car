import { X, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Vehicle } from '../types/database';
import { PhotoUpload } from './PhotoUpload';
import { supabase } from '../lib/supabase';

interface IssueItem {
  description: string;
  priority: string;
  photos: string[];
  mileage?: number;
}

interface SnagFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vehicleId: string, issues: IssueItem[], branchId?: string) => Promise<void>;
  vehicles: Array<{ id: string; reg_number: string } & Partial<Vehicle>>;
  submitting?: boolean;
  userBranchId?: string | null;
}

interface Branch {
  id: string;
  branch_name: string;
}

export function SnagFormModal({
  isOpen,
  onClose,
  onSubmit,
  vehicles,
  submitting = false,
  userBranchId,
}: SnagFormModalProps) {
  const [vehicleId, setVehicleId] = useState('');
  const [mileage, setMileage] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [issues, setIssues] = useState<IssueItem[]>([
    { description: '', priority: '', photos: [] },
    { description: '', priority: '', photos: [] },
  ]);

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

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, branch_name')
          .order('branch_name');

        if (error) throw error;
        setBranches(data || []);
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };

    if (isOpen) {
      fetchBranches();

      if (vehicles.length === 1 && !vehicleId) {
        setVehicleId(vehicles[0].id);
        if (vehicles[0].current_mileage) {
          setMileage(String(vehicles[0].current_mileage));
        }
      }
    }
  }, [isOpen, vehicles]);

  const handleClose = () => {
    setVehicleId('');
    setMileage('');
    setSelectedBranchId('');
    setIssues([
      { description: '', priority: '', photos: [] },
      { description: '', priority: '', photos: [] },
    ]);
    onClose();
  };

  const handleAddIssue = () => {
    setIssues([...issues, { description: '', priority: '', photos: [] }]);
  };

  const handleRemoveIssue = (index: number) => {
    if (issues.length > 1) {
      setIssues(issues.filter((_, i) => i !== index));
    }
  };

  const handleIssueChange = (index: number, field: 'description' | 'priority', value: string) => {
    const newIssues = [...issues];
    newIssues[index][field] = value;
    setIssues(newIssues);
  };

  const handlePhotoUpload = (index: number, photoUrl: string) => {
    const newIssues = [...issues];
    newIssues[index].photos.push(photoUrl);
    setIssues(newIssues);
  };

  const handleRemovePhoto = (issueIndex: number, photoIndex: number) => {
    const newIssues = [...issues];
    newIssues[issueIndex].photos.splice(photoIndex, 1);
    setIssues(newIssues);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validIssues = issues.filter(issue => issue.description.trim() !== '');

    if (validIssues.length === 0) {
      return;
    }

    const mileageValue = mileage ? parseInt(mileage, 10) : undefined;
    const issuesWithMileage = validIssues.map(issue => ({
      ...issue,
      mileage: mileageValue,
    }));

    await onSubmit(vehicleId, issuesWithMileage, selectedBranchId || undefined);
    handleClose();
  };

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const needsBranchSelection = !userBranchId && selectedVehicle && !selectedVehicle.branch_id;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!submitting ? handleClose : undefined}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Report New Snags</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle <span className="text-red-500">*</span>
                </label>
                <select
                  value={vehicleId}
                  onChange={e => setVehicleId(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.reg_number}
                    </option>
                  ))}
                </select>
              </div>

              {needsBranchSelection && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={e => setSelectedBranchId(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.branch_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This vehicle is not assigned to a branch. Please select which branch this snag should be assigned to.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Mileage (Optional)
                </label>
                <input
                  type="number"
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  disabled={submitting}
                  placeholder="Enter current mileage when snag was noticed"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recording mileage helps track when issues occur and how long they take to resolve
                </p>
              </div>

              <div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Issues <span className="text-red-500">*</span>
                  </label>
                </div>

                <div className="space-y-4">
                  {issues.map((issue, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder={`Issue ${index + 1}`}
                            value={issue.description}
                            onChange={e => handleIssueChange(index, 'description', e.target.value)}
                            disabled={submitting}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                        <select
                          value={issue.priority}
                          onChange={e => handleIssueChange(index, 'priority', e.target.value)}
                          disabled={submitting}
                          className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">No Priority</option>
                          <option value="Dangerous">Dangerous</option>
                          <option value="Important">Important</option>
                          <option value="Nice to Fix">Nice to Fix</option>
                          <option value="Aesthetic">Aesthetic</option>
                        </select>
                        {issues.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIssue(index)}
                            disabled={submitting}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          <ImageIcon className="w-3 h-3 inline mr-1" />
                          Photos (optional)
                        </label>

                        {issue.photos.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {issue.photos.map((photo, photoIndex) => (
                              <div key={photoIndex} className="relative">
                                <img
                                  src={photo}
                                  alt={`Issue ${index + 1} photo ${photoIndex + 1}`}
                                  className="w-20 h-20 object-cover rounded border border-gray-300"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(index, photoIndex)}
                                  disabled={submitting}
                                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <PhotoUpload
                          onUpload={(url) => handlePhotoUpload(index, url)}
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddIssue}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                    Add Issue
                  </button>
                </div>
              </div>
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
              {submitting ? 'Reporting...' : 'Report Snags'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
