import {approachPose} from './approach-road.ts';
import {bridgeLaneCenters} from './bridge-deck.ts';
import {bridgeLayout,bridgePoint} from './bridge-layout.ts';
import {pccDimensions} from './streetcar.ts';
import {pccDoorLead,ferryStopX,washingtonStopX,washingtonDwell} from './washington-call.ts';
import {museumDoorStation,streetcarRideBody} from './streetcar-ride-path.ts';

export {setStreetcarTrucks} from './streetcar.ts';
export type RideMode='bridge'|'streetcar';
type Point={x:number;y:number;z:number};
const metres=.06;
const bridgeStart=bridgeLayout.length+7.65,approachEnd=32,bridgeSpeed=1.10;
const streetcarSpeed=.72,acceleration=.075,dwell=washingtonDwell;
const bodyScale=pccDimensions.length/3.629;
// SFMTA northbound stops 14727, 14513, 14532 and 14503, projected onto the mapped rail.
// The front boarding door (1.521 in the 1051 body mesh) meets each stop marker.
const doorAhead=pccDoorLead;
const ferry=ferryStopX,washington=washingtonStopX,broadway=35.3121-doorAhead;
const legDuration=(length:number,speed=streetcarSpeed)=>length/speed+speed/acceleration;
const museum=museumDoorStation-doorAhead;
const turnSpeed=.32; // 11.9 mph in the switch and across the arterial.
export const museumLegDuration=legDuration(ferry-museum,turnSpeed);
const firstLeg=legDuration(washington-ferry),lastLeg=legDuration(broadway-washington);

export const washingtonRideArrival=museumLegDuration+dwell+firstLeg;

export function rideDuration(mode:RideMode){
  return mode==='bridge'?(bridgeStart+approachEnd)/bridgeSpeed:museumLegDuration+dwell+firstLeg+dwell+lastLeg;
}

// OSM 8921938 / 1343738800 mark lane five Fremont/Folsom exit-only.
// Lane four continues onto the right edge of the four-lane I-80 mainline.
const throughLane=1;
const throughOffset=bridgeLaneCenters[3];
const spanJoint=bridgePoint(throughOffset,0),approachJoint=approachPose(false,0,throughLane);

function bridgeRoad(station:number):Point{
  if(station<0){
    const p=approachPose(false,-station,throughLane);
    // approachPose places the animated body's wheel reference .01375 below the actual pavement.
    // The lane count changes five-to-four over a 2 m survey segment. A
    // driver shifts half a lane over the adjoining carriageway, not in 2 m.
    const spacing=Math.min(-station/2,.52);
    let x=p.x*3,z=p.z*3;
    for(const k of [-2,-1,1,2]){
      const sample=approachPose(false,-station+k*spacing,throughLane),w=3-Math.abs(k);
      x+=w*sample.x;z+=w*sample.z;
    }
    // Match the painted span tangent at the joint before following the first surveyed chord.
    const jointWeight=Math.max(0,1+station/2)**2;
    return {x:x/9+(spanJoint.x-approachJoint.x)*jointWeight,y:p.y+.01375,
      z:z/9+(spanJoint.z-approachJoint.z)*jointWeight};
  }
  // The suspension asphalt and its YBI continuation have the same wearing surface.
  return {...bridgePoint(throughOffset,station),y:bridgeLayout.upperDeck+.0755};
}

function sedanEye(station:number):Point{
  const p=bridgeRoad(station),before=bridgeRoad(station+.45),after=bridgeRoad(station-.45);
  const dx=after.x-before.x,dz=after.z-before.z,len=Math.hypot(dx,dz);
  return {x:p.x+.38*metres*dz/len,y:p.y+1.18*metres,z:p.z-.38*metres*dx/len};
}

// Constant acceleration into cruise, then a matching braking distance into the platform.
function legStation(start:number,end:number,time:number,speed=streetcarSpeed){
  const length=end-start,duration=legDuration(length,speed),rampTime=speed/acceleration;
  if(time<=0)return start;
  if(time>=duration)return end;
  if(time<rampTime)return start+.5*acceleration*time*time;
  if(time>duration-rampTime)return end-.5*acceleration*(duration-time)**2;
  return start+speed*(time-rampTime/2);
}

/** The station is bridge-local Z (negative onto the approach), or distance along the museum curve switching to mainline X. */
export function driverPose(mode:RideMode,seconds:number){
  const t=Math.max(0,Math.min(rideDuration(mode),Number.isNaN(seconds)?0:seconds));
  if(mode==='bridge'){
    const station=Math.max(-approachEnd,bridgeStart-t*bridgeSpeed);
    return {eye:sedanEye(station),look:sedanEye(station-2.6),station,body:undefined};
  }
  const onward=t-museumLegDuration-dwell;
  const station=t<=museumLegDuration?legStation(museum,ferry,t,turnSpeed):onward<=firstLeg?legStation(ferry,washington,onward):legStation(washington,broadway,onward-firstLeg-dwell);
  const p=streetcarRideBody(station),dx=Math.cos(p.heading),dz=-Math.sin(p.heading);
  // Left pane of the PCC windshield, one metre behind the glass, 2.15 m above the rails.
  const forward=1.801*bodyScale-1.04*metres,left=.30*metres;
  const cosPitch=Math.cos(p.pitch),sinPitch=Math.sin(p.pitch),height=2.15*metres;
  const along=forward*cosPitch-height*sinPitch;
  const eye={x:p.x+dx*along+dz*left,y:p.y+forward*sinPitch+height*cosPitch,z:p.z+dz*along-dx*left};
  // The cab, eye and lamp follow the same rigid heading through the switch.
  const look={x:eye.x+2.1*dx*cosPitch,y:eye.y+2.1*sinPitch,z:eye.z+2.1*dz*cosPitch};
  return {eye,look,station,body:p};
}
