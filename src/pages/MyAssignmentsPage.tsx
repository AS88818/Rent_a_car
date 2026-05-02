import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { snagAssignmentService, userService, maintenanceService, bookingService, snagResolutionService } from '../services/api';
import { Snag, AuthUser } from '../types/database';
import { showToast } from '../lib/toast';
import { Calendar, AlertCircle, CheckCircle, RefreshCw, ChevronDown, Wrench, Car } from 'lucide-react';
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

interface MaintenanceJob {
  id: string;
  vehicle_id: string;
  service_date: string;
  mileage: number;
  work_done: string;
  work_category?: string;
  branch_id: string;
  reg_number: string | null;
}

interface DrivingJob {
  id: string;
  booking_reference?: string;
  vehicle_id: string;
  client_name: string;
  start_datetime: string;
  end_datetime: string;
  start_location: string;
  end_location: string;
  status: string;
  booking_type?: string;
  reg_number: string | null;
}

export function MyAssignmentsPage() {
  const { user, branchId, userRole } = useAuth();
  const isAdminOrManager = userRole === 'admin' || userRole === 'user';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState<MaintenanceJob[]>([]);
  const [drivingJobs, setDrivingJobs] = useState<DrivingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolveSnag, setResolveSnag] = useState<Snag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reassignAssignment, setReassignAssignment] = useState<Assignment | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [teamUsers, setTeamUsers] = useState<AuthUser[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string>('');
  const [, setViewingUserRole] = useState<string>(userRole || '');

  useEffect(() => {
    if (user?.id) {
      setViewingUserId(user.id);
      setViewingUserRole(userRole || '');
    }
  }, [user?.id]);

  useEffect(() => {
    userService.getAllUsers().then(users => {
      setTeamUsers(users.filter(u => u.status === 'active' && u.id !== user?.id));
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (viewingUserId) fetchAll();
  }, [viewingUserId]);

  const fetchAll = async () => {
    const targetUserId = viewingUserId || user?.id;
    if (!targetUserId) return;

    try {
      const [assignmentsData, maintenanceData, drivingData] = await Promise.all([
        snagAssignmentService.getAssignmentsByUser(targetUserId).catch(() => []),
        maintenanceService.getMaintenanceLogsByUser(targetUserId).catch(() => []),
        bookingService.getBookingsByChauffeur(targetUserId).catch(() => []),
      ]);
      setAssignments(assignmentsData as Assignment[]);
      setMaintenanceJobs(maintenanceData as MaintenanceJob[]);
      setDrivingJobs(drivingData as DrivingJob[]);
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAll();
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
      fetchAll();
    } catch (error: any) {
      showToast(error.message || 'Failed to resolve snag', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassign = async (data: {
    snagId: string;
    assignedTo?: string;
    assignedToExternal?: string;
    deadline?: string;
    notes?: string;
  }) => {
    if (!user?.id) return;
    setReassigning(true);
    try {
      await snagAssignmentService.reassignSnag(
        data.snagId,
        data.assignedTo || null,
        user.id,
        data.deadline,
        data.notes,
        data.assignedToExternal
      );
      showToast('Snag reassigned successfully', 'success');
      setReassignAssignment(null);
      fetchAll();
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

  const getDrivingJobStatus = (job: DrivingJob) => {
    const now = new Date();
    const start = new Date(job.start_datetime);
    const end = new Date(job.end_datetime);
    if (now >= start && now <= end) return 'Active';
    if (now < start) return 'Upcoming';
    return job.status;
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
  const viewingName = teamUsers.find(u => u.id === viewingUserId)?.full_name || 'Team Member';
  const isSelf = viewingUserId === user?.id;
  const effectiveRole = isSelf ? (userRole || '') : (teamUsers.find(u => u.id === viewingUserId)?.role || '');

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">
              {isSelf ? 'My Assignments' : `${viewingName}'s Assignments`}
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
                onChange={e => {
                  const selected = teamUsers.find(u => u.id === e.target.value);
                  setViewingUserId(e.target.value || user?.id || '');
                  setViewingUserRole(selected?.role || userRole || '');
                }}
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
          {isSelf ? 'Your snag assignments, maintenance jobs, and driving duties' : 'Assignments for this team member'}
        </p>
      </div>

      {/* Snag Assignments Section */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          Snag Assignments
        </h2>

        <div className="grid gap-6 mb-6 md:grid-cols-3">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
                <p className="text-sm text-gray-600">Total Assigned</p>
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
            <h3 className="text-lg font-semibold text-red-600 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Overdue
            </h3>
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
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Upcoming</h3>
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
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No snag assignments</p>
          </div>
        )}
      </div>

      {/* Maintenance Jobs Section */}
      {(effectiveRole === 'member' || effectiveRole === 'admin' || effectiveRole === 'user' || maintenanceJobs.length > 0) && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            Maintenance Jobs
            <span className="ml-1 text-sm font-normal text-gray-500">(recent)</span>
          </h2>

          {maintenanceJobs.length > 0 ? (
            <div className="space-y-3">
              {maintenanceJobs.map(job => (
                <MaintenanceJobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">No maintenance jobs logged yet</p>
            </div>
          )}
        </div>
      )}

      {/* Driving Jobs Section */}
      {(effectiveRole === 'driver' || effectiveRole === 'admin' || effectiveRole === 'user' || drivingJobs.length > 0) && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Car className="w-5 h-5 text-green-600" />
            Driving Jobs
            <span className="ml-1 text-sm font-normal text-gray-500">(active &amp; upcoming)</span>
          </h2>

          {drivingJobs.length > 0 ? (
            <div className="space-y-3">
              {drivingJobs.map(job => (
                <DrivingJobCard key={job.id} job={job} getStatus={getDrivingJobStatus} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">No upcoming driving jobs</p>
            </div>
          )}
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

// --- Snag Assignment Card ---

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

// --- Maintenance Job Card ---

function MaintenanceJobCard({ job }: { job: MaintenanceJob }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-400">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{job.reg_number || 'Unknown vehicle'}</span>
            {job.work_category && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                {job.work_category}
              </span>
            )}
          </div>
          <p className="text-gray-800 text-sm mb-1">{job.work_done}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Date: {formatDate(job.service_date)}</span>
            <span>Mileage: {job.mileage.toLocaleString()} km</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Driving Job Card ---

function DrivingJobCard({ job, getStatus }: { job: DrivingJob; getStatus: (job: DrivingJob) => string }) {
  const status = getStatus(job);
  const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    Upcoming: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{job.reg_number || 'Unknown vehicle'}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
              {status}
            </span>
            {job.booking_reference && (
              <span className="text-xs text-gray-400">{job.booking_reference}</span>
            )}
          </div>
          <p className="text-gray-800 text-sm mb-1">Client: {job.client_name}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-gray-500">
            <span>Pickup: {job.start_location}</span>
            <span>Drop-off: {job.end_location}</span>
            <span>Start: {formatDate(job.start_datetime)}</span>
            <span>End: {formatDate(job.end_datetime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
