import type { Preview } from '@storybook/react';
import './preview-tailwind.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
  },
};

export default preview;
