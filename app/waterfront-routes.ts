import * as THREE from 'three';

import {streetPose} from './streets.ts';
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
  return {x:p.x,y:p.y,z:p.z,heading:Math.atan2(d.z,d.x)};
}

// Two offset lanes joined by half-round turns let people stroll back from
// the end of a pier or an approach without a teleport or an about-face.
function outAndBack(axis:THREE.CatmullRomCurve3,offset:number){
  const nodes:THREE.Vector3[]=[];
  const n=Math.ceil(axis.getLength()/.25);
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
const cityRoutes=[
  {line:rinconWalkers,count:12}, {line:ferry,count:10},
  {line:pierSeven,count:10}, {line:northShore,count:8}, {line:southShore,count:10},
  {line:rinconEntryWalk,count:8}, {line:rinconExitWalk,count:7},
];
const streetRoutes=[cityRoutes[0],cityRoutes[5],cityRoutes[6],{line:southShore,count:5}];
const plazaRoutes=[cityRoutes[1],cityRoutes[2],cityRoutes[3]];
type Region='street'|'plaza';
const walks=(region?:Region)=>region==='street'?streetRoutes:region==='plaza'?plazaRoutes:cityRoutes;
export const waterfrontWalkerCount=(region?:Region)=>walks(region).reduce((sum,r)=>sum+r.count,0);

export function waterfrontWalker(time:number,index:number,region?:Region){
  for(const {line,count} of walks(region)){
    if(index<count){
      const phase=(index+.18+.17*Math.sin(index*3.51))/count+.093;
      return along(line,time,pedestrianPace,phase);
    }
    index-=count;
  }
  throw new RangeError('Unknown waterfront walker');
}

// Cars share a monotonic flow within each direction. Unequal headways make
// small groups, while the speed modulation preserves their order at wraparound.
export const waterfrontCarCount=(region?:Region)=>region?20:56;
const laneGap=[.61,1.02,.83,4.62,.68,1.55,5.88];
function trafficPhases(count:number){
  const starts:number[]=[];
  let total=0;
  for(let i=0;i<count;i++){starts.push(total);total+=laneGap[i%laneGap.length];}
  return starts.map(p=>p/total);
}
const cityPhases=trafficPhases(waterfrontCarCount()/2),vignettePhases=trafficPhases(waterfrontCarCount('street')/2);
// Sample the surveyed carriageways once. Animation only interpolates the two
// adjacent stations instead of searching all road segments for every vehicle.
const streetStart=-80,streetEnd=80,step=.10;
const carriageways=[-1,1].map(direction=>Array.from({length:1601},(_,i)=>streetPose(streetStart+i*step,direction)));
export const waterfrontRoadRange=(region?:Region):[number,number]=>region==='street'?[-66,-11]:region==='plaza'?[-26,37]:[streetStart,streetEnd];
export function waterfrontCar(time:number,index:number,region?:Region){
  const [start,end]=waterfrontRoadRange(region),span=end-start,direction=index%2?1:-1;
  const phases=region?vignettePhases:cityPhases;
  const u=phases[Math.floor(index/2)] + (direction>0?.16:.42)+time*(direction>0?.74:-.81)/span;
  const cycle=u+.008*Math.sin(6*Math.PI*u+(direction>0?0:1));
  const x=start+span*(cycle-Math.floor(cycle)),station=(x-streetStart)/step;
  const i=Math.min(carriageways[0].length-2,Math.floor(station)),lane=carriageways[direction>0?1:0],a=lane[i],b=lane[i+1];
  return {x,z:THREE.MathUtils.lerp(a.z,b.z,station-i),y:.04025,heading:a.heading};
}

export function waterfrontCyclist(time:number,index:number){
  return along(rinconCyclists,time,cyclingPace,.205+index*.323);
}
