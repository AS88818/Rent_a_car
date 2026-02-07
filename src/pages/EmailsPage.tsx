import { useEffect, useState } from 'react';
import { emailService, userService, vehicleService, categoryService } from '../services/api';
import { EmailTemplate, EmailQueue, AuthUser, Vehicle, VehicleCategory, TemplateCategory } from '../types/database';
import { showToast } from '../lib/toast';
import {
  Plus,
  Edit,
  X,
  Mail,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  Copy,
  Send,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Calendar,
  Download,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { EmailTemplateFormModal } from '../components/EmailTemplateFormModal';
import { EmailQueueEditModal } from '../components/EmailQueueEditModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { generateEmailPDF, generateBulkEmailsPDF } from '../lib/pdf-utils';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  booking: 'Booking',
  invoice: 'Invoice',
  quote: 'Quote',
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  booking: 'bg-blue-100 text-blue-800 border-blue-200',
  invoice: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  quote: 'bg-amber-100 text-amber-800 border-amber-200',
};

export function EmailsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailQueue, setEmailQueue] = useState<EmailQueue[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingEmails, setProcessingEmails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showQueueEditModal, setShowQueueEditModal] = useState(false);
  const [editingQueueEmail, setEditingQueueEmail] = useState<EmailQueue | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; message: string } | null>(null);
  const [templateFilter, setTemplateFilter] = useState<'all' | 'approved' | 'pending' | 'draft' | 'rejected'>('all');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<'all' | TemplateCategory>('all');
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'>('all');
  const [queueSearch, setQueueSearch] = useState('');
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(10);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingTemplateId, setRejectingTemplateId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [vehiclesData, categoriesData, templatesData, queueData, userData] = await Promise.all([
        vehicleService.getVehicles(),
        categoryService.getCategories(),
        emailService.getEmailTemplates(),
        emailService.getEmailQueue(),
        userService.getCurrentUser(),
      ]);

      setVehicles(vehiclesData);
      setVehicleCategories(categoriesData);
      setEmailTemplates(templatesData);
      setEmailQueue(queueData);
      setCurrentUser(userData);
    } catch (error) {
      showToast('Failed to fetch email data', 'error');
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

  const isAdmin = currentUser?.role === 'admin';

  const handleCreateTemplate = async (template: Partial<EmailTemplate>) => {
    setSubmitting(true);
    try {
      const newTemplate = await emailService.createEmailTemplate(template as any);
      setEmailTemplates([...emailTemplates, newTemplate]);
      setShowTemplateModal(false);
      showToast('Template created successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to create template', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTemplate = async (template: Partial<EmailTemplate>) => {
    if (!editingTemplate) return;

    setSubmitting(true);
    try {
      const updated = await emailService.updateEmailTemplate(editingTemplate.id, template);
      setEmailTemplates(emailTemplates.map((t) => (t.id === updated.id ? updated : t)));
      setShowTemplateModal(false);
      setEditingTemplate(null);
      showToast('Template updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update template', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await emailService.deleteEmailTemplate(id);
      setEmailTemplates(emailTemplates.filter((t) => t.id !== id));
      showToast('Template deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete template', 'error');
    }
  };

  const handleDuplicateTemplate = async (template: EmailTemplate) => {
    const newName = `${template.template_name} (Copy)`;
    const newKey = `${template.template_key}_copy_${Date.now()}`;

    try {
      const duplicated = await emailService.duplicateTemplate(template.id, newName, newKey);
      setEmailTemplates([...emailTemplates, duplicated]);
      showToast('Template duplicated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to duplicate template', 'error');
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      const updated = await emailService.submitTemplateForApproval(id);
      setEmailTemplates(emailTemplates.map((t) => (t.id === updated.id ? updated : t)));
      showToast('Template submitted for approval', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to submit template', 'error');
    }
  };

  const handleApproveTemplate = async (id: string) => {
    try {
      const updated = await emailService.approveTemplate(id);
      setEmailTemplates(emailTemplates.map((t) => (t.id === updated.id ? updated : t)));
      showToast('Template approved successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to approve template', 'error');
    }
  };

  const handleRejectTemplate = async () => {
    if (!rejectingTemplateId || !rejectionReason.trim()) return;

    try {
      const updated = await emailService.rejectTemplate(rejectingTemplateId, rejectionReason.trim());
      setEmailTemplates(emailTemplates.map((t) => (t.id === updated.id ? updated : t)));
      showToast('Template rejected', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to reject template', 'error');
    } finally {
      setShowRejectModal(false);
      setRejectingTemplateId(null);
      setRejectionReason('');
    }
  };

  const handleUpdateQueueEmail = async (updates: Partial<EmailQueue>) => {
    if (!editingQueueEmail) return;

    setSubmitting(true);
    try {
      const updated = await emailService.updateEmailQueue(editingQueueEmail.id, updates);
      setEmailQueue(emailQueue.map((e) => (e.id === updated.id ? updated : e)));
      setShowQueueEditModal(false);
      setEditingQueueEmail(null);
      showToast('Email updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update email', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEmail = async (id: string) => {
    try {
      const updated = await emailService.cancelQueuedEmail(id);
      setEmailQueue(emailQueue.map((e) => (e.id === updated.id ? updated : e)));
      showToast('Email cancelled', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to cancel email', 'error');
    }
  };

  const handleSendEmailNow = async (id: string) => {
    setSendingEmailId(id);
    try {
      await emailService.sendEmailNow(id);
      await handleProcessEmails();
      showToast('Email sent', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to send email', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleRetryEmail = async (id: string) => {
    try {
      const updated = await emailService.updateEmailQueue(id, {
        status: 'pending',
        error_message: undefined,
        attempts: 0,
      } as any);
      setEmailQueue(emailQueue.map((e) => (e.id === updated.id ? updated : e)));
      showToast('Email queued for retry', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to retry email', 'error');
    }
  };

  const handleRetryAllFailed = async () => {
    const failedEmails = emailQueue.filter((e) => e.status === 'failed');
    if (failedEmails.length === 0) return;

    try {
      for (const email of failedEmails) {
        const updated = await emailService.updateEmailQueue(email.id, {
          status: 'pending',
          error_message: undefined,
          attempts: 0,
        } as any);
        setEmailQueue((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      }
      showToast(`${failedEmails.length} emails queued for retry`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to retry emails', 'error');
    }
  };

  const handleProcessEmails = async () => {
    setProcessingEmails(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to process emails');
      }

      const result = await response.json();
      showToast(
        `Processed ${result.results?.processed || 0} emails. Sent: ${result.results?.sent || 0}, Failed: ${result.results?.failed || 0}`,
        'success'
      );

      await fetchData();
    } catch (error: any) {
      showToast(error.message || 'Failed to process emails', 'error');
    } finally {
      setProcessingEmails(false);
    }
  };

  const handleDownloadEmail = (email: EmailQueue) => {
    try {
      generateEmailPDF(email);
      showToast('PDF downloaded successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to generate PDF', 'error');
    }
  };

  const handleDownloadAllEmails = () => {
    try {
      if (filteredQueue.length === 0) {
        showToast('No emails to download', 'error');
        return;
      }
      generateBulkEmailsPDF(filteredQueue);
      showToast(`Downloaded ${filteredQueue.length} emails as PDF`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to generate PDF', 'error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'cancelled':
        return <X className="w-4 h-4 text-gray-600" />;
      default:
        return <Mail className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScheduleText = (template: EmailTemplate) => {
    if (template.schedule_type === 'immediate') {
      return 'Immediate';
    }

    const value = template.schedule_value;
    const unit = template.schedule_unit;
    const unitText = value === 1 ? unit.slice(0, -1) : unit;

    const timing = {
      before_start: 'before pickup',
      after_start: 'after pickup',
      before_end: 'before dropoff',
      after_end: 'after dropoff',
    }[template.schedule_type];

    return `${value} ${unitText} ${timing}`;
  };

  const filteredTemplates = emailTemplates.filter((template) => {
    if (templateFilter !== 'all' && template.approval_status !== templateFilter) return false;
    if (templateCategoryFilter !== 'all' && template.template_category !== templateCategoryFilter) return false;
    return true;
  });

  const filteredQueue = emailQueue.filter((email) => {
    if (queueFilter !== 'all' && email.status !== queueFilter) return false;
    if (queueSearch) {
      const search = queueSearch.toLowerCase();
      return (
        email.recipient_name.toLowerCase().includes(search) ||
        email.recipient_email.toLowerCase().includes(search) ||
        email.subject.toLowerCase().includes(search) ||
        email.email_type.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const totalQueuePages = Math.max(1, Math.ceil(filteredQueue.length / queuePageSize));
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const paginatedQueue = filteredQueue.slice(
    (safeQueuePage - 1) * queuePageSize,
    safeQueuePage * queuePageSize
  );

  useEffect(() => {
    setQueuePage(1);
  }, [queueFilter, queueSearch, queuePageSize]);

  const emailStats = {
    total: emailQueue.length,
    pending: emailQueue.filter((e) => e.status === 'pending').length,
    sent: emailQueue.filter((e) => e.status === 'sent').length,
    failed: emailQueue.filter((e) => e.status === 'failed').length,
  };

  const templateStats = {
    total: emailTemplates.length,
    approved: emailTemplates.filter((t) => t.approval_status === 'approved').length,
    pending: emailTemplates.filter((t) => t.approval_status === 'pending').length,
    draft: emailTemplates.filter((t) => t.approval_status === 'draft').length,
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
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Email Management</h1>
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
            <h2 className="text-xl font-semibold text-gray-900">Email Queue Monitor</h2>
            <div className="flex items-center gap-2">
              {emailStats.failed > 0 && (
                <button
                  onClick={handleRetryAllFailed}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry All Failed
                </button>
              )}
              <button
                onClick={handleDownloadAllEmails}
                disabled={filteredQueue.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Download All PDF
              </button>
              <button
                onClick={handleProcessEmails}
                disabled={processingEmails}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${processingEmails ? 'animate-spin' : ''}`} />
                {processingEmails ? 'Processing...' : 'Process Emails'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-medium text-blue-900">Total</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">{emailStats.total}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-yellow-600" />
                <p className="text-sm font-medium text-yellow-900">Pending</p>
              </div>
              <p className="text-2xl font-bold text-yellow-900">{emailStats.pending}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Sent</p>
              </div>
              <p className="text-2xl font-bold text-green-900">{emailStats.sent}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-red-900">Failed</p>
              </div>
              <p className="text-2xl font-bold text-red-900">{emailStats.failed}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Emails</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search by name, email, subject, or type..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {queueSearch && (
                <button
                  onClick={() => setQueueSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedQueue.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(email.status)}
                        <span
                          className={`text-xs px-2 py-1 rounded border font-medium ${getStatusBadge(email.status)}`}
                        >
                          {email.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {email.email_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <p className="font-medium">{email.recipient_name}</p>
                        <p className="text-xs text-gray-500">{email.recipient_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{email.subject}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(email.scheduled_for).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownloadEmail(email)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {email.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingQueueEmail(email);
                                setShowQueueEditModal(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendEmailNow(email.id)}
                              disabled={sendingEmailId === email.id}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="Send Now"
                            >
                              {sendingEmailId === email.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  action: () => handleCancelEmail(email.id),
                                  message: 'Are you sure you want to cancel this email?',
                                })
                              }
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {email.status === 'failed' && (
                          <button
                            onClick={() => handleRetryEmail(email.id)}
                            className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {email.error_message && (
                        <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={email.error_message}>
                          {email.error_message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredQueue.length === 0 && (
              <div className="text-center py-8 text-gray-500">No emails in queue</div>
            )}
          </div>

          {filteredQueue.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>
                  Showing {(safeQueuePage - 1) * queuePageSize + 1}-
                  {Math.min(safeQueuePage * queuePageSize, filteredQueue.length)} of {filteredQueue.length}
                </span>
                <select
                  value={queuePageSize}
                  onChange={(e) => setQueuePageSize(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} per page
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                  disabled={safeQueuePage <= 1}
                  className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  {safeQueuePage} / {totalQueuePages}
                </span>
                <button
                  onClick={() => setQueuePage((p) => Math.min(totalQueuePages, p + 1))}
                  disabled={safeQueuePage >= totalQueuePages}
                  className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Email Templates</h2>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowTemplateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-medium text-blue-900">Total</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">{templateStats.total}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">Approved</p>
              </div>
              <p className="text-2xl font-bold text-green-900">{templateStats.approved}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-orange-600" />
                <p className="text-sm font-medium text-orange-900">Pending</p>
              </div>
              <p className="text-2xl font-bold text-orange-900">{templateStats.pending}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Edit className="w-5 h-5 text-yellow-600" />
                <p className="text-sm font-medium text-yellow-900">Draft</p>
              </div>
              <p className="text-2xl font-bold text-yellow-900">{templateStats.draft}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Templates</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Approval</option>
              <option value="draft">Draft</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={templateCategoryFilter}
              onChange={(e) => setTemplateCategoryFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Categories</option>
              <option value="booking">Booking</option>
              <option value="invoice">Invoice</option>
              <option value="quote">Quote</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredTemplates.map((template) => {
              const canEdit =
                (template.approval_status === 'draft' || template.approval_status === 'rejected') &&
                (template.created_by === currentUser?.id || isAdmin);
              const canDelete = !template.is_system_template && (template.created_by === currentUser?.id || isAdmin);
              const canApprove = isAdmin && template.approval_status === 'pending';
              const canSubmit = template.approval_status === 'draft' && template.created_by === currentUser?.id;

              return (
                <div key={template.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{template.template_name}</h3>
                        <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
                          <span
                            className={`text-xs px-2 py-0.5 rounded border font-medium ${CATEGORY_COLORS[template.template_category]}`}
                          >
                            {CATEGORY_LABELS[template.template_category]}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded border font-medium ${getApprovalBadge(template.approval_status)}`}
                          >
                            {template.approval_status}
                          </span>
                          {template.is_system_template && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                              System
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 font-mono mb-1 truncate">{template.template_key}</p>
                      <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {getScheduleText(template)}
                        </span>
                        {template.vehicle_ids && template.vehicle_ids.length > 0 && (
                          <span>
                            Vehicles:{' '}
                            {template.vehicle_ids.length === vehicles.length
                              ? 'All Vehicles'
                              : `${template.vehicle_ids.length} Selected`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {canSubmit && (
                        <button
                          onClick={() => handleSubmitForApproval(template.id)}
                          className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Submit for Approval"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {canApprove && (
                        <>
                          <button
                            onClick={() => handleApproveTemplate(template.id)}
                            className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Approve"
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setRejectingTemplateId(template.id);
                              setRejectionReason('');
                              setShowRejectModal(true);
                            }}
                            className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDuplicateTemplate(template)}
                        className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateModal(true);
                          }}
                          className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() =>
                            setConfirmAction({
                              action: () => handleDeleteTemplate(template.id),
                              message: 'Are you sure you want to delete this template?',
                            })
                          }
                          className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    <p className="font-medium">Subject:</p>
                    <p className="text-gray-600 mb-2">{template.subject}</p>
                    <p className="font-medium">Body Preview:</p>
                    <p className="text-gray-600 whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                      {template.body.substring(0, 200)}
                      {template.body.length > 200 ? '...' : ''}
                    </p>
                  </div>
                  {template.rejection_reason && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-medium text-red-900">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{template.rejection_reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <EmailTemplateFormModal
        isOpen={showTemplateModal}
        onClose={() => {
          setShowTemplateModal(false);
          setEditingTemplate(null);
        }}
        onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
        template={editingTemplate}
        vehicles={vehicles}
        vehicleCategories={vehicleCategories}
        submitting={submitting}
      />

      <EmailQueueEditModal
        isOpen={showQueueEditModal}
        onClose={() => {
          setShowQueueEditModal(false);
          setEditingQueueEmail(null);
        }}
        onSubmit={handleUpdateQueueEmail}
        email={editingQueueEmail}
        submitting={submitting}
      />

      {confirmAction && (
        <ConfirmModal
          isOpen={!!confirmAction}
          title="Confirm Action"
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            confirmAction.action();
            setConfirmAction(null);
          }}
          message={confirmAction.message}
        />
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              setShowRejectModal(false);
              setRejectingTemplateId(null);
              setRejectionReason('');
            }}
          ></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Template</h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                rows={4}
                autoFocus
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingTemplateId(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectTemplate}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
