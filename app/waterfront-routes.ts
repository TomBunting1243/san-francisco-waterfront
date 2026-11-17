import * as THREE from 'three';

type Point=[number,number];
export const pedestrianPace=.108;
export const bicycleScale=.155;
export const bicycleWheelBottom=.025;
export const rinconGround=.146;
export const plazaGround=.108;

export const rinconLawn:Point[]=[
  [-36.50,-1.24],[-35.1,-1.62],[-33.3,-1.82],[-31.3,-1.49],[-29.2,-.77],
  [-27.1,-.38],[-26.15,-.32],[-26.14,-.12],[-28.8,.10],[-31.2,.40],
  [-33.4,.64],[-35.4,.78],[-36.61,.65],[-36.72,.19],
];
export const rinconLawnHeight=(z:number)=>.147-z*.012;

function curve(points:Point[],height:number,closed:boolean){
  const line=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,height,z)),closed,'centripetal');
  line.arcLengthDivisions=2400;
  return line;
}

const rincon=curve([
  [-36.97,.68],[-36.34,1.01],[-35.1,1.04],[-33.25,.84],[-31.15,.60],
  [-28.92,.32],[-26.45,.035],[-25.57,-.09],[-25.34,-.31],[-25.73,-.51],
  [-27.1,-.64],[-29.05,-1.075],[-31.25,-1.78],[-33.45,-2.11],[-35.42,-1.96],
  [-36.51,-1.45],[-36.86,-.73],[-37.02,.09],
],rinconGround,true);

const ferry=curve([
  [-5.20,2.66],[-3.85,2.56],[-2.55,2.72],[-2.04,3.20],
  [-2.16,4.60],[-2.39,5.89],[-2.84,6.29],[-4.89,6.14],[-5.64,5.57],
  [-5.84,4.16],[-5.78,3.11],
],plazaGround,true);

export const routeWidth={rincon:.60,ferry:.42};
export const routes={rincon,ferry};
const gradedPath=(points:[number,number,number][])=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
export const rinconApproach=gradedPath([
  [-46.51,.045,-1.15],[-46.08,.095,-1.04],[-45.81,.119,-.99],[-44.63,.132,-.71],
  [-42.91,rinconGround,-.37],[-41.13,rinconGround,-.01],[-39.58,rinconGround,.34],
  [-38.25,rinconGround,.68],[-37.13,rinconGround,.85],[-36.34,rinconGround,1.01],
]);
export const rinconExit=gradedPath([
  [-25.74,rinconGround,-.22],[-25.05,rinconGround,-.29],[-24.53,rinconGround,-.25],
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
const rinconWalkers=laneOffset(rincon,.071);
const rinconCyclists=laneOffset(rincon,-.149);
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
