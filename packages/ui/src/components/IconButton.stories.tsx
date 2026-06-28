import type { Meta, StoryObj } from '@storybook/react';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = { title: 'Components/IconButton', component: IconButton };
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <IconButton aria-label="עריכה" tone="brand" icon={<Pencil size={14} />} />
      <IconButton aria-label="פתח מודעה" tone="default" icon={<ExternalLink size={14} />} />
      <IconButton aria-label="מחיקה" tone="danger" icon={<Trash2 size={14} />} />
    </div>
  ),
};
