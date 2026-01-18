import { useEffect, useState } from 'react';
import { categoryService, branchService } from '../services/api';
import { VehicleCategory, Branch } from '../types/database';
import { showToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import {
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export function SettingsPage() {
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryVehicleCounts, setCategoryVehicleCounts] = useState<Record<string, number>>({});
  const [branchVehicleCounts, setBranchVehicleCounts] = useState<Record<string, number>>({});
  const [branchUserCounts, setBranchUserCounts] = useState<Record<string, number>>({});

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<VehicleCategory | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchContact, setBranchContact] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [categoriesData, branchesData] = await Promise.all([
        categoryService.getCategories(),
        branchService.getBranches(),
      ]);

      setCategories(categoriesData);
      setBranches(branchesData);

      await fetchCounts();
    } catch (error) {
      showToast('Failed to fetch settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, category_id, branch_id, deleted_at');

      const activeVehicles = vehicles?.filter(v => v.deleted_at === null) || [];

      const catCounts: Record<string, number> = {};
      const branchVCounts: Record<string, number> = {};

      activeVehicles.forEach(vehicle => {
        if (vehicle.category_id) {
          catCounts[vehicle.category_id] = (catCounts[vehicle.category_id] || 0) + 1;
        }
        if (vehicle.branch_id) {
          branchVCounts[vehicle.branch_id] = (branchVCounts[vehicle.branch_id] || 0) + 1;
        }
      });

      setCategoryVehicleCounts(catCounts);
      setBranchVehicleCounts(branchVCounts);

      const { data: users } = await supabase
        .from('users')
        .select('id, branch_id');

      const branchUCounts: Record<string, number> = {};
      users?.forEach(user => {
        if (user.branch_id) {
          branchUCounts[user.branch_id] = (branchUCounts[user.branch_id] || 0) + 1;
        }
      });

      setBranchUserCounts(branchUCounts);
    } catch (error) {
      console.error('Failed to fetch counts:', error);
    }
  };


  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        const updated = await categoryService.updateCategory(editingCategory.id, {
          category_name: categoryName,
          description: categoryDesc,
        });
        setCategories(categories.map(c => c.id === updated.id ? updated : c));
        showToast('Category updated successfully', 'success');
      } else {
        const newCategory = await categoryService.createCategory({
          category_name: categoryName,
          description: categoryDesc,
        });
        setCategories([...categories, newCategory]);
        showToast('Category added successfully', 'success');
      }

      setCategoryName('');
      setCategoryDesc('');
      setEditingCategory(null);
      setShowCategoryForm(false);
    } catch (error: any) {
      showToast(error.message || `Failed to ${editingCategory ? 'update' : 'add'} category`, 'error');
    }
  };

  const handleEditCategory = (category: VehicleCategory) => {
    setEditingCategory(category);
    setCategoryName(category.category_name);
    setCategoryDesc(category.description || '');
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: string) => {
    const vehicleCount = categoryVehicleCounts[id] || 0;

    if (vehicleCount > 0) {
      showToast(
        `Cannot delete category: ${vehicleCount} vehicle${vehicleCount !== 1 ? 's are' : ' is'} currently assigned to this category. Please reassign or delete those vehicles first.`,
        'error'
      );
      return;
    }

    try {
      await categoryService.deleteCategory(id);
      setCategories(categories.filter(c => c.id !== id));
      showToast('Category deleted successfully', 'success');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete category';
      if (errorMessage.includes('vehicle')) {
        showToast('Cannot delete: This category has vehicles assigned to it', 'error');
      } else {
        showToast(errorMessage, 'error');
      }
    }
  };

  const handleCancelCategoryForm = () => {
    setCategoryName('');
    setCategoryDesc('');
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingBranch) {
        const updated = await branchService.updateBranch(editingBranch.id, {
          branch_name: branchName,
          location: branchLocation,
          contact_info: branchContact,
        });
        setBranches(branches.map(b => b.id === updated.id ? updated : b));
        showToast('Branch updated successfully', 'success');
      } else {
        const newBranch = await branchService.createBranch({
          branch_name: branchName,
          location: branchLocation,
          contact_info: branchContact,
        });
        setBranches([...branches, newBranch]);
        showToast('Branch added successfully', 'success');
      }

      setBranchName('');
      setBranchLocation('');
      setBranchContact('');
      setEditingBranch(null);
      setShowBranchForm(false);
    } catch (error: any) {
      showToast(error.message || `Failed to ${editingBranch ? 'update' : 'add'} branch`, 'error');
    }
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchName(branch.branch_name);
    setBranchLocation(branch.location);
    setBranchContact(branch.contact_info || '');
    setShowBranchForm(true);
  };

  const handleDeleteBranch = async (id: string) => {
    const vehicleCount = branchVehicleCounts[id] || 0;
    const userCount = branchUserCounts[id] || 0;

    if (vehicleCount > 0 || userCount > 0) {
      const messages = [];
      if (vehicleCount > 0) {
        messages.push(`${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}`);
      }
      if (userCount > 0) {
        messages.push(`${userCount} user${userCount !== 1 ? 's' : ''}`);
      }
      showToast(
        `Cannot delete branch: ${messages.join(' and ')} assigned to this branch. Please reassign them first.`,
        'error'
      );
      return;
    }

    try {
      await branchService.deleteBranch(id);
      setBranches(branches.filter(b => b.id !== id));
      showToast('Branch deleted successfully', 'success');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete branch';
      if (errorMessage.includes('vehicle') || errorMessage.includes('user')) {
        showToast('Cannot delete: This branch has vehicles or users assigned to it', 'error');
      } else {
        showToast(errorMessage, 'error');
      }
    }
  };

  const handleCancelBranchForm = () => {
    setBranchName('');
    setBranchLocation('');
    setBranchContact('');
    setEditingBranch(null);
    setShowBranchForm(false);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
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
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-8">
        {/* Categories and Branches */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Vehicle Categories */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Vehicle Categories</h2>
              <button
                onClick={() => setShowCategoryForm(!showCategoryForm)}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {showCategoryForm && (
              <form onSubmit={handleAddCategory} className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {editingCategory ? 'Edit Category' : 'New Category'}
                </h3>
                <input
                  type="text"
                  placeholder="Category Name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                  >
                    {editingCategory ? 'Update' : 'Add'} Category
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCategoryForm}
                    className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {categories.map((cat) => {
                const vehicleCount = categoryVehicleCounts[cat.id] || 0;
                const canDelete = vehicleCount === 0;

                return (
                  <div key={cat.id} className="p-3 bg-gray-50 rounded border border-gray-200 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{cat.category_name}</p>
                        {vehicleCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                            {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {cat.description && <p className="text-sm text-gray-600">{cat.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (!canDelete) {
                            handleDeleteCategory(cat.id);
                          } else {
                            setConfirmAction({
                              action: () => handleDeleteCategory(cat.id),
                              message: 'Are you sure you want to delete this category? This cannot be undone.'
                            });
                          }
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          canDelete
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        title={canDelete ? 'Delete' : `Cannot delete: ${vehicleCount} vehicle(s) assigned`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branches */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Branches</h2>
              <button
                onClick={() => setShowBranchForm(!showBranchForm)}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {showBranchForm && (
              <form onSubmit={handleAddBranch} className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {editingBranch ? 'Edit Branch' : 'New Branch'}
                </h3>
                <input
                  type="text"
                  placeholder="Branch Name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
                <input
                  type="text"
                  placeholder="Contact Info (optional)"
                  value={branchContact}
                  onChange={(e) => setBranchContact(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                  >
                    {editingBranch ? 'Update' : 'Add'} Branch
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelBranchForm}
                    className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {branches.map((branch) => {
                const vehicleCount = branchVehicleCounts[branch.id] || 0;
                const userCount = branchUserCounts[branch.id] || 0;
                const canDelete = vehicleCount === 0 && userCount === 0;

                return (
                  <div key={branch.id} className="p-3 bg-gray-50 rounded border border-gray-200 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{branch.branch_name}</p>
                        {vehicleCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                            {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {userCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                            {userCount} user{userCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{branch.location}</p>
                      {branch.contact_info && <p className="text-sm text-gray-600">{branch.contact_info}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleEditBranch(branch)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (!canDelete) {
                            handleDeleteBranch(branch.id);
                          } else {
                            setConfirmAction({
                              action: () => handleDeleteBranch(branch.id),
                              message: 'Are you sure you want to delete this branch? This cannot be undone.'
                            });
                          }
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          canDelete
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        title={
                          canDelete
                            ? 'Delete'
                            : `Cannot delete: ${vehicleCount > 0 ? vehicleCount + ' vehicle(s)' : ''} ${vehicleCount > 0 && userCount > 0 ? 'and ' : ''} ${userCount > 0 ? userCount + ' user(s)' : ''} assigned`
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {confirmAction && (
        <ConfirmModal
          isOpen={!!confirmAction}
          onClose={() => {
            setConfirmAction(null);
            setShowConfirmModal(false);
          }}
          onConfirm={() => {
            confirmAction.action();
            setConfirmAction(null);
            setShowConfirmModal(false);
          }}
          message={confirmAction.message}
        />
      )}
    </div>
  );
}
