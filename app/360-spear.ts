import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Building={id:number;p:number[][]};
type At=(s:number,y:number,depth?:number)=>FacadePoint;
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78});
const stucco='#d1cfc4',shadow='#9e9e94',sash='#b3b9b5',iron='#4a5355';
const glazing=['#535f71','#5c6877','#64717e','#576776'];
const foot=.3048*.06;
const floors=[17+7/12,31+1/12,44+7/12,58+1/12,72+7/12].map(h=>h*foot);
const deck=floors[4],parapet=(74+7/12)*foot,screen=93*foot;
const quad=(b:FacadePanels,f:At,l:number,r:number,y:number,top:number,d:number,color:string)=>
  b.quad(f(l,y,d),f(l,top,d),f(r,top,d),f(r,y,d),color);

// Spear and Harrison elevations and sections: Charles F. Bloszies, A3.01, 2019.
// https://commissions.sfplanning.org/cpcpackets/2018-014774CUA.pdf
// As-built lobby and folding storefront: https://360spearstreet.com/leasing/
export function add360Spear(building:Building,root:THREE.Group,windows:Window[]){
  if(building.id!==192307107)return false;
  const [back,north,south]=building.p;
  const width=Math.hypot(south[0]-north[0],south[1]-north[1]);
  const depth=Math.hypot(back[0]-north[0],back[1]-north[1]);
  const ux=(south[0]-north[0])/width,uz=(south[1]-north[1])/width;
  const vx=(back[0]-north[0])/depth,vz=(back[1]-north[1])/depth;
  const world=([u,v]:Point,y:number):FacadePoint=>[north[0]+u*ux+v*vx,y,north[1]+u*uz+v*vz];
  const batch=new FacadePanels();
  function rect(u:number,v:number,w:number,d:number):Point[]{
    return [[u,v],[u+w,v],[u+w,v+d],[u,v+d]];
  }
  function cap(p:Point[],y:number,c:string){
    for(const [a,b,c0] of THREE.ShapeUtils.triangulateShape(p.map(([u,v])=>new THREE.Vector2(u,v)),[]))
      batch.triangle(world(p[a],y),world(p[c0],y),world(p[b],y),c);
  }
  function prism(p:Point[],lo:number,hi:number,side:string,top:string){
    p.forEach((a,i)=>{const b=p[(i+1)%p.length];batch.quad(world(a,lo),world(a,hi),world(b,hi),world(b,lo),side);});
    cap(p,hi,top);
  }
  const plane=(a:Point,b:Point):At=>{
    const du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv);
    return (s,y,d=0)=>world([a[0]+(s*du+d*dv)/len,a[1]+(s*dv-d*du)/len],y);
  };
  function opening(f:At,l:number,r:number,lo:number,hi:number,back:number,c:string){
    batch.quad(f(l,lo),f(l,hi),f(l,hi,back),f(l,lo,back),shadow);
    batch.quad(f(r,lo,back),f(r,hi,back),f(r,hi),f(r,lo),shadow);
    batch.quad(f(l,lo,back),f(r,lo,back),f(r,lo),f(l,lo),stucco);
    batch.quad(f(l,hi),f(r,hi),f(r,hi,back),f(l,hi,back),shadow);
    quad(batch,f,l,r,lo,hi,back,c);
  }
  function louvers(f:At,l:number,r:number,lo:number,hi:number,d:number){
    quad(batch,f,l,r,lo,hi,d,'#434c4f');
    const rows=Math.max(4,Math.round((hi-lo)/.012));
    for(let i=1;i<rows;i++){
      const y=lo+(hi-lo)*i/rows;
      quad(batch,f,l,r,y,y+.0028,d+.0012,'#848c8b');
    }
  }
  function officeFloor(f:At,len:number,bays:number,street:number){
    const pitch=len/bays;
    for(let i=0;i<bays;i++)for(let floor=0;floor<4;floor++){
      const y=floors[floor],top=floors[floor+1],span=top-y;
      const end=i===0||i===bays-1;
      const sill=y+span*(end?.20:.105),head=y+span*(end?.72:.89);
      const left=i*pitch,right=left+pitch;
      quad(batch,f,left,right,y,sill,0,stucco);
      quad(batch,f,left,right,head,top,0,stucco);
      // The end piers have paired small lights; the north end has louvers on L2.
      const openings=end?[[.19,.36],[.56,.73]]:[[.112,.886]];
      let last=left;
      for(const [a,b] of openings){
        const l=left+a*pitch,r=left+b*pitch,d=-.012;
        quad(batch,f,last,l,sill,head,0,stucco);last=r;
        opening(f,l,r,sill,head,d,glazing[(floor+i+street)%4]);
        if(!street && i===0 && floor===0){louvers(f,l,r,sill,head,d+.001);continue;}
        const cross=sill+(head-sill)*(end?.52:.32);
        quad(batch,f,l,r,cross-.0018,cross+.0018,d+.0015,sash);
        const cols=end?1:3;
        for(let j=1;j<cols;j++){
          const s=l+(r-l)*j/cols;quad(batch,f,s-.0018,s+.0018,sill,head,d+.0015,sash);
        }
        if((floor+3*i+street)%4===0){
          const cell=(r-l)/cols,mid=l+.5*cell,cy=(cross+head)/2;
          const [x,wy,z]=f(mid,cy,d+.002),np=f(mid,cy,d+.012);
          windows.push({x,y:wy,z,ry:Math.atan2(np[0]-x,np[2]-z),w:cell*.88,h:(head-cross)*.89});
        }
      }
      quad(batch,f,last,right,sill,head,0,stucco);
    }
  }
  const long=plane([0,0],[width,0]),short=plane([width,0],[width,depth]);
  officeFloor(long,width,13,0);officeFloor(short,depth,6,1);
  const corners=rect(0,0,width,depth);
  for(const [i,a] of corners.entries()){
    const b=corners[(i+1)%4],f=plane(a,b),len=Math.hypot(a[0]-b[0],a[1]-b[1]);
    quad(batch,f,0,len,deck,parapet,0,stucco);
    quad(batch,f,0,len,deck,parapet,-.015,shadow);
    batch.quad(f(0,parapet),f(0,parapet,-.015),f(len,parapet,-.015),f(len,parapet),'#dcd8ca');
    if(i>1){
      // The documented north side is windowless and the west wall shares its
      // lot line with 390 Main. Keep the narrow exposed upper edge continuous.
      quad(batch,f,0,len,.025,deck,0,i===2?'#b5b5aa':'#c6c7be');
      for(const y of [floors[0],floors[3]])quad(batch,f,0,len,y,y+.003,.001,'#b8b9b1');
    }
  }
  // Visible street face follows structural axes 1–14 from Harrison to the
  // mid-block passage. The office entry occupies bay 7, with glazed roll-up
  // doors to its south and the lobby lounge opening to its north.
  for(const [f,len,bays] of [[long,width,13],[short,depth,6]] as const){
    for(let i=0;i<bays;i++){
      const spe=f===long,k=spe?12-i:5-i,pitch=len/bays;
      const l=i*pitch,r=l+pitch,jamb=.039,low=.024,head=floors[0]-.018;
      const entry=spe&&k===6,lounge=spe&&k===7,roll=spe&&[4,5,8].includes(k);
      const grille=spe?[2,3,9,10,11,12].includes(k):[1,3,4].includes(k);
      quad(batch,f,l,l+jamb,low,floors[0],0,stucco);
      quad(batch,f,r-jamb,r,low,floors[0],0,stucco);
      quad(batch,f,l+jamb,r-jamb,head,floors[0],0,stucco);
      const a=l+jamb,b=r-jamb,d=entry?-.080:lounge?-.105:-.019;
      opening(f,a,b,low,head,d,lounge?'#ac9b82':grille?'#6b7372':'#536367');
      if(grille){louvers(f,a,b,low+.050,head,d+.001);}
      else{
        const cols=roll?4:entry?3:2,rows=roll?7:entry?3:2;
        for(let c=1;c<cols;c++){
          const x=a+(b-a)*c/cols;
          quad(batch,f,x-.0027,x+.0027,low,head,d+.003,iron);
        }
        for(let c=1;c<rows;c++){
          const y=low+(head-low)*c/rows;
          quad(batch,f,a,b,y-.0027,y+.0027,d+.003,iron);
        }
        if(entry)for(const side of [-1,1]){
          const x=(a+b)/2+side*.01;quad(batch,f,x-.002,x+.002,.073,.143,d+.006,'#c7c2ae');
        }
        if(lounge){
          quad(batch,f,a,b,.207,head,-.005,'#787e73');
          for(let c=0;c<=4;c++){
            const x=a+(b-a)*c/4;quad(batch,f,x-.003,x+.003,.205,head,-.002,iron);
          }
          for(let c=0;c<3;c++){
            const x=a+(b-a)*c/3;
            prism(rect(x,-.032,(b-a)/3-.005,.033),.028,.072,'#9e9b89','#939674');
            prism(rect(x+.004,-.031,(b-a)/3-.013,.026),.072,.083,'#8e9472','#839071');
          }
        }
      }
    }
  }
  // A3.01 shows the curb rising west up Harrison while Spear is level. The
  // splayed base follows that line within the footprint of the flat scene street.
  batch.quad(short(0,.024,.002),short(0,.030,.002),short(depth,.087,.002),short(depth,.024,.002),'#a6a69c');
  const pitch=width/13;
  // Flush glazed canopy with dark outriggers and projecting blade at the doors.
  const canopyLeft=5*pitch+.023,canopyRight=7*pitch-.02;
  prism(rect(canopyLeft,-.109,canopyRight-canopyLeft,.115),.299,.308,'#6b716e','#b3bcb1');
  for(const u of [canopyLeft,6*pitch,canopyRight-.014])
    prism(rect(u,-.11,.015,.113),.291,.300,iron,iron);
  prism(rect(7*pitch-.011,-.108,.010,.105),.219,.279,iron,iron);
  // Cream numerals on both sides of the projecting bronze address sign.
  const figures:Point[][]=[
    [[0,1],[.64,1],[1,.83],[.92,.66],[.55,.53],[.91,.46],[1,.26],[.79,.08],[.37,0],[0,.12]],
    [[.86,1],[.51,.96],[.20,.79],[.02,.52],[0,.24],[.18,.06],[.55,0],[.86,.11],[1,.32],[.89,.49],[.62,.57],[.28,.52],[.05,.36]],
    [[.50,1],[.17,.88],[0,.58],[.04,.25],[.23,.05],[.50,0],[.77,.05],[.96,.25],[1,.58],[.83,.88],[.50,1]]
  ];
  for(const side of [-1,1]){
    const planeU=7*pitch-.006+side*.006;
    const rt=side>0?1:-1;
    for(const [i,line] of figures.entries())for(let j=1;j<line.length;j++){
      const [x1,y1]=line[j-1],[x2,y2]=line[j],dx=(x2-x1)*.014,dy=(y2-y1)*.024;
      const r=.0012/Math.hypot(dx,dy);
      const atSign=(x:number,y:number,a:number,b:number)=>world([planeU,-.052+rt*((i-1)*.021+(x-.5)*.014+a)],.241+y*.024+b);
      const A=atSign(x1,y1,-dy*r,dx*r),B=atSign(x2,y2,-dy*r,dx*r);
      const C=atSign(x2,y2,dy*r,-dx*r),D=atSign(x1,y1,dy*r,-dx*r);
      batch.quad(A,B,C,D,'#dfcfad');
    }
  }
  cap(corners,deck,'#c0beb1');
  // Register 2024 city ortho pixels to the four exterior roof corners. The dark
  // perimeter is an 18-foot-high mechanical screen, with open sky above the plant.
  const roofPoint=(px:number,py:number):Point=>[(px-53)/865*width,(py-36)/392*depth];
  function roofBox(x:number,y:number,w:number,h:number,bottom:number,top:number,color:string,roof:string){
    const [u,v]=roofPoint(x,y),[r,s]=roofPoint(x+w,y+h);prism(rect(u,v,r-u,s-v),bottom,top,color,roof);
  }
  const outline=[[105,85],[191,85],[191,126],[247,126],[247,162],[503,162],[503,84],[731,84],[731,376],[105,376]];
  // Make the enclosure double sided with a thin coping, retaining the open roof between units.
  for(const [i,a] of outline.entries()){
    const b=outline[(i+1)%outline.length],A=roofPoint(a[0],a[1]),B=roofPoint(b[0],b[1]);
    const isHorizontal=a[1]===b[1];
    roofBox(Math.min(a[0],b[0]),Math.min(a[1],b[1]),isHorizontal?Math.abs(b[0]-a[0]):2.2,isHorizontal?2.2:Math.abs(b[1]-a[1]),deck,screen,'#a5a59e','#d7d4c7');
    const count=Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/.27);
    for(let j=0;j<count;j++){
      const u=a[0]+(b[0]-a[0])*j/count,v=a[1]+(b[1]-a[1])*j/count;
      roofBox(u-.9,v-.9,3.7,3.7,deck,screen+.003,'#93958e','#c5c3b7');
    }
  }
  // Documented raised escape/stair head at Spear/Harrison wraps the two
  // narrow upper windows on each street elevation.
  const corner=rect(width-.455,0,.455,.409),stairTop=(85+5/12)*foot;
  prism(corner,deck,stairTop,stucco,'#bfbbad');
  for(const [f,start,w] of [[long,width-.455,.455],[short,0,.409]] as const){
    for(const ratio of [.29,.66]){
      const l=start+ratio*w-.030;quad(batch,f,l,l+.060,parapet+.049,stairTop-.029,.002,'#68737a');
      quad(batch,f,l,l+.060,parapet+.088,parapet+.091,.003,sash);
    }
  }
  roofBox(719,355,66,70,deck,1.593,'#aaa99f','#c1bdaf');
  roofBox(510,92,77,156,deck,1.653,'#abaea4','#cbccbf');
  roofBox(191,229,80,64,deck,1.594,'#a9aca2','#bdbeb3');
  roofBox(685,97,26,105,deck,1.552,'#adafa7','#c2c3b8');
  roofBox(128,149,23,151,deck,1.499,'#aaa99e','#bbb9aa');
  roofBox(158,175,20,140,deck,1.508,'#a2a397','#bab8a8');
  for(const [x,y,w,h] of [[256,203,129,10],[373,188,91,12],[452,165,15,42],[573,240,8,127],[692,202,15,44]])
    roofBox(x,y,w,h,deck,1.582,'#a8aaa1','#cecdc0');
  // Two double rows of condenser fans in each large southern bank and a
  // smaller row of seven units at the head of the mechanical well.
  function fans(x:number,y:number,w:number,h:number,cols:number,rows:number,top:number){
    roofBox(x,y,w,h,deck,top,'#a8aaa1','#babcb0');
    const radius=Math.min(w/cols,h/rows)*.31;
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const cx=x+(i+.5)*w/cols,cy=y+(j+.5)*h/rows;
      const p:Point[]=Array.from({length:9},(_,k)=>roofPoint(cx+radius*Math.cos(k*Math.PI*2/9),cy+radius*Math.sin(k*Math.PI*2/9)));
      cap(p,top+.002,'#565f5c');
    }
  }
  for(const y of [274,330]){fans(469,y,100,25,8,2,1.543);fans(606,y,94,25,8,2,1.557);}
  for(let k=0;k<7;k++)fans(598,101+k*19,49,12,5,1,1.502);
  for(const [x,y,w,h,c,r] of [[203,315,77,11,5,1],[296,315,16,40,1,3],[324,315,22,39,1,3],
    [364,315,17,37,1,3],[394,315,16,36,1,3],[328,245,40,41,2,3],[206,251,51,32,2,2]])
    fans(x,y,w,h,c,r,1.556);
  const mesh=batch.mesh(paint);mesh.name='360 Spear Street';root.add(mesh);
  return true;
}
