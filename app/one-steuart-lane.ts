import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
type Rect=readonly [west:number,north:number,east:number,south:number];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.50});
const stone='#d7cbb5',cutStone='#b8ae9b',frame='#797970',ground=.045;
const scale=.06,unit=scale/7; // the Howard 2024 plate has seven pixels per metre
const point=(u:number,v:number,h:number):FacadePoint=>[
  -27.00800104+.0012973094*u-.0084729829*v,ground+h*scale,-33.37263659+.0084728164*u+.0012965840*v];
const glass=['#627c87','#708995','#849597','#60737e','#74868b'];
// 2023 LiDAR planes measured at several elevations, relative to 3.33 m street grade.
// Each band changes its actual plan. The 2010 survey instead contains the old garage.
function plan(floor:number):Rect{
  if(floor===0)return [2752,312,3086,598];
  if(floor<6)return [2763,312,3087,568];
  if(floor<10)return [2785,312,3068,568];
  if(floor<14)return [2785,312,3068,550];
  if(floor<18)return [2785,312,3060,550];
  return [2785,330,3059,549];
}
export function addOneSteuartLane(b:{id:number},root:THREE.Group,windows:Window[]){
  if(b.id!==667097308)return false;
  const shell=new FacadePanels();
  function corners([w,n,e,s]:Rect){return [[w,n],[e,n],[e,s],[w,s]];}
  function slab(r:Rect,y:number,thickness:number,top=stone,slot?:number){
    const [w,n,e,s]=r;
    let perimeter=corners(r),pieces:Rect[]=[r];
    if(slot!==undefined){
      const pitch=(s-n)/12,a=n+slot*pitch,b=a+pitch,inset=e-9.2;
      // The narrow vertical terrace seam opens through the bay-facing cornice.
      pieces=[[w,n,e,a],[w,a,inset,b],[w,b,e,s]];
      perimeter=[[w,n],[e,n],[e,a],[inset,a],[inset,b],[e,b],[e,s],[w,s]];
    }
    for(const section of pieces){
      const p=corners(section),up=p.map(([u,v])=>point(u,v,y)),down=p.map(([u,v])=>point(u,v,y-thickness));
      shell.quad(up[3],up[2],up[1],up[0],top);
      shell.quad(down[0],down[1],down[2],down[3],cutStone);
    }
    for(let i=0;i<perimeter.length;i++){
      const [u,v]=perimeter[i],[u1,v1]=perimeter[(i+1)%perimeter.length];
      shell.quad(point(u,v,y-thickness),point(u,v,y),point(u1,v1,y),point(u1,v1,y-thickness),stone);
    }
  }
  const levels=[0,...Array.from({length:21},(_,i)=>4.65+(67.25-4.65)*i/20)];
  for(let floor=0;floor<levels.length-1;floor++){
    const r=plan(floor),lo=levels[floor],hi=levels[floor+1],p=corners(r);
    const sky=[1,6,10,14,18].includes(floor);
    const thick=sky?.43:.24;
    const joint=floor<10?8:3;
    slab(r,hi,thick,stone,floor>1&&!sky?joint:undefined);
    // A setback exposes the last slab. At a terrace level its outer guard is an
    // open metal cap; the room wall and its night pane physically recede together.
    for(let face=0;face<4;face++){
      const [u,v]=p[face],[u1,v1]=p[(face+1)%4],length=Math.hypot(u1-u,v1-v);
      const tu=(u1-u)/length,tv=(v1-v)/length;
      const at=(s:number,y:number,d=0)=>point(u+s*tu+d*tv,v+s*tv-d*tu,y);
      const wall=(a:number,b:number,l:number,h:number,d:number,t:string)=>
        shell.quad(at(a,l,d),at(a,h,d),at(b,h,d),at(b,l,d),t);
      const soffit=(a:number,b:number,y:number,front:number,back:number,t:string)=>
        shell.quad(at(a,y,front),at(b,y,front),at(b,y,back),at(a,y,back),t);
      function reveals(a:number,b:number,h:number,d:number){
        shell.quad(at(a,lo),at(a,h),at(a,h,d),at(a,lo,d),cutStone);
        shell.quad(at(b,lo,d),at(b,h,d),at(b,h),at(b,lo),cutStone);
      }
      const bays=face%2===0?14:12,pitch=length/bays;
      const head=hi-thick;
      for(let k=0;k<bays;k++){
        const a=k*pitch,end=a+pitch;
        if(floor===0){
          // Actual garage is towards the inland end on Howard. The lobby fronts
          // the Steuart Lane cul-de-sac, looking toward the Embarcadero.
          const garage=face===0&&k<2,door=face===1&&(k===5||k===6);
          const back=garage?-24:door?-10:-3.5;
          const start=garage?0:door?5*pitch:a,finish=garage?2*pitch:door?7*pitch:end;
          if((garage||door)&&a!==start)continue;
          const col=3.1,l=start+col,h=finish-col;
          wall(start,l,-.75,head,0,stone);wall(h,finish,-.75,head,0,stone);
          reveals(l,h,head,back);
          wall(l,h,-.75,head,back,garage?'#373b3c':door?'#784e40':'#4e6064');
          if(!garage){
            const mid=(l+h)/2;wall(mid-.37,mid+.37,0,head,back+.21,frame);
            if(door){
              for(let j=0;j<12;j++)for(let i=0;i<6;i++){
                const s=l+(h-l)*(.12+i*.15),y=.56+j*.29;
                wall(s,s+.85,y,y+.11,back+.26,'#b1a490');
              }
              // Open overhead metal grille, with a clear view through the bars.
              for(let j=0;j<21;j++){
                const s=start+(finish-start)*j/21;
                soffit(s,s+.55,head-.10,13,back,'#726e63');
                shell.quad(at(s,head-.09,back),at(s+.55,head-.09,back),at(s+.55,head-.09,13),at(s,head-.09,13),'#817e71');
              }
              wall(start,finish,head-.18,head-.07,13,frame);
            }else{
              for(let j=1;j<=2;j++)wall(start+j*.9,start+j*.9+.27,0,head,.13,'#918980');
            }
          }
          continue;
        }
        const cove=face===1&&k===joint;
        const wrap=sky&&(face===1||face===0&&k>=bays-4||face===2&&k<4);
        const back=wrap?-14:cove?-10:-1.4;
        const pier=wrap||cove?.7:2.15;
        const l=a+pier,h=end-.5;
        wall(a,l,lo,head,back+1.15,wrap||cove?frame:stone);
        wall(l,end,lo,head,back,glass[(k*5+Math.floor(k/2)+floor*3+face)%glass.length]);
        if(wrap||cove){
          if(k===0||cove||face===0&&k===bays-4)reveals(a,end,head,back);
          wall(a,end,lo+.95,lo+1.0,-.35,'#818e8e');
          wall(a,a+.35,lo,lo+1,-.35,'#788486');
        }
        if((floor*19+k*11+face*7)%13===2){
          const [x,y,z]=at((l+h)/2,(lo+head)/2,back+.14),outer=at(0,0,1),base=at(0,0);
          windows.push({x,y,z,ry:Math.atan2(outer[0]-base[0],outer[2]-base[2]),w:(h-l)*unit,h:(head-lo)*scale-.005});
        }
      }
    }
  }
  // Inboard lift/plant enclosure. Robust central 2023 roof returns are 70.9–72.1 m.
  const plant:Rect=[2859,369,3012,510],p=corners(plant);
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    const vertex=(k:number,y:number)=>point(p[k][0],p[k][1],y);
    shell.quad(vertex(i,67.25),vertex(i,70.75),vertex(j,70.75),vertex(j,67.25),'#aaa99c');
  }
  slab(plant,70.95,.20,'#c3c0b2');
  const mesh=shell.mesh(material);mesh.name='One Steuart Lane';root.add(mesh);return true;
}
