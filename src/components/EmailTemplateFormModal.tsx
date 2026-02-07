import { X, Info, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { EmailTemplate, Vehicle, ScheduleType, ScheduleUnit, TemplateCategory, VehicleCategory } from '../types/database';

interface EmailTemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (template: Partial<EmailTemplate>) => Promise<void>;
  template?: EmailTemplate | null;
  vehicles: Vehicle[];
  vehicleCategories?: VehicleCategory[];
  submitting?: boolean;
}

const BOOKING_VARIABLES = [
  '{{client_name}}',
  '{{vehicle_reg}}',
  '{{start_date}}',
  '{{start_time}}',
  '{{end_date}}',
  '{{end_time}}',
  '{{start_location}}',
  '{{end_location}}',
  '{{duration}}',
  '{{contact_number}}',
];

const INVOICE_VARIABLES = [
  '{{client_name}}',
  '{{invoice_reference}}',
  '{{total_amount}}',
  '{{payment_date}}',
  '{{payment_method}}',
];

const QUOTE_VARIABLES = [
  '{{client_name}}',
  '{{quote_reference}}',
  '{{start_date}}',
  '{{end_date}}',
  '{{duration}}',
  '{{pickup_location}}',
  '{{rental_type}}',
];

const COMPANY_VARIABLES = [
  '{{company_name}}',
  '{{company_tagline}}',
  '{{company_email}}',
  '{{company_phone_nanyuki}}',
  '{{company_phone_nairobi}}',
  '{{company_website}}',
  '{{company_address}}',
  '{{email_signature}}',
];

export function EmailTemplateFormModal({
  isOpen,
  onClose,
  onSubmit,
  template,
  vehicles,
  vehicleCategories = [],
  submitting = false,
}: EmailTemplateFormModalProps) {
  const [formData, setFormData] = useState({
    template_key: '',
    template_name: '',
    subject: '',
    body: '',
    vehicle_ids: [] as string[],
    template_category: 'booking' as TemplateCategory,
    is_active: true,
    schedule_type: 'immediate' as ScheduleType,
    schedule_value: 0,
    schedule_unit: 'hours' as ScheduleUnit,
  });

  const getCategoryName = (categoryId: string) => {
    const cat = vehicleCategories.find(c => c.id === categoryId);
    return cat?.category_name || '';
  };
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        template_key: template.template_key,
        template_name: template.template_name,
        subject: template.subject,
        body: template.body,
        vehicle_ids: template.vehicle_ids || [],
        template_category: template.template_category || 'booking',
        is_active: template.is_active,
        schedule_type: template.schedule_type,
        schedule_value: template.schedule_value,
        schedule_unit: template.schedule_unit,
      });
    } else {
      setFormData({
        template_key: '',
        template_name: '',
        subject: '',
        body: '',
        vehicle_ids: [],
        template_category: 'booking',
        is_active: true,
        schedule_type: 'immediate',
        schedule_value: 0,
        schedule_unit: 'hours',
      });
    }
  }, [template]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
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
  }, [isOpen, submitting, onClose]);

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      template_name: name,
      template_key: template ? formData.template_key : generateKey(name),
    });
  };

  const insertVariable = (variable: string, field: 'subject' | 'body') => {
    const textarea = document.getElementById(field) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData[field];
    const before = text.substring(0, start);
    const after = text.substring(end);

    setFormData({
      ...formData,
      [field]: before + variable + after,
    });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const getSchedulePreview = () => {
    if (formData.schedule_type === 'immediate') {
      return 'Sent immediately after booking is created';
    }

    const value = formData.schedule_value;
    const unit = formData.schedule_unit;
    const unitText = value === 1 ? unit.slice(0, -1) : unit;

    const timing = {
      before_start: `${value} ${unitText} before pickup`,
      after_start: `${value} ${unitText} after pickup`,
      before_end: `${value} ${unitText} before dropoff`,
      after_end: `${value} ${unitText} after dropoff`,
    }[formData.schedule_type];

    return `Sent ${timing}`;
  };

  const toggleVehicle = (vehicleId: string) => {
    setFormData({
      ...formData,
      vehicle_ids: formData.vehicle_ids.includes(vehicleId)
        ? formData.vehicle_ids.filter(id => id !== vehicleId)
        : [...formData.vehicle_ids, vehicleId]
    });
  };

  const selectAllVehicles = () => {
    setFormData({
      ...formData,
      vehicle_ids: vehicles.map(v => v.id)
    });
  };

  const clearAllVehicles = () => {
    setFormData({
      ...formData,
      vehicle_ids: []
    });
  };

  const getVariablesForCategory = (category: TemplateCategory) => {
    const categorySpecific = category === 'invoice'
      ? INVOICE_VARIABLES
      : category === 'quote'
      ? QUOTE_VARIABLES
      : BOOKING_VARIABLES;
    return [...categorySpecific, ...COMPANY_VARIABLES];
  };

  const currentVariables = getVariablesForCategory(formData.template_category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await onSubmit({
      ...formData,
      available_variables: currentVariables,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!submitting ? onClose : undefined}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {template ? 'Edit Email Template' : 'Create New Email Template'}
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Template Approval Required</p>
                  <p>
                    After creating this template, it will be saved as a draft. You'll need to submit it for
                    approval before it can be used for sending emails.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.template_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
                  placeholder="e.g., Payment Reminder"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.template_key}
                  onChange={(e) => setFormData({ ...formData, template_key: e.target.value })}
                  required
                  disabled={submitting || !!template}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:bg-gray-100 font-mono text-sm"
                  placeholder="payment_reminder"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier (lowercase, underscores only)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.template_category}
                onChange={(e) => setFormData({ ...formData, template_category: e.target.value as TemplateCategory })}
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
              >
                <option value="booking">Booking</option>
                <option value="invoice">Invoice</option>
                <option value="quote">Quote</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Determines when this template is used: booking triggers, invoice sends, or quote submissions
              </p>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicles (Optional)
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                  disabled={submitting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 text-left bg-white flex items-center justify-between"
                >
                  <span className="text-sm text-gray-700">
                    {formData.vehicle_ids.length === 0
                      ? 'All Vehicles'
                      : formData.vehicle_ids.length === vehicles.length
                      ? 'All Vehicles Selected'
                      : `${formData.vehicle_ids.length} Vehicle${formData.vehicle_ids.length > 1 ? 's' : ''} Selected`}
                  </span>
                  <X className={`w-4 h-4 transition-transform ${showVehicleDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showVehicleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-2 flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllVehicles}
                        className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllVehicles}
                        className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        onClick={() => toggleVehicle(vehicle.id)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          formData.vehicle_ids.includes(vehicle.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}>
                          {formData.vehicle_ids.includes(vehicle.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{vehicle.reg_number}</p>
                          <p className="text-xs text-gray-500">{vehicle.make} {vehicle.model}{getCategoryName(vehicle.category_id) ? ` - ${getCategoryName(vehicle.category_id)}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to apply to all vehicles, or select specific vehicles
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Schedule</label>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">When to send</label>
                  <select
                    value={formData.schedule_type}
                    onChange={(e) =>
                      setFormData({ ...formData, schedule_type: e.target.value as ScheduleType })
                    }
                    disabled={submitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
                  >
                    <option value="immediate">Immediately (when booking is created)</option>
                    <option value="before_start">Before pickup time</option>
                    <option value="after_start">After pickup time</option>
                    <option value="before_end">Before dropoff time</option>
                    <option value="after_end">After dropoff time</option>
                  </select>
                </div>

                {formData.schedule_type !== 'immediate' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Time value</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.schedule_value}
                        onChange={(e) =>
                          setFormData({ ...formData, schedule_value: parseInt(e.target.value) || 0 })
                        }
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Time unit</label>
                      <select
                        value={formData.schedule_unit}
                        onChange={(e) =>
                          setFormData({ ...formData, schedule_unit: e.target.value as ScheduleUnit })
                        }
                        disabled={submitting}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Preview:</span> {getSchedulePreview()}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject <span className="text-red-500">*</span>
              </label>
              <input
                id="subject"
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
                placeholder="Your booking confirmation"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {currentVariables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable, 'subject')}
                    disabled={submitting}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 font-mono"
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Body <span className="text-red-500">*</span>
              </label>
              <textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                required
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 font-mono text-sm"
                rows={12}
                placeholder="Dear {{client_name}},&#10;&#10;This is a reminder about your booking...&#10;&#10;Vehicle: {{vehicle_reg}}&#10;Pickup: {{start_date}} at {{start_time}}&#10;&#10;Best regards"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {currentVariables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable, 'body')}
                    disabled={submitting}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 font-mono"
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                disabled={submitting}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700">Active (template will be used once approved)</label>
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
