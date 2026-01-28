import { useEffect, useState } from 'react';
import { quotationService } from '../services/api';
import { CategoryPricing, PricingConfig } from '../types/database';
import { showToast } from '../lib/toast';
import { DollarSign, Save, Edit, X, TrendingUp, Percent, RefreshCw } from 'lucide-react';

export function PricingAdminPage() {
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [categoryPricing, setCategoryPricing] = useState<CategoryPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingGlobal, setEditingGlobal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [globalForm, setGlobalForm] = useState({
    chauffeur_fee_per_day: 0,
    vat_percentage: 0,
  });

  const [categoryForm, setCategoryForm] = useState<Partial<CategoryPricing>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [config, pricing] = await Promise.all([
        quotationService.getPricingConfig(),
        quotationService.getCategoryPricing(),
      ]);

      setPricingConfig(config);
      setCategoryPricing(pricing);

      if (config) {
        setGlobalForm({
          chauffeur_fee_per_day: config.chauffeur_fee_per_day,
          vat_percentage: config.vat_percentage * 100,
        });
      }
    } catch (error) {
      showToast('Failed to fetch pricing data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
      showToast('Data refreshed', 'success');
    } catch (error) {
      showToast('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveGlobal = async () => {
    if (!pricingConfig) return;

    setSubmitting(true);
    try {
      const updated = await quotationService.updatePricingConfig(pricingConfig.id, {
        chauffeur_fee_per_day: globalForm.chauffeur_fee_per_day,
        vat_percentage: globalForm.vat_percentage / 100,
      });

      setPricingConfig(updated);
      setEditingGlobal(false);
      showToast('Global pricing updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update pricing', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCategory = (category: CategoryPricing) => {
    setEditingCategory(category.id);
    setCategoryForm({
      off_peak_rate: category.off_peak_rate,
      peak_rate: category.peak_rate,
      self_drive_deposit: category.self_drive_deposit,
      tier1_days: category.tier1_days,
      tier1_discount: category.tier1_discount * 100,
      tier2_days: category.tier2_days,
      tier2_discount: category.tier2_discount * 100,
      tier3_days: category.tier3_days,
      tier3_discount: category.tier3_discount * 100,
      tier4_days: category.tier4_days,
      tier4_discount: category.tier4_discount * 100,
      tier5_days: category.tier5_days,
      tier5_discount: category.tier5_discount * 100,
      tier6_days: category.tier6_days,
      tier6_discount: category.tier6_discount * 100,
      tier7_days: category.tier7_days,
      tier7_discount: category.tier7_discount * 100,
      tier8_days: category.tier8_days,
      tier8_discount: category.tier8_discount * 100,
      tier9_days: category.tier9_days,
      tier9_discount: category.tier9_discount * 100,
    });
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;

    const errors = validateTiers();
    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }

    setSubmitting(true);
    try {
      const updates: Partial<CategoryPricing> = {
        off_peak_rate: categoryForm.off_peak_rate,
        peak_rate: categoryForm.peak_rate,
        self_drive_deposit: categoryForm.self_drive_deposit,
        tier1_days: categoryForm.tier1_days,
        tier1_discount: (categoryForm.tier1_discount || 0) / 100,
        tier2_days: categoryForm.tier2_days,
        tier2_discount: (categoryForm.tier2_discount || 0) / 100,
        tier3_days: categoryForm.tier3_days,
        tier3_discount: (categoryForm.tier3_discount || 0) / 100,
        tier4_days: categoryForm.tier4_days,
        tier4_discount: (categoryForm.tier4_discount || 0) / 100,
        tier5_days: categoryForm.tier5_days,
        tier5_discount: (categoryForm.tier5_discount || 0) / 100,
        tier6_days: categoryForm.tier6_days,
        tier6_discount: (categoryForm.tier6_discount || 0) / 100,
        tier7_days: categoryForm.tier7_days,
        tier7_discount: (categoryForm.tier7_discount || 0) / 100,
        tier8_days: categoryForm.tier8_days,
        tier8_discount: (categoryForm.tier8_discount || 0) / 100,
        tier9_days: categoryForm.tier9_days,
        tier9_discount: (categoryForm.tier9_discount || 0) / 100,
      };

      const updated = await quotationService.updateCategoryPricing(editingCategory, updates);

      setCategoryPricing(categoryPricing.map(c => c.id === editingCategory ? updated : c));
      setEditingCategory(null);
      setCategoryForm({});
      showToast('Category pricing updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update category pricing', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const validateTiers = () => {
    const errors: string[] = [];
    const tiers = [
      categoryForm.tier1_days || 0,
      categoryForm.tier2_days || 0,
      categoryForm.tier3_days || 0,
      categoryForm.tier4_days || 0,
      categoryForm.tier5_days || 0,
      categoryForm.tier6_days || 0,
      categoryForm.tier7_days || 0,
      categoryForm.tier8_days || 0,
      categoryForm.tier9_days || 0,
    ];

    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i] > 0 && tiers[i] <= tiers[i - 1]) {
        errors.push(`Tier ${i + 1} days (${tiers[i]}) must be greater than Tier ${i} days (${tiers[i - 1]})`);
      }
    }

    return errors;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pricing data...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pricing Administration</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-blue-600" />
              Global Pricing Configuration
            </h2>
            {!editingGlobal && (
              <button
                onClick={() => setEditingGlobal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>

          {pricingConfig && (
            <div className="space-y-4">
              {editingGlobal ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chauffeur Fee per Day (KES)
                    </label>
                    <input
                      type="number"
                      value={globalForm.chauffeur_fee_per_day}
                      onChange={(e) => setGlobalForm({ ...globalForm, chauffeur_fee_per_day: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VAT Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={globalForm.vat_percentage}
                      onChange={(e) => setGlobalForm({ ...globalForm, vat_percentage: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveGlobal}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingGlobal(false);
                        setGlobalForm({
                          chauffeur_fee_per_day: pricingConfig.chauffeur_fee_per_day,
                          vat_percentage: pricingConfig.vat_percentage * 100,
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Chauffeur Fee per Day</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(pricingConfig.chauffeur_fee_per_day)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">VAT Percentage</p>
                    <p className="text-2xl font-bold text-gray-900">{(pricingConfig.vat_percentage * 100).toFixed(0)}%</p>
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500 mt-4">
                Last updated: {new Date(pricingConfig.updated_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            Category Pricing
          </h2>

          <div className="space-y-4">
            {categoryPricing.map((category) => (
              <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{category.category_name}</h3>
                  {editingCategory !== category.id && (
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>

                {editingCategory === category.id ? (
                  <div className="p-4 space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Base Rates</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Off-Peak Rate (KES/day)
                          </label>
                          <input
                            type="number"
                            value={categoryForm.off_peak_rate || ''}
                            onChange={(e) => setCategoryForm({ ...categoryForm, off_peak_rate: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Peak Rate (KES/day)
                          </label>
                          <input
                            type="number"
                            value={categoryForm.peak_rate || ''}
                            onChange={(e) => setCategoryForm({ ...categoryForm, peak_rate: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Refundable Security Deposit (KES)
                            <span className="block text-xs font-normal text-gray-500 mt-1">
                              Self-drive only • Held against damage • Separate from 25% advance payment
                            </span>
                          </label>
                          <input
                            type="number"
                            value={categoryForm.self_drive_deposit || ''}
                            onChange={(e) => setCategoryForm({ ...categoryForm, self_drive_deposit: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Discount Tiers</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) => (
                          <div key={tier} className="border border-gray-200 rounded p-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Tier {tier}</p>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Days</label>
                                <input
                                  type="number"
                                  value={categoryForm[`tier${tier}_days` as keyof CategoryPricing] as number || ''}
                                  onChange={(e) => setCategoryForm({ ...categoryForm, [`tier${tier}_days`]: parseFloat(e.target.value) })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Discount (%)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={categoryForm[`tier${tier}_discount` as keyof CategoryPricing] as number || ''}
                                  onChange={(e) => setCategoryForm({ ...categoryForm, [`tier${tier}_discount`]: parseFloat(e.target.value) })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveCategory}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {submitting ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryForm({});
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 rounded p-3">
                        <p className="text-xs text-gray-600 mb-1">Off-Peak Rate</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(category.off_peak_rate)}/day</p>
                      </div>
                      <div className="bg-green-50 rounded p-3">
                        <p className="text-xs text-gray-600 mb-1">Peak Rate</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(category.peak_rate)}/day</p>
                      </div>
                      <div className="bg-yellow-50 rounded p-3">
                        <p className="text-xs text-gray-600 mb-1">Security Deposit (Refundable)</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(category.self_drive_deposit)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) => {
                        const days = category[`tier${tier}_days` as keyof CategoryPricing] as number;
                        const discount = (category[`tier${tier}_discount` as keyof CategoryPricing] as number) * 100;
                        return (
                          <div key={tier} className="text-center bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-600">T{tier}</p>
                            <p className="text-sm font-medium text-gray-900">{days}d</p>
                            <p className="text-xs text-green-600">{discount.toFixed(0)}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
