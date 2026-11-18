import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};
const bronze='#736963', fins='#a29990', dark='#4b4543', precast='#dfdcd2';
const glass=['#55575c','#595a5d','#56595d','#5e5c5d','#5b5b5f'];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.57});
const soffit=.295, fascia=.355, rim=4.448, deck=4.35, penthouse=4.681;

// Main runs from the southwest corner toward Howard. The old Folger works adjoin
// the opposite elevation. The owner and the 2007 DPR depict the built condition.
export function add211Main(b:{id:number;p:number[][]},root:THREE.Group,windows:Window[]){
  if(b.id!==154217696)return false;
  const origin=b.p[7], north=b.p[0], rear=b.p[5];
  const W=Math.hypot(north[0]-origin[0],north[1]-origin[1]);
  const D=Math.hypot(rear[0]-origin[0],rear[1]-origin[1]);
  const ux=(north[0]-origin[0])/W,uz=(north[1]-origin[1])/W;
  const at=(u:number,y:number,v:number):FacadePoint=>[origin[0]+ux*u-uz*v,y,origin[1]+uz*u+ux*v];
  const batch=new FacadePanels();
  const cap=(ring:Plan[],y:number,color:string,down=false)=>{
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring.map(([u,v])=>new THREE.Vector2(u,v)),[])){
      const pt=(i:number)=>at(ring[i][0],y,ring[i][1]);
      batch.triangle(pt(a),pt(down?b:c),pt(down?c:b),color);
    }
  };
  const solid=(ring:Plan[],lo:number,hi:number,wall:string,top:string)=>{
    ring.forEach(([u,v],i)=>{
      const [u2,v2]=ring[(i+1)%ring.length];
      batch.quad(at(u,lo,v),at(u,hi,v),at(u2,hi,v2),at(u2,lo,v2),wall);
    });
    cap(ring,hi,top);
  };
  const rect=(l:number,t:number,r:number,b:number):Plan[]=>[[l,t],[r,t],[r,b],[l,b]];
  const full=rect(0,0,W,D);
  cap(full,soffit,'#35312e',true);
  cap(full,deck,'#b7b0a3');
  full.forEach(([u,v],edge)=>{
    const [u2,v2]=full[(edge+1)%4], L=Math.hypot(u2-u,v2-v),du=(u2-u)/L,dv=(v2-v)/L;
    const pt=(s:number,y:number,out:number)=>at(u+du*s+dv*out,y,v+dv*s-du*out);
    const plane=(s:number,t:number,lo:number,hi:number,out:number,c:string)=>
      batch.quad(pt(s,lo,out),pt(s,hi,out),pt(t,hi,out),pt(t,lo,out),c);
    const rib=(s:number,hw:number,lo:number,hi:number,out:number,base:number,c:string)=>{
      plane(s-hw,s+hw,lo,hi,out,c);
      batch.quad(pt(s-hw,lo,base),pt(s-hw,hi,base),pt(s-hw,hi,out),pt(s-hw,lo,out),dark);
      batch.quad(pt(s+hw,lo,out),pt(s+hw,hi,out),pt(s+hw,hi,base),pt(s+hw,lo,base),dark);
    };
    plane(0,L,soffit,fascia,0,'#514e49');
    plane(0,L,fascia,rim,-.005,bronze);
    batch.quad(pt(0,rim,0),pt(0,rim,-.015),pt(L,rim,-.015),pt(L,rim,0),fins);
    batch.quad(pt(L,deck,-.015),pt(L,rim,-.015),pt(0,rim,-.015),pt(0,deck,-.015),dark);
    const bays=edge%2===0?40:35,pitch=L/bays,h=(rim-fascia)/17;
    for(let j=0;j<bays;j++){
      const s=j*pitch,t=s+pitch;
      const blocked=edge===2?(W-(s+t)/2>1.28?1.51:W-(s+t)/2>.42?1.1:0):0;
      for(let i=0;i<17;i++){
        const sill=fascia+i*h+.003,head=sill+h*.69;
        if(head<=blocked)continue;
        const lo=Math.max(sill,blocked);
        const louver=edge===0&&i===0&&[32,36,37,38].includes(j);
        const opaque=edge===0&&i===0&&j===39;
        plane(s,t,lo,head,0,opaque?bronze:louver?'#373637':glass[(j*7+i*3+edge)%glass.length]);
        if(louver)for(let k=1;k<10;k++)plane(s,t,lo+(head-lo)*k/10,lo+(head-lo)*k/10+.002, .0012,'#746e68');
        if(!opaque&&!louver&&(i*13+j*7+edge*2)%16===4){
          const [x,y,z]=pt((s+t)/2,(lo+head)/2,.0015), normal=pt((s+t)/2,y,1.0015);
          windows.push({x,y,z,ry:Math.atan2(normal[0]-x,normal[2]-z),w:pitch*.84,h:(head-lo)*.87});
        }
      }
      rib(s+.002,.002,Math.max(fascia,blocked),rim,.008,0,fins);
    }
    // Continuous lobby is recessed from both streets and the south plaza. The
    // rear wall meets its neighbors and does not acquire a fictitious storefront.
    const inset=.158, start=inset, end=L-inset;
    plane(start,end,.0001,soffit,-inset,edge===2?'#9b958b':'#373b3c');
    if(edge===2)return;
    const count=edge===0?18:15;
    for(let j=0;j<count;j++){
      const a=start+(end-start)*j/count,b=start+(end-start)*(j+1)/count;
      const corner=edge===0?j>=count-5:edge===1?j<3:false;
      if(corner){
        plane(a,b-.001,.001,soffit,-inset+.006,precast);
        continue;
      }
      const doors=edge===0?j===11||j===12:edge===1?j===5||j===6:false;
      plane(a,b,.012,soffit-.042,-inset+.003,doors?'#4d5554':'#52605e');
      plane(a,b,.177,.184,-inset+.006,'#625f57');
      rib(a+.001,.002,.008,soffit,-inset+.008,-inset,'#89877e');
      if(doors){
        rib((a+b)/2,.0024,.006,.18,-inset+.009,-inset,'#a6a294');
        plane((a+b)/2+.008,(a+b)/2+.012,.063,.111,-inset+.011,'#c3c1b6');
      } else if(j%5===0)rib(a+.027,.025,0,soffit,-inset+.038,-inset,precast);
    }
  });
  // Registered 2024 orthophoto pixels (x across the long facade, y toward Folger).
  const px=(x:number,y:number):Plan=>[(x-109)*W/625,(y-66)*D/537];
  const trace=(p:Plan[])=>p.map(([x,y])=>px(x,y));
  const box=(x:number,y:number,x2:number,y2:number,lo:number,hi:number,c:string,top=c)=>
    solid(trace(rect(x,y,x2,y2)),lo,hi,c,top);
  const circle=(x:number,y:number,r:number,n=12):Plan[]=>
    Array.from({length:n},(_,i)=>px(x+r*Math.cos(2*Math.PI*i/n),y+r*Math.sin(2*Math.PI*i/n)));
  const membrane:Plan[]=[];
  for(const [x,y,angle] of [[197,156,180],[642,156,270],[642,510,0],[197,510,90]]){
    for(let i=0;i<=6;i++){
      const theta=(angle+i*15)*Math.PI/180;
      membrane.push([x+47*Math.cos(theta),y+47*Math.sin(theta)]);
    }
    if(angle===180)membrane.push([501,109],[501,144],[555,144],[555,109]);
  }
  cap(trace(membrane),deck+.002,'#d7d4c8');
  const ph=trace([[294,225],[587,225],[587,332],[536,332],[536,394],[587,394],[587,552],[192,552],[192,395],[258,395],[258,317],[294,317]]);
  solid(ph,deck,penthouse,'#807a70','#dbd9ce');
  ph.forEach(([u,v],i)=>{
    const [u2,v2]=ph[(i+1)%ph.length],len=Math.hypot(u2-u,v2-v),du=(u2-u)/len,dv=(v2-v)/len;
    const p=(s:number,y:number,out:number)=>at(u+du*s+dv*out,y,v+dv*s-du*out);
    batch.quad(p(0,penthouse,0),p(0,penthouse+.033,0),p(len,penthouse+.033,0),p(len,penthouse,0),'#a69e90');
    batch.quad(p(0,penthouse+.033,0),p(0,penthouse+.033,-.011),p(len,penthouse+.033,-.011),p(len,penthouse+.033,0),'#c1baab');
    if(i===6||i===5||i===7){
      const n=Math.ceil(len/.105);
      for(let j=0;j<n;j++)batch.quad(p(len*j/n,deck+.035,.001),p(len*j/n,penthouse-.024,.001),p(len*(j+1)/n-.005,penthouse-.024,.001),p(len*(j+1)/n-.005,deck+.035,.001),'#535857');
    }
  });
  box(258,397,406,444,penthouse,4.91,'#a49e92','#cbc8bc');
  box(535,396,588,444,penthouse,4.927,'#9e988d','#cac5b7');
  const fan=(x:number,y:number,r:number,h:number)=>{
    solid(circle(x,y,r),h,h+.009,'#a09c8e','#54544e');
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,center=px(x,y);
      const b=px(x+r*.86*Math.cos(a),y+r*.86*Math.sin(a)),c=px(x+r*.85*Math.cos(a+.48),y+r*.85*Math.sin(a+.48));
      batch.triangle(at(center[0],h+.011,center[1]),at(c[0],h+.011,c[1]),at(b[0],h+.011,b[1]),'#8c897b');
    }
  };
  for(const y of [210,267]){box(211,y,278,y+41,deck,4.61,'#aaa598','#cac5b6');fan(244,y+20,12,4.61);}
  for(const y of [277,328,379]){
    box(602,y,653,y+47,deck,4.56,'#aba697','#c3beae');
    fan(628,y+13,8,4.56);fan(628,y+33,8,4.56);
  }
  box(328,477,474,544,penthouse,4.821,'#98958a','#c3bfb3');
  for(let j=0;j<12;j++)box(345+j*9,497,350+j*9,524,4.821,4.829,'#99988f');
  for(const [x,y,r] of [[338,307,10],[423,307,10],[507,343,8],[492,409,6]])
    solid(circle(x,y,r),penthouse,penthouse+.055,'#999789','#c2bfb1');
  for(const [x,y] of [[279,355],[371,354],[450,354]])box(x,y,x+20,y+21,penthouse,penthouse+.064,'#aba597','#c8c4b6');
  box(498,155,556,204,deck,4.51,'#88867c','#c1bcae');
  // Freestanding pale directory with dark base inside the northwest overhang.
  solid(rect(W-.102,.042,W-.029,.063),0,.036,'#736f68','#807e77');
  solid(rect(W-.102,.042,W-.029,.063),.036,.147,'#e4e1d8','#eeebe2');
  const model=batch.mesh(material);model.name='211 Main Street';root.add(model);return true;
}
