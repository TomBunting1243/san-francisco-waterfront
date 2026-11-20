import {cityDate} from './city-conditions.ts';
import {waterfrontSun} from './lighting.ts';
import type {WaterfrontShot} from './waterfront-shot.ts';

export type FilmPalette='day'|'night';
export type FilmEdition={shot:WaterfrontShot;palette:FilmPalette};

export function selectFilmEdition(search:string,now:Date,minutes?:number):FilmEdition{
  const params=new URLSearchParams(search),opening=params.get('opening');
  const shot=opening==='bridge'?'city-to-bridge':'bridge-to-city';
  const demo=params.get('film');
  // Use the same twilight threshold as the waterfront prints in the live scene.
  const palette=demo==='day'||demo==='night'?demo:waterfrontSun(cityDate(now,minutes)).night>.55?'night':'day';
  return {shot,palette};
}

export const portraitFilmQuery='(orientation: portrait)';

export function filmAssetPath({shot,palette}:FilmEdition,portrait:boolean){
  return './openings/'+shot+(palette==='night'?'-night':'')+(portrait?'-portrait':'');
}
