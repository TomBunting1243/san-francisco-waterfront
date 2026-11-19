import * as THREE from 'three';
import survey from '../public/data/california-terminal.json' with {type:'json'};
import {makeCaliforniaCarBody} from './california-car-body.ts';
import {streetPassenger} from './street-amenities.ts';

const nodes:Record<string,number[]>=survey.nodes;
const scale=.06, speed=9.5*.44704*scale, acceleration=.85*scale;
const railOffset=.5335*scale;
const stops=new Set(survey.stops);
export const californiaIslandTop=.052;
const grade=(z:number)=>.031+.014*THREE.MathUtils.smoothstep(z,-19.70,-19.20);
export const cableRailHead=(z:number)=>grade(z)+.0021;

/** The unpowered coast through the crossover and the outbound track share a
 * short lead. Stamp each physical edge once, even where the routes reverse. */
export function californiaRailGeometry(){
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],edges=new Set<string>();
  const inks=['#8c9082','#555852','#acaca0'].map(c=>new THREE.Color(c));
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
  for(const branch of branches){
    for(let i=1;i<branch.length;i++){
      const u=branch[i-1],v=branch[i],key=Math.min(u,v)+'/'+Math.max(u,v);
      if(edges.has(key))continue;
      edges.add(key);
      const [ax,az]=nodes[u],[bx,bz]=nodes[v],length=Math.hypot(bx-ax,bz-az);
      const nx=(bz-az)/length,nz=(ax-bx)/length;
      const [lx,lz]=joint(u,v,nx,nz,-1),[rx,rz]=joint(v,u,nx,nz,1);
      // Only the apron transition needs subdivisions. The flat street runs
      // retain their original survey vertices all the way to Kearny.
      const n=Math.min(az,bz)<-19.2&&Math.max(az,bz)>-19.7?Math.ceil(length/.09):1;
      for(const [offset,width,h,ink] of [[0,.078,.0006,0],[0,.0037,.0011,1],[-railOffset,.0035,.0021,2],[railOffset,.0035,.0021,2]]){
        const start=vertices.length/3;
        for(let j=0;j<=n;j++){
          const t=j/n;
          for(const edge of [-.5,.5]){
            const x=ax+(bx-ax)*t+(offset+edge*width)*THREE.MathUtils.lerp(lx,rx,t);
            const z=az+(bz-az)*t+(offset+edge*width)*THREE.MathUtils.lerp(lz,rz,t);
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
  function point(d:number){
    let i=1;
    while(i<ids.length-1&&cumulative[i]<d)i++;
    const a=nodes[ids[i-1]],b=nodes[ids[i]],t=(d-cumulative[i-1])/(cumulative[i]-cumulative[i-1]);
    // Extending the end segment here keeps wheelbase and heading well defined at a stop.
    return [THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)];
  }
  function pose(t:number){
    const station=distanceAt(t),halfTruckSpacing=2.75*scale,sign=inbound?-1:1;
    const a=point(station-sign*halfTruckSpacing),b=point(station+sign*halfTruckSpacing);
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    return {x,z,y:cableRailHead(z),yaw:Math.atan2(a[1]-b[1],b[0]-a[0]),
      pitch:Math.atan2(cableRailHead(b[1])-cableRailHead(a[1]),2*halfTruckSpacing)};
  }
  return {pose,duration:legs[legs.length-1].end};
}
const outgoing=railJourney(survey.outbound,false),returning=railJourney(survey.inbound,true);
const layover=31,departure=outgoing.pose(0);

export function createCaliforniaCar(){
  const car=new THREE.Group();car.name='California Street cable car 49';car.scale.setScalar(scale);
  const body=makeCaliforniaCarBody();car.rotation.order='YXZ';car.add(body);
  let headlamp=2;
  const rider=streetPassenger('#315e61','#b88062',true);rider.root.name='California cable car running-board rider';
  car.add(rider.root);
  function update(seconds:number,localMinutes:number){
    const interval=localMinutes<9*60?1200:600;
    const t=THREE.MathUtils.euclideanModulo(seconds,interval),travelTime=t-layover;
    const approaching=t>=interval-returning.duration;
    car.visible=localMinutes>=420&&localMinutes<1260&&(travelTime<=outgoing.duration||approaching);
    if(!car.visible)return;
    headlamp=approaching?3:2;
    const p=approaching?returning.pose(t-(interval-returning.duration)):travelTime<=0?departure:outgoing.pose(travelTime);
    car.position.set(p.x,p.y,p.z);car.rotation.set(0,p.yaw,p.pitch,'YXZ');
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
