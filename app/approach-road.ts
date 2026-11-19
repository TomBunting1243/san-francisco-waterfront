import * as THREE from 'three';
import data from '../public/data/approach-soma.json' with {type:'json'};
import { bayReliefGround } from './bay-relief.ts';
import { bridgeLayout } from './bridge-layout.ts';
import {roadPaintLift} from './bridge-deck.ts';
import { createStreetVehicle, streetVehicleMaterial } from './street-vehicles.ts';

export type ApproachMesh = (shape:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Group) => THREE.Mesh;
type Knot = {x:number;z:number;s:number;lanes:number};
type Grade = (s:number,z:number) => number;
const {lerp,smoothstep}=THREE.MathUtils;
const laneWidth=.216;
const concrete='#a6aba1', beamPaint='#8c9a98', roadPaint='#738587';
export const approachGround=(x:number,z:number)=>Math.max(bayReliefGround(x,z),-.01-.51*smoothstep(-z,114,126));

export function approachDistance(x:number,z:number,points:number[][]) {
  let nearest=Infinity;
  for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i],dx=bx-ax,dz=bz-az;
    const u=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);
    nearest=Math.min(nearest,Math.hypot(x-ax-u*dx,z-az-u*dz));
  }
  return nearest;
}

function measured(points:number[][]) {
  let s=0;
  return points.map(([x,z,lanes],i):Knot=>{
    if(i)s+=Math.hypot(x-points[i-1][0],z-points[i-1][1]);
    return {x,z,lanes,s};
  });
}
function gradeAt(stations:number[][],z:number){
  const index=Math.min(stations.length-1,Math.max(1,stations.findIndex(([distance])=>-z<=distance)));
  const [from,y0]=stations[index-1],[to,y1]=stations[index];
  return lerp(y0,y1,smoothstep(-z,from,to));
}

function axis(knots:Knot[],grade:Grade,branch=false){
  const length=knots.at(-1)!.s;
  const stations=knots.map((k,i)=>{
    const p=knots[Math.max(i-1,0)],q=knots[Math.min(i+1,knots.length-1)];
    const dx=q.x-p.x,dz=q.z-p.z,heading=-Math.atan2(dz,dx);
    return {...k,heading};
  });
  function sample(s:number) {
    s=THREE.MathUtils.clamp(s,0,length);
    let lo=0,hi=stations.length-1;
    while(hi-lo>1){
      const at=(lo+hi)>>1;
      if(stations[at].s<s)lo=at;else hi=at;
    }
    const a=stations[lo],b=stations[hi],u=(s-a.s)/(b.s-a.s||1);
    const x=lerp(a.x,b.x,u),z=lerp(a.z,b.z,u);
    const heading=a.heading+Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading))*u;
    const lanes=lerp(a.lanes,b.lanes,u),nominal=lanes*laneWidth*.5+.051;
    const width=branch?nominal:lerp(.607,nominal,smoothstep(s,0,4));
    return {x,y:grade(s,z),z,heading,width,lanes};
  }
  return {sample,knots,length};
}

const westGrade=[[22.65,bridgeLayout.upperDeck+.0755],[35,4.13],[56,3.22],[84,2.06],[102,1.65],[123,1.45],[151,1.07],[160,.94]];
const eastGrade=[[22.65,bridgeLayout.lowerDeck+.058],[36,3.48],[55,2.94],[85,2.01],[104,1.62],[128,1.41],[151,1.04],[160,.93]];
const main=[axis(measured(data.west.points),(_,z)=>gradeAt(westGrade,z)),axis(measured(data.east.points),(_,z)=>gradeAt(eastGrade,z))];
const exits=new Set(['Harrison Street exit','Fremont Street exit','Fifth Street exit','Fourth Street exit','Seventh Street exit','Ninth Street exit']);
const westConnect=new Set(['Harrison Street exit','Fremont Street exit','Fifth Street exit','Fifth Street entrance','Ninth Street exit']);
const ramps=data.ramps.map(road=>{
  const highwayStart=exits.has(road.name);
  const [,sz]=road.points[highwayStart?0:road.points.length-1];
  const [tx,tz]=road.points[highwayStart?road.points.length-1:0];
  const mainGrade=westConnect.has(road.name)?westGrade:eastGrade;
  const y0=gradeAt(mainGrade,sz)-.026;
  const y1=approachGround(tx,tz)+.09;
  const knots=measured(road.points),length=knots.at(-1)!.s;
  const ramp=axis(knots,s=>{
    const t=highwayStart?s/length:1-s/length;
    // Leave enough height for the two loop ramps to cross their own feeder roads.
    return lerp(y0,y1,smoothstep(t,.04,.91));
  },true);
  return {ramp,joinDistance:highwayStart?0:length};
});

function section(at:ReturnType<typeof main[number]['sample']>,offset:number,height:number) {
  return [at.x+Math.sin(at.heading)*offset,at.y+height,at.z+Math.cos(at.heading)*offset];
}
function intervals(length:number,knots:Knot[]) {
  return [...new Set([...knots.map(k=>k.s),...Array.from({length:Math.ceil(length/.8)},(_,i)=>i*.8)])].sort((a,b)=>a-b);
}

function slabGeometry(axis:typeof main[number],from:number,to:number,offsetA:number|((w:number)=>number),offsetB:number|((w:number)=>number),heightA:number,heightB:number) {
  const ease=(offset:number|((w:number)=>number),width:number)=>typeof offset==='number'?offset:offset(width);
  const distances=[from,...intervals(axis.length,axis.knots).filter(s=>s>from&&s<to),to];
  const vertices:number[]=[];
  for(let i=1;i<distances.length;i++){
    const a=axis.sample(distances[i-1]),b=axis.sample(distances[i]);
    const c=section(a,ease(offsetA,a.width),heightA),d=section(b,ease(offsetA,b.width),heightA);
    const e=section(b,ease(offsetB,b.width),heightB),f=section(a,ease(offsetB,a.width),heightB);
    vertices.push(...c,...d,...e,...c,...e,...f);
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}

// Use the same two planes per road section as slabGeometry. A dash starting in
// the middle of a curved grade must lie on the rendered slab, not on a fresh
// evaluation of the road profile at its endpoints.
function pavementMarkings(axis:typeof main[number]){
  const stations=[...new Set([0,...intervals(axis.length,axis.knots),axis.length])].sort((a,b)=>a-b);
  const rows=stations.map(s=>{
    const a=axis.sample(s);
    return {s,w:a.width,left:section(a,-a.width,0),right:section(a,a.width,0)};
  });
  type UV=[number,number];
  return (from:number,to:number,center:(w:number)=>number,width:number)=>{
    const vertices:number[]=[];
    for(let j=1;j<rows.length;j++){
      const a=rows[j-1],b=rows[j];
      if(b.s<=from)continue;
      if(a.s>=to)break;
      const lo=(Math.max(a.s,from)-a.s)/(b.s-a.s),hi=(Math.min(b.s,to)-a.s)/(b.s-a.s);
      const point=(v:number,edge:number):UV=>{
        const w=lerp(a.w,b.w,v);return [.5+(center(w)+edge*width/2)/(2*w),v];
      };
      const quad=[point(lo,1),point(hi,1),point(hi,-1),point(lo,-1)];
      for(const first of [true,false]){
        const poly:UV[]=[];
        for(let i=0;i<4;i++){
          const p=quad[i],q=quad[(i+1)%4],d=p[0]+p[1]-1,e=q[0]+q[1]-1;
          if(first?d<=0:d>=0)poly.push(p);
          if(d*e<0)poly.push([lerp(p[0],q[0],d/(d-e)),lerp(p[1],q[1],d/(d-e))]);
        }
        const vertex=([u,v]:UV)=>{
          for(let k=0;k<3;k++){
            const value=first?a.left[k]+u*(a.right[k]-a.left[k])+v*(b.left[k]-a.left[k]):
              b.right[k]+(1-u)*(b.left[k]-b.right[k])+(1-v)*(a.right[k]-b.right[k]);
            vertices.push(value+(k===1?roadPaintLift:0));
          }
        };
        for(let i=1;i+1<poly.length;i++){vertex(poly[0]);vertex(poly[i]);vertex(poly[i+1]);}
      }
    }
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.computeVertexNormals();g.userData.roadPaint='SoMa approaches';return g;
  };
}

export function approachPose(eastbound:boolean,distance:number,lane:number){
  const axis=main[eastbound?1:0],at=axis.sample(distance);
  const laneLimit=Math.max(0,Math.floor((at.lanes-1)/2));
  const laneAlignment=Math.abs(at.lanes%2-1)*.5;
  const offset=(THREE.MathUtils.clamp(lane,-laneLimit,laneLimit)+laneAlignment)*laneWidth;
  const [x,y,z]=section(at,offset,-.01375);
  return {x,y,z,heading:at.heading+(eastbound?Math.PI:0)};
}
export const approachLengths=main.map(road=>road.length);

export function buildApproachRoad(mesh:ApproachMesh,root:THREE.Group) {
  const group=new THREE.Group();
  group.name='Mapped I-80 west approach and SoMa ramps';
  root.add(group);
  const unit=new THREE.BoxGeometry(1,1,1);
  function box(name:string,w:number,h:number,d:number,color:string,x:number,y:number,z:number,heading=0){
    const m=mesh(unit,color,x,y,z,group);
    m.name=name;m.scale.set(w,h,d);m.rotation.y=heading;
  }
  for(const [routeIndex,axis] of [...main,...ramps.map(r=>r.ramp)].entries()){
    const branch=routeIndex>1,westbound=routeIndex===0;
    const bridgeFoot=!branch;
    const marking=pavementMarkings(axis);
    const right=(w:number)=>w,left=(w:number)=>-w;
    // Continuous extruded top and side surfaces, with joints between consecutive
    // spans placed in the darker concrete beam and a low cast parapet.
    for(let from=0;from<axis.length;from+=12){
      const to=Math.min(from+12,axis.length);
      const add=(geo:THREE.BufferGeometry,color:string)=>mesh(geo,color,0,0,0,group);
      add(slabGeometry(axis,from,to,right,left,0,0),roadPaint);
      add(slabGeometry(axis,from,to,left,right,-.142,-.142),beamPaint);
      add(slabGeometry(axis,from,to,right,right,-.142,0),concrete);
      add(slabGeometry(axis,from,to,left,left,0,-.142),concrete);
      for(const side of [-1,1]){
        const inner=(w:number)=>side*(w-.047),outer=(w:number)=>side*w;
        const start=bridgeFoot&&from===0?.14:from;
        add(slabGeometry(axis,start,to,side>0?inner:outer,side>0?outer:inner,-.072,-.072),beamPaint);
        add(slabGeometry(axis,start,to,outer,outer,side>0?-.072:.103,side>0?.103:-.072),concrete);
        add(slabGeometry(axis,start,to,inner,inner,side>0?.103:0,side>0?0:.103),concrete);
        add(slabGeometry(axis,start,to,side>0?outer:inner,side>0?inner:outer,.103,.103),concrete);
        const edge=(w:number)=>side*(w-.059);
        add(marking(from,to,edge,.011),side===(westbound?-1:1)?'#c4ab72':'#d8d8c3');
      }
    }
    for(let s=bridgeFoot?.115:1.4;s<axis.length-.6;s+=.86){
      const p=axis.sample(s);
      const lanes=Math.round(p.lanes);
      for(let lane=1;lane<lanes;lane++){
        const x=(lane-lanes/2)*laneWidth;
        mesh(marking(s,Math.min(s+.25,axis.length),()=>x,.008),'#cbcbbb',0,0,0,group);
      }
    }
    for(let s=branch?1.8:2.6;s<axis.length-1.5;s+=branch?2.8:3.1){
      const p=axis.sample(s),ground=approachGround(p.x,p.z)-.06;
      if(p.y<ground+.46)continue;
      const runway=ramps[routeIndex-2];
      const closeToMain=branch&&Math.abs(s-runway.joinDistance)<1.9;
      if(closeToMain)continue;
      box('Concrete transverse cap',.19,.145,p.width*1.8,concrete,p.x,p.y-.166,p.z,p.heading);
      const feet=branch?[0]:[-.34,.34];
      for(const footprint of feet){
        const [x,,z]=section(p,p.width*footprint,0);
        const base=approachGround(x,z)-.10;
        const girder=p.y-.18,postH=girder-base;
        box('Pier foundation',.29,.14,.29,'#b0afa0',x,base+.043,z,p.heading);
        box('Concrete pier',.139,postH,.151,'#abae9f',x,(girder+base)/2,z,p.heading);
      }
    }
  }
  const paint=streetVehicleMaterial(),matrix=new THREE.Object3D();
  const count=15;
  const streams=Array.from({length:4},(_,body)=>{
    const car=createStreetVehicle(body,paint,true);
    const geometry=(car.children[0] as THREE.Mesh).geometry;
    const instances=new THREE.InstancedMesh(geometry,paint,count);
    instances.name='Skyway traffic';
    instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instances.receiveShadow=true;
    instances.frustumCulled=false;
    group.add(instances);
    return instances;
  });
  matrix.scale.setScalar(.25);
  const update=(elapsed:number)=>{
    for(const [body,instances] of streams.entries()){
      for(let i=0;i<count;i++){
        const index=i*streams.length+body;
        const eastbound=(i+body)%2===1,roadIndex=eastbound?1:0;
        const road=main[roadIndex],speed=eastbound?1.21:-1.10;
        const lane=(Math.floor(index/2)%3)-1;
        const seed=(Math.floor(index/6)*16.73+lane*.91+(i%3)*2.73+body*3.01)%road.length;
        const s=THREE.MathUtils.euclideanModulo(seed-elapsed*speed,road.length);
        const pose=approachPose(eastbound,s,lane);
        matrix.position.set(pose.x,pose.y,pose.z);
        matrix.rotation.y=pose.heading;matrix.updateMatrix();instances.setMatrixAt(i,matrix.matrix);
      }
      instances.instanceMatrix.needsUpdate=true;
    }
  };
  update(0);
  return update;
}
