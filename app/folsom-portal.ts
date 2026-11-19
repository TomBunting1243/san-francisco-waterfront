import * as THREE from 'three';
import data from '../public/data/folsom-portal.json' with {type:'json'};
import {streetcarTrack} from './streets.ts';
import {setPackedNormals} from './packed-normals.ts';

type Point=[number,number,number];
type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
export const folsomPavement=data.pavement as Record<string,Record<string,number[][][][]>>;
// SFMTA identifies this Howard–Folsom portal at https://www.sfmta.com/media/43628/download?inline=
// Two outside surface tracks continue toward the Ferry Building. Two Metro tracks
// diverge at the southern switch and descend inside the walls on OSM ways
// 160312617 and 240059480. City p2024_rgb8cm shows the concrete throat and cap.
// USGS 2023 3DEP track-bed returns in metres NAVD88, tied to the local running rail.
const grades=[[-33.68,3.40],[-32.86,3.21],[-32.03,2.79],[-31.3,2.21],[-30.6,1.50],
  [-29.9,.67],[-29.1,-.23],[-28.2,-1.11],[-27.04,-2.48],[-26.72,-2.82]];
function railY(x:number){
  const i=grades.findIndex(p=>p[0]>=x);
  if(i===0)return streetcarTrack.railTop;
  const [a,h]=grades[i<0?grades.length-2:i-1],[b,k]=grades[i<0?grades.length-1:i];
  return streetcarTrack.railTop+.06*(h+(k-h)*(x-a)/(b-a)-3.40);
}
export function addFolsomPortal(mesh:Surface){
  const pts:number[]=[],colors:number[]=[],indices:number[]=[],ink=new THREE.Color();
  function quad(a:Point,b:Point,c:Point,d:Point,color:string){
    const i=pts.length/3;ink.set(color);
    for(const p of [a,b,c,d]){pts.push(...p);colors.push(ink.r,ink.g,ink.b);}
    indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  function slice(pair:number[][]){
    const [a,b]=pair,dx=a[0]-b[0],dz=a[1]-b[1],w=Math.hypot(dx,dz);
    const y=railY((a[0]+b[0])/2);
    return {w,y,point:(n:number,h:number):Point=>[b[0]+n*dx/w,h,b[1]+n*dz/w]};
  }
  const halfGauge=(streetcarTrack.gauge+streetcarTrack.railHead)/2;
  for(const [section,pairs] of data.sections.entries()){
    for(let i=1;i<pairs.length;i++){
      const a=slice(pairs[i-1]),b=slice(pairs[i]);
      const strip=(u:number,v:number,aH:number,bH:number,color:string,fromNorth=false)=>{
        const a0=fromNorth?a.w:0,b0=fromNorth?b.w:0;
        quad(a.point(a0+u,aH),a.point(a0+v,aH),b.point(b0+v,bH),b.point(b0+u,bH),color);
      };
      if(section>0){
        quad(a.point(-.184,a.y-.008),a.point(a.w+.184,a.y-.008),b.point(b.w+.184,b.y-.008),b.point(-.184,b.y-.008),'#797974');
        for(const edge of [0,1]){
          const sign=edge?1:-1,aa=edge?a.w:0,bb=edge?b.w:0;
          const I=aa+sign*.154,J=bb+sign*.154,O=aa+sign*.185,P=bb+sign*.185;
          if(edge)quad(a.point(I,a.y-.009),a.point(I,.093),b.point(J,.093),b.point(J,b.y-.009),'#8b8982');
          else quad(b.point(J,b.y-.009),b.point(J,.093),a.point(I,.093),a.point(I,a.y-.009),'#a5a297');
          strip(edge?.154:-.185,edge?.185:-.154,.093,.093,'#bcb7a5',!!edge);
          if(edge)quad(b.point(P,.044),b.point(P,.093),a.point(O,.093),a.point(O,.044),'#a8a393');
          else quad(a.point(O,.044),a.point(O,.093),b.point(P,.093),b.point(P,.044),'#a8a393');
        }
      }
      for(const north of [false,true]){
        for(const off of [-halfGauge,halfGauge]){
          const hw=streetcarTrack.railHead/2;
          strip(off-hw,off+hw,a.y,b.y,'#abb2ae',north);
        }
        // The outer surface wires continue past the switch; these two follow the incline.
        const wire=.0013,head=(rail:number)=>rail+THREE.MathUtils.lerp(.264,streetcarTrack.wireRise,
          THREE.MathUtils.smoothstep(rail,-.285,.056));
        const h=head(a.y),k=head(b.y),p=north?a.w:0,q=north?b.w:0;
        strip(-wire,wire,h,k,'#495953',north);
        quad(a.point(p+wire,h),a.point(p,h-.002),b.point(q,k-.002),b.point(q+wire,k),'#495953');
        quad(a.point(p,h-.002),a.point(p-wire,h),b.point(q-wire,k),b.point(q,k-.002),'#495953');
      }
      if(section===2){
        const left=-.184;
        quad(a.point(left,.095),a.point(a.w+.184,.095),b.point(b.w+.184,.095),b.point(left,.095),'#b6b0a1');
        quad(b.point(left,.012),b.point(b.w+.184,.012),a.point(a.w+.184,.012),a.point(left,.012),'#696b65');
        quad(a.point(left,.012),a.point(a.w+.184,.012),a.point(a.w+.184,.095),a.point(left,.095),'#a19e93');
        quad(b.point(left,b.y-.008),b.point(b.w+.184,b.y-.008),b.point(b.w+.184,.012),b.point(left,.012),'#3f4847');
      }
    }
  }
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pts,3))
    .setAttribute('color',new THREE.Float32BufferAttribute(colors,3)).setIndex(indices);
  setPackedNormals(g);g.userData.paintVertices=true;
  mesh(g,'#ffffff',0,0,0).name='Folsom Portal ramp and tracks';
}
