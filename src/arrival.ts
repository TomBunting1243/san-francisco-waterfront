import './city.css';
import './standalone.css';
import {attachClockArrival,finishClockArrival} from '../app/clock-arrival';
import {pacificLighting} from '../app/lighting';
import {cityDate} from '../app/city-conditions';
import {loadConditions} from './conditions';
const {minutes}=loadConditions();
const darkPrint=minutes===undefined&&document.documentElement.dataset.palette==='ink';
document.documentElement.dataset.clockLight=darkPrint||pacificLighting(cityDate(new Date(),minutes)).night>.55?'night':'day';
const poster=document.querySelector<HTMLElement>('.world-poster');
const detachPoster=poster?attachClockArrival(poster):()=>{};
const root=document.getElementById('root')!;
const replaced=new MutationObserver(()=>{if(!poster?.isConnected){detachPoster();replaced.disconnect();}});
replaced.observe(root,{childList:true});

// Every visitor to the standalone site opens on the waterfront. Start the
// survey and its renderer dependencies while the controls are downloading.
// CityWorld still owns construction, the progress bar and WebGL recovery.
if (window.WebGL2RenderingContext) {
  void import('../app/landscape').catch(() => {});
}
void import('./main').catch(() => {
  replaced.disconnect();
  detachPoster();finishClockArrival();
  const loader = document.querySelector('.world-loading');
  const message = loader?.querySelector('[role="status"]');
  if (message) message.textContent = 'The waterfront couldn’t load. Reload to try again.';
  loader?.querySelector('progress')?.remove();
});
