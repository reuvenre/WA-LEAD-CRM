'use client';

import { Clock, User, Tag, ArrowRightLeft, StickyNote, MessageSquare } from 'lucide-react';
import type { Activity } from '@/types';
import { cn } from '@/lib/utils';

interface ActivityLogProps {
  activities: Activity[];
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'שינוי סטטוס': <ArrowRightLeft className="w-3 h-3" />,
  'שיוך נציג': <User className="w-3 h-3" />,
  'עדכון תגיות': <Tag className="w-3 h-3" />,
  'הערה פנימית': <StickyNote className="w-3 h-3" />,
  'הודעה נכנסת': <MessageSquare className="w-3 h-3" />,
};

const ACTION_COLORS: Record<string, string> = {
  'שינוי סטטוס': 'bg-blue-100 text-blue-600',
  'שיוך נציג': 'bg-purple-100 text-purple-600',
  'עדכון תגיות': 'bg-amber-100 text-amber-600',
  'הערה פנימית': 'bg-slate-100 text-slate-600',
  'הודעה נכנסת': 'bg-green-100 text-green-600',
};

export function ActivityLog({ activities }: ActivityLogProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
        <Clock className="w-6 h-6 text-slate-300" />
        <p className="text-xs">אין פעילות עדיין</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        const icon = ACTION_ICONS[activity.action] ?? <Clock className="w-3 h-3" />;
        const color = ACTION_COLORS[activity.action] ?? 'bg-slate-100 text-slate-600';
        const time = new Date(activity.createdAt).toLocaleString('he-IL', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });

        return (
          <div key={activity.id} className="flex items-start gap-2">
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', color)}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-slate-700">{activity.action}</span>
                <span className="text-[10px] text-slate-400 flex-shrink-0">{time}</span>
              </div>
              {activity.details && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{activity.details}</p>
              )}
              <p className="text-[10px] text-slate-400">{activity.actor}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
