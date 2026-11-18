import * as THREE from 'three';
import {FacadePanels, type FacadePoint} from './facade-panels.ts';

type Point = [number,number];
type Building = {id:number; p:number[][]};
type Window = {x:number;y:number;z:number;ry:number;w:number;h:number};
const stone='#b99c91', graniteShade='#a78a81', reveal='#88746c', joint='#71645e';
const glass=['#4b5661','#525e69','#4b5965','#535f67'];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.71});
const origin=[-17.72,-16.058],ux=.9884,uz=-.1519;
const world=([u,v]:Point,y:number):FacadePoint=>[origin[0]+ux*u-uz*v,y,origin[1]+uz*u+ux*v];
const local=([x,z]:number[]):Point=>[(x-origin[0])*ux+(z-origin[1])*uz,-(x-origin[0])*uz+(z-origin[1])*ux];
const bayPitch=.232, center=1.205;
const lobby=.324, decks=[3.54,4.465,5.365];

// Owner's building photographs, 12th-floor plan and the City's 2024 8-cm aerial.
// https://vanbartongroup.com/sample-investments/101-mission-street/
// https://griddig.com/dynamic/space_listings/files/floor_plan/floor_plan_301-1458862365.pdf
// USGS CA_SanFrancisco_1_B23: 62, 77.6 and 92.7 m NAVD88 against local grade 3.3 m.
// u points toward Mission, v toward Spear. Both long elevations have faceted bays.
// Only the Spear-facing corners step in at floors 15 and 19.
function plan(tier:number):Point[] {
  const ring:Point[]=[];
  function bays(count:number,east:boolean){
    const direction=east?-1:1, v=east?1.34:-.24, out=east?.048:-.048;
    const start=center-direction*count*bayPitch/2;
    ring.push([start,v]);
    for(let i=0;i<count;i++){
      const s=start+direction*i*bayPitch;
      for(const [t,d] of [[.12,0],[.29,out],[.76,out],[.93,0]])
        ring.push([s+direction*t*bayPitch,v+d]);
    }
    ring.push([start+direction*count*bayPitch,v]);
  }
  bays(9,false);
  ring.push([2.424,-.066],[2.424,1.183-tier*.23]);
  bays(9-2*tier,true);
  ring.push([-.013,1.183-tier*.23],[-.013,-.066]);
  return ring;
}

function cap(batch:FacadePanels,ring:Point[],y:number,tint:string,reverse=false){
  const path=ring.map(([x,z])=>new THREE.Vector2(x,z));
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(path,[]))
    batch.triangle(world(ring[a],y),world(ring[reverse?b:c],y),world(ring[reverse?c:b],y),tint);
}

function rect(batch:FacadePanels,u:number,v:number,w:number,d:number,lo:number,hi:number,wall:string,top=wall){
  const q:Point[]=[[u-w/2,v-d/2],[u+w/2,v-d/2],[u+w/2,v+d/2],[u-w/2,v+d/2]];
  q.forEach((a,i)=>{const b=q[(i+1)%4]; batch.quad(world(a,lo),world(a,hi),world(b,hi),world(b,lo),wall);});
  cap(batch,q,hi,top);
}
function facade(batch:FacadePanels,ring:Point[],tier:number,windows:Window[]){
  const base=tier?decks[tier-1]:lobby, top=decks[tier],rows=tier?4:13;
  const pitch=(top-base)/rows;
  ring.forEach((a,i)=>{
    const b=ring[(i+1)%ring.length],du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv);
    const at=(s:number,y:number,d=0)=>world([a[0]+(du*s+dv*d)/len,a[1]+(dv*s-du*d)/len],y);
    const face=(l:number,r:number,low:number,high:number,d:number,tint:string)=>
      batch.quad(at(l,low,d),at(l,high,d),at(r,high,d),at(r,low,d),tint);
    // On the long walls the short recessed flats between bays are solid granite.
    if(len<.045 && Math.abs(dv)<.001){face(0,len,base,top,0,graniteShade);return;}
    const jamb=len>.14?.018:.003, back=-.009;
    face(0,jamb,base,top,0,stone); face(len-jamb,len,base,top,0,stone);
    batch.quad(at(jamb,base),at(jamb,top),at(jamb,top,back),at(jamb,base,back),reveal);
    batch.quad(at(len-jamb,base,back),at(len-jamb,top,back),at(len-jamb,top),at(len-jamb,base),reveal);
    for(let row=0;row<rows;row++){
      const y=base+row*pitch,end=y+pitch,sill=y+pitch*.18,head=end-pitch*.32;
      face(jamb,len-jamb,y,sill,0,stone);
      face(jamb,len-jamb,head,end,0,stone);
      if(!tier && row<2) for(const f of [.06,.86,.94])
        face(jamb,len-jamb,y+f*pitch,y+f*pitch+.003,.0013,graniteShade);
      batch.quad(at(jamb,sill,back),at(len-jamb,sill,back),at(len-jamb,sill),at(jamb,sill),stone);
      batch.quad(at(jamb,head),at(len-jamb,head),at(len-jamb,head,back),at(jamb,head,back),reveal);
      const cols=Math.max(1,Math.round((len-2*jamb)/.106)),w=(len-2*jamb)/cols;
      for(let col=0;col<cols;col++){
        const l=jamb+col*w,r=l+w;
        face(l,r,sill,head,back,glass[(row+Math.floor(i/4)+col)%4]);
        if(col)face(l-.0015,l+.0015,sill,head,back+.001,joint);
        if(w>.06 && (row*3+i+col+tier)%9===0){
          const [x,wy,z]=at(l+w/2,(sill+head)/2,back+.002);
          const normal=at(l+w/2,(sill+head)/2,back+.012);
          windows.push({x,y:wy,z,ry:Math.atan2(normal[0]-x,normal[2]-z),w:w*.89,h:(head-sill)*.90});
        }
      }
    }
  });
}

function streetLevel(batch:FacadePanels,b:Building){
  const shape=b.p.slice(0,-1).map(local);
  const area=THREE.ShapeUtils.area(shape.map(([x,z])=>new THREE.Vector2(x,z)));
  if(area<0)shape.reverse();
  for(const [i,a] of shape.entries()){
    const b=shape[(i+1)%shape.length],du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv);
    const midU=(a[0]+b[0])/2,midV=(a[1]+b[1])/2;
    const street=midV>1.20 || midU>2.26;
    const entrance=midU>2.23 && midV>1.17;
    const modules=Math.max(1,Math.round(len/.23));
    const at=(s:number,y:number,d=0)=>world([a[0]+du*s+dv*d/len,a[1]+dv*s-du*d/len],y);
    const face=(l:number,r:number,lo:number,hi:number,d:number,c:string)=>
      batch.quad(at(l,lo,d),at(l,hi,d),at(r,hi,d),at(r,lo,d),c);
    const depth=entrance?-.119:street?-.054:-.020;
    for(let n=0;n<modules;n++){
      const l=n/modules,r=(n+1)/modules,pier=Math.min(.018/len,.14/modules);
      face(l,l+pier,.025,lobby,0,stone);
      face(r-pier,r,.025,lobby,0,stone);
      batch.quad(at(l+pier,.025),at(l+pier,lobby),at(l+pier,lobby,depth),at(l+pier,.025,depth),reveal);
      batch.quad(at(r-pier,.025,depth),at(r-pier,lobby,depth),at(r-pier,lobby),at(r-pier,.025),reveal);
      face(l+pier,r-pier,.025,lobby,depth,street?'#687773':'#5a6260');
      face(l+pier,r-pier,.180,.188,depth+.003,'#a29c8e');
      face((l+r)/2-.002/len,(l+r)/2+.002/len,.025,lobby,depth+.002,joint);
      if(entrance)for(const side of [-1,1]){
        const s=(l+r)/2+side*.012/len;
        face(s-.0018/len,s+.0018/len,.078,.129,depth+.006,'#d3c5a4');
      }
    }
    batch.quad(at(0,lobby,depth),at(1,lobby,depth),at(1,lobby),at(0,lobby),'#b4ab9e');
  }
  cap(batch,plan(0),lobby,'#9c8b80',true);
}

function roof(batch:FacadePanels){
  // Rectified aerial referenced to the granite roofline. The U-shaped duct,
  // raised east runs and black mechanical well are inside the main deck.
  const y=decks[2];
  const fixtures=[
    [.95,.87,.073,.42],[.74,.68,.43,.081],[.53,.705,.07,.13],
    [.39,.85,.44,.036],[1.55,.90,.054,.53],
    [.44,.42,.39,.041],[1.98,.42,.38,.043],[1.84,.19,.33,.046],
    [.38,.52,.52,.04],[1.98,.51,.49,.041]
  ];
  for(const [u,v,w,d] of fixtures)rect(batch,u,v,w,d,y,y+.067,'#a5a299','#c2bfb4');
  for(const [u,v,w,d,h] of [[.62,.037,.20,.20,.081],[1.72,.97,.11,.22,.091],
    [.65,1.12,.10,.13,.073],[1.21,.73,.13,.10,.067],[1.51,.88,.075,.16,.12]])
    rect(batch,u,v,w,d,y,y+h,'#88887e','#a7a398');
  rect(batch,1.20,.11,.67,.39,y,y+.032,'#b7ada0','#696860');
  for(const [u,v,w,d] of [[.87,.11,.025,.40],[1.53,.11,.025,.40],[1.20,-.08,.68,.023],[1.20,.30,.68,.023]])
    rect(batch,u,v,w,d,y+.03,y+.145,'#a79c90','#bdb3a5');
  for(const u of [1.19,1.36]){
    rect(batch,u,.060,.154,.155,y+.032,y+.13,'#aaa99f','#b9b8ac');
    const circle:Point[]=Array.from({length:16},(_,i)=>[u+.061*Math.cos(i*Math.PI/8),.060+.061*Math.sin(i*Math.PI/8)]);
    cap(batch,circle,y+.132,'#525854');
  }
}

export function add101Mission(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==192026938)return false;
  const batch=new FacadePanels();
  streetLevel(batch,b);
  for(let tier=0;tier<3;tier++){
    const ring=plan(tier);
    facade(batch,ring,tier,windows);
    cap(batch,ring,decks[tier],tier===2?'#c3beb1':'#a6a298');
    for(const [i,a] of ring.entries()){
      const c=ring[(i+1)%ring.length],du=c[0]-a[0],dv=c[1]-a[1],len=Math.hypot(du,dv);
      // The two east shoulder terraces alone have exposed edges on lower tiers.
      if(tier<2 && !(Math.abs(dv)>.13 && Math.abs(du)>.13 && a[1]+c[1]>1.1 ||
          Math.min(a[1],c[1])>1.29 && Math.abs((a[0]+c[0])/2-center)>(7-2*tier)*bayPitch/2 ||
          Math.abs(du)<.001 && Math.max(a[1],c[1])>.74)) continue;
      const n:Point=[-dv/len*.012,du/len*.012];
      const low=decks[tier], high=low+.042;
      const inner=(p:Point):Point=>[p[0]+n[0],p[1]+n[1]];
      // Only the upper portion of each straight end is a terrace perimeter.
      let l=a,r=c;
      if(tier<2 && Math.abs(du)<.001){
        const cut=1.183-(tier+1)*.23;
        if(a[1]<cut)l=[a[0],cut];
        if(c[1]<cut)r=[c[0],cut];
      }
      batch.quad(world(l,low),world(l,high),world(r,high),world(r,low),stone);
      batch.quad(world(l,high),world(inner(l),high),world(inner(r),high),world(r,high),'#d0bfb0');
      batch.quad(world(inner(r),low),world(inner(r),high),world(inner(l),high),world(inner(l),low),graniteShade);
    }
  }
  roof(batch);
  const mesh=batch.mesh(material);
  mesh.name='101 Mission Street';
  root.add(mesh);
  return true;
}
