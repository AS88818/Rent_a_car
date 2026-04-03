import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { snagAssignmentService, snagService, userService } from '../services/api';
import { Snag, AuthUser } from '../types/database';
import { showToast } from '../lib/toast';
import { Calendar, AlertCircle, CheckCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { formatDate, getPriorityColor } from '../lib/utils';
import { SnagResolutionModal } from '../components/SnagResolutionModal';
import { AssignSnagModal } from '../components/AssignSnagModal';

interface Assignment {
  id: string;
  snag_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  deadline: string | null;
  assignment_notes: string | null;
  status: string;
  snags: {
    id: string;
    description: string;
    priority: string | null;
    date_opened: string;
    vehicles: {
      reg_number: string;
      branch_id: string;
    };
  };
}

export function MyAssignmentsPage() {
  const { user, branchId, userRole } = useAuth();
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolveSnag, setResolveSnag] = useState<Snag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reassignAssignment, setReassignAssignment] = useState<Assignment | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [teamUsers, setTeamUsers] = useState<AuthUser[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      setViewingUserId(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    userService.getAllUsers().then(users => {
      setTeamUsers(users.filter(u => u.status === 'active' && u.id !== user?.id));
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (viewingUserId) fetchAssignments();
  }, [viewingUserId]);

  const fetchAssignments = async () => {
    const targetUserId = viewingUserId || user?.id;
    if (!targetUserId) return;

    try {
      const data = await snagAssignmentService.getAssignmentsByUser(targetUserId);
      setAssignments(data);
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAssignments();
      showToast('Data refreshed', 'success');
    } catch (error) {
      showToast('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleResolve = async (resolution: {
    snagId: string;
    resolutionMethod: any;
    resolutionNotes: string;
    checkedByUserId?: string;
    photoUrls?: string[];
    maintenanceLog?: any;
  }) => {
    if (!user?.id) return;

    setSubmitting(true);
    try {
      const { snagResolutionService } = await import('../services/api');

      if (resolution.maintenanceLog) {
        await snagResolutionService.createResolutionWithMaintenanceLog(
          {
            snag_id: resolution.snagId,
            resolution_method: resolution.resolutionMethod,
            resolution_notes: resolution.resolutionNotes,
            resolved_by: user.id,
            checked_by: resolution.checkedByUserId,
            photo_urls: resolution.photoUrls,
          },
          resolution.maintenanceLog
        );
      } else {
        await snagResolutionService.createResolution({
          snag_id: resolution.snagId,
          resolution_method: resolution.resolutionMethod,
          resolution_notes: resolution.resolutionNotes,
          resolved_by: user.id,
          checked_by: resolution.checkedByUserId,
          photo_urls: resolution.photoUrls,
        });
      }

      showToast('Snag resolved successfully', 'success');
      fetchAssignments();
    } catch (error: any) {
      showToast(error.message || 'Failed to resolve snag', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassign = async (data: {
    snagId: string;
    assignedTo: string;
    deadline?: string;
    notes?: string;
  }) => {
    if (!user?.id) return;
    setReassigning(true);
    try {
      await snagAssignmentService.reassignSnag(
        data.snagId,
        data.assignedTo,
        user.id,
        data.deadline,
        data.notes
      );
      showToast('Snag reassigned successfully', 'success');
      setReassignAssignment(null);
      fetchAssignments();
    } catch (error: any) {
      showToast(error.message || 'Failed to reassign snag', 'error');
    } finally {
      setReassigning(false);
    }
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const getDaysUntilDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const days = Math.ceil(
      (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const overdueAssignments = assignments.filter(a => isOverdue(a.deadline));
  const upcomingAssignments = assignments.filter(a => !isOverdue(a.deadline));

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">
              {viewingUserId === user?.id
                ? 'My Assignments'
                : `${teamUsers.find(u => u.id === viewingUserId)?.full_name || 'Team Member'}'s Assignments`}
            </h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isAdminOrManager && teamUsers.length > 0 && (
            <div className="relative">
              <select
                value={viewingUserId}
                onChange={e => setViewingUserId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              >
                <option value={user?.id}>My Assignments</option>
                <optgroup label="Team Members">
                  {teamUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          )}
        </div>
        <p className="text-gray-600">
          {viewingUserId === user?.id ? 'Snags assigned to you' : 'Snags assigned to this team member'}
        </p>
      </div>

      <div className="grid gap-6 mb-6 md:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              <p className="text-sm text-gray-600">Total Assignments</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{overdueAssignments.length}</p>
              <p className="text-sm text-gray-600">Overdue</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{upcomingAssignments.length}</p>
              <p className="text-sm text-gray-600">On Track</p>
            </div>
          </div>
        </div>
      </div>

      {overdueAssignments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Overdue Assignments
          </h2>
          <div className="space-y-4">
            {overdueAssignments.map(assignment => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onResolve={setResolveSnag}
                onReassign={setReassignAssignment}
              />
            ))}
          </div>
        </div>
      )}

      {upcomingAssignments.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Assignments</h2>
          <div className="space-y-4">
            {upcomingAssignments.map(assignment => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onResolve={setResolveSnag}
                onReassign={setReassignAssignment}
              />
            ))}
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600">No assignments at the moment</p>
        </div>
      )}

      <SnagResolutionModal
        isOpen={resolveSnag !== null}
        onClose={() => setResolveSnag(null)}
        onSubmit={handleResolve}
        snag={resolveSnag}
        vehicleId={resolveSnag?.vehicle_id}
        branchId={branchId || undefined}
        submitting={submitting}
        users={teamUsers}
        currentUserId={user?.id}
      />

      <AssignSnagModal
        isOpen={reassignAssignment !== null}
        onClose={() => setReassignAssignment(null)}
        onSubmit={handleReassign}
        snag={reassignAssignment ? {
          id: reassignAssignment.snags.id,
          vehicle_id: '',
          description: reassignAssignment.snags.description,
          priority: reassignAssignment.snags.priority as any,
          status: 'Open',
          date_opened: reassignAssignment.snags.date_opened,
          branch_id: reassignAssignment.snags.vehicles.branch_id,
          assigned_to: reassignAssignment.assigned_to,
          created_at: '',
          updated_at: '',
        } as Snag : null}
        users={teamUsers}
        submitting={reassigning}
      />
    </div>
  );
}

interface AssignmentCardProps {
  assignment: Assignment;
  onResolve: (snag: Snag) => void;
  onReassign: (assignment: Assignment) => void;
}

function AssignmentCard({ assignment, onResolve, onReassign }: AssignmentCardProps) {
  const isOverdue = assignment.deadline && new Date(assignment.deadline) < new Date();
  const daysUntil = assignment.deadline
    ? Math.ceil(
        (new Date(assignment.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 border-l-4 ${
        isOverdue ? 'border-red-500' : 'border-blue-500'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-900">
              {assignment.snags.vehicles.reg_number}
            </span>
            {assignment.snags.priority && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(
                  assignment.snags.priority
                )}`}
              >
                {assignment.snags.priority}
              </span>
            )}
          </div>
          <p className="text-gray-900 mb-2">{assignment.snags.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Opened: {formatDate(assignment.snags.date_opened)}</span>
            {assignment.deadline && (
              <span
                className={`flex items-center gap-1 ${
                  isOverdue ? 'text-red-600 font-semibold' : ''
                }`}
              >
                <Calendar className="w-4 h-4" />
                Deadline: {formatDate(assignment.deadline)}
                {daysUntil !== null && (
                  <span>
                    ({isOverdue ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days left`})
                  </span>
                )}
              </span>
            )}
          </div>
          {assignment.assignment_notes && (
            <p className="text-sm text-gray-600 mt-2 italic">Note: {assignment.assignment_notes}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() =>
            onResolve({
              id: assignment.snags.id,
              vehicle_id: '',
              description: assignment.snags.description,
              priority: assignment.snags.priority,
              status: 'Open',
              date_opened: assignment.snags.date_opened,
              branch_id: assignment.snags.vehicles.branch_id,
              created_at: '',
              updated_at: '',
            } as Snag)
          }
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          Resolve Snag
        </button>
        <button
          onClick={() => onReassign(assignment)}
          className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          Reassign
        </button>
      </div>
    </div>
  );
}
