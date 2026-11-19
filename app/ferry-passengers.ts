import {CatmullRomCurve3,Vector3} from 'three';
import {ferryCycle,vessels,berthThresholds} from './ferry-service.ts';
import type {ferryPose} from './motion.ts';
import {southPlazaTop} from './plaza-survey.ts';
import {harborDatum,waterSurface} from './water-surface.ts';
import {ferryEntryX,ferryPorticoGround} from './ferry-portico-access.ts';
import {ferryConnections} from './ferry-terminal.ts';
import type {createPeople} from './people.ts';

// Vallejo's first arrival uses the starboard edge of float E, berth E1.
// All four travelers stay in the world: a return trip brings each pair back.
const ship=vessels[0],call=ferryCycle,passage=2*call;
const [stopX,stopZ]=berthThresholds.E1,bridge=ferryConnections.find(c=>c.gate==='E')!;
const rampX=stopX-.091,rampFoot=stopZ-1.79,sill=waterSurface.level+ship.sill;
const deckSide=stopX+.155,mooredX=deckSide+ship.beam*.03;
const speed=.088;
type Boat=ReturnType<typeof ferryPose>;
type Plan=[number,number];

function itinerary(person:number,leaving:boolean){
  const rank=person%2,right=leaving?-1:1,aisle=.046*right;
  const cabinZ=stopZ+(rank===0?-.032:.032),endX=mooredX-.222;
  const rampLane=rampX+.026*right;
  const homeX=.50+.21*person;
  const points:Plan[]=[
    [homeX,-2.193],[homeX,-2.147],[homeX-.065,-2.127+aisle*.12],
    [.29,-2.127+aisle*.12],
    [ferryEntryX+aisle+.09,-2.133],[ferryEntryX+aisle,-2.070],[ferryEntryX+aisle,-1.99],
    [ferryEntryX+aisle,-1.20],[ferryEntryX+aisle,1.47],[ferryEntryX+aisle,1.79],
    [ferryEntryX+aisle-.085,1.91+aisle],[-.47,1.94+aisle],[-1.55,1.94+aisle],
    [-4.44,1.94+aisle],[-7.72,1.94+aisle],[bridge.from[0]+aisle+.09,2.01+aisle],
    [bridge.from[0]+aisle,2.17],[bridge.from[0]+aisle,bridge.from[1]],
    [bridge.to[0]+aisle,bridge.to[1]],[bridge.to[0]+aisle+.06,5.162],
    [rampLane-.07,5.198],[rampLane,5.249],[rampLane,rampFoot],
    [rampLane,stopZ-.125],[rampLane+.015,stopZ-.046],
    [rampX+.085,stopZ+.022*right],[stopX+.04,stopZ+.016*right],
    [deckSide+.035,stopZ+.014*right],[endX,cabinZ],
  ];
  // Straight runs stay on the measured surfaces. Give each turn its own
  // short handles so the curve cannot overshoot a gangway or shop doorway.
  const knots:Vector3[]=[];
  const v=points.map(([x,z])=>new Vector3(x,0,z));
  for(let i=0;i<v.length;i++){
    const p=v[i];
    if(i>0&&i+1<v.length){
      const before=v[i-1],after=v[i+1];
      knots.push(p.clone().lerp(before,Math.min(.28,.095/p.distanceTo(before))),p,
        p.clone().lerp(after,Math.min(.28,.095/p.distanceTo(after))));
    }else knots.push(p);
  }
  const curve=new CatmullRomCurve3(knots,false,'centripetal');
  curve.arcLengthDivisions=2400;
  const end=curve.getTangentAt(1);
  return {curve,length:curve.getLength(),endX,cabinZ,endHeading:Math.atan2(end.z,end.x)};
}
export const ferryPassengerCount=4;
const trips=Array.from({length:ferryPassengerCount},(_,i)=>({board:itinerary(i,false),alight:itinerary(i,true)}));
const unit=(v:number)=>Math.min(1,Math.max(0,v));
function floor(x:number,z:number,boat:Boat){
  if(z<1.671)return ferryPorticoGround(z);
  // Follow the granite map court where its diagonal edge meets the lower apron.
  if(z<=2.14&&x>=-8.65&&x<=-6.26-(z-1.64)*(.79/.50))return southPlazaTop;
  if(x>-7.44||z<=bridge.from[1])return harborDatum.ferryApron;
  const tide=boat.tideOffset??0;
  if(z<bridge.to[1])return bridge.landY+(bridge.deckY+tide-bridge.landY)*unit((z-bridge.from[1])/(bridge.to[1]-bridge.from[1]));
  if(x<stopX+.020)return bridge.deckY+tide+(sill-bridge.deckY)*unit((z-rampFoot)/(stopZ-rampFoot));
  return sill+tide+(boat.y-waterSurface.level-tide)*unit((x-stopX-.020)/(deckSide-stopX-.020));
}

export function ferryPassengerPose(elapsed:number,person:number,boat:Boat){
  const {board,alight}=trips[person],rank=person%2;
  const phase=((elapsed+ship.offset+(person>=2?call:0))%passage+passage)%passage;
  const release=30.20+rank*.38,toCabin=.485+rank*.115,waitAt=board.length-toCabin;
  const aboard=release+toCabin/speed,disembark=call+24.1+rank*1.50;
  if(phase>=aboard&&phase<disembark){
    const localZ=board.endX-mooredX,localX=ship.door-(board.cabinZ-stopZ);
    const cs=Math.cos(boat.heading),sn=Math.sin(boat.heading);
    // CityWorld applies local roll before the hull heading. Plant the soles on
    // that same deck and turn toward the cabin after boarding, then toward
    // the open door just before stepping out.
    const roll=Math.sin(elapsed*1.2)*.007*(1-boat.brow),cr=Math.cos(roll),sr=Math.sin(roll);
    const fore=localX*cr-ship.sill*sr;
    let heading=-boat.heading;
    const sinceBoarded=phase-aboard,untilAlighting=disembark-phase;
    if(sinceBoarded<1||untilAlighting<1){
      const target=sinceBoarded<1?board.endHeading:alight.endHeading+Math.PI;
      const t=1-Math.min(sinceBoarded,untilAlighting);
      heading+=Math.atan2(Math.sin(target-heading),Math.cos(target-heading))*t*t*(3-2*t);
    }
    return {x:boat.x+fore*cs+localZ*sn,z:boat.z-fore*sn+localZ*cs,
      y:boat.y+localX*sr+ship.sill*cr,heading,standing:true};
  }
  const ashore=phase>=disembark,walked=(phase-disembark)*speed;
  const inbound=ashore&&walked<alight.length;
  let trip=board,distance:number,standing=false;
  if(inbound){
    trip=alight;distance=trip.length-walked;
  }else if(phase>=release&&phase<aboard){
    distance=waitAt+(phase-release)*speed;
  }else{
    // People reach the head of the ramp at different times, then yield to
    // the arriving passengers before crossing the fully deployed brow.
    const beforeCall=phase<release?phase:phase-passage;
    distance=Math.min(waitAt,Math.max(0,waitAt+(beforeCall-10-rank*1.9)*speed));
    standing=distance===0||distance===waitAt;
  }
  const u=unit(distance/trip.length),p=trip.curve.getPointAt(u),d=trip.curve.getTangentAt(u);
  const heading=standing&&distance===0?Math.PI*.45:Math.atan2(d.z,d.x)+(inbound?Math.PI:0);
  return {x:p.x,z:p.z,y:floor(p.x,p.z,boat),heading,standing};
}

export function updateFerryPassengers(people:ReturnType<typeof createPeople>,start:number,time:number,boat:Boat,hovered:number){
  for(let i=0;i<ferryPassengerCount;i++){
    const at=(offset:number)=>ferryPassengerPose(time+offset,i,boat),p=at(0);
    people.update(start+i,p.x,p.z,time,1,p.y,hovered===start+i?1:0,p.standing,p.heading,p.standing?undefined:at);
  }
}
