import * as THREE from 'three';
import {footprintGeometry,sfMap} from './sf-map.ts';

type Building={id:number;parent?:number;p:number[][];h:number};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const parcel=28319370,club=944095688,market=944095689,drumm=944095690;
const podium=.615;
const stone='#bdb8a8',sunStone='#ccc6b5',reveal='#777e78',slate='#55666a',metal='#8a928b';

class Paint{
  p:number[]=[];c:number[]=[];i:number[]=[];
  palette=new Map<string,THREE.Color>();
  quad(a:number[],b:number[],c:number[],d:number[],color:string){
    let rgb=this.palette.get(color);
    if(!rgb){rgb=new THREE.Color(color);this.palette.set(color,rgb);}
    const idx=this.p.length/3;
    for(const p of [a,b,c,d]){this.p.push(...p);this.c.push(rgb.r,rgb.g,rgb.b);}
    this.i.push(idx,idx+1,idx+2,idx,idx+2,idx+3);
  }
  finish(root:THREE.Group,name:string){
    if(!this.i.length)return;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setIndex(this.i);g.computeVertexNormals();
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87}));m.name=name;root.add(m);
  }
}
function wall(a:number[],b:number[]){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  const p=(u:number,y:number,d=0)=>[a[0]+dx*u+nx*d,y,a[1]+dz*u+nz*d];
  function panel(s:Paint,l:number,r:number,lo:number,hi:number,d:number,color:string){
    s.quad(p(l,lo,d),p(r,lo,d),p(r,hi,d),p(l,hi,d),color);
  }
  function strip(s:Paint,l:number,r:number,lo:number,hi:number,d0:number,d1:number,color:string){
    panel(s,l,r,lo,hi,d1,color);
    s.quad(p(l,hi,d1),p(r,hi,d1),p(r,hi,d0),p(l,hi,d0),color);
    s.quad(p(l,lo,d0),p(r,lo,d0),p(r,lo,d1),p(l,lo,d1),reveal);
    s.quad(p(l,lo,d0),p(l,lo,d1),p(l,hi,d1),p(l,hi,d0),color);
    s.quad(p(r,lo,d1),p(r,lo,d0),p(r,hi,d0),p(r,hi,d1),color);
  }
  function window(out:Pane[],u:number,y:number,w:number,h:number){
    const [x,,z]=p(u,y,.011);out.push({x,y,z,ry:Math.atan2(nx,nz),w,h});
  }
  return {p,nx,nz,length,panel,strip,window};
}
type Wall=ReturnType<typeof wall>;
function edges(plan:number[][],cb:(f:Wall,edge:number)=>void){
  const cw=THREE.ShapeUtils.isClockWise(plan.map(([x,z])=>new THREE.Vector2(x,z)));
  for(let i=1;i<plan.length;i++){const a=plan[i-1],b=plan[i];cb(cw?wall(a,b):wall(b,a),i-1);}
}
function slab(root:THREE.Group,p:number[][],lo:number,hi:number,color:string,name:string){
  const m=new THREE.Mesh(footprintGeometry(p,hi-lo),new THREE.MeshStandardMaterial({color,roughness:.88}));
  m.name=name;m.position.y=lo;root.add(m);
}
function inside(x:number,z:number,p:number[][]){
  let result=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const [ax,az]=p[i],[bx,bz]=p[j];
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)result=!result;
  }return result;
}

function streetRooms(s:Paint,f:Wall,lo:number,hi:number,panes:Pane[]){
  const count=Math.max(1,Math.round(f.length/.24)),floors=Math.max(1,Math.round((hi-lo)/.21));
  f.panel(s,0,1,lo,hi,.002,slate);
  for(let i=0;i<count;i++){
    const a=i/count,b=(i+1)/count;
    f.strip(s,a,a+.10/count,lo,hi,.003,.029,i%3===0?sunStone:stone);
    for(let k=0;k<floors;k++){
      const y=lo+(hi-lo)*k/floors,high=lo+(hi-lo)*(k+1)/floors;
      f.panel(s,a+.10/count,b,y+.019,high-.034,.005,(i+k)%4===0?'#788684':'#5d6c6d');
      f.panel(s,a+.52/count,a+.55/count,y+.019,high-.034,.009,metal);
      if((i+3*k)%7===0)f.window(panes,a+.72/count,(y+high)/2,.065,.103);
    }
  }
  for(let k=1;k<=floors;k++){
    const y=lo+(hi-lo)*k/floors;
    f.strip(s,0,1,y-.032,y,.004,.021,stone);
  }
}

function terrace(s:Paint,f:Wall,lo:number,hi:number,panes:Pane[]){
  const count=Math.max(1,Math.round(f.length/.25));
  f.panel(s,0,1,lo,hi,.002,'#52666a');
  for(let i=0;i<count;i++){
    const u=i/count;
    f.strip(s,u,u+.12/count,lo,hi,.003,.065,sunStone);
    f.panel(s,u+.48/count,u+.51/count,lo+.025,hi-.02,.007,metal);
    if(i%3===0)f.window(panes,u+.69/count,(lo+hi)/2,.071,.114);
  }
  // Guest-room glazing is behind the terrace. The front guard is a low opaque
  // concrete upstand with daylight under its slim metal handrail.
  f.strip(s,0,1,lo,lo+.054,.007,.112,stone);
  f.strip(s,0,1,lo+.078,lo+.087,.098,.109,metal);
  for(let i=0;i<=count;i++){
    const a=Math.min(.99,i/count);
    f.panel(s,a,Math.min(1,a+.009/f.length),lo+.05,lo+.08,.104,metal);
  }
}
function pierEnd(s:Paint,f:Wall,h:number,edge:number){
  f.panel(s,0,1,podium,h,.001,stone);
  const bays=f.length<.4?1:2;
  for(let i=0;i<bays;i++){
    const a=i/bays,b=(i+1)/bays;
    // Axial views read narrow stacks of openings flanked by Portman's deep concrete blades.
    const slot=edge%2===0?.32:.52,mid=(a+b)/2,g=slot/(2*bays);
    f.panel(s,mid-g,mid+g,podium,h-.045,.004,slate);
    for(let y=podium+.21;y<h-.025;y+=.21)f.strip(s,mid-g,mid+g,y-.026,y+.004,.007,.054,stone);
    f.strip(s,a,a+.12/bays,podium,h,.002,.04,sunStone);
  }
}

function rooftop(root:THREE.Group,b:Building){
  const [a,c,d]=b.p,[cx,cz]=[(b.p[0][0]+b.p[2][0])/2,(b.p[0][1]+b.p[2][1])/2];
  const dir=Math.atan2(c[1]-a[1],c[0]-a[0]),cos=Math.cos(dir),sin=Math.sin(dir);
  const point=(u:number,v:number)=>[cx+u*cos-v*sin,cz+u*sin+v*cos];
  const rect=(u:number,v:number,w:number,depth:number)=>[[u-w/2,v-depth/2],[u+w/2,v-depth/2],[u+w/2,v+depth/2],[u-w/2,v+depth/2]].map(([x,z])=>point(x,z));
  const circle=(r:number)=>Array.from({length:49},(_,i)=>point(r*Math.cos(i*Math.PI/24),r*Math.sin(i*Math.PI/24)));
  slab(root,circle(.38),3.97,4.23,reveal,'Restaurant pedestal');
  slab(root,circle(.648),4.22,4.75,'#60777a','Circular Regency Club glazing');
  const glazing=new Paint();
  edges(circle(.649),f=>f.panel(glazing,0,.12,4.26,4.73,.003,'#b2b3a7'));
  glazing.finish(root,'Revolving dining room mullions');
  for(const [y,t] of [[4.20,.12],[4.79,.19]]){
    const side=Math.min(Math.hypot(c[0]-d[0],c[1]-d[1]),1.65),bar=.14;
    for(const s of [-1,1]){
      slab(root,rect(0,s*(side-bar)/2,side,bar),y,y+t,sunStone,'Square cantilever frame');
      slab(root,rect(s*(side-bar)/2,0,bar,side-2*bar),y,y+t,sunStone,'Square cantilever frame');
    }
  }
  slab(root,circle(.63),4.75,4.85,'#969e95','Regency Club roof');
}

export function addHyattRegency(b:Building,root:THREE.Group,windows:Pane[]){
  if(b.id!==parcel&&b.parent!==parcel)return false;
  if(b.id!==parcel)return true;
  const group=new THREE.Group();group.name='Hyatt Regency San Francisco';root.add(group);
  const parts=sfMap.buildings.filter(p=>p.parent===parcel);
  const street=new Paint(),terraces=new Paint(),ends=new Paint(),base=new Paint();
  // Owner floor plan places the porte cochere on Drumm and the plaza stairs
  // opposite it. Set the street glazing inside the perimeter colonnade.
  const plinth=b.p,center=[.91,-14.75];
  const inset=plinth.map(([x,z])=>[center[0]+(x-center[0])*.92,center[1]+(z-center[1])*.92]);
  slab(group,inset,.025,podium-.065,'#5c6d6e','Inset public floors');
  slab(group,plinth,podium-.068,podium,stone,'Continuous public podium and arcade soffit');
  edges(plinth,f=>{
    const n=Math.max(1,Math.round(f.length/.37));
    for(let i=0;i<n;i++)f.strip(base,i/n,Math.min(1,i/n+.052/f.length),.03,podium-.06,-.044,.008,sunStone);
  });
  edges(inset,f=>{
    const n=Math.max(1,Math.round(f.length/.23));
    for(let i=0;i<n;i++)f.panel(base,i/n,Math.min(1,i/n+.009/f.length),.054,podium-.08,.003,metal);
    f.panel(base,0,1,.28,.30,.004,metal);
  });
  for(const part of parts){
    const h=part.id===club?3.99:part.h;
    if(h<=podium)continue;
    slab(group,part.p,podium,h-.008,reveal,'Mapped hotel floor mass');
    slab(group,part.p,h-.008,h,'#b8b8a9','Mapped terrace floor');
    edges(part.p,(f,edge)=>{
      const [x,,z]=f.p(.5,0,.034);
      const neighbor=parts.find(other=>other.id!==part.id&&inside(x,z,other.p));
      const low=neighbor?Math.max(podium,neighbor.id===club?3.99:neighbor.h):podium;
      if(h-low<.035)return;
      if(neighbor||h-low<.25){terrace(terraces,f,low,h,windows);return;}
      if(part.id===market&&(edge===1||edge===2)||part.id===drumm&&edge===6){
        streetRooms(street,f,low,h,windows);return;
      }
      pierEnd(ends,f,h,edge);
    });
    if(part.id===club)rooftop(group,part);
  }
  street.finish(group,'Market and Drumm guest room elevations');
  terraces.finish(group,'Stepped bay balconies, room dividers and open guardrails');
  ends.finish(group,'Fluted end piers and recessed floor openings');
  base.finish(group,'Ground-level arcade columns and transoms');
  return true;
}
