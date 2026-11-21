import {northWaterfrontGrade} from './north-quay-grade.ts';
import {signalPeriod} from './waterfront-signals.ts';

// The straightened 2024 SF ortho puts the two ladder sections on one oblique
// line, from inland pixel (158,35) to Port-side (199,302). Each walker
// keeps a separate shoulder-width lane, including on the return trip.
const lanes=[
  {offset:-4,curbStart:37.469,curbEnd:40.426,portEdge:290.162,delay:.25},
  {offset:4,curbStart:33.100,curbEnd:37.049,portEdge:290.174,delay:.85},
];
export const chestnutWalkerCount=lanes.length;
const duration=22,accelerationTime=.7;
const course=Math.atan2(1-.2*41/267,41/267);

export function chestnutWalkerPose(time:number,index:number){
  const lane=lanes[index];
  const cycle=Math.floor(time/signalPeriod),phase=time-cycle*signalPeriod;
  const outbound=(cycle+index)%2===0;
  const start=38+lane.delay,t=Math.max(0,Math.min(duration,phase-start));
  // Short acceleration and braking steps leave most of the crossing at a
  // brisk, constant walking pace. Both sides clear before through traffic.
  let distance=t-accelerationTime/2;
  if(t<accelerationTime)distance=t*t/(2*accelerationTime);
  else if(t>duration-accelerationTime)distance=duration-accelerationTime-(duration-t)**2/(2*accelerationTime);
  const progress=distance/(duration-accelerationTime);
  const v=22+(305-22)*(outbound?progress:1-progress);
  const u=158+(v-35)*41/267+lane.offset;
  const x=80+u/112,z=-11+(660+v-.20*u)/112;
  // Curb tops overlap the lower inland sidewalk. The Port promenade and
  // its curb share a height; the road paint is flush with the carriageway.
  const rise=v<lane.curbStart?.014:v<lane.curbEnd||v>=lane.portEdge?.018:0;
  const standing=t===0||t===duration;
  const turn=Math.max(0,Math.min(1,(phase-start-duration-.5)/1.8));
  const heading=course+(outbound?0:Math.PI)+Math.PI*turn;
  return {x,y:northWaterfrontGrade(x)+rise,z,heading,standing};
}
