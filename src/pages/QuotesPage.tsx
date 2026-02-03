import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  Receipt,
  Calendar,
  AlertCircle,
  Edit,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { quotationService } from '../services/api';
import { showToast } from '../lib/toast';
import { InvoiceConversionModal } from '../components/InvoiceConversionModal';
import { AcceptQuoteModal } from '../components/AcceptQuoteModal';

interface Quote {
  id: string;
  client_name: string;
  client_phone?: string;
  pickup_location?: string;
  dropoff_location?: string;
  start_date: string;
  end_date: string;
  quote_reference: string;
  status: 'Draft' | 'Active' | 'Accepted' | 'Converted' | 'Expired';
  created_at: string;
  quote_data: { [key: string]: any };
  expiration_date: string | null;
  extended_expiration: boolean;
  client_email?: string;
  booking_id?: string;
  converted_at?: string;
}

interface EditExpirationModalProps {
  quote: Quote;
  onClose: () => void;
  onSave: (quoteId: string, newDate: string) => void;
}

interface DeleteConfirmationModalProps {
  quote: Quote;
  onClose: () => void;
  onConfirm: (quoteId: string) => void;
  isDeleting: boolean;
}

function DeleteConfirmationModal({ quote, onClose, onConfirm, isDeleting }: DeleteConfirmationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Quote
            </h3>
          </div>
          <div className="space-y-3 mb-6">
            <p className="text-gray-700">
              Are you sure you want to delete this quote?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Reference:</span> {quote.quote_reference}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Client:</span> {quote.client_name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Status:</span> {quote.status}
              </p>
            </div>
            <p className="text-sm text-red-600 font-medium">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(quote.id)}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Quote
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditExpirationModal({ quote, onClose, onSave }: EditExpirationModalProps) {
  const [expirationDate, setExpirationDate] = useState(
    quote.expiration_date
      ? new Date(quote.expiration_date).toISOString().split('T')[0]
      : ''
  );

  const handleSave = () => {
    if (!expirationDate) {
      showToast('Please select an expiration date', 'error');
      return;
    }
    onSave(quote.id, expirationDate);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Edit Expiration Date
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Quote: <span className="font-medium">{quote.quote_reference}</span>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Client: <span className="font-medium">{quote.client_name}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Expiration Date
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuotesPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'Draft' | 'Active' | 'Accepted' | 'Converted' | 'Expired'>('all');
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [acceptingQuote, setAcceptingQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [deletingQuote, setDeletingQuote] = useState<Quote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      // Update expired quotes before fetching
      await quotationService.updateExpiredQuotes();
      const data = await quotationService.getQuotes();
      setQuotes(data);
    } catch (error) {
      console.error('Failed to load quotes:', error);
      showToast('Failed to load quotes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadQuotes();
      showToast('Data refreshed', 'success');
    } catch (error) {
      showToast('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateExpiration = async (quoteId: string, newDate: string) => {
    try {
      await quotationService.updateExpiration(quoteId, newDate);
      showToast('Expiration date updated successfully', 'success');
      setEditingQuote(null);
      loadQuotes();
    } catch (error) {
      console.error('Failed to update expiration:', error);
      showToast('Failed to update expiration date', 'error');
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    setIsDeleting(true);
    try {
      await quotationService.deleteQuote(quoteId);
      showToast('Quote deleted successfully', 'success');
      setDeletingQuote(null);
      loadQuotes();
    } catch (error) {
      console.error('Failed to delete quote:', error);
      showToast('Failed to delete quote', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLoadQuote = (quote: Quote) => {
    navigate('/quotation', { state: { loadQuote: quote } });
  };

  const getDaysRemaining = (expirationDate: string | null): number | null => {
    if (!expirationDate) return null;
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Expired':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft':
        return <Edit className="w-3 h-3" />;
      case 'Active':
        return <CheckCircle className="w-3 h-3" />;
      case 'Expired':
        return <XCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const filteredQuotes = quotes.filter(
    (q) => filter === 'all' || q.status === filter
  );

  const statusCounts = {
    all: quotes.length,
    Draft: quotes.filter((q) => q.status === 'Draft').length,
    Active: quotes.filter((q) => q.status === 'Active').length,
    Expired: quotes.filter((q) => q.status === 'Expired').length,
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-gray-600 mt-1">Manage and track all your quotes</p>
          </div>
          <button
            onClick={() => navigate('/quotation')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Create Quote
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'Active', 'Draft', 'Expired'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status} ({statusCounts[status]})
            </button>
          ))}
        </div>

        {filteredQuotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {filter === 'all'
                ? 'No quotes found'
                : `No ${filter.toLowerCase()} quotes found`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuotes.map((quote) => {
              const quoteData = quote.quote_data as { [key: string]: any };
              const categories = Object.keys(quoteData);
              const daysRemaining = getDaysRemaining(quote.expiration_date);

              return (
                <div
                  key={quote.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {quote.quote_reference}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs rounded-full font-medium border flex items-center gap-1 ${getStatusColor(
                            quote.status
                          )}`}
                        >
                          {getStatusIcon(quote.status)}
                          {quote.status}
                        </span>
                        {quote.extended_expiration && (
                          <span className="px-2 py-1 text-xs rounded-full font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            Extended
                          </span>
                        )}
                      </div>

                      <p className="font-medium text-gray-900 mb-2">
                        {quote.client_name}
                      </p>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(quote.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {quote.start_date} to {quote.end_date}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {categories.length} {categories.length === 1 ? 'vehicle' : 'vehicles'}
                        </div>
                      </div>

                      {quote.expiration_date && (
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className={`flex items-center gap-1 text-sm ${
                              daysRemaining !== null && daysRemaining < 0
                                ? 'text-red-600'
                                : daysRemaining !== null && daysRemaining <= 1
                                ? 'text-orange-600'
                                : 'text-gray-600'
                            }`}
                          >
                            <AlertCircle className="w-4 h-4" />
                            {daysRemaining !== null && daysRemaining < 0
                              ? `Expired ${Math.abs(daysRemaining)} ${
                                  Math.abs(daysRemaining) === 1 ? 'day' : 'days'
                                } ago`
                              : daysRemaining === 0
                              ? 'Expires today'
                              : daysRemaining === 1
                              ? 'Expires tomorrow'
                              : `Expires in ${daysRemaining} days`}
                          </div>
                          {quote.status !== 'Draft' && (
                            <button
                              onClick={() => setEditingQuote(quote)}
                              className="text-xs text-blue-600 hover:text-blue-700 underline"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {quote.status === 'Active' && (
                        <>
                          <button
                            onClick={() => setAcceptingQuote(quote)}
                            className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Accept Quote
                          </button>
                          <button
                            onClick={() => setConvertingQuote(quote)}
                            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                          >
                            <Receipt className="w-4 h-4" />
                            Convert to Invoice
                          </button>
                        </>
                      )}
                      {quote.status === 'Converted' && (
                        <div className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Converted to Booking
                        </div>
                      )}
                      <button
                        onClick={() => handleLoadQuote(quote)}
                        className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => setDeletingQuote(quote)}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                        title="Delete quote"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {convertingQuote && (
        <InvoiceConversionModal
          quote={convertingQuote}
          onClose={() => setConvertingQuote(null)}
          onSuccess={() => {
            setConvertingQuote(null);
            loadQuotes();
          }}
        />
      )}

      {editingQuote && (
        <EditExpirationModal
          quote={editingQuote}
          onClose={() => setEditingQuote(null)}
          onSave={handleUpdateExpiration}
        />
      )}

      {acceptingQuote && (
        <AcceptQuoteModal
          quote={acceptingQuote}
          onClose={() => setAcceptingQuote(null)}
          onSuccess={() => {
            setAcceptingQuote(null);
            loadQuotes();
          }}
        />
      )}

      {deletingQuote && (
        <DeleteConfirmationModal
          quote={deletingQuote}
          onClose={() => setDeletingQuote(null)}
          onConfirm={handleDeleteQuote}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
