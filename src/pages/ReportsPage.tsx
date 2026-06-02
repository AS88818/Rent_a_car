import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Eye, Mail, RefreshCw, Send, ToggleLeft, ToggleRight } from 'lucide-react';
import { reportService } from '../services/api';
import { ReportPreview, ReportSubscriptionWithUser, ReportType } from '../types/database';
import { useAuth } from '../lib/auth-context';
import { showToast } from '../lib/toast';

const REPORTS: Array<{
  type: ReportType;
  title: string;
  schedule: string;
  description: string;
}> = [
  {
    type: 'daily_ops_digest',
    title: 'Daily Ops Digest',
    schedule: '06:00 EAT daily',
    description: 'Pickups, returns, overdue work, yesterday activity, and fleet health.',
  },
  {
    type: 'weekly_finance_brief',
    title: 'Weekly Finance Brief',
    schedule: 'Monday 07:00 EAT',
    description: 'Revenue, collections, utilization, receivables, and weekly finance signals.',
  },
];

const reportLabel = (type: ReportType) =>
  REPORTS.find(report => report.type === type)?.title || type;

export function ReportsPage() {
  const { user, userRole } = useAuth();
  const [subscriptions, setSubscriptions] = useState<ReportSubscriptionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [runningReport, setRunningReport] = useState<ReportType | null>(null);
  const [preview, setPreview] = useState<{ type: ReportType; report: ReportPreview } | null>(null);

  const isAdmin = userRole === 'admin';

  const fetchSubscriptions = async () => {
    if (!user) return;

    try {
      const data = isAdmin
        ? await reportService.getAllSubscriptions()
        : await reportService.getMySubscriptions(user.id);
      setSubscriptions(data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load report subscriptions', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [user?.id, userRole]);

  const rows = useMemo(() => {
    return subscriptions
      .filter(subscription => !subscription.user?.deleted_at)
      .sort((a, b) => {
        const reportOrder = a.report_type.localeCompare(b.report_type);
        if (reportOrder !== 0) return reportOrder;
        return (a.user?.full_name || '').localeCompare(b.user?.full_name || '');
      });
  }, [subscriptions]);

  const summary = useMemo(() => {
    return REPORTS.map(report => {
      const reportRows = rows.filter(row => row.report_type === report.type);
      return {
        ...report,
        enabled: reportRows.filter(row => row.enabled).length,
        total: reportRows.length,
      };
    });
  }, [rows]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSubscriptions();
  };

  const handleToggle = async (subscription: ReportSubscriptionWithUser) => {
    setUpdatingId(subscription.id);
    try {
      const updated = await reportService.updateSubscription(subscription.id, !subscription.enabled);
      setSubscriptions(current => current.map(row => row.id === updated.id ? updated : row));
      showToast('Report subscription updated', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update subscription', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePreview = async (type: ReportType) => {
    setRunningReport(type);
    try {
      const result = await reportService.callReportFunction(type, 'preview');
      if (!result.report) throw new Error('Report preview was empty');
      setPreview({ type, report: result.report });
    } catch (error: any) {
      showToast(error.message || 'Failed to preview report', 'error');
    } finally {
      setRunningReport(null);
    }
  };

  const handleTestSend = async (type: ReportType) => {
    setRunningReport(type);
    try {
      const result = await reportService.callReportFunction(type, 'test');
      showToast(result.queued ? 'Test report queued for email delivery' : 'Report was already queued', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to queue test report', 'error');
    } finally {
      setRunningReport(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-gray-600">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh reports"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Scheduled operational and finance summaries for the backoffice team.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {summary.map(report => (
          <section key={report.type} className="bg-white border border-gray-200 border-l-4 border-l-[#b6ff00] rounded-lg p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#b6ff00]">
                    <BarChart3 className="w-5 h-5 text-gray-900" />
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
                </div>
                <p className="text-sm text-gray-600">{report.description}</p>
                <p className="text-sm font-medium text-gray-900 mt-3">{report.schedule}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {report.enabled} of {report.total} subscription{report.total === 1 ? '' : 's'} enabled
                </p>
              </div>

              {isAdmin && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handlePreview(report.type)}
                    disabled={runningReport === report.type}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-[#f7ffe8] transition-colors disabled:opacity-50"
                    title={`Preview ${report.title}`}
                  >
                    <Eye className="w-4 h-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleTestSend(report.type)}
                    disabled={runningReport === report.type}
                    className="p-2 bg-[#b6ff00] text-gray-900 rounded-lg hover:bg-[#a7ed00] transition-colors disabled:opacity-50"
                    title={`Send test ${report.title}`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Subscriptions</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isAdmin
              ? 'Manage scheduled report delivery for users. Only enabled admin subscriptions are sent by the scheduled jobs.'
              : 'Manage your own scheduled report preferences.'}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">No report subscriptions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#eef6ff] border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Report</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">User</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Role</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Delivery</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-700">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(subscription => {
                  const disabledByRole = subscription.report_type === 'weekly_finance_brief' && subscription.user?.role !== 'admin';
                  return (
                    <tr key={subscription.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-medium text-gray-900">{reportLabel(subscription.report_type)}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">{subscription.user?.full_name || 'Unknown user'}</div>
                        <div className="text-xs text-gray-500">{subscription.user?.email || 'No email'}</div>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{subscription.user?.role || 'unknown'}</td>
                      <td className="px-5 py-4 text-gray-600">
                        {disabledByRole
                          ? 'Admin-only scheduled report'
                          : REPORTS.find(report => report.type === subscription.report_type)?.schedule}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleToggle(subscription)}
                          disabled={updatingId === subscription.id || disabledByRole}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                            subscription.enabled
                              ? 'bg-[#b6ff00] text-gray-900 hover:bg-[#a7ed00]'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {subscription.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          {subscription.enabled ? 'On' : 'Off'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 bg-[#f7ffe8] border border-[#b6ff00] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Email delivery</h2>
            <p className="text-sm text-gray-700 mt-1">
              Reports are queued through the existing email queue and sent by the existing queue processor. No PDF attachments are generated for these reports.
            </p>
          </div>
        </div>
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{reportLabel(preview.type)} Preview</h2>
                <p className="text-sm text-gray-600">{preview.report.subject}</p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
            <iframe
              title={`${reportLabel(preview.type)} preview`}
              srcDoc={preview.report.html}
              className="w-full flex-1 min-h-[70vh] bg-[#fbfaf7]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
