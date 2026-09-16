import {createRoot} from 'react-dom/client';
import CityWorld from '../app/CityWorld';
import './city.css';
import './standalone.css';

const lines=[
  'The next ferry is almost here.',
  'Keep an eye out for the fireboat.',
  'A good day for a walk along the water.',
  'Meet you under the clock tower.',
  'Nothing quite like the Bay.',
];

createRoot(document.getElementById('root')!).render(
  <main><CityWorld passerbyLines={lines} fallback={<p className="standalone-fallback" role="status">The interactive city needs a browser with WebGL. You can still enjoy this view of the waterfront.</p>}/></main>
);
