import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'פעיל' },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="brand">חדש</Badge>
      <Badge tone="amber">בטיפול</Badge>
      <Badge tone="red">חם</Badge>
      <Badge tone="green">סגור ✓</Badge>
      <Badge tone="slate">לא רלוונטי</Badge>
      <Badge tone="emerald">פרטי</Badge>
      <Badge tone="indigo">בתיווך</Badge>
    </div>
  ),
};
