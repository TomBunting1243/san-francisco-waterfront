import * as THREE from 'three';
import { approachLampStart, approachLampSpacing } from './authored-road-light.ts';
import data from '../public/data/approach-soma.json' with {type:'json'};
import { bayReliefGround } from './bay-relief.ts';
import { bridgeLayout } from './bridge-layout.ts';
import {roadPaintLift} from './bridge-deck.ts';
import { createStreetVehicle, streetVehicleMaterial, streetVehicleTreadHeight } from './street-vehicles.ts';

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

function axis(knots:Knot[],grade:Grade,branch=false,firstHeading?:number){
  const length=knots.at(-1)!.s;
  const stations=knots.map((k,i)=>{
    const p=knots[Math.max(i-1,0)],q=knots[Math.min(i+1,knots.length-1)];
    const dx=q.x-p.x,dz=q.z-p.z,heading=-Math.atan2(dz,dx);
    return {...k,heading:i===0&&firstHeading!==undefined?firstHeading:heading};
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
// The OSM Fremont ramp and the five-lane mainline share a graph node
// (ways 8921938 / 1343738800). It is a topology node at road center, not
// the center of an exit lane. Register the two-lane ramp between lanes 4/5.
const fremontRoad=data.ramps.find(r=>r.name==='Fremont Street exit')!;
const rampNode=fremontRoad.points[0];
export const fremontFork=main[0].knots.find(k=>k.x===rampNode[0]&&k.z===rampNode[1])!.s;
function fremontKnots(points:number[][]){
  const m=main[0].sample(fremontFork),end=points[2],next=points[3];
  const d=Math.hypot(next[0]-end[0],next[1]-end[1]);
  const start=new THREE.Vector2(m.x+Math.sin(m.heading)*1.5*laneWidth,m.z+Math.cos(m.heading)*1.5*laneWidth);
  const finish=new THREE.Vector2(end[0],end[1]);
  const curve=new THREE.CubicBezierCurve(start,start.clone().add(new THREE.Vector2(Math.cos(m.heading),-Math.sin(m.heading)).multiplyScalar(1.63)),
    finish.clone().add(new THREE.Vector2(end[0]-next[0],end[1]-next[1]).multiplyScalar(1.65/d)),finish);
  return measured([...curve.getPoints(12).map(p=>[p.x,p.y,2]),...points.slice(3)]);
}
const ramps=data.ramps.map(road=>{
  const highwayStart=exits.has(road.name);
  const [,sz]=road.points[highwayStart?0:road.points.length-1];
  const [tx,tz]=road.points[highwayStart?road.points.length-1:0];
  const mainGrade=westConnect.has(road.name)?westGrade:eastGrade;
  const y0=gradeAt(mainGrade,sz)-.026;
  // The Fremont slip joins the surveyed street surface inside the core.
  const fremont=road===fremontRoad;
  const y1=fremont ? .031 : approachGround(tx,tz)+.09;
  const knots=fremont?fremontKnots(road.points):measured(road.points),length=knots.at(-1)!.s;
  const ramp=axis(knots,(s,z)=>{
    const t=highwayStart?s/length:1-s/length;
    // Leave enough height for the two loop ramps to cross their own feeder roads.
    const roadY=lerp(y0,y1,smoothstep(t,.04,.91));
    return fremont?lerp(gradeAt(westGrade,z),roadY,smoothstep(s,3.8,7.0)):roadY;
  },true,fremont?main[0].sample(fremontFork).heading:undefined);
  return {ramp,joinDistance:highwayStart?0:length};
});

const fremont=ramps[data.ramps.indexOf(fremontRoad)].ramp;
export const fremontExitDistance=fremontFork+fremont.length;
export function westboundExitPose(distance:number){
  const onRamp=distance>=fremontFork;
  const at=onRamp?fremont.sample(distance-fremontFork):main[0].sample(distance);
  const offset=onRamp ? .5*laneWidth:2*laneWidth;
  return {x:at.x+Math.sin(at.heading)*offset,y:at.y,z:at.z+Math.cos(at.heading)*offset,heading:at.heading};
}

function section(at:ReturnType<typeof main[number]['sample']>,offset:number,height:number) {
  return [at.x+Math.sin(at.heading)*offset,at.y+height,at.z+Math.cos(at.heading)*offset];
}
// Register ramp cross-sections to the piecewise-linear outer edge of the
// actual mainline triangles (including the mesh chunk boundary at s=12).
const mainEdgeRows=[...new Set([...intervals(main[0].length,main[0].knots),12])].sort((a,b)=>a-b)
  .filter(s=>s>fremontFork-2&&s<fremontFork+7).map(s=>{
    const at=main[0].sample(s);return {s,p:section(at,at.width,0)};
  });
function mouthSlice(s:number){
  const at=fremont.sample(s),cos=Math.cos(at.heading),sin=Math.sin(at.heading);
  const along=(p:number[])=>cos*(p[0]-at.x)-sin*(p[2]-at.z);
  const j=mainEdgeRows.findIndex(row=>along(row.p)>=0);
  const a=mainEdgeRows[j-1],b=mainEdgeRows[j],u=-along(a.p)/(along(b.p)-along(a.p));
  const inner=a.p.map((n,k)=>lerp(n,b.p[k],u));
  return {inner,outer:section(at,at.width,0),main:lerp(a.s,b.s,u),
    overlap:at.width+sin*(inner[0]-at.x)+cos*(inner[2]-at.z)};
}
function bisect(hi:number,before:(s:number)=>boolean){
  let lo=0;
  for(let i=0;i<22;i++){
    const s=(lo+hi)/2;
    if(before(s))lo=s;else hi=s;
  }
  return (lo+hi)/2;
}
const goreRamp=bisect(5,s=>mouthSlice(s).overlap>0);
const gore={ramp:goreRamp,main:mouthSlice(goreRamp).main};
function intervals(length:number,knots:Knot[]) {
  return [...new Set([...knots.map(k=>k.s),...Array.from({length:Math.ceil(length/.8)},(_,i)=>i*.8)])].sort((a,b)=>a-b);
}

function slabGeometry(axis:typeof main[number],from:number,to:number,offsetA:number|((w:number)=>number),offsetB:number|((w:number)=>number),heightA:number,heightB:number) {
  const ease=(offset:number|((w:number)=>number),width:number)=>typeof offset==='number'?offset:offset(width);
  const distances=[from,...intervals(axis.length,axis.knots).filter(s=>s>from&&s<to),to];
  const vertices:number[]=[],station:number[]=[];
  const wearing=heightA===0&&heightB===0;
  for(let i=1;i<distances.length;i++){
    const a=axis.sample(distances[i-1]),b=axis.sample(distances[i]);
    const c=section(a,ease(offsetA,a.width),heightA),d=section(b,ease(offsetA,b.width),heightA);
    const e=section(b,ease(offsetB,b.width),heightB),f=section(a,ease(offsetB,a.width),heightB);
    vertices.push(...c,...d,...e,...c,...e,...f);
    if(wearing){const lo=distances[i-1],hi=distances[i];station.push(lo,hi,hi,lo,hi,lo); }
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  if(wearing)geometry.setAttribute('roadExposure',new THREE.Uint16BufferAttribute(station.map(s=>100+Math.round(s*50)),1));
  geometry.computeVertexNormals();
  return geometry;
}

// One asphalt surface between the two carriageways. OSM uses one shared
// node at the split; drawing both full-width ribbons there would stack two
// slightly different decks. Cut the ramp to the actual main-deck edge.
function fremontMouthGeometry(){
  const cuts=new Set([0,gore.ramp,...intervals(fremont.length,fremont.knots).filter(s=>s<gore.ramp)]);
  for(const row of mainEdgeRows)if(row.s>fremontFork&&row.s<gore.main)
    cuts.add(bisect(gore.ramp,s=>mouthSlice(s).main<row.s));
  const stations=[...cuts].sort((a,b)=>a-b),bounds=stations.map(mouthSlice),positions:number[]=[],code:number[]=[];
  for(let i=1;i<bounds.length;i++){
    const a=bounds[i-1],b=bounds[i];
    positions.push(...a.outer,...b.outer,...b.inner,...a.outer,...b.inner,...a.inner);
    const lo=100+Math.round(stations[i-1]*50),hi=100+Math.round(stations[i]*50);code.push(lo,hi,hi,lo,hi,lo);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('roadExposure',new THREE.Uint16BufferAttribute(code,1));
  geometry.computeVertexNormals();return geometry;
}

// Use the same two planes per road section as slabGeometry. A dash starting in
// the middle of a curved grade must lie on the rendered slab, not on a fresh
// evaluation of the road profile at its endpoints.
function pavementRows(axis:typeof main[number]){
  const stations=[...new Set([0,...intervals(axis.length,axis.knots),axis.length])].sort((a,b)=>a-b);
  return stations.map(s=>{
    const a=axis.sample(s);
    return {s,w:a.width,left:section(a,-a.width,0),right:section(a,a.width,0)};
  });
}
const mainPavement=main.map(pavementRows);

function pavementMarkings(rows:ReturnType<typeof pavementRows>){
  type UV=[number,number];
  return (from:number,to:number,center:(w:number)=>number,width:number)=>{
    const vertices:number[]=[],code:number[]=[];
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
          code.push(100+Math.round(lerp(a.s,b.s,v)*50));
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
    g.setAttribute('roadExposure',new THREE.Uint16BufferAttribute(code,1));
    g.computeVertexNormals();g.userData.roadPaint='SoMa approaches';return g;
  };
}

export function approachPose(eastbound:boolean,distance:number,lane:number){
  const axis=main[eastbound?1:0],at=axis.sample(distance);
  const laneLimit=Math.max(0,Math.floor((at.lanes-1)/2));
  const laneAlignment=Math.abs(at.lanes%2-1)*.5;
  const offset=(THREE.MathUtils.clamp(lane,-laneLimit,laneLimit)+laneAlignment)*laneWidth;
  // Place the wheels on the two triangles supporting the lane paint. Both
  // edges of a cross-section share elevation, including at the curve apex.
  const rows=mainPavement[eastbound?1:0];
  let lo=0,hi=rows.length-1;
  while(hi-lo>1){
    const middle=(lo+hi)>>1;
    if(rows[middle].s<distance)lo=middle;else hi=middle;
  }
  const a=rows[lo],b=rows[hi],v=THREE.MathUtils.clamp((distance-a.s)/(b.s-a.s),0,1);
  const u=.5+offset/(2*lerp(a.w,b.w,v)),first=u+v<=1;
  const base=first?a.left:b.right,across=first?a.right:b.left,along=first?b.left:a.right;
  const acrossWeight=first?u:1-u,alongWeight=first?v:1-v;
  const x=base[0]+acrossWeight*(across[0]-base[0])+alongWeight*(along[0]-base[0]);
  const z=base[2]+acrossWeight*(across[2]-base[2])+alongWeight*(along[2]-base[2]);
  const pitch=Math.atan2(b.left[1]-a.left[1],b.s-a.s)*(eastbound?-1:1);
  return {x,y:lerp(a.left[1],b.left[1],v)-streetVehicleTreadHeight,z,heading:at.heading+(eastbound?Math.PI:0),pitch};
}
export const approachLengths=main.map(road=>road.length);

export function buildApproachRoad(mesh:ApproachMesh,root:THREE.Group) {
  const group=new THREE.Group();
  group.name='Mapped I-80 west approach and SoMa ramps';
  root.add(group);
  const unit=new THREE.BoxGeometry(1,1,1);
  function box(name:string,w:number,h:number,d:number,color:string,x:number,y:number,z:number,heading=0){
    const m=mesh(unit,color,x,y,z,group);
    m.name=name;m.scale.set(w,h,d);m.rotation.y=heading;return m;
  }
  for(const [routeIndex,axis] of [...main,...ramps.map(r=>r.ramp)].entries()){
    const branch=routeIndex>1,westbound=routeIndex===0;
    // CanadaD, KartaView track 366261 frame 2052 (CC BY-SA 4.0): the
    // Fremont exit keeps the yellow stripe against the driver's left parapet.
    // https://kartaview.org/details/366261/2052/track-info
    const yellowEdge=westbound||axis===fremont?-1:1;
    const bridgeFoot=!branch;
    const marking=pavementMarkings(mainPavement[routeIndex]??pavementRows(axis));
    const right=(w:number)=>w,left=(w:number)=>-w;
    // Continuous extruded top and side surfaces, with joints between consecutive
    // spans placed in the darker concrete beam and a low cast parapet.
    for(let from=0;from<axis.length;from+=12){
      const to=Math.min(from+12,axis.length);
      const add=(geo:THREE.BufferGeometry,color:string)=>mesh(geo,color,0,0,0,group);
      if(axis===fremont&&from===0){
        add(fremontMouthGeometry(),roadPaint);
        add(slabGeometry(axis,gore.ramp,to,right,left,0,0),roadPaint);
      }else add(slabGeometry(axis,from,to,right,left,0,0),roadPaint);
      add(slabGeometry(axis,from,to,left,right,-.142,-.142),beamPaint);
      add(slabGeometry(axis,from,to,right,right,-.142,0),concrete);
      add(slabGeometry(axis,from,to,left,left,0,-.142),concrete);
      for(const side of [-1,1]){
        const inner=(w:number)=>side*(w-.047),outer=(w:number)=>side*w;
        let start=bridgeFoot&&from===0?.14:from;
        // Leave the physically common paved mouth open. Its outer barrier is
        // carried by the exit; the mainline and ramp inner rails start at the gore.
        if(axis===fremont&&side===-1)start=Math.max(start,gore.ramp);
        if(westbound&&side===1&&from<gore.main&&to>fremontFork){
          if(from<fremontFork){
            add(slabGeometry(axis,start,fremontFork,outer,outer,-.072,.103),concrete);
            add(slabGeometry(axis,start,fremontFork,inner,inner,.103,0),concrete);
            add(slabGeometry(axis,start,fremontFork,outer,inner,.103,.103),concrete);
            add(marking(from,fremontFork,w=>w-.059,.011),'#d8d8c3');
          }
          start=Math.max(start,gore.main);
        }
        if(start>=to)continue;
        add(slabGeometry(axis,start,to,side>0?inner:outer,side>0?outer:inner,-.072,-.072),beamPaint);
        add(slabGeometry(axis,start,to,outer,outer,side>0?-.072:.103,side>0?.103:-.072),concrete);
        add(slabGeometry(axis,start,to,inner,inner,side>0?.103:0,side>0?0:.103),concrete);
        add(slabGeometry(axis,start,to,side>0?outer:inner,side>0?inner:outer,.103,.103),concrete);
        const edge=(w:number)=>side*(w-.059);
        add(marking(start,to,edge,.011),side===yellowEdge?'#c4ab72':'#d8d8c3');
      }
    }
    for(let s=bridgeFoot?.115:1.4;s<axis.length-.6;s+=.86){
      const p=axis.sample(s);
      if(axis===fremont&&s<gore.ramp)continue;
      const lanes=Math.round(p.lanes);
      for(let lane=1;lane<lanes;lane++){
        const x=(lane-lanes/2)*laneWidth;
        mesh(marking(s,Math.min(s+.25,axis.length),()=>x,.008),'#cbcbbb',0,0,0,group);
      }
    }
    // KartaView 366261/2052 shows an overhanging arm at the exit. Positions
    // and spacing are modeled along each parapet; do not place posts in forks.
    for(let s=approachLampStart;s<axis.length-.35;s+=approachLampSpacing){
      if(westbound&&s>fremontFork-.35&&s<gore.main+.35)continue;
      if(branch&&Math.abs(s-ramps[routeIndex-2].joinDistance)<2.2)continue;
      const p=axis.sample(s),side=routeIndex===1?-1:1;
      const at=(offset:number)=>section(p,side*(p.width+offset),0);
      const [x,,z]=at(-.014),[ax,,az]=at(-.105),[lx,,lz]=at(-.197);
      box('Skyway light standard',.017,.62,.017,'#899899',x,p.y+.395,z,p.heading);
      box('Skyway light arm',.017,.018,.19,'#a6b0ab',ax,p.y+.695,az,p.heading);
      const lens=box('Skyway roadway lens',.060,.018,.047,'#b9bbe0',lx,p.y+.684,lz,p.heading);
      lens.userData.signLight=[.82,.65,.44];
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
        matrix.rotation.set(0,pose.heading,pose.pitch,'YXZ');matrix.updateMatrix();instances.setMatrixAt(i,matrix.matrix);
      }
      instances.instanceMatrix.needsUpdate=true;
    }
  };
  update(0);
  return update;
}
