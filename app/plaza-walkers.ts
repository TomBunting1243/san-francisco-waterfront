// The Market-axis paving runs from the west plaza across the southbound
// carriageway to Harry Bridges Plaza. Both ends of this crossing have a
// ramp. The signal, curb and paving builders use the same surveys.
import {gutterTop,harryBridgesGround,westMarketGround} from './curb-survey.ts';
import {marketWalkDelay,signalPeriod} from './waterfront-signals.ts';

type Stop=readonly [seconds:number,x:number,z:number];
const cycle=2*signalPeriod;
const walk=marketWalkDelay(0);

// Each party goes out and back on different sides of the marked crossing.
// Within a party the second walker stays alongside, including at the curb.
const parties=[
  {offset:0,delay:.6,side:-.065},{offset:0,delay:.8,side:-.008},
  {offset:0,delay:3.7,side:.052},
  {offset:signalPeriod,delay:1.85,side:-.082},{offset:signalPeriod,delay:2,side:-.024},
  {offset:signalPeriod,delay:4.9,side:.037},{offset:signalPeriod,delay:5.1,side:.093},
];
export const plazaCrossingCount=parties.length;

const circuit:Stop[]=[
  [0,-1.28,-7.48],[8,-1.39,-8.04],[12,-1.47,-8.16],[16,-1.49,-8.05],[35,-1.12,-6.34],
  [walk,-1.12,-6.34],[walk+1.2,-1.105,-6.245],[walk+5.8,-1.065,-5.88],[walk+11.8,-.925,-5.395],
  [walk+19.5,-.97,-4.81],[walk+26,-.57,-4.53],[walk+29,-.34,-4.47],
  [walk+39,-.34,-4.47],[walk+46,-.45,-4.74],[walk+55,-.86,-5.31],
  [signalPeriod+walk,-.86,-5.31],[signalPeriod+walk+2,-.875,-5.47],[signalPeriod+walk+6,-.88,-5.78],[signalPeriod+walk+11.7,-.86,-6.24],
  [signalPeriod+walk+14,-.91,-6.42],[cycle,-1.28,-7.48],
];

// Use the neighbouring walking velocities at a corner so shoulders change
// bearing continuously. A stationary neighbour eases the arrival or departure.
function tangent(i:number){
  const previous=circuit[i===0?circuit.length-2:i-1],p=circuit[i],next=circuit[i===circuit.length-1?1:i+1];
  const before=(p[0]-previous[0]+cycle)%cycle,after=(next[0]-p[0]+cycle)%cycle;
  const dx=p[1]-previous[1],dz=p[2]-previous[2],nx=next[1]-p[1],nz=next[2]-p[2];
  if((dx===0&&dz===0)||(nx===0&&nz===0))return [0,0];
  return [(dx/before+nx/after)/2,(dz/before+nz/after)/2];
}
const segments=circuit.slice(1).map(([end,bx,bz],i)=>{
  const [start,ax,az]=circuit[i],span=end-start;
  const [sx,sz]=tangent(i),[ex,ez]=tangent(i+1);
  return {start,end,span,ax,az,dx:bx-ax,dz:bz-az,sx:sx*span,sz:sz*span,ex:ex*span,ez:ez*span};
});

export function plazaCrossingPose(time:number,index:number){
  const {offset,delay,side}=parties[index];
  const t=((time+offset-delay)%cycle+cycle)%cycle;
  const s=segments.find(segment=>t<segment.end)!;
  const u=(t-s.start)/s.span,v=1-u,blend=u*u*(3-2*u);
  const centerZ=s.az+s.dz*blend+s.sz*u*v*v-s.ez*u*u*v;
  // Companions stay abreast when the path turns across the granite.
  const turn=Math.max(0,Math.min(1,(centerZ+5.26)/.56));
  const x=s.ax+s.dx*blend+s.sx*u*v*v-s.ex*u*u*v+side,z=centerZ-side*turn*1.4;
  const tx=6*u*v*s.dx+v*(1-3*u)*s.sx+u*(3*u-2)*s.ex;
  const tz=6*u*v*s.dz+v*(1-3*u)*s.sz+u*(3*u-2)*s.ez;
  const standing=s.dx===0&&s.dz===0;
  const heading=standing?(z< -6?Math.PI/2:z< -5?-Math.PI/2:.65):Math.atan2(tz,tx);
  const y=z<=-6.249?westMarketGround(x,z):z< -5.48?gutterTop:(harryBridgesGround(x,z)??gutterTop);
  return {x,y,z,heading,standing};
}
