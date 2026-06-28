import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  args: { label: 'חדרים' },
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: (args) => (
    <Select {...args}>
      {[2, 3, 4, 5, 6].map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </Select>
  ),
};
