import {approachPose} from './approach-road.ts';
import {bridgeLaneCenters} from './bridge-deck.ts';
import {bridgeLayout,bridgePoint} from './bridge-layout.ts';
import {pccDimensions} from './streetcar.ts';
import {streetcarPose} from './streets.ts';

export type RideMode='bridge'|'streetcar';
type Point={x:number;y:number;z:number};
const metres=.06;
const bridgeStart=bridgeLayout.length+7.65,approachEnd=32,bridgeSpeed=1.10;
const streetcarSpeed=.72,acceleration=.075,dwell=7;
const bodyScale=pccDimensions.length/3.629;
// SFMTA northbound stops 14513, 14532 and 14503, projected onto the mapped rail.
// The front boarding door (1.21 in the 1051 body mesh) meets each stop marker.
const doorAhead=1.21*bodyScale;
const ferry=-1.1513-doorAhead,washington=15.1602-doorAhead,broadway=35.3121-doorAhead;
const rampTime=streetcarSpeed/acceleration;
const legDuration=(length:number)=>length/streetcarSpeed+rampTime;
const firstLeg=legDuration(washington-ferry),lastLeg=legDuration(broadway-washington);

export function rideDuration(mode:RideMode){
  return mode==='bridge'?(bridgeStart+approachEnd)/bridgeSpeed:firstLeg+dwell+lastLeg;
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
function legStation(start:number,end:number,time:number){
  const length=end-start,duration=legDuration(length);
  if(time<=0)return start;
  if(time>=duration)return end;
  if(time<rampTime)return start+.5*acceleration*time*time;
  if(time>duration-rampTime)return end-.5*acceleration*(duration-time)**2;
  return start+streetcarSpeed*(time-rampTime/2);
}

/** The station is bridge-local Z (negative onto the approach), or streetcarPose's body X. */
export function driverPose(mode:RideMode,seconds:number){
  const t=Math.max(0,Math.min(rideDuration(mode),Number.isNaN(seconds)?0:seconds));
  if(mode==='bridge'){
    const station=Math.max(-approachEnd,bridgeStart-t*bridgeSpeed);
    return {eye:sedanEye(station),look:sedanEye(station-2.6),station};
  }
  const station=t<=firstLeg?legStation(ferry,washington,t):legStation(washington,broadway,t-firstLeg-dwell);
  const p=streetcarPose(station),dx=Math.cos(p.heading),dz=-Math.sin(p.heading);
  // Left pane of the PCC windshield, one metre behind the glass, 2.15 m above the rails.
  const forward=1.801*bodyScale-1.04*metres,left=.30*metres;
  const eye={x:p.x+dx*forward+dz*left,y:p.y+2.15*metres,z:p.z+dz*forward-dx*left};
  // The motorman looks through the bend; the eye remains fixed to the rigid vehicle.
  const ahead=streetcarPose(station+2.1);
  const look={x:ahead.x+forward*Math.cos(ahead.heading)-left*Math.sin(ahead.heading),y:eye.y,
    z:ahead.z-forward*Math.sin(ahead.heading)-left*Math.cos(ahead.heading)};
  return {eye,look,station};
}
