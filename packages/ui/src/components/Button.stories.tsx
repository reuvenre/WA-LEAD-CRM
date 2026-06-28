import type { Meta, StoryObj } from '@storybook/react';
import { Plus } from 'lucide-react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'כניסה למערכת' },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'דירה חדשה' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'הגדרות' } };
export const Danger: Story = { args: { variant: 'danger', children: 'מחיקה' } };
export const WithIcon: Story = { args: { icon: <Plus className="w-4 h-4" />, children: 'הוסף לקוח' } };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">קטן</Button>
      <Button size="md">בינוני</Button>
      <Button size="lg">גדול</Button>
    </div>
  ),
};
