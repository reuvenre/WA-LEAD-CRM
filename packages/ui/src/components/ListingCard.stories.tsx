import type { Meta, StoryObj } from '@storybook/react';
import { ExternalLink } from 'lucide-react';
import { ListingCard } from './ListingCard';

const meta: Meta<typeof ListingCard> = {
  title: 'Real Estate/ListingCard',
  component: ListingCard,
  args: {
    title: 'מיני פנטהאוז 4 חד׳ בתל אביב',
    subtitle: 'מיני פנטהאוז · המשתלה',
    address: 'דוד אבידן, תל אביב יפו',
    price: 4790000,
    rooms: 4,
    floor: 4,
    totalFloors: 8,
    sizeSqm: 112,
    source: 'Yad2',
    listedBy: 'פרטי',
    sourceUrl: 'https://www.yad2.co.il/item/f4vgnrwd',
    linkIcon: <ExternalLink size={13} />,
  },
};
export default meta;
type Story = StoryObj<typeof ListingCard>;

export const Private: Story = {};
export const Agency: Story = {
  args: { listedBy: 'בתיווך', source: 'Madlan', title: 'דירה 5 חד׳ ברעננה', price: 3250000, rooms: 5, floor: 0, totalFloors: 0, sizeSqm: 135 },
};

export const Grid: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ width: 620 }}>
      <ListingCard {...args} />
      <ListingCard {...args} title="פנטהאוז 5 חד׳ בהרצליה" price={9800000} rooms={5} floor={12} totalFloors={14} sizeSqm={180} listedBy="בתיווך" source="Madlan" />
    </div>
  ),
};
