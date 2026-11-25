import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan=[number,number];
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type Wall=(s:number,h:number,out?:number)=>FacadePoint;
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.69,metalness:.06});
const stone='#c4c2b4',edge='#d1cfc3',metal='#929e9b',steel='#788984';
const dark='#405b62',glass='#60848a',roof='#b5b6ad',grade=.045;
const pitch=6.10,arcade=7*pitch;
// Local metres from the Fremont/Howard street-wall intersection. The 2023
// returns put the Fremont wall at plate x 205–208, Howard at y 311. The
// city roof outline includes overhangs and cannot serve as the shopfront.
function point(s:number,t:number,h:number):FacadePoint{
  const x=206+7*t,y=311+7*s;
  return [-27.00800104+.0012973094*x-.0084729829*y,grade+h*.06,-33.37263659+.0084728164*x+.0012965840*y];
}
function wall(s:number,t:number,ds:number,dt:number):Wall{
  return (x,h,d=0)=>point(s+ds*x+dt*d,t+dt*x-ds*d,h);
}
function panel(f:FacadePanels,w:Wall,l:number,r:number,b:number,h:number,c:string,d=0){
  f.quad(w(l,b,d),w(r,b,d),w(r,h,d),w(l,h,d),c);
}
function lid(f:FacadePanels,ring:Plan[],h:number,c:string){
  const tris=THREE.ShapeUtils.triangulateShape(ring.map(([s,t])=>new THREE.Vector2(s,t)),[]);
  for(const [a,b,d] of tris)f.triangle(point(...ring[a],h),point(...ring[b],h),point(...ring[d],h),c);
}
function sides(f:FacadePanels,ring:Plan[],lo:number,hi:number,tint:string,skipStreet=false){
  ring.forEach(([s,t],i)=>{
    const [x,z]=ring[(i+1)%ring.length],ds=x-s,dt=z-t,len=Math.hypot(ds,dt);
    if(skipStreet&&((t===0&&z===0)||(s===0&&x===0)))return;
    panel(f,wall(s,t,ds/len,dt/len),0,len,lo,hi,tint);
  });
}
function box(f:FacadePanels,s:number,t:number,x:number,z:number,lo:number,hi:number,c:string){
  const ring:Plan[]=[[s,t],[x,t],[x,z],[s,z]];
  sides(f,ring,lo,hi,c);lid(f,ring,hi,c);
}
function pane(w:Wall,l:number,r:number,b:number,h:number,d:number,out:Pane[]){
  const [x,y,z]=w((l+r)/2,(b+h)/2,d+.018),a=w(0,0),n=w(0,0,1);
  out.push({x,y,z,w:(r-l)*.06,h:(h-b)*.06,ry:Math.atan2(n[0]-a[0],n[2]-a[2])});
}
function diagonal(f:FacadePanels,w:Wall,x:number,y:number,toX:number,toY:number,d:number){
  const dx=toX-x,dy=toY-y,half=.095/Math.hypot(dx,dy),nx=-dy*half,ny=dx*half;
  f.quad(w(x-nx,y-ny,d),w(toX-nx,toY-ny,d),w(toX+nx,toY+ny,d),w(x+nx,y+ny,d),steel);
}
function offices(f:FacadePanels,w:Wall,width:number,bays:number,step:number,curtain:(i:number)=>boolean,panes:Pane[]){
  for(let i=0;i<bays;i++){
    const a=i*step,b=i===bays-1?width:(i+1)*step,glazed=curtain(i),inset=glazed?-.12:-.22;
    const left=a+(glazed?.05:.46),right=b-(glazed?.05:.46);
    panel(f,w,a,left,4.70,29.18,glazed?metal:stone);
    panel(f,w,right,b,4.70,29.18,glazed?metal:stone);
    for(let j=0;j<6;j++){
      const bottom=4.70+j*4.08,top=bottom+4.08;
      const sill=bottom+(glazed?.44:.76),head=top-(glazed?.12:.70);
      panel(f,w,left,right,bottom,sill,glazed?'#9daaaa':stone);
      panel(f,w,left,right,head,top,glazed?metal:stone);
      const count=glazed?3:2,cell=(right-left)/count;
      for(let k=0;k<count;k++){
        const l=left+k*cell,r=l+cell-.075;
        panel(f,w,l,r,sill,head,glazed?glass:dark,inset);
        panel(f,w,r,l+cell,sill,head,metal,inset+.04);
        if((i*3+j*5)%11===1)pane(w,l,r,sill,head,inset,panes);
      }
      if(glazed){
        const mid=sill+(head-sill)*.70;
        panel(f,w,left,right,mid,mid+.065,metal,inset+.04);
        if((i+j)%3===0)diagonal(f,w,left,sill+.08,right,head-.08,inset+.026);
        if((i+j)%3===1)diagonal(f,w,left,head-.08,right,sill+.08,inset+.026);
      }
    }
  }
}
function frontage(f:FacadePanels,w:Wall,width:number,bays:number,isFremont:boolean,windows:Pane[]){
  const step=isFremont?pitch:width/bays;
  for(let i=0;i<bays;i++){
    const a=i*step,b=i===bays-1?width:(i+1)*step;
    const inArcade=isFremont&&i<7,cornerReturn=!isFremont&&i===bays-1;
    const recess=inArcade?2.70:.25;
    // The northeast end of the Howard facade meets the corner arcade; the
    // last part of its street wall is open below the upper office plate.
    const r=cornerReturn?b-2.70:b;
    if(r<=a)continue;
    const cell=(r-a)/3;
    for(let k=0;k<3;k++){
      const l=a+k*cell,t=l+cell,door=inArcade&&i===5&&k===1;
      panel(f,w,l,t,0,door?.08:.44,'#838c87',-recess);
      panel(f,w,l,l+.09,door?.08:.44,4.12,metal,-recess);
      panel(f,w,l+.09,t,door?.08:.44,3.36,dark,-recess);
      panel(f,w,l+.09,t,3.36,3.44,metal,-recess);
      panel(f,w,l+.09,t,3.44,4.12,glass,-recess);
      if(inArcade&&(i===0||i===3||i===5)&&k!==2)pane(w,l+.10,t,door?.09:.45,3.35,-recess,windows);
    }
    // The soffit faces down. Its own private floor meets the municipal
    // sidewalk on the surveyed outer column plane.
    f.quad(w(a,4.12,-recess),w(r,4.12,-recess),w(r,4.12),w(a,4.12),'#abaea3');
    if(isFremont||!cornerReturn)
      f.quad(w(a,0),w(r,0),w(r,0,-recess),w(a,0,-recess),'#bcb9a9');
    panel(f,w,a,b,4.12,4.70,edge);
  }
}
const lower:Plan[]=[[0,0],[68.5,0],[68.5,82.6],[41.4,82.6],[41.4,54.8],[38.8,54.8],[38.8,49.8],[35.2,49.8],[35.2,46.2],[31.3,46.2],[31.3,41.1],[0,41.1]];
// LiDAR resolves a 29 m terrace below the eighth floor and a taller rear
// service block. The oblique northern terrace edge is visible in the ortho.
const top:Plan[]=[[2.9,2.7],[66.2,2.7],[66.2,66.8],[60.5,66.8],[46.2,52.9],[43.7,44.1],[34.1,40.0],[16.4,40.0],[6.0,16.4],[2.9,7.8]];
export function add215Fremont(building:{id:number},root:THREE.Group,windows:Pane[]){
  if(building.id!==192883909)return false;
  const f=new FacadePanels(),fremont=wall(0,0,1,0),howard=wall(0,41.1,0,-1);
  sides(f,lower,0,29.18,'#aead9f',true);lid(f,lower,29.18,roof);
  frontage(f,fremont,68.5,11,true,windows);frontage(f,howard,41.1,7,false,windows);
  // Eleven structural bays span the Fremont wall; the first seven are the
  // open retail arcade. Use the actual arcade pitch on both levels.
  for(let i=0;i<=7;i++){
    const s=i*pitch,half=.30;
    box(f,Math.max(0,s-half),.03,s+half,.70,0,4.12,'#acafa7');
  }
  // Closed side of the arcade where the southern flush frontage begins.
  panel(f,wall(arcade,2.7,0,-1),0,2.7,0,4.12,stone);
  offices(f,fremont,68.5,11,pitch,i=>i<7,windows);
  offices(f,howard,41.1,7,41.1/7,i=>i===6,windows);
  sides(f,top,29.18,33.78,'#879b9c');lid(f,top,33.78,roof);
  for(let s=pitch;s<65;s+=pitch)panel(f,wall(2.9,2.7,1,0),s-2.9,s-2.76,29.18,33.78,metal,.018);
  box(f,31.6,23.3,53.6,40.0,33.78,37.70,'#929690');
  const mesh=f.mesh(material);mesh.name='215 Fremont Street / recessed retail arcade';root.add(mesh);
  return true;
}
