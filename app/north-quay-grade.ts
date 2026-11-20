import {bayReliefGround} from './bay-relief.ts';
import survey from '../public/data/sightline-streets.json' with {type:'json'};

// Sample the regional ground under both carriageways at the same cross
// sections used to triangulate the road. This keeps tires, rails and paint
// on a single, continuous grade where the flat core meets the relief.
const profile=survey.gradeAxis.map(([x,z])=>Math.max(0,...[-.8,0,.8].map(d=>bayReliefGround(x,z+d)+.04)));
export const northQuayStations=survey.gradeAxis.map(([x])=>x);
export function northWaterfrontGrade(x:number){
  const base=.031+.023*Math.max(0,Math.min(1,x-35));
  const t=Math.max(0,Math.min(profile.length-1,(x-northQuayStations[0])/2));
  const i=Math.floor(t);
  return base+profile[i]+(profile[Math.min(i+1,profile.length-1)]-profile[i])*(t-i);
}
