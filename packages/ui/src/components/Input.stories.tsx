import type { Meta, StoryObj } from '@storybook/react';
import { User, Search } from 'lucide-react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  args: { label: 'שם משתמש', placeholder: 'הזן שם משתמש' },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithIcon: Story = { args: { label: 'שם משתמש', icon: <User className="w-4 h-4" /> } };
export const Search_: Story = { args: { label: 'חיפוש', placeholder: 'שם / טלפון / עיר…', icon: <Search className="w-4 h-4" /> } };
