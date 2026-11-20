import {filmAssetPath,selectFilmEdition,type FilmEdition} from '../app/cinematic-edition.ts';
import {readMotionPreference} from '../app/city-runtime.ts';
import {loadConditions} from './conditions.ts';

const root=document.documentElement;
if(matchMedia('(prefers-color-scheme: dark)').matches)root.dataset.palette='ink';
const still=matchMedia('(prefers-reduced-motion: reduce)').matches||readMotionPreference();
const capture=(window as Window&{cityPosterCapture?:string}).cityPosterCapture;
const edition=!capture&&window.WebGL2RenderingContext&&selectFilmEdition(location.search,new Date(),loadConditions().minutes);
if(edition){
  (window as Window&{waterfrontFilmEdition?:FilmEdition}).waterfrontFilmEdition=edition;
  root.dataset.openingPhase='film';
  root.dataset.openingFilm=edition.palette;
  const network=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
  const saveData=network?.saveData||matchMedia('(prefers-reduced-data: reduce)').matches;
  // The custom property is consumed by the compiled stylesheet under assets/.
  // Resolve it against the page, just like the matching image preload.
  const src=new URL(filmAssetPath(edition)+(still||saveData?'-end':'')+'.webp',document.baseURI).href;
  root.style.setProperty('--opening-image','url("'+src+'")');
  const preload=document.createElement('link');
  preload.rel='preload';preload.as='image';preload.href=src;preload.fetchPriority='high';
  document.head.appendChild(preload);
}else if(window.WebGL2RenderingContext&&window.ResizeObserver&&!still){
  root.dataset.clockArrival='on';
}
