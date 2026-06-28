import type { Meta, StoryObj } from '@storybook/react';
import { KeyRound } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

const meta: Meta<typeof EmptyState> = { title: 'Components/EmptyState', component: EmptyState };
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: <KeyRound size={32} />,
    title: 'לא נמצאו דירות',
    description: 'בחר עיר וסנן לפי חדרים/סוג, ואז לחץ "משוך".',
    action: <Button>משוך דירות</Button>,
  },
};
