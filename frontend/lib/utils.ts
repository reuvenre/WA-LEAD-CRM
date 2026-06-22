import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { LeadStatus, Priority } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דק'`;
  if (diffHours < 24) return `לפני ${diffHours} שע'`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;

  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export function formatFullTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Convert a stored UTC ISO timestamp into the value a <input type="datetime-local">
 * expects ('YYYY-MM-DDTHH:mm' in the viewer's LOCAL time). Slicing the raw ISO string
 * would show UTC wall-clock as if it were local, drifting the time by the tz offset.
 */
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert a 'YYYY-MM-DDTHH:mm' datetime-local value (LOCAL time) back to a UTC ISO
 * string for the API, so the backend stores an unambiguous instant.
 */
export function fromDatetimeLocal(local: string): string | null {
  if (!local) return null;
  const d = new Date(local); // datetime-local has no tz → parsed as local time
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  NEW: {
    label: 'חדש',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
  IN_PROGRESS: {
    label: 'בטיפול',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  HOT: {
    label: 'חם',
    color: 'text-red-700',
    bg: 'bg-red-50',
    dot: 'bg-red-500',
  },
  CLOSED: {
    label: 'סגור ✓',
    color: 'text-green-700',
    bg: 'bg-green-50',
    dot: 'bg-green-500',
  },
  LOST: {
    label: 'הפסד',
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    dot: 'bg-slate-400',
  },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  Low: { label: 'נמוכה', color: 'text-slate-500' },
  Med: { label: 'בינונית', color: 'text-amber-600' },
  High: { label: 'גבוהה', color: 'text-red-600' },
};

export const ALL_STATUSES: LeadStatus[] = ['NEW', 'IN_PROGRESS', 'HOT', 'CLOSED', 'LOST'];
export const ALL_PRIORITIES: Priority[] = ['Low', 'Med', 'High'];
