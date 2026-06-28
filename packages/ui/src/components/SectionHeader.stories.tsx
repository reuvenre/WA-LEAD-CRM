import type { Meta, StoryObj } from '@storybook/react';
import { Plus } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { Button } from './Button';

const meta: Meta<typeof SectionHeader> = {
  title: 'Components/SectionHeader',
  component: SectionHeader,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {
  args: {
    title: 'דירות יד שניה',
    subtitle: 'נמשך מ-Yad2 · מתאים למשרדי תיווך',
    actions: <Button icon={<Plus className="w-4 h-4" />}>דירה חדשה</Button>,
  },
};
