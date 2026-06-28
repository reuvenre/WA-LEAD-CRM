import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';

const meta: Meta<typeof Spinner> = { title: 'Components/Spinner', component: Spinner };
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size={20} />
      <Spinner size={32} />
      <Spinner size={48} />
    </div>
  ),
};
