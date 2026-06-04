import type {
  MaintenanceLog,
  MaintenanceResolvedSnag,
  MaintenanceWorkCategory,
  MaintenanceWorkItem,
} from '../types/database';

export const MAINTENANCE_WORK_CATEGORIES: MaintenanceWorkCategory[] = [
  'Accessories',
  'Body',
  'Brakes',
  'Cooling',
  'Electrical',
  'Engine / Fuel',
  'Exhaust',
  'Gearbox',
  'Service',
  'Steering',
  'Suspension',
  'Wheels',
];

function toTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function compareMaintenanceLogs(a: MaintenanceLog, b: MaintenanceLog): number {
  const dateDiff = toTime(b.service_date) - toTime(a.service_date);
  if (dateDiff !== 0) return dateDiff;

  const mileageDiff = (b.mileage || 0) - (a.mileage || 0);
  if (mileageDiff !== 0) return mileageDiff;

  return toTime(b.created_at) - toTime(a.created_at);
}

export function sortMaintenanceLogs(logs: MaintenanceLog[]): MaintenanceLog[] {
  return [...logs].sort(compareMaintenanceLogs);
}

export function sortMaintenanceWorkItems(items?: MaintenanceWorkItem[]): MaintenanceWorkItem[] {
  return [...(items || [])].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

export function getMaintenanceLogCategories(log: MaintenanceLog): MaintenanceWorkCategory[] {
  const itemCategories = sortMaintenanceWorkItems(log.work_items)
    .map(item => item.work_category)
    .filter((category): category is MaintenanceWorkCategory => Boolean(category));

  const categories = itemCategories.length > 0
    ? itemCategories
    : log.work_category
      ? [log.work_category]
      : [];

  return [...new Set(categories)];
}

export function getMaintenanceResolvedSnag(log: MaintenanceLog): MaintenanceResolvedSnag | null {
  const resolution = log.snag_resolutions?.[0];
  if (!resolution?.snags) return null;

  return Array.isArray(resolution.snags)
    ? resolution.snags[0] || null
    : resolution.snags;
}
