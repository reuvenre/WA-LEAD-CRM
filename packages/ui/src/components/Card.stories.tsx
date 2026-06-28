import type { Meta, StoryObj } from '@storybook/react';
import { Building2, Home, TrendingUp } from 'lucide-react';
import { Card, KpiCard } from './Card';
import { Badge } from './Badge';

const meta: Meta<typeof Card> = { title: 'Components/Card', component: Card };
export default meta;
type Story = StoryObj<typeof Card>;

export const DataCard: Story = {
  render: () => (
    <Card className="p-4 w-72">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-800">פנטהאוז 4 חד׳ בתל אביב</h3>
        <Badge tone="amber">Yad2</Badge>
      </div>
      <p className="text-xs text-slate-500">המשתלה · קומה 4 מתוך 8</p>
      <p className="text-base font-bold text-slate-800 mt-2">₪4,790,000</p>
    </Card>
  ),
};

export const Kpi: Story = {
  render: () => (
    <div className="flex gap-4">
      <KpiCard label="עסקאות פעילות" value="12" hint="+3 החודש" icon={<Building2 className="w-4 h-4" />} />
      <KpiCard label="נכסים" value="48" icon={<Home className="w-4 h-4" />} />
      <KpiCard label="שווי תיק" value="₪82M" hint="GDV" icon={<TrendingUp className="w-4 h-4" />} />
    </div>
  ),
};
