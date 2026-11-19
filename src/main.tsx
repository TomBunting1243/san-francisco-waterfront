import {useCallback,useRef,useState} from 'react';
import CustomConditions, {type Ride} from './CustomConditions';
import {loadConditions,saveConditions,type Conditions} from './conditions.ts';
import {createRoot} from 'react-dom/client';
import CityWorld from '../app/CityWorld';
import './city.css';
import './standalone.css';

const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
function updatePalette() {
  document.documentElement.dataset.palette = darkMode.matches ? 'ink' : 'paper';
  window.dispatchEvent(new Event('portfolio-palette-change'));
}
updatePalette();
darkMode.addEventListener('change', updatePalette);

const lines=[
  'The next ferry is almost here.',
  'Keep an eye out for the fireboat.',
  'A good day for a walk along the water.',
  'Meet you under the clock tower.',
  'Nothing quite like the Bay.',
];

function StandaloneCity(){
  const [conditions,setConditions]=useState(loadConditions);
  const [ride,setRide]=useState<Ride|null>(null);
  const customButton=useRef<HTMLButtonElement>(null);
  const endRide=useCallback(()=>{
    setRide(null);
    customButton.current?.focus({preventScroll:true});
  },[]);
  function apply(value:Conditions){setConditions(value);saveConditions(value);}
  return <main>
    <CityWorld conditions={conditions} passerbyLines={lines} ride={ride} onRideEnd={endRide}
      overlay={<CustomConditions value={conditions} change={apply} ride={ride} customButton={customButton}
        startRide={mode=>setRide({mode,paused:false})} toggleRide={()=>setRide(current=>current&&{...current,paused:!current.paused})} endRide={endRide}/>}
      fallback={<p className="standalone-fallback" role="status">The interactive city needs a browser with WebGL. You can still enjoy this view of the waterfront.</p>}/>
    <footer className="standalone-credit">
      Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      {' · '}<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>
      {' · '}<a href="https://www.mapzen.com/data/elevation/" target="_blank" rel="noreferrer">Mapzen terrain</a>
      {' · '}<a href="https://tidesandcurrents.noaa.gov/ports/index.html?port=sf" target="_blank" rel="noreferrer">NOAA waterfront weather</a>
    </footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<StandaloneCity/>);
