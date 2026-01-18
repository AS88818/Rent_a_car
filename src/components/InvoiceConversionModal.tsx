import { useState } from 'react';
import { X, FileText, Calendar, DollarSign } from 'lucide-react';
import { Quote, CategoryQuoteResult, InvoiceSelectedCategory, PaymentMethod } from '../types/database';
import { invoiceService, quotationService } from '../services/api';
import { showToast } from '../lib/toast';

interface InvoiceConversionModalProps {
  quote: Quote;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
}

export function InvoiceConversionModal({ quote, onClose, onSuccess }: InvoiceConversionModalProps) {
  const quoteData = quote.quote_data as { [key: string]: CategoryQuoteResult };
  const categories = Object.entries(quoteData);

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleToggleCategory = (categoryName: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryName)) {
      newSelected.delete(categoryName);
    } else {
      newSelected.add(categoryName);
    }
    setSelectedCategories(newSelected);
  };

  const calculateTotals = () => {
    const selected = categories.filter(([name]) => selectedCategories.has(name));
    const subtotal = selected.reduce((sum, [, data]) => sum + data.subtotal, 0);
    const vat = selected.reduce((sum, [, data]) => sum + data.vat, 0);
    const total = selected.reduce((sum, [, data]) => sum + data.grandTotal, 0);
    return { subtotal, vat, total };
  };

  const totals = calculateTotals();

  const handleSubmit = async () => {
    if (selectedCategories.size === 0) {
      showToast('Please select at least one vehicle category', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedCategoryData: InvoiceSelectedCategory[] = categories
        .filter(([name]) => selectedCategories.has(name))
        .map(([name, data]) => ({
          categoryName: name,
          rentalFee: data.rentalFee,
          chauffeurFee: data.chauffeurFee,
          otherFees: (quote.other_fee_1_amount || 0) + (quote.other_fee_2_amount || 0) + (quote.outside_hours_charges || 0),
          subtotal: data.subtotal,
          vat: data.vat,
          total: data.grandTotal,
          securityDeposit: data.securityDeposit,
          advancePayment: data.advancePayment,
          breakdown: `${data.breakdown.peakDays} peak days, ${data.breakdown.offPeakDays} off-peak days`,
        }));

      const totalAmount = selectedCategoryData.reduce((sum, cat) => sum + cat.total, 0);
      const advancePaymentAmount = Math.ceil((totalAmount * 0.25) / 10) * 10;
      const securityDepositAmount = selectedCategoryData.reduce((sum, cat) => sum + cat.securityDeposit, 0);

      const invoice = await invoiceService.createInvoiceFromQuote(
        quote.id,
        selectedCategoryData,
        dueDate,
        paymentMethod || undefined,
        notes || undefined,
        advancePaymentAmount,
        securityDepositAmount
      );

      showToast(`Invoice ${invoice.invoice_reference} created successfully`, 'success');
      onSuccess(invoice.id);
    } catch (error: any) {
      showToast(error.message || 'Failed to create invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Convert Quote to Invoice
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Quote Reference</p>
                <p className="font-semibold text-gray-900">{quote.quote_reference}</p>
              </div>
              <div>
                <p className="text-gray-600">Client Name</p>
                <p className="font-semibold text-gray-900">{quote.client_name}</p>
              </div>
              <div>
                <p className="text-gray-600">Rental Period</p>
                <p className="font-semibold text-gray-900">
                  {quote.start_date} to {quote.end_date}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Rental Type</p>
                <p className="font-semibold text-gray-900">
                  {quote.has_chauffeur ? 'With Chauffeur' : 'Self Drive'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Select Vehicle Categories to Invoice
            </h3>
            <div className="space-y-2">
              {categories.map(([categoryName, data]) => (
                <label
                  key={categoryName}
                  className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedCategories.has(categoryName)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(categoryName)}
                      onChange={() => handleToggleCategory(categoryName)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{categoryName}</p>
                      <p className="text-sm text-gray-600">
                        {data.breakdown.peakDays + data.breakdown.offPeakDays} days rental
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(data.grandTotal)}</p>
                    <p className="text-xs text-gray-600">incl. VAT</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {selectedCategories.size > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Invoice Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT (16%)</span>
                  <span className="font-medium text-gray-900">{formatCurrency(totals.vat)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-green-200">
                  <span className="font-semibold text-gray-900">Total Amount</span>
                  <span className="text-lg font-bold text-green-700">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Payment will be due by this date</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Payment Method (Optional)
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select payment method...</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Card</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any special notes or instructions..."
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedCategories.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating Invoice...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
