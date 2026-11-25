import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Plan=readonly [number,number];

// SF Building Footprints, polygon 201006.0001520. The survey clips all four corners.
const outline:Plan[]=[
  [-25.85557,-18.35334],[-25.82810,-18.40610],[-23.47223,-18.75273],[-23.41582,-18.71281],
  [-23.05365,-16.37580],[-23.09730,-16.31536],[-25.45473,-15.96762],[-25.50377,-16.01041],
];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.63});
const brick='#975e52',reveal='#794b43',sand='#c6b9a5',glass='#404953',metal='#5a5c5a';
const parapet=49.66*.06,deck=49.0*.06,groundHead=.265;

// 2007 SF Planning DPR 3717/020 and Coolcaesar's 2017 Main Street elevation.
export function add180Howard(b:{id:number},root:THREE.Group,windows:Window[]){
  if(b.id!==192026934)return false;
  const panels=new FacadePanels();
  function cap(ring:Plan[],y:number,color:string){
    for(let i=1;i<ring.length-1;i++)
      panels.triangle([ring[0][0],y,ring[0][1]],[ring[i+1][0],y,ring[i+1][1]],[ring[i][0],y,ring[i][1]],color);
  }
  outline.forEach(([x,z],edge)=>{
    const [x2,z2]=outline[(edge+1)%outline.length],len=Math.hypot(x2-x,z2-z);
    const tx=(x2-x)/len,tz=(z2-z)/len;
    const pt=(s:number,y:number,d:number):FacadePoint=>[x+tx*s+tz*d,y,z+tz*s-tx*d];
    const face=(s:number,t:number,lo:number,hi:number,d:number,color:string)=>
      panels.quad(pt(s,lo,d),pt(s,hi,d),pt(t,hi,d),pt(t,lo,d),color);
    if(edge%2===0){face(0,len,0,parapet,0,brick);return;}
    const pitch=len/8,jamb=.024,top=parapet-.064,rise=(top-groundHead)/12;
    face(0,len,top,parapet,0,sand);
    for(let bay=0;bay<8;bay++){
      const start=pitch*bay,end=pitch*(bay+1),l=start+jamb,r=end-jamb;
      face(start,l,0,top,0,brick);face(r,end,0,top,0,brick);
      const recessed=-.046;
      for(const [s,sign] of [[l,1],[r,-1]]){
        const a=pt(s,0,0),c=pt(s,groundHead,recessed);
        if(sign===1)panels.quad(a,pt(s,groundHead,0),c,pt(s,0,recessed),reveal);
        else panels.quad(pt(s,0,recessed),c,pt(s,groundHead,0),a,reveal);
      }
      panels.quad(pt(l,groundHead,0),pt(l,groundHead,recessed),pt(r,groundHead,recessed),pt(r,groundHead,0),sand);
      face(l,r,0,groundHead,recessed,edge===1||edge===7?'#465450':glass);
      face(l,r,.171,.178,recessed+.0015,metal);
      for(let n=1;n<3;n++){
        const s=l+(r-l)*n/3;face(s-.002,s+.002,0,groundHead,recessed+.0015,metal);
      }
      for(let floor=0;floor<12;floor++){
        const lo=groundHead+floor*rise,sill=lo+rise*.30,hi=lo+rise;
        face(l,r,lo,sill,-.002,sand);
        face(l,r,sill,hi,-.006,glass);
        for(let pane=0;pane<3;pane++){
          const w=(r-l)/3,startPane=l+pane*w;
          if(pane)face(startPane-.0016,startPane+.0016,sill,hi,-.003,metal);
          if((bay*17+floor*7+pane*3+edge)%13===0){
            const [wx,wy,wz]=pt(startPane+w/2,(sill+hi)/2,-.0045);
            windows.push({x:wx,y:wy,z:wz,ry:Math.atan2(tz,-tx),w:w-.007,h:hi-sill-.006});
          }
        }
      }
    }
  });
  const cx=outline.reduce((sum,p)=>sum+p[0],0)/outline.length;
  const cz=outline.reduce((sum,p)=>sum+p[1],0)/outline.length;
  const inner:Plan[]=outline.map(([x,z])=>[cx+(x-cx)*.985,cz+(z-cz)*.985]);
  const level=(p:Plan,y:number):FacadePoint=>[p[0],y,p[1]];
  outline.forEach((p,i)=>{
    const j=(i+1)%outline.length;
    panels.quad(level(p,parapet),level(inner[i],parapet),level(inner[j],parapet),level(outline[j],parapet),sand);
    panels.quad(level(inner[j],deck),level(inner[j],parapet),level(inner[i],parapet),level(inner[i],deck),reveal);
  });
  cap(inner,deck,'#b4b7b3');
  // Central roof plant, around 53.9 m above grade in the 2023 LiDAR.
  const plant:Plan[]=[[-24.97779,-18.18763],[-23.96951,-18.34192],[-23.75415,-16.93544],[-24.76244,-16.78114]];
  plant.forEach(([x,z],i)=>{
    const [xx,zz]=plant[(i+1)%4];
    panels.quad([x,deck,z],[x,3.234,z],[xx,3.234,zz],[xx,deck,zz],'#aaa9a0');
  });
  cap(plant,3.234,'#b5b5ac');
  const model=panels.mesh(material);model.name='180 Howard Street';root.add(model);return true;
}
