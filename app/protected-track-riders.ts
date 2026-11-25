import {howardMissionCyclePoint} from './howard-mission-bikeway.ts';

// Turn in the open receiving area at Howard and inside the Mission bike box.
// Centre stations and track widths are pixels on the registered 2024 aerial.
const howard=4377,mission=5590,turnRadius=7.5,scale=132;
const straight=(mission-howard)/scale,cruise=.292,corner=.058,rampSeconds=3.4;
const rampDistance=(corner+cruise)*.5*rampSeconds;
const cruiseSeconds=(straight-2*rampDistance)/cruise;
const legSeconds=2*rampSeconds+cruiseSeconds;
const turnLength=Math.PI*turnRadius/scale,turnSeconds=turnLength/corner;
const halfLap=legSeconds+turnSeconds;
export const trackRidePeriod=2*halfLap;

function distanceFromRest(t:number){
  const u=t/rampSeconds;
  // Integral of a smoothstep speed transition from turning speed to cruise.
  return corner*t+(cruise-corner)*rampSeconds*(u*u*u-.5*u*u*u*u);
}
function station(t:number){
  if(t<rampSeconds)return distanceFromRest(t);
  if(t<legSeconds-rampSeconds)return rampDistance+(t-rampSeconds)*cruise;
  return straight-distanceFromRest(legSeconds-t);
}
export function protectedTrackRider(time:number,index:number){
  const seconds=((time+(index===0?.13:.64)*trackRidePeriod)%trackRidePeriod+trackRidePeriod)%trackRidePeriod;
  const direction=seconds<halfLap?1:-1;
  const t=seconds%halfLap,begin=direction===1?howard:mission,end=direction===1?mission:howard;
  const arc=Math.max(0,(t-legSeconds)/turnSeconds)*Math.PI;
  const distance=t<legSeconds?station(t):straight;
  const u=arc===0?begin+direction*distance*scale:end+direction*turnRadius*Math.sin(arc);
  const p=howardMissionCyclePoint(u,direction);
  // Average the tangent across a wheelbase so a surveyed paint joint does
  // not twitch the handlebars as the front and rear tires pass it.
  const slope=(howardMissionCyclePoint(u+5,direction).z-howardMissionCyclePoint(u-5,direction).z)*scale/10;
  // The two lane centres follow a slightly sloping road edge. Bend into the
  // opposite centreline along the same tangent, including at the period seam.
  p.z-=direction*turnRadius/scale*(1-Math.cos(arc));
  const heading=Math.atan2(direction*(slope*Math.cos(arc)-Math.sin(arc)),direction*Math.cos(arc));
  const travelled=(direction===1?0:straight+turnLength)+distance+arc*turnRadius/scale;
  const crank=travelled/(2*(straight+turnLength))*Math.PI*2*48;
  return {...p,heading,crank,standing:false};
}
