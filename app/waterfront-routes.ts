import * as THREE from 'three';

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

export function waterfrontWalker(time:number,index:number,region?:'street'|'plaza'){
  const rinconRoute=region==='street'||region!=='plaza'&&index<12;
  return along(rinconRoute?rinconWalkers:ferry,time,pedestrianPace,index*.178+(.093*Number(rinconRoute)));
}

export function waterfrontCyclist(time:number,index:number){
  return along(rinconCyclists,time,cyclingPace,.205+index*.323);
}
