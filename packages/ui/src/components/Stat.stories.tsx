import type { Meta, StoryObj } from '@storybook/react';
import { Stat } from './Stat';

const meta: Meta<typeof Stat> = { title: 'Components/Stat', component: Stat };
export default meta;
type Story = StoryObj<typeof Stat>;

export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-2 w-64">
      <Stat label="חדרים" value={4} />
      <Stat label="קומה" value="4 מתוך 8" />
      <Stat label="מ״ר" value={112} />
    </div>
  ),
};
