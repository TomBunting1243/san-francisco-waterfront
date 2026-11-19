import * as THREE from 'three';
import {ferryMarketBoardingHeight} from './ferry-market-platform.ts';
import {ferryRefugeGround} from './curb-survey.ts';
import {ferryEntryX,ferryPorticoGround} from './ferry-portico-access.ts';
import {pccDimensions,pccExitX,pccLengthScale} from './pcc-layout.ts';
import {pccTreads} from './pcc-entrance.ts';
import {transitPassenger} from './transit-passenger.ts';
import {streetcarPose} from './streets.ts';
import {ferryStopX} from './washington-call.ts';
import type {WashingtonTramPose} from './washington-platform.ts';
import {marketWalkDelay} from './waterfront-signals.ts';

const parked=streetcarPose(ferryStopX),exitAlong=pccExitX*pccLengthScale;
const sill=.42*pccDimensions.width/.8835,metre=.06;
const c=Math.cos(parked.heading),s=Math.sin(parked.heading);
const exitX=parked.x+exitAlong*c+sill*s,exitZ=parked.z-exitAlong*s+sill*c;

type Node=readonly [t:number,x:number,z:number,y:number];
function interpolate(nodes:readonly Node[],t:number){
  const end=nodes.findIndex(p=>p[0]>=t);
  const b=nodes[end<0?nodes.length-1:end],a=nodes[Math.max(0,(end<0?nodes.length-1:end)-1)];
  const f=THREE.MathUtils.clamp((t-a[0])/(b[0]-a[0]||1),0,1);
  return {x:a[1]+(b[1]-a[1])*f,z:a[2]+(b[2]-a[2])*f,y:a[3]+(b[3]-a[3])*f,
    yaw:Math.atan2(b[1]-a[1],b[2]-a[2]),walking:t>a[0]&&t<=b[0]&&(a[1]!==b[1]||a[2]!==b[2])};
}

// Coordinates before leaving the sill are in the vehicle's moving frame.
const within:Node[]=[[0,0,-1.04,.96],[1.3,0,-1.04,.96],
  [2.05,0,-.752,pccTreads[3]],[2.59,0,-.522,pccTreads[2]],
  [3.14,0,-.311,pccTreads[1]],[3.68,0,-.10,pccTreads[0]],
  [4.36,0,.22,(.067-parked.y)/metre]];
const platform:Node[]=[[4.36,exitX+.22*metre*s,exitZ+.22*metre*c,.067],
  [5.08,exitX,-3.46,.067],[15.5,.849,-3.46,.067],[20.6,.415,-3.468,.031],
  [28,-.224,-3.48,.031],[30,-.207,-3.32,.0373],[31,-.20,-3.245,.04065]];
const atSignal=platform[platform.length-1][0];
// Seconds from the first legal step. The crossing has curb cuts on both
// sides. Follow the public entrance under the fanlight and turn into the hall.
const crossing:Node[]=[[0,-.20,-3.245,.04065],[.35,-.197,-3.215,.04065],
  [2.1,-.18,-3.066,.0315],[9.8,-.134,-2.382,.0315],[11.6,ferryEntryX,-2.2208,.045],
  [11.61,ferryEntryX,-2.2200,.031],[14.24,ferryEntryX,-1.99,.031],
  [17.82,ferryEntryX,-1.769,.103],[25.6,ferryEntryX,-1.112,.103],
  [29.75,.220,-1.112,.103],[33.03,.220,-.83,.103]];

export function ferryPassengerPose(t:number,elapsed:number,tram:WashingtonTramPose=parked){
  if(t<within[within.length-1][0]){
    const p=interpolate(within,t),pitch=tram.pitch??0,cp=Math.cos(pitch),sp=Math.sin(pitch);
    const along=exitAlong*cp-p.y*metre*sp,across=sill+p.z*metre;
    const co=Math.cos(tram.heading),si=Math.sin(tram.heading);
    return {x:tram.x+along*co+across*si,z:tram.z-along*si+across*co,
      y:tram.y+exitAlong*sp+p.y*metre*cp,yaw:tram.heading,walking:p.walking,visible:Number.isFinite(t)};
  }
  if(t<=atSignal){
    const p=interpolate(platform,t);
    if(p.x>=-.224&&t>=5.08&&t<=28)p.y=ferryMarketBoardingHeight(p.x);
    if(t>28)p.y=ferryRefugeGround(p.x,p.z);
    return {...p,visible:true};
  }
  // The signal clock stays tied to the city even when a ride starts mid-cycle.
  const arrival=elapsed-t+atSignal;
  const sinceWalk=t-atSignal-marketWalkDelay(arrival);
  const p=interpolate(crossing,sinceWalk);
  if(p.z< -3.055)p.y=ferryRefugeGround(p.x,p.z);
  if(sinceWalk>=14.24)p.y=ferryPorticoGround(p.z);
  return {...p,visible:sinceWalk<crossing[crossing.length-1][0]};
}

export function createFerryPassenger(){
  const rider=transitPassenger('canvas tote'),light=new THREE.Vector4();
  rider.root.name='Ferry Building center-exit passenger';rider.root.scale.setScalar(metre);
  function update(t:number,elapsed:number,tram:WashingtonTramPose){
    const p=ferryPassengerPose(t,elapsed,tram);
    rider.root.visible=p.visible;if(!p.visible)return;
    rider.root.position.set(p.x,p.y,p.z);rider.root.rotation.y=p.yaw;
    rider.stride(t,p.walking,0);
    const pitch=tram.pitch??0,height=(2.15+.896)*metre;
    // Right-bank saloon globe at cabin station 7.54 m, beside the center well.
    const along=(exitAlong-.138*metre)*Math.cos(pitch)-height*Math.sin(pitch);
    const across=sill+(1.03-1.506)*metre,co=Math.cos(tram.heading),si=Math.sin(tram.heading);
    light.set(tram.x+along*co+across*si,tram.y+height*Math.cos(pitch)+(exitAlong-.138*metre)*Math.sin(pitch),
      tram.z-along*si+across*co,1-THREE.MathUtils.smoothstep(t,2.9,5.08));
  }
  rider.root.visible=false;
  return {rider:rider.root,update,light};
}
