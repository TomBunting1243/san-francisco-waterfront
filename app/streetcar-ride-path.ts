import junction from '../public/data/steuart-junction.json' with {type:'json'};
import {registeredMarketTracks} from './california-sidewalk.ts';
import {trackAt,waterfrontRailTop,donCheeRailTop} from './streets.ts';
import {pccLengthScale,pccTruckHalfSpacing,pccAxleHalfSpacing} from './pcc-layout.ts';

const turn=junction.curves.find(curve=>curve.way===93448549)!.points;
const path=[...registeredMarketTracks[331003151].slice(-5),...junction.westJoin.slice(1),...turn.slice(1)];
const ends=path.map(()=>0);
const join=path[path.length-1][0];
ends[ends.length-1]=join;
for(let i=ends.length-2;i>=0;i--)ends[i]=ends[i+1]-Math.hypot(path[i][0]-path[i+1][0],path[i][1]-path[i+1][1]);

// The west-side high landing serves 14727 inbound. Project its center to the
// adjacent rail. Station follows path length up to the switch, then mainline X.
const pad=junction.landings[1],padX=(pad[0][0]+pad[3][0])/2,padZ=(pad[0][1]+pad[3][1])/2;
let best=Infinity,sPlatform=0;
for(let i=1;i<path.length;i++){
  const [x,z]=path[i-1],dx=path[i][0]-x,dz=path[i][1]-z;
  const f=Math.min(1,Math.max(0,((padX-x)*dx+(padZ-z)*dz)/(dx*dx+dz*dz)));
  const error=Math.hypot(x+f*dx-padX,z+f*dz-padZ);
  if(error<best){best=error;sPlatform=ends[i-1]+f*(ends[i]-ends[i-1]);}
}
export const museumDoorStation=sPlatform;
export function rideRailAt(s:number){
  if(s>=join)return {...trackAt(s),y:waterfrontRailTop(s)};
  let i=1;while(i<ends.length-1&&ends[i]<s)i++;
  const f=(s-ends[i-1])/(ends[i]-ends[i-1]),a=path[i-1],b=path[i];
  const x=a[0]+f*(b[0]-a[0]),z=a[1]+f*(b[1]-a[1]);
  return {x,z,y:donCheeRailTop(z),heading:-Math.atan2(b[1]-a[1],b[0]-a[0])};
}
const halfWheelbase=pccTruckHalfSpacing*pccLengthScale,halfAxles=pccAxleHalfSpacing*pccLengthScale;
type Sample=ReturnType<typeof rideRailAt>;
function chord(a:Sample,b:Sample){
  return {x:(b.x+a.x)/2,y:(a.y+b.y)/2,z:(b.z+a.z)/2,heading:-Math.atan2(b.z-a.z,b.x-a.x)};
}
function bogie(s:number){
  const a=rideRailAt(s-halfAxles),b=rideRailAt(s+halfAxles);
  return {...chord(a,b),pitch:Math.atan2(b.y-a.y,Math.hypot(b.x-a.x,b.z-a.z))};
}
export function streetcarRideBody(s:number){
  // Fit the two swiveling truck frames to the rail, then fit the rigid PCC to
  // the kingpins. This gives the driver's seat its outward sweep on the bend.
  let half=halfWheelbase;
  let rear=bogie(s-half),front=bogie(s+half);
  for(let i=0;i<3;i++){
    half*=2*halfWheelbase/Math.hypot(front.x-rear.x,front.z-rear.z);
    rear=bogie(s-half);front=bogie(s+half);
  }
  return {...chord(rear,front),pitch:Math.atan2(front.y-rear.y,Math.hypot(front.x-rear.x,front.z-rear.z)),rear,front};
}
