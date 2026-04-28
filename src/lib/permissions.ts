import { UserRole } from '../types/database';

export interface PermissionCheck {
  canViewAll: boolean;
  canCreateGlobal: boolean;
  canEditGlobal: boolean;
  canDeleteGlobal: boolean;
  canCreateInBranch: boolean;
  canEditInBranch: boolean;
  canDeleteInBranch: boolean;
  canManageUsers: boolean;
  canManageBranches: boolean;
  canViewReports: boolean;
}

export function getPermissions(role: UserRole): PermissionCheck {
  switch (role) {
    case 'admin':
      return {
        canViewAll: true,
        canCreateGlobal: true,
        canEditGlobal: true,
        canDeleteGlobal: true,
        canCreateInBranch: true,
        canEditInBranch: true,
        canDeleteInBranch: true,
        canManageUsers: true,
        canManageBranches: true,
        canViewReports: true,
      };

    case 'user':
      return {
        canViewAll: true,
        canCreateGlobal: false,
        canEditGlobal: false,
        canDeleteGlobal: false,
        canCreateInBranch: true,
        canEditInBranch: true,
        canDeleteInBranch: true,
        canManageUsers: false,
        canManageBranches: false,
        canViewReports: true,
      };

    case 'member':
      return {
        canViewAll: true,
        canCreateGlobal: false,
        canEditGlobal: false,
        canDeleteGlobal: false,
        canCreateInBranch: true,
        canEditInBranch: true,
        canDeleteInBranch: true,
        canManageUsers: false,
        canManageBranches: false,
        canViewReports: false,
      };

    case 'driver':
      return {
        canViewAll: false,
        canCreateGlobal: false,
        canEditGlobal: false,
        canDeleteGlobal: false,
        canCreateInBranch: false,
        canEditInBranch: true,
        canDeleteInBranch: false,
        canManageUsers: false,
        canManageBranches: false,
        canViewReports: false,
      };

    default:
      return {
        canViewAll: false,
        canCreateGlobal: false,
        canEditGlobal: false,
        canDeleteGlobal: false,
        canCreateInBranch: false,
        canEditInBranch: false,
        canDeleteInBranch: false,
        canManageUsers: false,
        canManageBranches: false,
        canViewReports: false,
      };
  }
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const permissions = getPermissions(role);

  if (route.includes('/users') || route.includes('/user-management')) {
    return permissions.canManageUsers;
  }

  if (route.includes('/settings')) {
    return permissions.canManageUsers || permissions.canManageBranches;
  }

  return true;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'user':
      return 'User';
    case 'member':
      return 'Member';
    case 'driver':
      return 'Driver';
    default:
      return role;
  }
}

export function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Full access to all features and data across all branches. Can manage users and system settings.';
    case 'user':
      return 'Full access except User Management, Pricing, Company Settings, and Settings. Can manage bookings, quotes, invoices, emails, and reports.';
    case 'member':
      return 'Full access except User Management, Pricing, Company Settings, Settings, Create Invoice, Emails, and Reports. Can manage bookings and quotes, and assign or reassign snags.';
    case 'driver':
      return 'Can update mileage, view bookings, and update location information for vehicles they operate.';
    default:
      return '';
  }
}

export function canDeleteVehicle(role: UserRole): boolean {
  return role === 'admin' || role === 'user';
}
