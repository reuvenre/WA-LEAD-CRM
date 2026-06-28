import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Components/Avatar',
  component: Avatar,
  args: { name: 'admin' },
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-3 bg-navy p-4 rounded-lg">
      <Avatar name="admin" tone="brand" />
      <Avatar name="daniel" tone="amber" />
      <Avatar name="שירה" tone="slate" />
      <Avatar name="R" tone="brand" size={48} />
    </div>
  ),
};
