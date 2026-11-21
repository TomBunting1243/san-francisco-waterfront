import * as THREE from 'three';

import {frontMarketShopperCount,frontMarketShopperPose} from './market-shoppers.ts';
import {chestnutWalkerCount,chestnutWalkerPose} from './chestnut-crossing.ts';
import {plazaCrossingCount,plazaCrossingPose} from './plaza-walkers.ts';
import {northWaterfrontGrade,streetPose} from './streets.ts';
import {pier2931Walk} from './north-quay-promenade.ts';
import {pierOneHalfPassageHeight} from './central-pier-access.ts';
import {roadStopLines,signalPeriod} from './waterfront-signals.ts';
import {streetVehicleNose} from './street-vehicles.ts';
import {harborDatum} from './water-surface.ts';
import {rinconPoint} from './rincon-park.ts';

type Point=[number,number];
export const pedestrianPace=.082;
export const bicycleScale=.079;
export const bicycleWheelBottom=.025;
export const rinconGround=.146;
export const plazaGround=.108;

function curve(points:Point[],height:number,closed:boolean){
  const line=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,height,z)),closed,'centripetal');
  line.arcLengthDivisions=2400;
  return line;
}

const rincon=curve([
  [316,219],[322,201],[358,173],[398,159],[433,154],[476,157],[526,172],[578,198],[625,226],
  [640,242],[612,248],[568,254],[528,260],[479,268],[437,274],[394,270],[355,263],[331,247],
].map(([u,v])=>rinconPoint(u,v)),rinconGround,true);

const ferry=curve([
  [-5.20,2.66],[-3.85,2.56],[-2.55,2.72],[-2.04,3.20],
  [-2.16,4.60],[-2.39,5.89],[-2.84,6.29],[-4.89,6.14],[-5.64,5.57],
  [-5.84,4.16],[-5.78,3.11],
],plazaGround,true);

export const routeWidth={rincon:.28,ferry:.42};
export const routes={rincon,ferry};
const gradedPath=(points:[number,number,number][])=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
export const rinconApproach=gradedPath([
  [-46.51,.045,-1.15],[-46.08,.095,-1.04],[-45.81,.119,-.99],[-44.63,.132,-.71],
  [-42.91,rinconGround,-.37],[-41.13,rinconGround,-.01],[-39.58,rinconGround,.34],
  [-38.25,rinconGround,.68],[-37.13,rinconGround,.85],[-35.7,rinconGround,.65],[-34.60,rinconGround,.48],
]);
export const rinconExit=gradedPath([
  [-28.67,rinconGround,.04],[-27.32,rinconGround,-.12],[-25.74,rinconGround,-.22],[-25.05,rinconGround,-.29],[-24.53,rinconGround,-.25],
  [-24.00,rinconGround,-.29],[-23.64,.118,-.29],[-23.10,.078,-.34],[-22.47,.045,-.40],
]);

/** Ribbons share the exact distance-sampled centerline and height of the moving routes. */
export function walkSurface(line:THREE.CatmullRomCurve3,width:number,depth=.075){
  const positions:number[]=[],normals=[];
  const segments=Math.ceil(line.getLength()/.08);
  for(let i=0;i<=segments;i++){
    const t=i/segments,p=line.getPointAt(t),d=line.getTangentAt(t);
    normals.push(p.clone().addScaledVector(new THREE.Vector3(d.z,0,-d.x),width/2),p.clone().addScaledVector(new THREE.Vector3(-d.z,0,d.x),width/2));
  }
  function facet(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3){
    for(const p of [a,b,c,c,b,d])positions.push(...p.toArray());
  }
  for(let i=0;i<segments;i++){
    const [a,b,c,d]=normals.slice(i*2,i*2+4);
    facet(b,d,a,c);
    facet(a,c,a.clone().setY(a.y-depth),c.clone().setY(c.y-depth));
    facet(d,b,d.clone().setY(d.y-depth),b.clone().setY(b.y-depth));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

function laneOffset(line:THREE.CatmullRomCurve3,offset:number){
  const samples=Math.ceil(line.getLength()/.09);
  return curve(Array.from({length:samples},(_,i)=>{
    const t=i/samples,p=line.getPointAt(t),d=line.getTangentAt(t);
    return [p.x+d.z*offset,p.z-d.x*offset];
  }),line.points[0].y,true);
}
const rinconWalkers=laneOffset(rincon,.056);
const rinconCyclists=laneOffset(rincon,-.065);
export const walkingRouteLength={rincon:rinconWalkers.getLength(),ferry:ferry.getLength()};
export const cyclingRouteLength=rinconCyclists.getLength();
export const cyclingPace=.355;

function along(line:THREE.CatmullRomCurve3,time:number,speed:number,progress:number){
  const u=((progress+time*speed/line.getLength())%1+1)%1;
  const p=line.getPointAt(u),d=line.getTangentAt(u);
  return {x:p.x,y:p.y,z:p.z,heading:Math.atan2(d.z,d.x),standing:false};
}

// Two offset lanes joined by half-round turns let people stroll back from
// the end of a pier or an approach without a teleport or an about-face.
function outAndBack(axis:THREE.CatmullRomCurve3,offset:number,spacing=.25){
  const nodes:THREE.Vector3[]=[];
  const n=Math.ceil(axis.getLength()/spacing);
  function point(t:number,side:number,forward=0){
    const p=axis.getPointAt(t),d=axis.getTangentAt(t);
    return p.add(new THREE.Vector3((side*d.z+forward*d.x)*offset,0,(-side*d.x+forward*d.z)*offset));
  }
  for(let i=0;i<=n;i++)nodes.push(point(i/n,1));
  for(let j=1;j<6;j++)nodes.push(point(1,Math.cos(j*Math.PI/6),Math.sin(j*Math.PI/6)));
  for(let i=n;i>=0;i--)nodes.push(point(i/n,-1));
  for(let j=1;j<6;j++)nodes.push(point(0,-Math.cos(j*Math.PI/6),-Math.sin(j*Math.PI/6)));
  const route=new THREE.CatmullRomCurve3(nodes,true,'centripetal');route.arcLengthDivisions=1600;
  return route;
}
const pierSeven=outAndBack(gradedPath([[27.29,harborDatum.pierDeck,-.15],[27.29,harborDatum.pierDeck,4],
  [27.28,harborDatum.pierDeck,9],[27.28,harborDatum.pierDeck,14.11]]),.093);
// Midlines of the city's surveyed sidewalk polygons: north of Washington
// by the park frontage, and Howard to Mission along the west-side shops.
const northShore=outAndBack(curve([[14.80,-4.94],[16.0,-4.88],[18.0,-4.80],
  [20.0,-4.71],[22.0,-4.65],[24.0,-4.61],[25.35,-4.57]],.045,false),.037);
const southShore=outAndBack(curve([[-21.80,-3.115],[-21.0,-3.13],[-20.0,-3.235],[-19,-3.38],
  [-18,-3.561],[-17,-3.75],[-16,-3.80],[-15,-3.895],[-14.1,-3.975]],.045,false),.037);
function approachWalk(axis:THREE.CatmullRomCurve3){
  const nodes=Array.from({length:75},(_,i)=>axis.getPointAt(.025+.95*i/74));
  return outAndBack(new THREE.CatmullRomCurve3(nodes),.044);
}
const rinconEntryWalk=approachWalk(rinconApproach),rinconExitWalk=approachWalk(rinconExit);
// The public opening is on the street. Inside it the walkway turns
// south to the waiting-room door. Continuing straight would reach the slip.
const pierPassage=outAndBack(curve([
  [15.18,-1.991],[15.70,-1.993],[16.30,-1.995],[16.42,-1.990],
  [16.487,-1.944],[16.515,-1.86],[16.515,-1.55],[16.515,-1.25],
  [16.49,-1.13],[16.42,-1.075],[16.30,-1.062],[15.88,-1.062],[15.42,-1.062],
],.06,false),.039,.065);
const slowTime=.85,lookTime=4.2;
// Ease into a short look at the destination, then follow the other side back.
function visitingWalk(line:THREE.CatmullRomCurve3,time:number,startPhase:number){
  const half=line.getLength()/2,leg=half/pedestrianPace+slowTime,period=leg*2+lookTime;
  const phase=THREE.MathUtils.euclideanModulo(time+period*startPhase,period);
  const standing=phase>=leg&&phase<leg+lookTime;
  const returning=phase>=leg+lookTime;
  const legTime=returning?phase-leg-lookTime:Math.min(phase,leg);
  let distance=pedestrianPace*(legTime-slowTime/2);
  if(legTime<slowTime)distance=.5*pedestrianPace*legTime**2/slowTime;
  else if(legTime>leg-slowTime)distance=half-.5*pedestrianPace*(leg-legTime)**2/slowTime;
  const progress=(distance+(returning?half:0))/(2*half);
  const p=line.getPointAt(progress),d=line.getTangentAt(progress);
  const glance=standing?Math.sin(Math.PI*(phase-leg)/lookTime):0;
  return {x:p.x,z:p.z,y:p.y,heading:Math.atan2(d.z,d.x),glance,standing};
}
function passageVisitor(time:number,index:number){
  const {x,z,heading,glance,standing}=visitingWalk(pierPassage,time,index===0?.37:.84);
  return {x,z,y:pierOneHalfPassageHeight(x,z),heading:heading+.70*glance,standing};
}
// People walk between the two historic portals on the Port's apron. The
// surveyed curb is continuous across the jog between the two building fronts.
const pierWalk=outAndBack(gradedPath([82.98,84,86,88,90.205].map(x=>{
  const {curbZ,y}=pier2931Walk(x)!;
  return [x,y,curbZ+.225];
})),.050);
const pierVisitorPhases=[.05,.28,.57,.86];
function northPierVisitor(time:number,index:number){
  const {x,z,heading,glance,standing}=visitingWalk(pierWalk,time,pierVisitorPhases[index]);
  const {wallZ,y}=pier2931Walk(x)!;
  const toSign=Math.atan2(wallZ-z,90.205-x)-heading;
  return {x,z,y,heading:heading+glance*Math.atan2(Math.sin(toSign),Math.cos(toSign)),standing};
}

type Walk={line:THREE.CatmullRomCurve3;count:number}|{pose:(time:number,index:number)=>ReturnType<typeof along>;count:number};
const crossing:Walk={pose:plazaCrossingPose,count:plazaCrossingCount};
const shoppers:Walk={pose:frontMarketShopperPose,count:frontMarketShopperCount};
const passage:Walk={pose:passageVisitor,count:2};
const cityRoutes:Walk[]=[
  {line:rinconWalkers,count:12}, {line:ferry,count:10},
  {line:pierSeven,count:10}, {line:northShore,count:8}, {line:southShore,count:10},
  {line:rinconEntryWalk,count:8}, {line:rinconExitWalk,count:7}, {pose:northPierVisitor,count:pierVisitorPhases.length},
  {pose:chestnutWalkerPose,count:chestnutWalkerCount}, crossing, shoppers, passage,
];
const streetRoutes=[cityRoutes[0],cityRoutes[5],cityRoutes[6],{line:southShore,count:5}];
const plazaRoutes=[cityRoutes[1],cityRoutes[2],cityRoutes[3],crossing,shoppers,passage];
type Region='street'|'plaza';
const walks=(region?:Region)=>region==='street'?streetRoutes:region==='plaza'?plazaRoutes:cityRoutes;
export const waterfrontWalkerCount=(region?:Region)=>walks(region).reduce((sum,r)=>sum+r.count,0);

// Resolve the same four slots in the all-city and plaza casts.
export function frontMarketShopperStart(region?:Region){
  let start=0;
  for(const route of walks(region)){
    if(route===shoppers)return start;
    start+=route.count;
  }
  return -1;
}

export function waterfrontWalker(time:number,index:number,region?:Region){
  for(const route of walks(region)){
    const {count}=route;
    if(index<count){
      if('pose' in route)return route.pose(time,index);
      const phase=(index+.18+.17*Math.sin(index*3.51))/count+.093;
      return along(route.line,time,pedestrianPace,phase);
    }
    index-=count;
  }
  throw new RangeError('Unknown waterfront walker');
}

// Distance is measured along the scene x station; across the signal
// envelopes the lane gradient is under .12. The same elapsed time can be
// sampled out of order or while paused without changing any vehicle's state.
export const waterfrontCarCount=(region?:Region)=>region?20:56;
const streetStart=-80,streetEnd=80,step=.10;
const carriageways=[-1,1].map(direction=>Array.from({length:1601},(_,i)=>streetPose(streetStart+i*step,direction)));
export const waterfrontRoadRange=(region?:Region):[number,number]=>region==='street'?[-79,-4]:region==='plaza'?[-26,37]:[streetStart,streetEnd];
const reactionDelay=[0,1.12,2.6,4.05,5.42,6.85,8.28]; // response delay accumulated down a queue
const queueSpace=[0,.65,1.33,1.98,2.71,3.36,4.06]; // allowance to the front bumper in scene units

// Constant acceleration and braking meet a steady-speed middle section.
// The final position holds until the next scheduled green departure.
function drive(time:number,length:number,speed:number){
  const accel=.155,brake=.195,rise=speed/accel,fall=speed/brake;
  const end=length/speed+(rise+fall)*.5;
  if(time<=0)return 0;
  if(time<rise)return .5*accel*time*time;
  if(time<end-fall)return speed*(time-.5*rise);
  if(time<end)return length-.5*brake*(end-time)**2;
  return length;
}

export function waterfrontCar(time:number,index:number,region?:Region){
  const [start,end]=waterfrontRoadRange(region),north=Boolean(index%2),dir=north?1:-1;
  const lines=north?roadStopLines.north:roadStopLines.south;
  const single=region==='street';
  const gateA=dir*(single||north?lines.mission:lines.washington);
  const gateB=dir*(north?lines.washington:lines.mission);
  const packs=region?2:4,cycles=single?packs:packs+1,perGroup=waterfrontCarCount(region)/(2*packs);
  const number=Math.floor(index/2),rank=number%perGroup,pack=Math.floor(number/perGroup);
  const release=1.0+(north?.18:.85)+reactionDelay[rank];
  const lap=cycles*signalPeriod,phase=((time-release+pack*signalPeriod)%lap+lap)%lap;
  // Each cutaway extends beyond its framed city blocks. An instance leaves the
  // modeled road, stays hidden during the return to the inlet, then starts its
  // next through trip. Never move a visible instance across the waterfront.
  const inlet=north?start:-end,outlet=north?end:-start,transfer=6.5;
  const circuit=outlet-inlet+transfer;
  const leg=single?0:Math.min(2,Math.floor(phase/signalPeriod));
  const market=dir*lines.market;
  const from=leg===0?gateA:leg===1?market:gateB;
  const to=single||leg===2?gateA+circuit:leg===0?market:gateB;
  const speed=!single&&leg<2?(north?.725:.76):region==='plaza'?.91:region==='street'?.81:.85;
  const elapsed=phase-leg*signalPeriod;
  const station=from+drive(elapsed,to-from,speed)-streetVehicleNose(index)-.05-queueSpace[rank];
  const at=station-inlet;
  const k=(at%circuit+circuit)%circuit;
  const span=outlet-inlet,active=k<span;
  const along=active?inlet+k:outlet-(k-span)/transfer*span;
  const x=dir*along,u=Math.max(0,Math.min(1600,(x-streetStart)/step));
  const i=Math.min(1599,Math.floor(u)),lane=carriageways[north?1:0],a=lane[i],b=lane[i+1];
  return {x,z:THREE.MathUtils.lerp(a.z,b.z,u-i),y:northWaterfrontGrade(x)+.00925,heading:a.heading,active};
}

export function waterfrontCyclist(time:number,index:number){
  return along(rinconCyclists,time,cyclingPace,.205+index*.323);
}
