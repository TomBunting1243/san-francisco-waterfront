import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Pt=[number,number];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84});
const olive='#85856b',ivory='#ddd3bf',wood='#805c48',green='#405e51',gold='#bb976b';

// Interiors are an interpretation of the operator's July 2023 refresh photos.
// BXP street plan R-4110 supplies the corner envelope. All points are in
// the same local axes as the adjoining podium, with a 0.06 unit/metre scale.
class DiningPanels extends FacadePanels{
  box(x:number,y:number,z:number,w:number,h:number,d:number,tint:string){
    const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,f=z-d/2,e=z+d/2;
    this.quad([l,t,f],[l,t,e],[r,t,e],[r,t,f],tint);
    this.quad([l,b,e],[r,b,e],[r,t,e],[l,t,e],tint);
    this.quad([r,b,f],[l,b,f],[l,t,f],[r,t,f],tint);
    this.quad([l,b,f],[l,b,e],[l,t,e],[l,t,f],tint);
    this.quad([r,b,e],[r,b,f],[r,t,f],[r,t,e],tint);
  }
  disk(x:number,y:number,z:number,r:number,h:number,tint:string,n=12){
    const pos=(i:number,up:number):FacadePoint=>[x+r*Math.sin(2*Math.PI*i/n),up,z+r*Math.cos(2*Math.PI*i/n)];
    for(let i=0;i<n;i++){
      this.triangle([x,y+h,z],pos(i,y+h),pos(i+1,y+h),tint);
      this.quad(pos(i,y),pos(i+1,y),pos(i+1,y+h),pos(i,y+h),tint);
    }
  }
}
function table(p:DiningPanels,x:number,z:number,floor:number,round:boolean,patio=false){
  const top=floor+.045;
  p.box(x,floor+.022,z,.009,.044,.009,'#4f5149');
  if(round)p.disk(x,top-.003,z,.029,.003,ivory);
  else p.box(x,top-.002,z,.058,.004,.049,patio?wood:ivory);
  for(const side of [-1,1]){
    const chairZ=z+side*.048,back=chairZ+side*.011;
    p.box(x,floor+.026,chairZ,.027,.004,.025,patio?'#bbb9aa':wood);
    for(const k of [-1,1])p.box(x+k*.010,floor+.012,chairZ,.002,.024,.019,green);
    p.box(x,floor+.041,back,.029,.003,.003,green);
    if(patio){
      for(const k of [-1,0,1])p.box(x+k*.011,floor+.035,back,.002,.014,.003,green);
    }else p.box(x,floor+.035,back,.026,.014,.004,round?green:'#9a866d');
    p.disk(x,top+.0004,z+side*.014,.007,.0007,'#e4e0cd',8);
  }
}
const leaves=['#566944','#67784d','#788653','#4c6146'];
const bracts=['#ac4b68','#bb637d','#95445d','#c07786'];
function vine(p:DiningPanels,path:Pt[],z:number,seed:number,spacing:number){
  // Photograph of the plaza entrance: crooked woody stems, outward shoots
  // and thin papery bracts caught among the leaves.
  let state=seed;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const stem=(x:number,y:number,tx:number,ty:number,r:number,depth:number)=>{
    const length=Math.hypot(tx-x,ty-y),nx=(y-ty)*r/length,ny=(tx-x)*r/length;
    p.quad([x+nx,y+ny,depth],[x-nx,y-ny,depth],[tx-nx,ty-ny,depth],[tx+nx,ty+ny,depth],'#755f48');
  };
  for(let k=1;k<path.length;k++){
    const [x,y]=path[k-1],[tx,ty]=path[k],dx=tx-x,dy=ty-y,length=Math.hypot(dx,dy);
    stem(x,y,tx,ty,.0008+.0009*(1-k/path.length),z);
    const count=Math.ceil(length/spacing);
    for(let j=0;j<count;j++){
      const t=(j+.13+.68*random())/count,sx=x+dx*t,sy=y+dy*t;
      const angle=Math.atan2(dy,dx)+(random()<.5?-1:1)*(.40+random()*1.45);
      const size=.010+random()*.019,ex=sx+Math.cos(angle)*size,ey=sy+Math.sin(angle)*size;
      stem(sx,sy,ex,ey,.00055,z+.00035);
      for(let h=0;h<5;h++){
        const u=(h+.6)/6,cx=sx+(ex-sx)*u,cy=sy+(ey-sy)*u;
        const a=angle+(h%2?-1:1)*(.50+random()*.63),lx=Math.cos(a),ly=Math.sin(a);
        const len=.006+random()*.006,w=len*.24,d=z+.0008+random()*.002;
        p.quad([cx,cy,d],[cx+lx*len*.52+ly*w,cy+ly*len*.52-lx*w,d+.001],
          [cx+lx*len,cy+ly*len,d+.0005],[cx+lx*len*.45-ly*w,cy+ly*len*.45+lx*w,d+.001],leaves[Math.floor(random()*4)]);
      }
      if(random()>.72)continue;
      const rotation=random()*6.28;
      for(let h=0;h<3;h++){
        const a=rotation+h*2.1,l=.002+random()*.0024,w=l*.55,lx=Math.cos(a),ly=Math.sin(a),d=z+.003;
        p.triangle([ex,ey,d],[ex+l*lx+w*ly,ey+l*ly-w*lx,d+.0006],
          [ex+l*lx-w*ly,ey+l*ly+w*lx,d+.0012],bracts[Math.floor(random()*4)]);
      }
    }
  }
}
export function addOshaDiningRoom(root:THREE.Group,patio:THREE.Group,floor:number,ceiling:number){
  const interior=new DiningPanels(),outside=new DiningPanels(),light=new DiningPanels();
  const rear=4.48,left=2.925,right=4.775,soffit=floor+.225;
  const shell:Pt[]=[[left,rear],[right,rear],[5.28,5.19],[left,5.19]];
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(shell.map(([x,z])=>new THREE.Vector2(x,z)),[])){
    const point=(i:number,h:number):FacadePoint=>[shell[i][0],h,shell[i][1]];
    interior.triangle(point(a,floor+.001),point(c,floor+.001),point(b,floor+.001),'#8d6750');
    interior.triangle(point(a,soffit),point(b,soffit),point(c,soffit),'#c8bfa8');
  }
  // Olive inset wall panels, cream pilasters and continuous dark banquette
  // behind the front tables are visible across multiple refresh photographs.
  interior.box((left+right)/2,(floor+ceiling)/2,rear,right-left,ceiling-floor,.012,ivory);
  interior.box(left,(floor+ceiling)/2,(rear+5.19)/2,.014,ceiling-floor,5.19-rear,'#89765e');
  for(let i=0;i<7;i++){
    const x=left+.137+i*.26;
    interior.box(x,floor+.145,rear+.009,.228,.128,.006,olive);
    interior.box(x,floor+.068,rear+.014,.245,.020,.012,gold);
  }
  interior.box(3.96,floor+.044,rear+.035,1.44,.086,.045,'#694937');
  // A pale counter and green tiled pier separate the bar/view into the room.
  interior.box(3.15,floor+.045,4.86,.28,.089,.068,'#b8ab98');
  interior.box(3.15,floor+.092,4.86,.31,.007,.079,ivory);
  interior.box(3.56,(floor+ceiling)/2,4.70,.058,ceiling-floor,.058,'#35625b');
  for(let j=0;j<10;j++){
    const y=floor+.018+j*.028;
    interior.box(3.56,y,4.731,.058,.0013,.002,'#839384');
  }
  for(const x of [3.65,3.83,4.02,4.21,4.40,4.59])table(interior,x,4.61,floor,true);
  for(const x of [3.45,3.69,3.93,4.18,4.42,4.66,4.88])table(interior,x,4.92,floor,false);
  for(const x of [3.45,3.73,4.01,4.29,4.57,4.85,5.07])table(interior,x,5.09,floor,true);
  vine(interior,Array.from({length:10},(_,i)=>[3.28+i*.158,soffit-.024+.012*Math.sin(i*2.1)]),4.58,439,.029);
  for(const x of [3.52,4.04,4.56]){
    // Crystal chandeliers: a dark suspension, brass ring and short drops.
    interior.box(x,soffit-.021,4.84,.002,.042,.002,gold);
    interior.disk(x,soffit-.046,4.84,.033,.003,gold);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,cx=x+.027*Math.cos(a),cz=4.84+.027*Math.sin(a);
      light.disk(cx,soffit-.067-(i%2)*.005,cz,.003,.018,'#f4ddaa',5);
    }
  }
  // Short ceiling coves cast a localized amber wash behind the banquette.
  // Only the visible diffusers enter the existing signLight dusk pass.
  for(let i=0;i<7;i++)light.box(left+.137+i*.26,soffit-.012,rear+.018,.12,.002,.005,'#eddbb9');
  // Refreshed patio photograph: two-tone woven seating, timber-topped
  // tables, a low black rail, and bougainvillea trailing down the jamb.
  for(const side of [-1,1]){
    for(const x of [.16,.30])table(outside,x*side,.115,floor,x===.16,true);
    for(const y of [.030,.050,.070])outside.box(.235*side,floor+y,.204,.287,.0025,.0025,'#48534a');
    for(const x of [.092,.233,.379])outside.box(side*x,floor+.037,.204,.003,.074,.003,'#4b534a');
  }
  const lintel=ceiling-.083;
  vine(outside,[[-.359,floor+.006],[-.368,floor+.069],[-.356,lintel-.030],[-.372,lintel],
    [-.317,lintel+.011],[-.243,lintel+.004],[-.170,lintel+.008],[-.124,lintel-.004]],.033,71,.015);
  vine(outside,[[-.356,lintel-.030],[-.323,lintel-.016],[-.281,lintel-.012],[-.255,lintel-.030]],.037,583,.016);
  vine(outside,[[.371,floor+.025],[.367,lintel-.039],[.381,lintel-.012],[.354,lintel+.006],
    [.308,lintel+.001],[.250,lintel+.013],[.211,lintel+.004]],.033,846,.017);
  // SF 2024 RGB orthophoto: the pale parasols extend along the adjacent
  // storefronts. Keep the Osha entrance and its separately photographed
  // flower-framed patio clear. Heights are interpreted from the 2023 DSM.
  const adjacent=new DiningPanels();
  for(const [x,z] of [[.433,.136],[.590,.141],[.735,.139],[.892,.144],[1.042,.156],[1.199,.170],[1.356,.166],[1.541,.140]]){
    table(adjacent,x,z,floor,false,true);
    adjacent.box(x,floor+.137,z,.004,.274,.004,'#6e6556');
    for(let i=0;i<8;i++){
      const edge=(k:number):FacadePoint=>[x+.091*Math.cos(k*Math.PI/4),floor+.231,z+.097*Math.sin(k*Math.PI/4)];
      const a=edge(i),b=edge(i+1),peak:FacadePoint=[x,floor+.269,z];
      adjacent.triangle(peak,b,a,i%3===1?'#e0d3bd':'#e9decb');
      adjacent.triangle(peak,a,b,'#cdc2ac');
    }
  }
  function attach(p:DiningPanels,parent:THREE.Group,name:string){
    const m=p.mesh(material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  attach(adjacent,patio,'Four Center adjacent plaza cafe parasols');
  attach(interior,root,'Osha dining room · olive panels, banquette and marble tables');
  attach(outside,patio,'Osha street patio · woven chairs and bougainvillea');
  attach(light,root,'Osha chandelier glass').userData.signLight=[.87,.61,.29];
}
