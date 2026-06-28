import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  LayoutDashboard, Building2, Home, Building, KeyRound, Users, GitBranch,
  CalendarDays, MessageSquare, Settings as SettingsIcon, LogOut,
} from 'lucide-react';
import { Sidebar } from './Sidebar';

const meta: Meta<typeof Sidebar> = {
  title: 'Components/Sidebar',
  component: Sidebar,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof Sidebar>;

const ITEMS = [
  { key: 'dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={16} /> },
  { key: 'deals', label: 'עסקאות', icon: <Building2 size={16} /> },
  { key: 'properties', label: 'נכסים', icon: <Home size={16} /> },
  { key: 're_projects', label: 'פרויקטים', icon: <Building size={16} /> },
  { key: 'listings', label: 'דירות יד שניה', icon: <KeyRound size={16} /> },
  { key: 'clients', label: 'לקוחות', icon: <Users size={16} /> },
  { key: 'kanban', label: 'פייפליין', icon: <GitBranch size={16} /> },
  { key: 'calendar', label: 'יומן פגישות', icon: <CalendarDays size={16} /> },
  { key: 'chat', label: 'WhatsApp', icon: <MessageSquare size={16} /> },
];

export const Default: Story = {
  render: () => {
    const [active, setActive] = useState('dashboard');
    return (
      <Sidebar
        brandLabel="Real Estate"
        brandSubLabel="ניהול נדל״ן"
        logoText="RE"
        user={{ name: 'admin', role: 'מנהל-על' }}
        highlightUser
        items={ITEMS}
        activeKey={active}
        onSelect={setActive}
        footer={
          <>
            <button className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
              <SettingsIcon size={16} /> הגדרות
            </button>
            <button className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition-colors">
              <LogOut size={16} /> התנתק
            </button>
          </>
        }
      />
    );
  },
};
