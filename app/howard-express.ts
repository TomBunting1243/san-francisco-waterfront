import * as THREE from 'three';
import {StreetAssembly} from './street-amenities.ts';
import {streetPose} from './streets.ts';
import {bayReliefGround} from './bay-relief.ts';
import {crossStreetGreenStart,howardTurnStopLine,signalPeriod} from './waterfront-signals.ts';
import inbound from '../public/data/howard-express.json' with {type:'json'};

// SFMTA GTFS 20260829–20270115, route 30X, shape 23, terminal 17676.
// M21 replaces M11 on thirteen school-break weekdays with identical calls.
const omitted=new Set(['2026-09-07','2026-10-12','2026-11-26','2026-12-25','2027-01-01']);
const arrivals=[468,503,536];
export function expressServiceDate(date:string){
  if(date<'2026-08-29'||date>'2027-01-15'||omitted.has(date))return false;
  const weekday=new Date(date+'T12:00:00Z').getUTCDay();
  return weekday>=1&&weekday<=5;
}
export function howardCallAt(seconds:number){
  for(const minute of arrivals){
    const t=seconds-minute*60;
    if(t>=-780&&t<=370)return t;
  }
  return undefined;
}
const C=.988686,S=.150004;
const point=(u:number,v:number)=>[-25.894+(C*(u-300)+S*(v-1400))/200,-12.650+(-S*(u-300)+C*(v-1400))/200];
// The feed pin is on the crosswalk. Resolution 243-06 reserves the first 90 ft
// of the far-side south curb. Use its straight (u=215) segment. Both curbside
// doors land between the 4 ft wells on the 2024 rectified plate.
// https://sfbos.org/ftp/uploadedfiles/bdsupvrs/resolutions06/r0243-06.pdf
const berth=point(232.4,1747);
export const expressBerth={x:berth[0],z:berth[1],yaw:Math.atan2(-C,S)};
// Walk behind the line of wells, round the corner on the sidewalk and enter
// the modeled recessed corner shop on Spear. Its door is centred at (63,1585).
const exitWalk=[[185,1802],[183,1570],[178,1549],[64,1549],[63,1586.7]];
const walkEdge=(u:number)=>1556.3128+(u-64)*.003341;
const shopSill=(u:number)=>1584.885+(u-63.03)*.02135;
function landingY(u:number,v:number){
  return THREE.MathUtils.lerp(.045,.038,THREE.MathUtils.clamp((v-walkEdge(u))/(shopSill(u)-walkEdge(u)),0,1));
}
// The municipal sidewalk ends before the private shop recess. This narrow
// landing meets the actual public polygon and the existing storefront sill.
export function howardShopLanding(){
  const xyz:number[]=[],index:number[]=[];
  for(const u of [48,78])for(const v of [walkEdge(u),shopSill(u)+2]){
    const [x,z]=point(u,v),y=landingY(u,v);
    xyz.push(x,y,z,x,-.04,z);
  }
  index.push(0,2,4,4,2,6,0,1,2,2,1,3,4,6,5,5,6,7);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geometry.setIndex(index);geometry.computeVertexNormals();
  const a=new StreetAssembly();a.add(geometry,'#b9b4a7',0,0,0);
  const mesh=a.bake('201 Spear corner shop threshold landing');mesh.geometry.userData.paintVertices=true;return mesh;
}
export function expressAlighter(t:number){
  if(t<2)return;
  const dist=(t-2)*15;
  const start=[224.24,1802.08];
  let a=start,left=dist;
  for(const b of exitWalk){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(left<=len){
      const f=left/len,u=a[0]+dx*f,v=a[1]+dz*f,[x,z]=point(u,v);
      const sidewalk=u>=48&&u<=78?landingY(u,v):.045;
      const y=THREE.MathUtils.lerp(.031+.06*.365,sidewalk,THREE.MathUtils.smoothstep(218-u,0,3.0));
      return {x,z,y,heading:Math.atan2(C*dx+S*dz,-S*dx+C*dz)};
    }
    left-=len;a=b;
  }
}
function track(points:number[][]){
  const vertices:THREE.Vector3[]=[];
  const toV=([x,z]:number[])=>new THREE.Vector3(x,0,z);
  vertices.push(toV(points[0]));
  for(let i=1;i<points.length-1;i++){
    const a=toV(points[i-1]),b=toV(points[i]),c=toV(points[i+1]);
    const inLength=a.distanceTo(b),outLength=c.distanceTo(b);
    if(inLength<.001||outLength<.001)continue;
    const reach=Math.min(.75,inLength*.42,outLength*.42);
    const entry=b.clone().lerp(a,reach/inLength),exit=b.clone().lerp(c,reach/outLength);
    const corner=new THREE.QuadraticBezierCurve3(entry,b,exit);
    vertices.push(...corner.getPoints(5));
  }
  vertices.push(toV(points.at(-1)!));
  const lengths=[0];
  for(let i=1;i<vertices.length;i++)lengths.push(lengths[i-1]+vertices[i].distanceTo(vertices[i-1]));
  const length=lengths.at(-1)!;
  function pose(s:number){
    let lo=1,hi=vertices.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(lengths[mid]<s)lo=mid+1;else hi=mid;}
    const a=vertices[lo-1],b=vertices[lo],f=THREE.MathUtils.clamp((s-lengths[lo-1])/(lengths[lo]-lengths[lo-1]),0,1);
    const x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;
    return {x,z,y:Math.max(.031,bayReliefGround(x,z)+.006),yaw:Math.atan2(a.z-b.z,b.x-a.x)};
  }
  return {pose,length};
}
function buildTracks(){
  // Keep the center of an 8½-ft coach clear of the motorcycle bay and carry
  // the entire articulated vehicle beyond the far crosswalk before unloading.
  const approach=track([...inbound,[-16.28,-27.49],[-27.98,-25.87],point(261,375),
    point(261,790),point(261,1118),point(261,1280),point(259,1455),point(237,1586),point(232.4,1665),berth]);
  // Inferred out-of-service movement toward the same block's next 30 trip
  // at Third/Folsom. Harrison carries inland traffic. No return 30X exists.
  const south:number[][]=[];
  for(let x=-25.65;x>=-46.5;x-=.5){
    const road=streetPose(x,-1);
    south.push([x,road.z-.175/Math.abs(Math.cos(road.heading))]);
  }
  const plate=(u:number,v:number)=>[u/132-56,2-v/132];
  const exit=track([berth,point(232.4,1852),point(254,2020),point(264,2492),plate(4086,908),
    plate(4099,822),plate(4106,780),plate(4106,758),plate(4097,744),plate(4070,737),...south,[-47.30,-3.60],[-47.58,-3.95],[-47.88,-5.75],
    [-49.3,-15.8],[-51.3,-28.8],[-53.55,-43.5],[-55.18,-54.0],[-57.50,-68.20],
    [-57.30,-68.18],[-55.65,-68.23],[-42.229,-70.259]]);
  let lo=0,hi=9;
  for(let i=0;i<22;i++){
    const mid=(lo+hi)/2,p=exit.pose(mid),bar=howardTurnStopLine;
    if((p.x-bar.x)*bar.nx+(p.z-bar.z)*bar.nz<0)lo=mid;else hi=mid;
  }
  return {approach,exit,rightStop:(lo+hi)/2-.423};
}
let routes:ReturnType<typeof buildTracks>|undefined;
const ease=(t:number)=>THREE.MathUtils.smoothstep(t,0,1);
// A 5.2 second constant deceleration into the stop line.
function braking(before:number){
  if(before>=0)return 0;
  return before>=-5.2?-.5*(.39/5.2)*before*before:.39*(before+2.6);
}
const mod=(n:number)=>THREE.MathUtils.euclideanModulo(n,signalPeriod);
export function howardExpressPose(t:number,trafficSeconds:number,bridgeRide=false,arrivalClock=trafficSeconds-t){
  routes??=buildTracks();
  const {approach,exit,rightStop}=routes;
  // Pick the last safe Spear green before the timetable call. Move the whole
  // coach across on green, then settle into the berth without blocking it.
  let cross=-25-mod(arrivalClock-25-crossStreetGreenStart-1);
  // The seated driver occupies the only usable lane beside the motorcycles
  // during the fourth signal cycle. Use the preceding green and hold at the
  // far-side berth if this particular scheduled call overlaps that drive.
  if(bridgeRide&&arrivalClock+cross>270&&arrivalClock+cross<330)cross-=signalPeriod;
  const pull=bridgeRide&&arrivalClock+25>255&&arrivalClock+25<370?370-arrivalClock:25;
  const bar=approach.length-3.02,stopped=bar-.065;
  const ready=pull+35,exitRelease=ready+mod(crossStreetGreenStart+1-(arrivalClock+ready));
  let s:number;
  if(t<cross-5)s=Math.max(.75,stopped+braking(t-cross+7));
  else if(t<cross)s=stopped;
  else if(t<cross+14)s=stopped+2.99*ease((t-cross)/14);
  else if(t<0)s=stopped+2.99+(approach.length-stopped-2.99)*ease((t-cross-14)/(-cross-14));
  else if(t<=pull)s=approach.length;
  else if(t<pull+31)s=approach.length+rightStop*ease((t-pull)/31);
  else if(t<=exitRelease)s=approach.length+rightStop;
  else {
    const dt=t-exitRelease;
    s=approach.length+rightStop+(dt<4?.055*dt*dt:.44*(dt-2));
  }
  const at=(d:number)=>d<=approach.length?approach.pose(d):exit.pose(d-approach.length);
  const head=at(s),joint=at(s-.355),axle=at(s-.690);
  const trailerYaw=Math.atan2(axle.z-joint.z,joint.x-axle.x);
  return {head,joint,trailerYaw,doors:Math.min(ease((t-.4)/1.3),ease((24-t)/1.4)),inService:t<23,atBerth:t>=0&&t<=pull};
}
