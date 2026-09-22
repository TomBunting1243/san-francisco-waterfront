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
  <main><CityWorld passerbyLines={lines} fallback={<p className="standalone-fallback" role="status">The interactive city needs a browser with WebGL. You can still enjoy this view of the waterfront.</p>}/><footer className="standalone-credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a></footer></main>
);
