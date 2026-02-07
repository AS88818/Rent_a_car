import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoiceService, quotationService } from '../services/api';
import { Invoice, PaymentStatus, PaymentMethod } from '../types/database';
import { showToast } from '../lib/toast';
import { generateInvoicePDF, companySettingsToPDFInfo } from '../lib/pdf-utils';
import { useCompanySettings } from '../lib/company-settings-context';
import {
  FileText,
  Filter,
  Search,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Calendar,
  Download,
  X,
  Mail,
  RefreshCw,
} from 'lucide-react';

export function InvoicesPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const { settings } = useCompanySettings();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, paymentMethodFilter, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    if (highlightId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === highlightId);
      if (invoice) {
        setSelectedInvoice(invoice);
      }
    }
  }, [highlightId, invoices]);

  const fetchInvoices = async () => {
    try {
      const data = await invoiceService.getInvoices({
        status: statusFilter,
        paymentMethod: paymentMethodFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        searchQuery: searchQuery || undefined,
      });
      setInvoices(data);
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchInvoices();
      showToast('Data refreshed', 'success');
    } catch (error) {
      showToast('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedInvoice) return;

    setMarkingPaid(true);
    try {
      await invoiceService.updateInvoiceStatus(
        selectedInvoice.id,
        'Paid',
        paymentDate,
        paymentMethod,
        paymentNotes || undefined
      );

      showToast('Invoice marked as paid', 'success');
      setShowMarkPaidModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error: any) {
      showToast(error.message || 'Failed to update invoice', 'error');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      await invoiceService.deleteInvoice(invoiceId);
      showToast('Invoice deleted successfully', 'success');
      fetchInvoices();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete invoice', 'error');
    }
  };

  const handleDownloadPDF = (invoice: Invoice) => {
    try {
      generateInvoicePDF(invoice, companySettingsToPDFInfo(settings));
      showToast('PDF downloaded successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to generate PDF', 'error');
    }
  };

  const handleSendEmail = async (invoice: Invoice) => {
    if (!invoice.client_email) {
      showToast('This invoice has no client email address', 'error');
      return;
    }

    if (invoice.payment_status !== 'Paid') {
      showToast('Only paid invoices can be emailed as receipts', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      await invoiceService.sendInvoiceReceipt(invoice.id);
      showToast(`Receipt sent to ${invoice.client_email}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to send email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const stats = {
    total: invoices.length,
    pending: invoices.filter(inv => inv.payment_status === 'Pending').length,
    paid: invoices.filter(inv => inv.payment_status === 'Paid').length,
    overdue: invoices.filter(inv => inv.payment_status === 'Overdue').length,
    pendingAmount: invoices
      .filter(inv => inv.payment_status === 'Pending')
      .reduce((sum, inv) => sum + inv.total_amount, 0),
    paidAmount: invoices
      .filter(inv => inv.payment_status === 'Paid')
      .reduce((sum, inv) => sum + inv.total_amount, 0),
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'Pending':
        return <Clock className="w-4 h-4" />;
      case 'Overdue':
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium text-blue-900">Total Invoices</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-yellow-600" />
            <p className="text-sm font-medium text-yellow-900">Pending</p>
          </div>
          <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
          <p className="text-xs text-yellow-700 mt-1">{formatCurrency(stats.pendingAmount)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">Paid</p>
          </div>
          <p className="text-2xl font-bold text-green-900">{stats.paid}</p>
          <p className="text-xs text-green-700 mt-1">{formatCurrency(stats.paidAmount)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-medium text-red-900">Overdue</p>
          </div>
          <p className="text-2xl font-bold text-red-900">{stats.overdue}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Client name or reference..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {(searchQuery || statusFilter !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setDateFrom('');
              setDateTo('');
            }}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={highlightId === invoice.id ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.invoice_reference}</div>
                      {invoice.quote_id && (
                        <div className="text-xs text-gray-500">From quote</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{invoice.client_name}</div>
                      {invoice.client_email && (
                        <div className="text-xs text-gray-500">{invoice.client_email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.payment_status)}`}>
                        {getStatusIcon(invoice.payment_status)}
                        {invoice.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {invoice.payment_status !== 'Paid' && (
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowMarkPaidModal(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Mark as Paid"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && !showMarkPaidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto print-content">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between no-print">
              <h2 className="text-xl font-semibold text-gray-900">Invoice Details</h2>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Invoice Reference</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.invoice_reference}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedInvoice.payment_status)}`}>
                    {getStatusIcon(selectedInvoice.payment_status)}
                    {selectedInvoice.payment_status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Client Name</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.client_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Client Email</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.client_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Invoice Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedInvoice.invoice_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedInvoice.due_date).toLocaleDateString()}
                  </p>
                </div>
                {selectedInvoice.payment_method && (
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className="font-semibold text-gray-900">{selectedInvoice.payment_method}</p>
                  </div>
                )}
                {selectedInvoice.payment_date && (
                  <div>
                    <p className="text-sm text-gray-600">Payment Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(selectedInvoice.payment_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Items</h3>
                <div className="space-y-2">
                  {selectedInvoice.selected_categories.map((cat, idx) => (
                    <div key={idx} className="bg-gray-50 rounded p-3">
                      <p className="font-medium text-gray-900">{cat.categoryName}</p>
                      <p className="text-sm text-gray-600 mt-1">{cat.breakdown}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div>
                          <span className="text-gray-600">Rental Fee:</span>
                          <span className="ml-2 font-medium">{formatCurrency(cat.rentalFee)}</span>
                        </div>
                        {cat.chauffeurFee > 0 && (
                          <div>
                            <span className="text-gray-600">Chauffeur Fee:</span>
                            <span className="ml-2 font-medium">{formatCurrency(cat.chauffeurFee)}</span>
                          </div>
                        )}
                        {cat.otherFees > 0 && (
                          <div>
                            <span className="text-gray-600">Other Fees:</span>
                            <span className="ml-2 font-medium">{formatCurrency(cat.otherFees)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <span className="ml-2 font-semibold">{formatCurrency(cat.total)}</span>
                        </div>
                      </div>
                      {cat.deposit > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                            <span className="text-sm text-amber-800 font-medium">
                              Refundable Deposit: {formatCurrency(cat.deposit)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">VAT (16%)</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.vat)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="font-semibold text-gray-900">Total Amount</span>
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(selectedInvoice.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-gray-900">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-2 justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                {selectedInvoice.payment_status === 'Paid' && (
                  <button
                    onClick={() => handleSendEmail(selectedInvoice)}
                    disabled={sendingEmail || !selectedInvoice.client_email}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!selectedInvoice.client_email ? 'No email address for this invoice' : 'Send receipt to client'}
                  >
                    <Mail className="w-4 h-4" />
                    {sendingEmail ? 'Sending...' : 'Email Receipt'}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {selectedInvoice.payment_status !== 'Paid' && (
                  <button
                    onClick={() => setShowMarkPaidModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Mark as Paid
                  </button>
                )}
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMarkPaidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Mark Invoice as Paid</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Invoice: {selectedInvoice.invoice_reference}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(selectedInvoice.total_amount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any payment notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowMarkPaidModal(false);
                  setPaymentDate(new Date().toISOString().split('T')[0]);
                  setPaymentMethod('Cash');
                  setPaymentNotes('');
                }}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {markingPaid ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
