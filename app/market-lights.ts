import * as THREE from 'three';
import inventory from '../public/data/market-lights.json' with {type:'json'};
import market from '../public/data/market-street.json' with {type:'json'};
import {StreetAssembly} from './street-amenities.ts';
import {streetcarTrack} from './streets.ts';
import {frostPlazaSurface,marketRailTop,registeredMarketTracks} from './california-sidewalk.ts';

const units=.06;
const iron='#434954',relief='#656361',collar='#55545b',glass='#eee1bd';
const armOffset=.545,capHeight=9.830;
const localLens=(arm:number)=>new THREE.Vector3(arm*armOffset,capHeight-(arm===0?0:.80)-.54,0);

// SF Historic Preservation Commission, 2018-002022COA, existing elevation p.72.
// The SFPUC's 1947 broadside photograph shows the trident aligned with the curb.
function castStandard(detailed:boolean){
  const a=new StreetAssembly();
  function turned(x:number,base:number,profile:number[][],color:string,sides=8){
    // Beyond the front blocks the bracket silhouette and three lens centres
    // still resolve; the fine rings project below one pixel from the waterfront.
    const levels=detailed?profile:profile.filter((_,i)=>i===0||i===profile.length-1||i%3===1);
    const g=new THREE.LatheGeometry(levels.map(([h,r])=>new THREE.Vector2(r,h)),detailed?sides:6);
    return a.add(g,color,x,base,0);
  }
  // Willis Polk's cast pedestal, access shell and tapering, collared trolley mast.
  turned(0,0,[[0,.352],[.12,.352],[.15,.320],[.43,.309],[.48,.320],[.53,.30],
    [.64,.278],[.90,.244],[.97,.256],[1.02,.237],[1.25,.203],[1.37,.230],
    [1.44,.207],[1.51,.148],[1.81,.144],[1.88,.174],[1.94,.140],[2.10,.126],
    [3.80,.11],[3.83,.131],[3.90,.130],[3.94,.109],[5.83,.098],[5.87,.116],
    [5.94,.116],[5.98,.096],[7.34,.087],[7.46,.132],[7.55,.105],[8.42,.073]],iron);
  for(let i=0;detailed&&i<6;i++){
    const azimuth=i*Math.PI/3;
    const rib=a.add(new THREE.SphereGeometry(1,5,3),relief,.242*Math.cos(azimuth),.93,.242*Math.sin(azimuth));
    rib.scale.set(.050,.26,.093);rib.rotation.y=-azimuth;
  }
  turned(0,0,[[7.45,.112],[7.52,.145],[7.60,.131],[7.68,.105],[8.10,.105],[8.20,.128],[8.26,.095],[8.50,.102],[8.60,.068]],collar);
  function yoke(x:number,y:number,toX:number,toY:number,r:number){
    const dx=toX-x,dy=toY-y;
    const branch=a.add(new THREE.CylinderGeometry(r*.82,r,Math.hypot(dx,dy),6,1,true),iron,(x+toX)/2,(y+toY)/2,0);
    branch.rotation.z=-Math.atan2(dx,dy);
  }
  for(const side of [-1,1]){
    const x=side*armOffset;
    yoke(0,7.78,side*.29,7.93,.076);yoke(side*.29,7.93,x,7.86,.070);
    yoke(0,8.14,side*.32,8.18,.067);yoke(side*.32,8.18,x,8.11,.055);
    turned(x,0,[[7.32,.002],[7.42,.060],[7.50,.046],[7.64,.068],[7.71,.047],
      [7.80,.109],[7.89,.137],[7.97,.10],[8.12,.073],[8.22,.084]],collar,7);
  }
  for(const side of [-1,0,1]){
    const x=side*armOffset,base=capHeight-(side===0?0:.80)-1.23;
    turned(x,base,[[0,.054],[.12,.090],[.19,.133],[.25,.095],[.31,.151],
      [.35,.132],[.40,.129],[.46,.159]],relief);
    const lens=turned(x,base,[[.46,.159],[.52,.188],[.70,.210],[.85,.174],[.91,.144]],glass,10);
    lens.userData.signLight=[.90,.61,.29];
    turned(x,base,[[.91,.145],[.94,.181],[.99,.174],[1.09,.084],[1.11,.044],
      [1.16,.039],[1.18,.046],[1.23,.003]],collar);
    // The glass is divided by slim bronze ribs which follow its widest section.
    for(let i=0;detailed&&i<4;i++){
      const angle=Math.PI/4+i*Math.PI/2;
      const points=[[.46,.163],[.69,.214],[.90,.151]];
      for(let j=1;j<points.length;j++){
        const [y0,r0]=points[j-1],[y1,r1]=points[j];
        const delta=new THREE.Vector3((r1-r0)*Math.cos(angle),y1-y0,(r1-r0)*Math.sin(angle));
        const bar=a.add(new THREE.CylinderGeometry(.010,.012,delta.length(),4,1,true),relief,
          x+(r1+r0)*.5*Math.cos(angle),base+(y1+y0)*.5,(r1+r0)*.5*Math.sin(angle));
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
      }
    }
  }
  return a.bake('Market Street Path of Gold standard');
}

type Pole=typeof inventory.poles[number];
const along=Math.atan2(1,.151);
const across=(p:Pole)=>p[1]-.15*p[2]-.019;

// Match across the road by minimum separation. Some inventory poles have no
// opposite member. A span requires an actual pair and a mapped overhead track.
function supportedPairs(){
  const left=inventory.poles.filter(p=>across(p)<0),right=inventory.poles.filter(p=>across(p)>0);
  const links=left.flatMap(a=>right.map(b=>({a,b,gap:Math.abs(a[2]-b[2])}))).filter(link=>link.gap<1.06);
  const used=new Set<number>();
  return links.sort((i,j)=>i.gap-j.gap).filter(({a,b})=>{
    if(used.has(a[0])||used.has(b[0]))return false;
    used.add(a[0]);used.add(b[0]);return true;
  });
}
const cross=(ax:number,az:number,bx:number,bz:number)=>ax*bz-az*bx;
function span(a:Pole,b:Pole){
  const [,ax,az]=a,[,bx,bz]=b,dx=bx-ax,dz=bz-az,stops=[0,1];
  for(const [id,cable,original] of market.tracks as [number,number,number[][]][]){
    if(cable)continue;
    const points=registeredMarketTracks[id]??original;
    for(let i=1;i<points.length;i++){
      const [x,z]=points[i-1],sx=points[i][0]-x,sz=points[i][1]-z,det=cross(dx,dz,sx,sz);
      if(Math.abs(det)<1e-7)continue;
      const t=cross(x-ax,z-az,sx,sz)/det,u=cross(x-ax,z-az,dx,dz)/det;
      if(t>0&&t<1&&u>=0&&u<=1&&!stops.some(s=>Math.abs(t-s)<.001))stops.push(t);
    }
  }
  if(stops.length===2)return;
  const wire=new StreetAssembly(),ox=(ax+bx)/2,oz=(az+bz)/2;
  const strand=(start:THREE.Vector3,end:THREE.Vector3,thickness:number)=>{
    const mid=start.clone().lerp(end,.5),direction=end.clone().sub(start);
    const mesh=wire.box(mid.x-ox,mid.y,mid.z-oz,thickness,thickness,direction.length(),'#586463');
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
  };
  const points=stops.sort((i,j)=>i-j).map(t=>{
    const x=ax+t*dx,z=az+t*dz,contact=marketRailTop(z)+streetcarTrack.wireRise;
    const point=new THREE.Vector3(x,contact+.018+.048*(2*t-1)**2,z);
    if(t>0&&t<1)strand(new THREE.Vector3(x,contact,z),point,.0016);
    return point;
  });
  for(let i=1;i<points.length;i++)strand(points[i-1],points[i],.0021);
  const mesh=wire.bake('Market trolley span between surveyed poles');mesh.position.set(ox,0,oz);
  return mesh;
}

/** The PUC and tree inventories occasionally occupy the same physical footing.
 * At 201 Market the 2024 aerial resolves the standard and no separate trunk. */
export function insideMarketLampFooting(x:number,z:number,trunkRadius:number){
  return inventory.poles.some(p=>Math.hypot(x-p[1],z-p[2])<.352*units+trunkRadius);
}

export function addMarketLights(root:THREE.Group){
  const close=castStandard(true),distance=castStandard(false);
  for(const [id,x,z,y] of inventory.poles){
    const pole=(z> -26?close:distance).clone();pole.userData.inventoryId=id;
    pole.position.set(x,frostPlazaSurface(x,z)??y,z);pole.rotation.y=-along;pole.scale.setScalar(units);
    for(const side of [-1,0,1]){
      const marker=new THREE.Object3D();marker.name='Path of Gold globe';
      marker.position.copy(localLens(side));pole.add(marker);
    }
    root.add(pole);
  }
  for(const {a,b} of supportedPairs()){
    const cable=span(a,b);if(cable)root.add(cable);
  }
}
