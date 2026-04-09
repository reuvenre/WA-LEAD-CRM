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
    label: 'חם 🔥',
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
