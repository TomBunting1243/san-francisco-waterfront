import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

import {addFoundryPlazaApron} from './foundry-plaza-apron.ts';
import {addFoundryPlazaGardens} from './foundry-plaza-gardens.ts';
import {addFoundryPlazaGlass,bakeFoundryPlazaSpill} from './foundry-plaza-glass.ts';

type Plan=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Wall=(s:number,h:number,d?:number)=>FacadePoint;
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.065});
const aluminum='#aeb6b2',frame='#465657',officeGlass='#516969',groundGlass='#394f50';
const grade=.045;
// The primary 2024 plate is at seven pixels per metre. These street-wall
// intersections are measured against wall returns, rather than roof eaves.
function point([u,v]:Plan,h:number):FacadePoint{
  return [-27.00800104+.0012973094*u-.0084729829*v,grade+h*.06,-33.37263659+.0084728164*u+.0012965840*v];
}
// Rings run counter-clockwise in the scene seen from above (negative plate
// signed area); the interiors of the retail buildings are left of each wall.
const north:Plan[]=[[32,134],[33,-205],[-36,-205],[-36,-224],[-359,-224],[-359,-201],[-520,-201],[-525,-62],[-541,-62],[-542,31],[-394,31],[-394,132]];
const south:Plan[]=[[30,312],[-393,311],[-394,466],[-552,466],[-552,640],[-408,640],[-410,893],[27,893]];
const court:Plan[]=[[-163,550],[-163,645],[-244,645],[-244,550]];
function makeWall(a:Plan,b:Plan){
  const du=b[0]-a[0],dv=b[1]-a[1],length=Math.hypot(du,dv),su=du/length,sv=dv/length;
  const at:Wall=(s,h,d=0)=>point([a[0]+7*(s*su-d*sv),a[1]+7*(s*sv+d*su)],h);
  return {at,length:length/7};
}
function panel(f:FacadePanels,at:Wall,s:number,t:number,b:number,h:number,color:string,d=0){
  f.quad(at(s,b,d),at(t,b,d),at(t,h,d),at(s,h,d),color);
}
function cap(f:FacadePanels,outer:Plan[],holes:Plan[][],height:(p:Plan)=>number,color:string){
  const coords=[...outer,...holes.flat()],vec=(ring:Plan[])=>ring.map(([x,y])=>new THREE.Vector2(x,y));
  for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(vec(outer),holes.map(vec))){
    const a=coords[i],b=coords[j],c=coords[k];
    f.triangle(point(a,height(a)),point(c,height(c)),point(b,height(b)),color);
  }
}
function addWindow(at:Wall,a:number,b:number,lo:number,hi:number,d:number,windows:Window[]){
  const [x,y,z]=at((a+b)/2,(lo+hi)/2,d+.018),normal=at(0,0,1),origin=at(0,0);
  windows.push({x,y,z,ry:Math.atan2(normal[0]-origin[0],normal[2]-origin[2]),w:(b-a)*.06,h:(hi-lo)*.06});
}
function streetWall(f:FacadePanels,a:Plan,b:Plan,base:number,stone:string,alongHoward:boolean,windows:Window[]){
  const {at,length}=makeWall(a,b);
  const bays=Math.max(1,Math.round(length/(alongHoward?7.65:5.95))),pitch=length/bays;
  for(let i=0;i<bays;i++){
    const s=pitch*i,t=s+pitch,edge=Math.min(.80,pitch*.11);
    const l=s+edge,r=t-edge,mid=(l+r)/2;
    panel(f,at,s,l,0,base,stone);panel(f,at,r,t,0,base,stone);
    // Continuous stone reveals give the retail/reception bays visible depth
    // from an oblique passenger eye. Above, the dark floors are paired by
    // silver transoms, as seen in westbound Howard's 2016 photographs.
    const recess=-.32;
    f.quad(at(l,0),at(l,0,recess),at(l,base,recess),at(l,base),stone);
    f.quad(at(r,0,recess),at(r,0),at(r,base),at(r,base,recess),stone);
    for(let floor=0;floor<7;floor++){
      const lo=base*floor/7,hi=base*(floor+1)/7;
      const sill=lo+(floor===0?.38:.24),head=hi-(floor===0?.48:.18);
      const bulk=floor===0?'#737c77':alongHoward?stone:aluminum;
      panel(f,at,l,r,lo,sill,bulk);panel(f,at,l,r,head,hi,bulk);
      const rail=sill+(head-sill)*.72;
      // One pane behind the physical mullion keeps the same two visible
      // lights while eliminating three hidden splits in each office bay.
      panel(f,at,l,r,sill,rail,floor?officeGlass:groundGlass,recess);
      panel(f,at,l,r,rail,rail+.08,frame,recess+.018);
      panel(f,at,l,r,rail+.08,head,floor?'#698080':'#4b6362',recess);
      if((i*7+floor*3+(alongHoward?2:0))%9===1)for(const [x,y] of [[l,mid-.05],[mid+.05,r]])
        addWindow(at,x+.018,y-.018,sill+.018,rail-.018,recess,windows);
      panel(f,at,mid-.05,mid+.05,sill,head,frame,recess+.025);
    }
  }
}
type Slice=[number,number];
function upper(f:FacadePanels,west:number,east:number,slices:Slice[],lo:number,isSouth:boolean,windows:Window[]){
  // Roof eaves reach forward of the glass at Fremont. The modest variation
  // along Howard's two blocks comes directly from cross-sections through the
  // 2023 returns. Break the southern roof around the recessed court.
  const holeWest=-244,holeEast=-163;
  for(let i=1;i<slices.length;i++){
    const [v0,h0]=slices[i-1],[v1,h1]=slices[i];
    const cut=isSouth&&v0>=550&&v1<=645;
    for(const [x0,x1] of cut?[[west,holeWest],[holeEast,east+17]]:[[west,east+17]]){
      f.quad(point([x0,v0],h0),point([x0,v1],h1),point([x1,v1],h1),point([x1,v0],h0),'#aeb1aa');
    }
    const front=makeWall([east,v1],[east,v0]);
    for(const street of ['First','Fremont'] as const){
      const firstStreet=street==='First';
      const wall=firstStreet?makeWall([west,v0],[west,v1]):front,w=wall.at;
      const start=firstStreet?h0:h1,end=firstStreet?h1:h0;
      const bays=Math.max(1,Math.round(wall.length/2)),pitch=wall.length/bays;
      f.quad(w(0,lo),w(wall.length,lo),w(wall.length,end-.36),w(0,start-.36),
        firstStreet?'#47656e':'#658087');
      for(let j=0;j<bays;j++){
        const s=j*pitch,h=start+(end-start)*j/bays;
        panel(f,w,s,s+.065,lo,h-.36,aluminum,.025);
        if(!firstStreet&&j%7===2&&i%2)addWindow(w,s+.10,s+pitch-.12,lo+.32,lo+3.25,0,windows);
      }
      // Clip a whole horizontal transom to the sloping roof once per run.
      for(let y=lo+3.8;y+.09<Math.max(start,end)-.36;y+=3.8){
        const clipped=THREE.MathUtils.clamp((y+.09+.36-start)/(end-start||1),0,1)*wall.length;
        const s=start<y+.45?clipped:0,t=end<y+.45?clipped:wall.length;
        if(t>s)panel(f,w,s,t,y,y+.09,aluminum,.035);
      }
      if(firstStreet){
        const brow=1.25;
        f.quad(w(0,start-.36,brow),w(wall.length,end-.36,brow),w(wall.length,end,brow),w(0,start,brow),'#869395');
        f.quad(w(0,start-.36),w(wall.length,end-.36),w(wall.length,end-.36,brow),w(0,start-.36,brow),'#70807e');
        f.quad(w(0,start,brow),w(wall.length,end,brow),w(wall.length,end),w(0,start),'#aeb1aa');
      }
    }
    const w=front.at;
    const eave=17/7;
    f.quad(w(0,h1-.36,eave),w(front.length,h0-.36,eave),w(front.length,h0,eave),w(0,h1,eave),'#8b9594');
    f.quad(w(0,h1-.36),w(front.length,h0-.36),w(front.length,h0-.36,eave),w(0,h1-.36,eave),'#7b8584');
  }
  const first=slices[0],last=slices[slices.length-1];
  for(const [a,b,h] of [[east,west,first[1]],[west,east,last[1]]]){
    const v=a===east?first[0]:last[0],w=makeWall([a,v],[b,v]);panel(f,w.at,0,w.length,lo,h,'#788d91');
    for(let s=1.8;s<w.length;s+=2.1)panel(f,w.at,s,s+.07,lo,h,aluminum,.02);
  }
}
export function addFoundrySquare(building:{id:number},root:THREE.Group,windows:Window[]){
  if(building.id===1410037751)return true;
  const isSouth=building.id===136104349;
  if(!isSouth&&building.id!==136104348)return false;
  const f=new FacadePanels(),outer=isSouth?south:north,base=isSouth?31.6:32.6;
  const illumination=new Map<number,[number,number,number]>();
  const stone=isSouth?'#989e97':'#c4a165';
  for(let i=0;i<outer.length;i++){
    const a=outer[i],b=outer[(i+1)%outer.length];
    const fremont=Math.min(a[0],b[0])>24,howard=isSouth?Math.max(a[1],b[1])<=312:Math.min(a[1],b[1])>128;
    const plazaStart=isSouth?1:9;
    if(i===plazaStart||i===plazaStart+1){
      const w=makeWall(a,b);
      addFoundryPlazaGlass(f,w.at,w.length,base,i===plazaStart+1,isSouth,illumination);
    }else if(fremont||howard)streetWall(f,a,b,base,stone,howard,windows);
    else{
      const w=makeWall(a,b);panel(f,w.at,0,w.length,0,base,'#788985');
      for(let h=4.6;h<base;h+=4.3)panel(f,w.at,0,w.length,h,h+.32,aluminum,.02);
    }
  }
  cap(f,outer,isSouth?[court]:[],()=>base,'#abaea6');
  if(isSouth){
    cap(f,court,[],()=>10.5,'#a6a7a0');
    court.forEach((a,i)=>{
      const b=court[(i+1)%court.length],w=makeWall(a,b);
      const lip=(v:number)=>45.3-(v-550)*.7/95;
      f.quad(w.at(0,10.5),w.at(w.length,10.5),w.at(w.length,lip(b[1])),w.at(0,lip(a[1])),'#788783');
    });
    upper(f,-383,-35,[[324,44.7],[415,46.1],[550,45.3],[645,44.6],[742,41.5],[878,40.5]],base,true,windows);
  }else upper(f,-382,-33,[[-187,47.2],[-125,48.1],[-25,47.6],[62,47.0],[116,46.2]],base,false,windows);
  const firstPlazaVertex=f.positions.length/3;
  addFoundryPlazaGardens(f,isSouth,point);
  addFoundryPlazaApron(f,isSouth,point);
  const mesh=f.mesh(material),light=new Uint8Array(f.positions.length);
  for(const [vertex,rgb] of illumination)light.set(rgb,vertex*3);
  bakeFoundryPlazaSpill(f,firstPlazaVertex,isSouth,light,point([0,0],0));
  mesh.geometry.setAttribute('signLight',new THREE.Uint8BufferAttribute(light,3,true));
  mesh.name=isSouth?'Foundry Square II / 405 Howard Street':'Foundry Square I / 400 Howard Street';root.add(mesh);
  return true;
}
