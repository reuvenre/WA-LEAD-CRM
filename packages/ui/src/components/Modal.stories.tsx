import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';

const meta: Meta<typeof Modal> = { title: 'Components/Modal', component: Modal };
export default meta;
type Story = StoryObj<typeof Modal>;

export const ClientForm: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>פתח טופס לקוח</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="לקוח חדש" subtitle="פרופיל קונה חדש">
          <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-2 gap-3">
              <Input label="שם" defaultValue="יוסי כהן" />
              <Input label="טלפון" defaultValue="052-1234567" />
              <Input label="עיר" defaultValue="תל אביב" />
              <Select label="חדרים" defaultValue="4">
                {[2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
            <Button className="w-full">הוסף לקוח</Button>
          </form>
        </Modal>
      </>
    );
  },
};
