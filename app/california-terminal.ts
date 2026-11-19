import * as THREE from 'three';
import survey from '../public/data/california-terminal.json' with {type:'json'};
import {makeCaliforniaCarBody,makeCaliforniaRunningGear} from './california-car-body.ts';
import {streetPassenger} from './street-amenities.ts';

const nodes:Record<string,number[]>=survey.nodes;
const scale=.06, speed=9.5*.44704*scale, acceleration=.85*scale;
const railOffset=.5335*scale;
const stops=new Set(survey.stops);
export const californiaIslandTop=.052;
const grade=(z:number)=>.031+.014*THREE.MathUtils.smoothstep(z,-19.70,-19.20);
export const cableRailHead=(z:number)=>grade(z)+.0021;

const branches=[survey.outbound,survey.inbound,survey.stub];
const connected=new Map<number,Set<number>>();
for(const branch of branches)for(let i=1;i<branch.length;i++){
  const a=branch[i-1],b=branch[i];
  if(!connected.has(a))connected.set(a,new Set());
  if(!connected.has(b))connected.set(b,new Set());
  connected.get(a)!.add(b);connected.get(b)!.add(a);
}
// Miter adjacent railheads at the shared survey pin; square-ended strips
// leave hairline holes on the outside of bends, even at the terminal stop.
function joint(id:number,other:number,nx:number,nz:number,sign:number){
  const [x,z]=nodes[id];let best=0,rx=nx,rz=nz;
  for(const next of connected.get(id)!){
    if(next===other)continue;
    const [u,v]=nodes[next],len=Math.hypot(u-x,v-z),qx=sign*(v-z)/len,qz=sign*(x-u)/len;
    const dot=nx*qx+nz*qz;
    if(dot>best){best=dot;rx=(nx+qx)/(1+dot);rz=(nz+qz)/(1+dot);}
  }
  return [rx,rz];
}

function segment(id:number,next:number){
  const [ax,az]=nodes[id],[bx,bz]=nodes[next],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
  const nx=dz/length,nz=-dx/length;
  const subdivisions=Math.min(az,bz)<-19.2&&Math.max(az,bz)>-19.7?Math.ceil(length/.09):1;
  return {ax,az,dx,dz,length,subdivisions,left:joint(id,next,nx,nz,-1),right:joint(next,id,nx,nz,1)};
}
/** The unpowered coast through the crossover and the outbound track share a
 * short lead. Stamp each physical edge once, even where the routes reverse. */
export function californiaRailGeometry(){
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],edges=new Set<string>();
  const inks=['#8c9082','#555852','#acaca0'].map(c=>new THREE.Color(c));
  for(const branch of branches){
    for(let i=1;i<branch.length;i++){
      const u=branch[i-1],v=branch[i],key=Math.min(u,v)+'/'+Math.max(u,v);
      if(edges.has(key))continue;
      edges.add(key);
      const {ax,az,dx,dz,subdivisions:n,left:[lx,lz],right:[rx,rz]}=segment(u,v);
      // Only the apron transition needs subdivisions. The flat street runs
      // retain their original survey vertices all the way to Kearny.
      for(const [offset,width,h,ink] of [[0,.078,.0006,0],[0,.0037,.0011,1],[-railOffset,.0035,.0021,2],[railOffset,.0035,.0021,2]]){
        const start=vertices.length/3;
        for(let j=0;j<=n;j++){
          const t=j/n;
          for(const edge of [-.5,.5]){
            const x=ax+dx*t+(offset+edge*width)*THREE.MathUtils.lerp(lx,rx,t);
            const z=az+dz*t+(offset+edge*width)*THREE.MathUtils.lerp(lz,rz,t);
            vertices.push(x,grade(z)+h,z);colors.push(inks[ink].r,inks[ink].g,inks[ink].b);
          }
          if(j){const a=start+2*j-2;indices.push(a,a+3,a+1,a,a+2,a+3);}
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.userData.paintVertices=true;
  return geometry;
}

function railJourney(ids:number[],inbound:boolean){
  const cumulative=[0];
  for(let i=1;i<ids.length;i++){
    const a=nodes[ids[i-1]],b=nodes[ids[i]];
    cumulative.push(cumulative[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));
  }
  const legs:{from:number;to:number;time:number;ramp:number;cruise:number;end:number}[]=[];
  let from=0,time=0;
  for(let i=1;i<ids.length;i++){
    if(!stops.has(ids[i])&&i<ids.length-1)continue;
    const to=cumulative[i],length=to-from,ramp=Math.min(speed/acceleration,Math.sqrt(length/acceleration));
    const cruise=Math.max(0,(length-acceleration*ramp*ramp)/(acceleration*ramp));
    const end=time+2*ramp+cruise;
    legs.push({from,to,time,ramp,cruise,end});
    from=to;time=end+7;
  }
  function distanceAt(t:number){
    const leg=legs.find(l=>t<l.end+7)??legs[legs.length-1];
    const {from,to,time:start,ramp,cruise,end}=leg,dt=Math.max(0,t-start);
    if(dt<ramp)return from+acceleration*dt*dt/2;
    if(dt<ramp+cruise)return from+acceleration*ramp*(dt-ramp/2);
    return to-acceleration*Math.max(0,end-t)**2/2;
  }
  const sections=ids.slice(1).map((id,i)=>segment(ids[i],id));
  function sample(d:number){
    let i=1;
    while(i<ids.length-1&&cumulative[i]<d)i++;
    const s=sections[i-1],t=(d-cumulative[i-1])/s.length;
    return {s,t,x:s.ax+s.dx*t,z:s.az+s.dz*t};
  }
  const sign=inbound?-1:1;
  function pose(t:number){
    const station=distanceAt(t),halfTruckSpacing=2.74*scale;
    const a=sample(station-sign*halfTruckSpacing),b=sample(station+sign*halfTruckSpacing);
    const lo=cableRailHead(a.z),hi=cableRailHead(b.z);
    return {x:(a.x+b.x)/2,z:(a.z+b.z)/2,y:(lo+hi)/2,yaw:Math.atan2(a.z-b.z,b.x-a.x),
      pitch:Math.atan2(hi-lo,Math.hypot(b.x-a.x,b.z-a.z)),station};
  }
  function wheelContact(station:number,along:number,center:THREE.Vector3,side:THREE.Vector3){
    const {s,t,x,z}=sample(station+sign*along*scale);
    const dx=-sign*THREE.MathUtils.lerp(s.left[0],s.right[0],t)*railOffset;
    const dz=-sign*THREE.MathUtils.lerp(s.left[1],s.right[1],t)*railOffset;
    // Interpolate the same triangulated grade as the physical rail mesh;
    // one wheel may be higher while the pair crosses the apron obliquely.
    const k=Math.floor(t*s.subdivisions),t0=k/s.subdivisions,t1=(k+1)/s.subdivisions;
    const sideHeight=(side:number)=>{
      const h=(f:number)=>cableRailHead(s.az+s.dz*f-side*sign*THREE.MathUtils.lerp(s.left[1],s.right[1],f)*railOffset);
      return THREE.MathUtils.lerp(h(t0),h(t1),t*s.subdivisions-k);
    };
    const low=sideHeight(-1),high=sideHeight(1);
    side.set(2*dx,high-low,2*dz).normalize();
    center.set(x,(low+high)/2,z);
  }
  return {pose,wheelContact,duration:legs[legs.length-1].end};
}
const outgoing=railJourney(survey.outbound,false),returning=railJourney(survey.inbound,true);
const layover=31,departure=outgoing.pose(0);

export function createCaliforniaCar(){
  const car=new THREE.Group();car.name='California Street cable car 49';car.scale.setScalar(scale);
  const body=makeCaliforniaCarBody(false);car.rotation.order='YXZ';car.add(body);
  let headlamp=2;
  const rider=streetPassenger('#315e61','#b88062',true);rider.root.name='California cable car running-board rider';
  car.add(rider.root);
  const {axles,frames}=makeCaliforniaRunningGear();
  car.add(...axles,...frames);
  const stations=[-3.53,-1.95,1.95,3.53];
  const centers=stations.map(()=>new THREE.Vector3()),sides=stations.map(()=>new THREE.Vector3());
  const xAxis=new THREE.Vector3(),yAxis=new THREE.Vector3(),zAxis=new THREE.Vector3(),mid=new THREE.Vector3();
  const inv=new THREE.Quaternion(),basis=new THREE.Matrix4();
  function align(part:THREE.Mesh,origin:THREE.Vector3,side:THREE.Vector3,forward:THREE.Vector3){
    zAxis.copy(side).normalize();yAxis.crossVectors(zAxis,forward).normalize();xAxis.crossVectors(yAxis,zAxis);
    basis.makeBasis(xAxis,yAxis,zAxis);
    part.quaternion.setFromRotationMatrix(basis).premultiply(inv);
    part.position.copy(origin).sub(car.position).applyQuaternion(inv).multiplyScalar(1/scale);
  }
  const forward=new THREE.Vector3(),across=new THREE.Vector3();
  let gearStation=NaN,gearInbound=false;
  function update(seconds:number,localMinutes:number){
    const interval=localMinutes<9*60?1200:600;
    const t=THREE.MathUtils.euclideanModulo(seconds,interval),travelTime=t-layover;
    const approaching=t>=interval-returning.duration;
    car.visible=localMinutes>=420&&localMinutes<1260&&(travelTime<=outgoing.duration||approaching);
    if(!car.visible)return;
    headlamp=approaching?3:2;
    const p=approaching?returning.pose(t-(interval-returning.duration)):travelTime<=0?departure:outgoing.pose(travelTime);
    // The passenger keeps moving through a layover while all six pieces of
    // running gear stay on the same steel. Reuse those transforms at stops.
    if(p.station!==gearStation||approaching!==gearInbound){
      gearStation=p.station;gearInbound=approaching;
      car.position.set(p.x,p.y,p.z);car.rotation.set(0,p.yaw,p.pitch,'YXZ');inv.copy(car.quaternion).invert();
      const path=approaching?returning:outgoing;
      for(let i=0;i<4;i++)path.wheelContact(p.station,stations[i],centers[i],sides[i]);
      for(let j=0;j<2;j++){
        const i=2*j;
        forward.subVectors(centers[i+1],centers[i]).normalize();
        align(axles[i],centers[i],sides[i],forward);align(axles[i+1],centers[i+1],sides[i+1],forward);
        mid.addVectors(centers[i],centers[i+1]).multiplyScalar(.5);across.addVectors(sides[i],sides[i+1]);
        align(frames[j],mid,across,forward);
      }
    }
    // The outbound island is to the car's left. The passenger walks along it,
    // turns to the end platform, steps onto the running board and rides away.
    const walk=THREE.MathUtils.smoothstep(t,1,6),cross=THREE.MathUtils.smoothstep(t,9,16);
    rider.root.visible=!approaching;
    rider.root.position.set(-.80-2.68*walk,THREE.MathUtils.lerp((californiaIslandTop-departure.y)/scale,.32,cross),-1.86+.74*cross);
    rider.root.rotation.y=-Math.PI*.5*(1-walk);
    rider.stride(t,(t>1&&t<6)||(t>9&&t<16),THREE.MathUtils.smoothstep(t,12,16));
  }
  update(0,720);
  return {car,body,update,get headlamp(){return headlamp;}};
}
