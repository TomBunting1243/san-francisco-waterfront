import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const scale=.06,grade=.045,c=Math.cos(-.148),s=Math.sin(-.148);
const ox=-7.131,oz=-30.936;
const at=([u,v]:Point,h:number):FacadePoint=>[ox+scale*(c*u-s*v),grade+scale*h,oz+scale*(s*u+c*v)];
const plan=([x,z]:number[]):Point=>[((x-ox)*c+(z-oz)*s)/scale,((z-oz)*c-(x-ox)*s)/scale];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77});
const solar=['#575855','#626363','#686663','#53575a','#716e67','#596063'];
const officeTop=135.6,roof=135.9,parapet=137.1,lobby=6.7;
const rect=(u:number,v:number,w:number,d:number):Point[]=>[[u,v],[u+w,v],[u+w,v+d],[u,v+d]];

/** 333 Market, parcel 3710/020. The OSM boundary actually traces the noses
 * of Gin Wong's diamond columns. Preserve those facets from plaza to roof. */
export function add333Market(b:{id:number;p:number[][]},root:THREE.Group,windows:Pane[]){
  if(b.id!==288505729)return false;
  const f=new FacadePanels(),ring=b.p.slice(0,-1).map(plan);
  // Remove survey vertices splitting a straight glazing edge, preserving each precast facet.
  const edges=ring.filter((b,i)=>{
    const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length];
    const ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-b[0],vy=c[1]-b[1];
    return Math.abs(ux*vy-uy*vx)>.045*Math.hypot(ux,uy)*Math.hypot(vx,vy);
  });
  function wall(a:Point,b:Point,lo:number,hi:number,tint:string){
    f.quad(at(a,lo),at(a,hi),at(b,hi),at(b,lo),tint);
  }
  function cap(p:Point[],height:number,tint:string){
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(p.map(([x,y])=>new THREE.Vector2(x,y)),[]))
      f.triangle(at(p[i],height),at(p[k],height),at(p[j],height),tint);
  }
  function box(u:number,v:number,w:number,d:number,lo:number,hi:number,body:string,top:string){
    const p=rect(u,v,w,d);p.forEach((a,i)=>wall(a,p[(i+1)%4],lo,hi,body));cap(p,hi,top);
  }
  cap(edges,roof,'#a6a499');
  const glassEdges:number[]=[];
  for(let i=0;i<edges.length;i++){
    const a=edges[i],b=edges[(i+1)%edges.length],du=b[0]-a[0],dv=b[1]-a[1];
    if(Math.max(Math.abs(du),Math.abs(dv))>2.3)glassEdges.push(i);
    else wall(a,b,0,parapet,du+dv>0?'#ddd8ca':'#c9c6bb');
  }
  for(const [bay,i] of glassEdges.entries()){
    const a=edges[i],b=edges[(i+1)%edges.length],du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv);
    const spot=(fraction:number,depth:number):Point=>[a[0]+fraction*du+depth*dv/len,a[1]+fraction*dv-depth*du/len];
    const face=(l:number,r:number,lo:number,hi:number,d:number,color:string)=>wall(spot(l,d),spot(r,d),lo,hi,color);
    const depth=-.14;
    const next=glassEdges[(bay+1)%glassEdges.length],nextA=edges[next],nextB=edges[(next+1)%edges.length];
    const nx=nextB[0]-nextA[0],nz=nextB[1]-nextA[1],nl=Math.hypot(nx,nz);
    const pierTop:Point[]=[];
    for(let t=(i+1)%edges.length;t!==next;t=(t+1)%edges.length)pierTop.push(edges[t]);
    pierTop.push(nextA,[nextA[0]-.43*nz/nl,nextA[1]+.43*nx/nl],spot(1,-.43));
    cap(pierTop,parapet,'#d8d4c7');
    // Continuous deep flank returns keep the columns solid next to the recessed lobby.
    for(const [lo,hi,d] of [[0,lobby,-1.34],[lobby,parapet,depth]]){
      wall(spot(0,0),spot(0,d),lo,hi,'#c4beae');wall(spot(1,d),spot(1,0),lo,hi,'#d3cfc1');
    }
    face(0,1,officeTop,parapet,depth,'#aaa69a');
    const pitch=(officeTop-lobby)/32;
    // Share the solar-bronze backing for three office levels. The opaque
    // spandrel and metal trim in front still articulate every floor.
    for(let band=0;band<11;band++){
      face(0,1,lobby+3*band*pitch,Math.min(officeTop,lobby+(3*band+3)*pitch),depth,
        solar[(band*3+bay*7+Math.floor(bay/3))%6]);
    }
    for(let row=0;row<32;row++){
      const lo=lobby+pitch*row,hi=lo+pitch,head=hi-.13,sill=lo+.84;
      face(0,1,lo,sill,depth+.009,'#555048');
      face(0,1,head,hi,depth+.012,'#8c8880');
      if((bay*5+row*7)%23===0){
        const [x,y,z]=at(spot(.25,depth+.028),(head+sill)/2);
        const p=at(a,0),q=at(b,0);
        windows.push({x,y,z,w:len*.45*scale,h:(head-sill)*.92*scale,ry:Math.atan2(q[2]-p[2],p[0]-q[0])});
      }
    }
    face(.492,.508,lobby,officeTop,depth+.019,'#9c9890');
    // The clear glass base sits well behind the shafts. Retain deep soffits,
    // a centered group of Market doors and the warm lobby glimpsed between them.
    const entry=a[0]>18&&b[0]>18&&Math.abs((a[1]+b[1])/2)<5;
    face(0,1,.12,lobby,-1.34,entry?'#a59778':'#667273');
    face(0,1,0,.12,-1.33,'#8e8980');
    face(.492,.508,.12,lobby,-1.31,'#b6ada0');
    face(0,1,2.65,2.73,-1.31,'#a8a69c');
    if(entry){
      for(const p of [.07,.93])face(p,p+.022,.12,2.68,-1.30,'#bdb8a9');
      for(const p of [.43,.56])face(p,p+.015,.84,1.38,-1.25,'#d4cdb9');
    }
    f.quad(at(spot(0,0),lobby),at(spot(1,0),lobby),at(spot(1,-1.34),lobby),at(spot(0,-1.34),lobby),'#c9c6b9');
    // Narrow coping closes the top of the parapet; the main roof is below it.
    f.quad(at(spot(0,-.43),parapet),at(spot(1,-.43),parapet),at(spot(1,depth),parapet),at(spot(0,depth),parapet),'#c4c3b6');
    wall(spot(1,-.43),spot(0,-.43),roof,parapet,'#898980');
  }
  // 2023 raster: central mechanical enclosure around 149–150 m absolute,
  // surrounding flat slab around 139.6 m, with a roof-level shaft opening.
  box(-11.6,-12.2,22.1,14.8,roof,145.75,'#adaeaa','#bcbdb6');
  box(-11.6,2.6,11.05,8.3,roof,145.9,'#aaaca8','#b9bcb6');
  box(2.45,2.6,8.05,8.3,roof,145.9,'#b1b2ac','#bec1b9');
  box(-.55,8.6,3.0,2.3,roof,145.8,'#a6a8a5','#b8bbb5');
  box(-19.0,-4.6,2.4,9.0,roof,139.7,'#8f9693','#a5aca8');
  const object=f.mesh(material);object.name='333 Market Street diamond-column office tower';root.add(object);return true;
}
