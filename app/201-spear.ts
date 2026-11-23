import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import harborFont from './harbor-font.json' with {type:'json'};
import {sfMap} from './sf-map.ts';

type Point=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type Building={id:number;p:number[][]};
const base=288645263,wing=1550628439,tower=1550628438;
const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77});
const brick='#b48169',returnBrick='#aa775f',reveal='#805e50',seal='#544d47';
const glass=['#485960','#52626a','#53646c','#40535b'];
const family=sfMap.buildings.filter(b=>[base,wing,tower].includes(b.id));
// SF 2024 8-cm orthophoto and 2023 USGS 1.5-m DSM: terrace, roof and parapet
// are separate surfaces. The nominal mapped heights overstate the main slab
// and leave too large a jump from the upper south terrace to the main roof.
const lowerDeck=1.275,upperDeck=4.073,mainDeck=4.357,lobby=.335;
const lowerRim=1.328,upperRim=4.132,mainRim=4.423;
// The leasing floor plans preserve the individually angled glazing facets.
// https://www.201spear.info/availabilities.html
// https://cwg-p-001.sitecorecontenthub.cloud/api/public/content/201Spear_Bro?v=bebace48
// https://sfplanning.s3.amazonaws.com/sfmea/2011.1122E_DEIR1.pdf

function ring(points:number[][]):Point[]{
  const pts=points.slice(0,-1) as Point[];
  // Remove mapped intermediate vertices on a single plane, retaining the teeth.
  const out=pts.filter((b,i)=>{
    const a=pts[(i+pts.length-1)%pts.length],c=pts[(i+1)%pts.length];
    const area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
    return area/Math.hypot(c[0]-a[0],c[1]-a[1])>.006;
  });
  const area=out.reduce((v,a,i)=>{const b=out[(i+1)%out.length];return v+a[0]*b[1]-b[0]*a[1]},0);
  return area>0?out:out.reverse();
}
function inside(x:number,z:number,points:number[][]){
  let hit=false;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function cap(batch:FacadePanels,ps:Point[],y:number,tint:string,down=false){
  const path=ps.map(([x,z])=>new THREE.Vector2(x,z));
  for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(path,[])){
    const pos=(n:number):FacadePoint=>[ps[n][0],y,ps[n][1]];
    batch.triangle(pos(i),pos(down?j:k),pos(down?k:j),tint);
  }
}
function prism(batch:FacadePanels,points:Point[],bottom:number,top:number,wall:string,roof:string){
  const poly=ring([...points,points[0]]);
  for(const [i,a] of poly.entries()){
    const b=poly[(i+1)%poly.length];
    batch.quad([a[0],bottom,a[1]],[a[0],top,a[1]],[b[0],top,b[1]],[b[0],bottom,b[1]],wall);
  }
  cap(batch,poly,top,roof);
}

// JackPav, KartaView sequence 11605, frame 1542, 2 August 2016. The
// numbered pier faces Spear. A dark shop sits below a continuous brick head.
// https://kartaview.org/details/11605/1542/track-info
// SF Planning locates the shopfronts, Spear lobby and separate garage access:
// https://commissions.sfplanning.org/cpcpackets/75%20Howard%20Street%20Draft%20EIR.pdf
function cornerShop(batch:FacadePanels,a:Point,b:Point,onSpear:boolean){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
  const width=onSpear?1.12:.77,top=.245,setback=-.043;
  const at=(s:number,y:number,d:number):FacadePoint=>[a[0]+ux*s+uz*d,y,a[1]+uz*s-ux*d];
  const face=(l:number,r:number,lo:number,hi:number,d:number,tint:string)=>
    batch.quad(at(l,lo,d),at(l,hi,d),at(r,hi,d),at(r,lo,d),tint);
  const start=onSpear?len-width:0,end=start+width;
  const cornerPier=.173,outerPier=.076;
  const l=start+(onSpear?outerPier:cornerPier),r=end-(onSpear?cornerPier:outerPier);
  const faceDepth=0;
  face(start,l,.027,lobby,faceDepth,brick);face(r,end,.027,lobby,faceDepth,brick);
  face(l,r,top,lobby,faceDepth,brick);
  // End return where the thicker street wall meets the older open colonnade.
  const outer=onSpear?start:end;
  const edge=[at(outer,.027,0),at(outer,lobby,0),at(outer,lobby,-.075),at(outer,.027,-.075)] as const;
  if(onSpear)batch.quad(edge[3],edge[2],edge[1],edge[0],returnBrick);
  else batch.quad(...edge,returnBrick);
  // The brick jambs turn into the actual recessed shop opening, leaving all
  // components inside the surveyed facade line and the sidewalk clear.
  batch.quad(at(l,.027,faceDepth),at(l,top,faceDepth),at(l,top,setback),at(l,.027,setback),returnBrick);
  batch.quad(at(r,.027,setback),at(r,top,setback),at(r,top,faceDepth),at(r,.027,faceDepth),returnBrick);
  batch.quad(at(l,top,faceDepth),at(r,top,faceDepth),at(r,top,setback),at(l,top,setback),returnBrick);
  const panes=onSpear?6:4,step=(r-l)/panes,frame='#404748';
  for(let j=0;j<panes;j++){
    const s=l+j*step,t=s+step,door=onSpear&&j===3;
    face(s,t,.038,top,setback,door?'#3a4948':j%3===1?'#435352':'#3c4a4c');
    face(s,t,.183,top,setback+.0006,j%2?'#46555a':'#465354');
    face(s,s+.005,.038,top,setback+.0018,frame);
    face(s,t,.028,.039,setback+.002,'#77736b');
    if(door){
      face(s,t,.168,.174,setback+.0022,frame);
      face(s+.011,s+.014,.083,.112,setback+.0025,'#aaa897');
    }
  }
  face(l,r,.177,.183,setback+.0025,frame);
  // The shop head and large numbered pier share the coursed brick finish.
  for(const y of [top+.016,top+.039,top+.062])
    face(l,r,y,y+.0013,faceDepth+.0005,'#a5725d');
  const pierStart=onSpear?r:start,pierEnd=onSpear?end:l;
  for(let y=.045;y<lobby-.005;y+=.011)face(pierStart,pierEnd,y,y+.00065,.0004,'#ab7c65');
  if(onSpear){
    const text=new THREE.ShapeGeometry(new FontLoader().parse(harborFont).generateShapes('201',.035),3);
    text.computeBoundingBox();
    const positions=text.getAttribute('position'),index=text.index!,middle=(text.boundingBox!.max.x+text.boundingBox!.min.x)/2;
    const vertex=(i:number)=>at(end-cornerPier/2-(positions.getX(i)-middle),top+.006+positions.getY(i),.0008);
    for(let i=0;i<index.count;i+=3)
      batch.triangle(vertex(index.getX(i)),vertex(index.getX(i+1)),vertex(index.getX(i+2)),'#b1afa0');
    text.dispose();
  }
  return {start,end};
}

function arcade(batch:FacadePanels,b:Building){
  const corners=[41,61,102,122].map(i=>b.p[i]) as Point[];
  const recess:Point[]=corners.map(([x,z])=>[-27.82+(x+27.82)*.922,-10.61+(z+10.61)*.869]);
  prism(batch,recess,.025,lobby,'#46595c','#7e6556');
  // Spear is the inland long side. The lobby sightline passes between the
  // square brick columns to clear glass and a divided pair of doors.
  for(const [i,a] of corners.entries()){
    const b=corners[(i+1)%4],c=recess[i],d=recess[(i+1)%4];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
    const shop=i===1||i===2?cornerShop(batch,a,b,i===1):undefined;
    const cols=i%2?8:4;
    for(let n=0;n<cols;n++){
      const f=(n+.28)/cols,px=a[0]+(b[0]-a[0])*f,pz=a[1]+(b[1]-a[1])*f;
      if(shop&&f*len>shop.start&&f*len<shop.end)continue;
      const cx=c[0]+(d[0]-c[0])*f,cz=c[1]+(d[1]-c[1])*f;
      const centerX=px*.67+cx*.33,centerZ=pz*.67+cz*.33;
      const footprint:Point[]=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>
        [centerX+.04*(u*ux-v*uz),centerZ+.04*(u*uz+v*ux)]);
      prism(batch,footprint,.025,lobby,brick,brick);
    }
    const frame=(t:number,y:number,offset=.002):FacadePoint=>[c[0]+(d[0]-c[0])*t+offset*uz,y,c[1]+(d[1]-c[1])*t-offset*ux];
    for(let k=1;k<cols*3;k++){
      const t=k/(cols*3),w=.002/len;
      batch.quad(frame(t-w,.03),frame(t-w,lobby),frame(t+w,lobby),frame(t+w,.03),seal);
    }
    batch.quad(frame(0,.202),frame(0,.209),frame(1,.209),frame(1,.202),seal);
    if(i===1){
      // Spear lobby renovation by Brereton, photographed by Cesar Rubio.
      // https://www.brereton.com/201-spear
      const leaf=.056/len;
      const door=(l:number,r:number,low:number,high:number,tint:string)=>
        batch.quad(frame(l,low,.003),frame(l,high,.003),frame(r,high,.003),frame(r,low,.003),tint);
      for(const side of [-1,1]){
        const mid=.5+side*leaf*.51;
        door(mid-leaf*.47,mid+leaf*.47,.038,.155,'#65736f');
        door(mid-leaf*.47,mid+leaf*.47,.155,.163,'#ada694');
        door(mid-leaf*.47,mid+leaf*.47,.027,.038,'#8d8a7a');
        // Pull bars mounted on the interior glass side of each leaf.
        const p=frame(mid-side*.013/len,.096);
        const rect:Point[]=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>
          [p[0]+u*.0018*ux+(v*.002+.004)*uz,p[2]+u*.0018*uz-(v*.002+.004)*ux]);
        // Each face is under the simplifying tolerance used for building plans.
        const [a,b,c,d]=rect;
        for(const [q,r] of [[a,b],[b,c],[c,d],[d,a]])
          batch.quad([q[0],.070,q[1]],[q[0],.102,q[1]],[r[0],.102,r[1]],[r[0],.070,r[1]],'#bfb7a2');
      }
    }
  }
}

function roofPlant(batch:FacadePanels){
  // Rectified aerial shows a chamfered service enclosure, including two
  // framed gray roof panels at opposite ends. Their glazing is unconfirmed.
  const ox=-27.47,oz=-10.74,ux=.992,uz=-.126;
  const point=(x:number,z:number):Point=>[ox+x*ux-z*uz,oz+x*uz+z*ux];
  const poly:Point[]=[[-.92,-.20],[-.83,-.31],[.79,-.31],[.91,-.21],[.91,.17],[.79,.29],[-.80,.29],[-.92,.18]];
  prism(batch,poly.map(([x,z])=>point(x,z)),mainDeck,4.69,'#998c7e','#aea99a');
  const rect=(x:number,z:number,w:number,d:number):Point[]=>
    [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>point(x+a*w/2,z+b*d/2));
  for(const [center,count] of [[-.68,1],[.69,2]]){
    prism(batch,rect(center,0,.235,.34),4.69,4.728,'#7a786d','#686e69');
    for(let i=0;i<count;i++)for(let j=0;j<3;j++){
      const yy=-.15+(i+.5)*.30/count;
      cap(batch,rect(center-.102+(j+.5)*.204/3,yy,.062,.30/count-.012),4.731,'#98a4a0');
    }
  }
  for(const [x,z,w,d,h] of [[-.29,.12,.10,.09,.052],[.30,-.12,.19,.115,.047],[.14,.11,.11,.065,.064],[-.18,-.14,.19,.09,.07]])
    prism(batch,rect(x,z,w,d),4.69,4.69+h,'#9b978a','#bdb8aa');
}

export function add201Spear(b:Building,root:THREE.Group,windows:Pane[]){
  if(b.id!==base&&b.id!==wing&&b.id!==tower)return false;
  const podium=b.id===base,high=b.id===tower,ps=ring(b.p),batch=new FacadePanels();
  const deck=podium?lowerDeck:high?mainDeck:upperDeck,rim=podium?lowerRim:high?mainRim:upperRim;
  const bottom=podium?lobby:lowerDeck,floors=podium?4:high?13:12;
  const pitch=(deck-bottom)/floors;
  if(podium){arcade(batch,b);cap(batch,ps,lobby,'#92705d',true);}
  const upper=family.filter(p=>p.id!==base&&p.id!==b.id);
  for(const [i,a] of ps.entries()){
    const c=ps[(i+1)%ps.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
    const nx=dz/len,nz=-dx/len;
    const at=(s:number,y:number,d=0):FacadePoint=>[a[0]+dx*s/len+nx*d,y,a[1]+dz*s/len+nz*d];
    const face=(l:number,r:number,lo:number,hi:number,d:number,color:string)=>
      batch.quad(at(l,lo,d),at(l,hi,d),at(r,hi,d),at(r,lo,d),color);
    const [mx,,mz]=at(len/2,0,.014),[ix,,iz]=at(len/2,0,-.014);
    const abuts=upper.some(p=>inside(mx,mz,p.p));
    if(!podium&&!high&&abuts)continue;
    const startsAt=high&&abuts?upperDeck:bottom;
    if(len<.115){
      face(0,len,startsAt,deck,0,returnBrick);
    }else{
      const jamb=.012,back=-.010;
      face(0,jamb,startsAt,deck,0,brick);face(len-jamb,len,startsAt,deck,0,brick);
      for(let row=0;row<floors;row++){
        const y=bottom+row*pitch,end=y+pitch;
        if(end<=startsAt)continue;
        const lo=Math.max(startsAt,y),sill=Math.max(lo,y+pitch*.13),head=end-pitch*.15;
        if(head<=lo){face(jamb,len-jamb,lo,end,0,brick);continue;}
        if(sill>lo)face(jamb,len-jamb,lo,sill,0,brick);
        face(jamb,len-jamb,head,end,0,brick);
        batch.quad(at(jamb,sill),at(jamb,head),at(jamb,head,back),at(jamb,sill,back),reveal);
        batch.quad(at(len-jamb,sill,back),at(len-jamb,head,back),at(len-jamb,head),at(len-jamb,sill),reveal);
        batch.quad(at(jamb,sill,back),at(len-jamb,sill,back),at(len-jamb,sill),at(jamb,sill),brick);
        batch.quad(at(jamb,head),at(len-jamb,head),at(len-jamb,head,back),at(jamb,head,back),reveal);
        face(jamb,len-jamb,sill,head,back,glass[(row+i)%glass.length]);
        if((i+3*row)%8===0){
          const [x,wy,z]=at(len/2,(sill+head)/2,back+.002);
          windows.push({x,y:wy,z,ry:Math.atan2(nx,nz),w:(len-2*jamb)*.93,h:(head-sill)*.93});
        }
      }
    }
    if(podium&&upper.some(p=>inside(ix,iz,p.p)))continue;
    face(0,len,deck,rim,0,brick);
    if(!high&&len>.115){
      const bed=(s:number,d:number):Point=>{const [x,,z]=at(s,deck,d);return [x,z];};
      const footprint=[bed(.010,-.024),bed(len-.014,-.024),bed(len-.030,-.057),bed(.023,-.055)];
      // Green strips inside the two south terrace parapets in the aerial and
      // the penthouse architect's photos. Preserve the clear paved center.
      prism(batch,footprint,deck,deck+.020,'#958671',i%3?'#87906c':'#979574');
    }
    // Narrow coping and inside face keep the outdoor terraces visibly open.
    batch.quad(at(0,rim,-.019),at(len,rim,-.019),at(len,rim),at(0,rim),'#bd9279');
    batch.quad(at(len,deck,-.019),at(len,rim,-.019),at(0,rim,-.019),at(0,deck,-.019),returnBrick);
  }
  cap(batch,ps,deck,high?'#c5bdad':'#c4baaa');
  if(high)roofPlant(batch);
  const mesh=batch.mesh(paint);mesh.name='201 Spear '+(podium?'arcade and south terrace':high?'brick tower':'upper south terrace');
  root.add(mesh);return true;
}
