import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74,metalness:.035});
const stone='#d0cdc2',edge='#dddace',reveal='#9d9c91',frame='#657478';
const glazing=['#4b606b','#506672','#50636a','#4d626e'];
const grade=.054;
// Plan registered to the 2024 8 cm orthophoto; heights in metres above grade.
function point(u:number,v:number,h:number):FacadePoint{
  return [-27.208+.98612*u+.16602*v,grade+h*.06,-28.544-.16602*u+.98612*v];
}
function rectangle(l:number,r:number,s:number,n:number):Point[]{return [[l,s],[r,s],[r,n],[l,n]];}
const base:Point[]=[
  [-.248,.578],[-.135,.578],[-.135,.110],[0,.110],[0,0],[1.717,0],
  [1.713,-.267],[3.171,-.267],[3.172,2.062],[2.700,2.063],[2.700,2.139],
  [.001,2.139],[.001,1.931],[-.133,1.931],[-.134,1.445],[-.247,1.445],
];
function cap(f:FacadePanels,ring:Point[],h:number,tint:string){
  const triangles=THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[]);
  for(const [a,b,c] of triangles)f.triangle(point(...ring[a],h),point(...ring[c],h),point(...ring[b],h),tint);
}
function sides(f:FacadePanels,ring:Point[],lo:number,hi:number,color:string,roof=color){
  ring.forEach(([u,v],i)=>{
    const [x,z]=ring[(i+1)%ring.length];
    f.quad(point(u,v,lo),point(u,v,hi),point(x,z,hi),point(x,z,lo),color);
  });
  cap(f,ring,hi,roof);
}
// Trim the actual stepped outline to the surveyed wing ends.
function trim(ring:Point[],end:number){
  const out:Point[]=[];
  ring.forEach((a,i)=>{
    const b=ring[(i+1)%ring.length];
    if(a[0]<=end)out.push(a);
    if((a[0]<end)!==(b[0]<end))out.push([end,a[1]+(b[1]-a[1])*(end-a[0])/(b[0]-a[0])]);
  });
  return out;
}
function facade(f:FacadePanels,ring:Point[],low:number,high:number,night:Pane[]){
  ring.forEach(([u,v],i)=>{
    const [x,z]=ring[(i+1)%ring.length],len=Math.hypot(x-u,z-v),du=(x-u)/len,dv=(z-v)/len;
    const at=(s:number,h:number,d=0)=>point(u+du*s+dv*d,v+dv*s-du*d,h);
    const face=(a:number,b:number,lo:number,hi:number,col:string,d=0)=>f.quad(at(a,lo,d),at(a,hi,d),at(b,hi,d),at(b,lo,d),col);
    if(len<.17){face(0,len,low,high,stone);return;}
    const floor=4.13,step=.188,seed=Math.round(u*11+v*17);
    // Align the stone grid across the two setbacks rather than restarting its
    // spacing at the edge of each roof. Narrow return bays have their own piers.
    const along=Math.abs(du)>Math.abs(dv),coordinate=along?u:v,dir=along?Math.sign(du):Math.sign(dv);
    const breaks=[0,len];
    for(let k=-3;k<=19;k++){
      const s=(.024+k*step-coordinate)*dir;if(s>.055&&s<len-.055)breaks.push(s);
    }
    breaks.sort((a,b)=>a-b);
    const q=at(0,0),out=at(0,0,1),ry=Math.atan2(out[0]-q[0],out[2]-q[2]);
    for(let j=1;j<breaks.length;j++){
      const a=breaks[j-1],b=breaks[j],right=b-.014,left=a+.014,w=right-left;
      // The Howard frontage is the short southwest face. Glazed entry doors
      // sit back under the three-story stone base shown by KMD.
      const entry=low===0&&u<-.235&&x<-.235&&j>=2&&j<breaks.length-1;
      const lobby=low===0;
      const jamb=(s:number,n:number)=>f.quad(at(s,low,n),at(s,high,n),at(s,high,-.017-n),at(s,low,-.017-n),reveal);
      face(a,left,low,high,stone);face(right,b,low,high,stone);
      jamb(left,0);jamb(right,-.017);
      const tint=glazing[Math.abs(seed+j)%glazing.length];
      face(left,right,lobby?9.2:low,high,tint,-.017);
      if(lobby){
        const inset=entry?-.067:-.030;
        face(left,right,0,9.2,'#516367',inset);
        f.quad(at(left,0,-.017),at(left,9.2,-.017),at(left,9.2,inset),at(left,0,inset),reveal);
        f.quad(at(right,0,inset),at(right,9.2,inset),at(right,9.2,-.017),at(right,0,-.017),reveal);
        f.quad(at(left,9.2,inset),at(right,9.2,inset),at(right,9.2,-.017),at(left,9.2,-.017),stone);
        face(left,right,entry?2.55:3.35,entry?2.74:3.51,frame,inset+.0014);
        face((left+right)/2-.003,(left+right)/2+.003,0,9.2,frame,inset+.0014);
      }
      const shaftStart=Math.max(low,9.2);
      face(left+w*.5-.0027,left+w*.5+.0027,shaftStart,high,frame,-.0154);
      for(let row=0;9.2+row*floor<high;row++){
        const y=9.2+row*floor;
        if(y<low)continue;
        if((row*5+j*3+Math.abs(seed))%8||y+3.1>=high)continue;
        const [x,yw,z]=at(left+w*.26,y+2.52,-.0155);
        night.push({x,y:yw,z,ry,w:w*.42,h:floor*.06*.46});
      }
    }
    // One ribbon per transom crosses the row behind the projecting piers.
    for(let row=0;9.2+row*floor<high;row++){
      const y=9.2+row*floor;
      if(y>=low)face(0,len,y,Math.min(high,y+(row%2?.18:.91)),row%2?frame:stone,row%2?-.0147:-.003);
    }
    face(0,len,high-.55,high,edge);
  });
}

export function add199Fremont(b:{id:number},root:THREE.Group,windows:Pane[]){
  if(b.id!==192883913)return false;
  const f=new FacadePanels(),mid=trim(base,2.645),high=trim(base,1.855);
  facade(f,base,0,32.6,windows);cap(f,base,32.6,'#949794');
  facade(f,mid,32.6,66.9,windows);cap(f,mid,66.9,'#b2b3ab');
  facade(f,high,66.9,94.2,windows);cap(f,high,94.2,'#8d9897');
  // The aerial resolves the finned shoulders and the open mechanical well
  // between tall end screens. The central shaft does not have a flat 111 m lid.
  const shoulder=rectangle(.032,1.646,-.102,2.11);
  facade(f,shoulder,94.2,98.1,windows);cap(f,shoulder,98.1,'#b1b1a8');
  for(const v of [-.08,.29,.67,1.05,1.43,1.81,2.05]){
    sides(f,rectangle(-.229,.115,v,v+.034),94.2,99.8,stone,edge);
    sides(f,rectangle(1.54,1.84,v,v+.034),94.2,99.8,stone,edge);
  }
  for(const [a,b] of [[.112,.359],[1.17,1.498]]){
    sides(f,rectangle(a,b,.16,1.735),98.1,106.25,'#a4aaa4','#929b99');
    for(let k=0;k<12;k++){
      const h=98.60+k*.61;
      f.quad(point(a,.159,h),point(a,.159,h+.19),point(b,.159,h+.19),point(b,.159,h),'#707d7d');
      f.quad(point(b,1.736,h),point(b,1.736,h+.19),point(a,1.736,h+.19),point(a,1.736,h),'#707d7d');
    }
  }
  const well=rectangle(.36,1.165,-.145,2.111);
  facade(f,well,98.1,106.3,windows);cap(f,well,106.3,'#808b89');
  for(const [s,n] of [[-.145,.208],[1.732,2.111]]){
    sides(f,rectangle(.36,1.165,s,n),106.3,110.95,stone,'#babcb3');
    for(const end of [s,n])for(let j=0;j<4;j++){
      const a=.62+j*.065,b=a+.032,z=end+(end===s?-.001:.001);
      if(end===s)f.quad(point(a,z,106.3),point(a,z,110.8),point(b,z,110.8),point(b,z,106.3),'#828d88');
      else f.quad(point(b,z,106.3),point(b,z,110.8),point(a,z,110.8),point(a,z,106.3),'#828d88');
    }
  }
  for(const a of [.36,1.137])sides(f,rectangle(a,a+.028,.208,1.732),106.3,110.8,stone,edge);
  for(const v of [.34,1.365])sides(f,rectangle(.54,1.013,v,v+.221),106.3,107.9,'#7a8683','#646f70');
  sides(f,rectangle(1.99,2.44,.722,1.241),66.9,70.6,'#c0c3b9','#d0d0c6');
  const mesh=f.mesh(material);mesh.name='199 Fremont Street / 300 Howard';root.add(mesh);
  return true;
}
