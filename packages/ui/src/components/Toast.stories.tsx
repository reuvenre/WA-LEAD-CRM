import type { Meta, StoryObj } from '@storybook/react';
import { Toast } from './Toast';

const meta: Meta<typeof Toast> = {
  title: 'Components/Toast',
  component: Toast,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof Toast>;

export const Tones: Story = {
  render: () => (
    <div className="relative h-40">
      <Toast tone="success" className="!static !translate-x-0 inline-flex mx-2">✓ הלקוח נוסף</Toast>
      <Toast tone="default" className="!static !translate-x-0 inline-flex mx-2">✓ נשמר</Toast>
      <Toast tone="error" className="!static !translate-x-0 inline-flex mx-2">משיכת הדירות נכשלה</Toast>
    </div>
  ),
};
