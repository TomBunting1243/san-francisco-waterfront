import * as THREE from 'three';
import {transitScreenMaterial,transitScreenName} from './transit-center-screen.ts';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.08});
type Plan=[number,number];
const grade=.031,scale=.06;
// Metres along and across the station. The origin is the surveyed Fremont
// centerline midway between Minna and Natoma. First crosses at station -110.
const ox=-22.938495,oz=-32.902787,ex=.15135,ez=Math.sqrt(1-ex*ex);
function point([s,d]:Plan,h:number):FacadePoint{
  return [ox+scale*(s*ex-d*ez),grade+scale*h,oz+scale*(s*ez+d*ex)];
}
function local([x,z]:number[]):Plan{
  return [((x-ox)*ex+(z-oz)*ez)/scale,((z-oz)*ex-(x-ox)*ez)/scale];
}
const soffit=12.45,roof=21.34;
function floor(f:FacadePanels,s0:number,s1:number,d0:number,d1:number,h:number,color:string,down=false){
  const a=point([s0,d0],h),b=point([s1,d0],h),c=point([s1,d1],h),d=point([s0,d1],h);
  if(down)f.quad(a,b,c,d,color);else f.quad(d,c,b,a,color);
}
function shell(f:FacadePanels,ring:Plan[],lo:number,hi:number,tint:string){
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    f.quad(point(a,lo),point(b,lo),point(b,hi),point(a,hi),tint);
  }
}
// The plan's street-level cores and shop rows sit well behind the screen.
// Clockwise plans give the vertical faces outward normals.
function block(f:FacadePanels,s:number,t:number,d:number,e:number,h:number,tint:string){
  shell(f,[[s,d],[s,e],[t,e],[t,d]],0,h,tint);
  floor(f,s,t,d,e,h,'#a9b5af');
}
function portalLeg(f:FacadePanels,s:number,d:number){
  const sign=Math.sign(d),foot=[s,d] as Plan;
  // Branching painted steel grows out toward the overhanging bus deck.
  for(const dx of [-2.0,2.0]){
    const ring:Plan[]=[[-.48,-.54],[-.48,.54],[.48,.54],[.48,-.54]];
    for(let i=0;i<4;i++){
      const [x,z]=ring[i],[u,v]=ring[(i+1)%4];
      f.quad(point([foot[0]+x,foot[1]+z],0),point([s+u,d+v],0),
        point([s+dx+u,d+sign*5.2+v],soffit),point([s+dx+x,d+sign*5.2+z],soffit),'#d4d8cf');
    }
  }
}
export function addSalesforceTransitCenter(b:{id:number;p:number[][]},root:THREE.Group,night={value:0}){
  if(b.id!==542375290)return false;
  const f=new FacadePanels(),lights=new Map<number,number>();
  const verts=b.p.map(local);
  if(Math.hypot(verts[0][0]-verts.at(-1)![0],verts[0][1]-verts.at(-1)![1])<.01)verts.pop();
  if(!THREE.ShapeUtils.isClockWise(verts.map(([s,d])=>new THREE.Vector2(s,d))))verts.reverse();
  // Existing surveyed perimeter preserves the lobed aluminium screen on both
  // long elevations. The bottom kick draws in toward the street-level piers.
  const screen=new FacadePanels(),uv:number[]=[];
  const hem=roof-44*.3048;
  let along=0;
  const inner=verts.map(([s,d]):Plan=>[s,d*.90]);
  const tris=THREE.ShapeUtils.triangulateShape(verts.map(v=>new THREE.Vector2(...v)),[]);
  for(const [i,j,k] of tris){
    f.triangle(point(verts[k],roof),point(verts[j],roof),point(verts[i],roof),'#839572');
    const first=f.positions.length/3;
    f.triangle(point(inner[i],soffit),point(inner[j],soffit),point(inner[k],soffit),'#bdc4bc');
    for(let n=first;n<first+3;n++)lights.set(n,.13);
  }
  for(let i=0;i<verts.length;i++){
    const k=(i+1)%verts.length,a=verts[i],b=verts[k],c=inner[i],d=inner[k];
    const aHem:Plan=[a[0],a[1]*.96],bHem:Plan=[b[0],b[1]*.96];
    f.quad(point(c,soffit),point(d,soffit),point(bHem,hem),point(aHem,hem),'#b6beb8');
    const width=Math.hypot(b[0]-a[0],b[1]-a[1]),join=soffit+.5;
    // The lower edge returns toward the interior. Each panel has an opaque
    // depth-writing surface; the open fraction is in the minified pigment.
    screen.quad(point(aHem,hem),point(bHem,hem),point(b,join),point(a,join),'#e7eae4');
    screen.quad(point(a,join),point(b,join),point(b,roof-.20),point(a,roof-.20),'#f0f1e9');
    for(const [lo,hi] of [[hem,join],[join,roof-.20]]){
      uv.push(along/4.8,(lo-hem)/4.8,(along+width)/4.8,(lo-hem)/4.8,
        (along+width)/4.8,(hi-hem)/4.8,along/4.8,(hi-hem)/4.8);
    }
    along+=width;
    f.quad(point(a,roof-.20),point(b,roof-.20),point(b,roof),point(a,roof),'#e0e4da');
  }
  const veil=screen.mesh(transitScreenMaterial(night));
  veil.name=transitScreenName;veil.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  root.add(veil);
  // The station map shows two through streets, three western retail blocks,
  // the Grand Hall between the streets, and an open bus plaza to the east.
  for(const [s,t] of [[-322,-304],[-292,-226],[-215,-174],[-164,-121]]){
    for(const side of [-1,1]){
      const d=side<0?-14:3,e=side<0?-3:14;
      block(f,s,t,d,e,9.2,'#78908f');
      for(let x=s+1.6;x<t-1;x+=4.0)block(f,x,x+.28,d-.13,e+.13,9.25,'#bbc3b8');
    }
  }
  block(f,-94,-15,-13,13,soffit,'#688988');
  for(let x=-92;x<=-16;x+=4.5)for(const d of [-13.15,13])block(f,x,x+.20,d,d+.15,soffit,'#b6c1b9');
  block(f,73,86,-7,7,soffit,'#829797');
  for(const x of [-309,-280,-250,-218,-186,-154,-126,-95,-72,-48,-23,-15,16,40,65,88]){
    for(const d of [-17,17])portalLeg(f,x,d);
  }
  // Recessed downlights in the traffic crossings, spanning the soffit.
  for(const s of [-110,0])for(const x of [-7,0,7])for(const d of [-18,-9,0,9,18]){
    const first=f.positions.length/3;
    floor(f,s+x-.52,s+x+.52,d-.28,d+.28,soffit-.06,'#efe9d5',true);
    for(let i=first;i<first+4;i++)lights.set(i,.83);
  }
  // Model the rooftop perimeter path as one continuous inset loop. The
  // planted roof, paths and deck all share the existing architecture batch.
  const path=(s:number,d:number,inset:number):Plan=>[(s+110)*(1-inset/220)-110,d*(1-inset/25)];
  for(let i=0;i<verts.length;i++){
    const a=verts[i],b=verts[(i+1)%verts.length];
    f.quad(point(path(...a,3),roof+.05),point(path(...b,3),roof+.05),
      point(path(...b,5.6),roof+.05),point(path(...a,5.6),roof+.05),'#c5bba2');
  }
  const mesh=f.mesh(material),values=new Uint8Array(f.positions.length);
  for(const [i,strength] of lights){
    values.set([Math.round(177*strength),Math.round(164*strength),Math.round(133*strength)],i*3);
  }
  mesh.geometry.setAttribute('signLight',new THREE.Uint8BufferAttribute(values,3,true));
  mesh.name='Salesforce Transit Center elevated bus deck and street-level halls';root.add(mesh);
  return true;
}
