import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Point=[number,number];
type NightWindow={x:number;y:number;z:number;ry:number;w:number;h:number};
const grade=.045;
const height=(datum:number)=>grade+(datum-4.57)*.06;
// Local u runs west (Battery to Sansome); v runs north (Pine to California).
function at([u,v]:Point,h:number):FacadePoint {
  return [3.63+.46132*u+.88723*v,h,-39.678-.88723*u+.46132*v];
}
const rect=(l:number,t:number,r:number,b:number):Point[]=>[[l,t],[r,t],[r,b],[l,b]];
const diamond=(x:number,y:number,r:number):Point[]=>[[x-r,y],[x,y-r],[x+r,y],[x,y+r]];
const panelsMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.63});
const pale='#c1b7af',light='#d1c8be',dark='#736c72',roof='#a49c90';
const glass=['#4b565e','#535c62','#62686c','#48535a','#626466','#505a65'];

export function addCaliforniaCenter(b:{id:number},root:THREE.Group,windows:NightWindow[]){
  if(b.id!==588355355)return false;
  const f=new FacadePanels();
  function cap(r:Point[],y:number,tint:string,underside=false){
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(r.map(([x,z])=>new THREE.Vector2(x,z)),[]))
      f.triangle(at(r[a],y),at(r[underside?b:c],y),at(r[underside?c:b],y),tint);
  }
  function solid(r:Point[],lo:number,hi:number,color:string,top=color){
    r.forEach((p,i)=>{const q=r[(i+1)%r.length];f.quad(at(p,lo),at(p,hi),at(q,hi),at(q,lo),color);});
    cap(r,hi,top);
  }
  function block(l:number,t:number,r:number,b:number,lo:number,hi:number,tint:string){
    solid(rect(l,t,r,b),lo,hi,tint);
  }
  const hex=(l:number,r:number,rad:number):Point[]=>[[l,1.29],[l+rad,1.29-rad],[r-rad,1.29-rad],[r,1.29],[r-rad,1.29+rad],[l+rad,1.29+rad]];
  function facade(ring:Point[],lo:number,hi:number,rows:number,office:boolean){
    cap(ring,hi,roof);
    ring.forEach((a,i)=>{
      const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);
      const u=dx/L,v=dz/L,wall=office&&Math.abs(v)<.02?dark:pale;
      const p=(s:number,y:number,out=0)=>at([a[0]+u*s+v*out,a[1]+v*s-u*out],y);
      const face=(s:number,e:number,y:number,Y:number,out:number,col:string)=>
        f.quad(p(s,y,out),p(s,Y,out),p(e,Y,out),p(e,y,out),col);
      const n=Math.max(1,Math.round(L/.224)),pitch=L/n,opening=Math.min(.13412,pitch*.72);
      const floor=(hi-lo)/rows,h=Math.min(.13412,floor*.65),inset=.009;
      // Granite piers and their jamb returns span the floor band. The square
      // lites sit behind these rails and continuous cut sill/head reveals.
      for(let k=0;k<=n;k++){
        const s=Math.max(0,(k-.5)*pitch+opening/2),e=Math.min(L,(k+.5)*pitch-opening/2);
        face(s,e,lo,hi,0,wall);
        if(k>0)f.quad(p(s,lo,-inset),p(s,hi,-inset),p(s,hi),p(s,lo),'#8b8384');
        if(k<n)f.quad(p(e,lo),p(e,hi),p(e,hi,-inset),p(e,lo,-inset),'#8c8685');
      }
      for(let j=0;j<rows;j++){
        const base=lo+j*floor,y=base+(floor-h)*.5,Y=y+h;
        // Place continuous bands just inside the pier plane so their intersections
        // never share a depth and the pier grid stays legible at shallow angles.
        face(0,L,base,y,-.0007,wall);face(0,L,Y,base+floor,-.0007,wall);
        f.quad(p(0,y,-.0007),p(0,y,-inset),p(L,y,-inset),p(L,y,-.0007),wall===dark?'#8b8386':light);
        f.quad(p(L,Y,-.0007),p(L,Y,-inset),p(0,Y,-inset),p(0,Y,-.0007),'#777476');
        for(let k=0;k<n;k++){
          const mid=(k+.5)*pitch;
          face(mid-opening/2,mid+opening/2,y,Y,-inset,glass[(k*5+j*3+i+Math.floor(j/3))%glass.length]);
          if((k*17+j*13+i*3)%16===2){
            const [x,H,z]=p(mid,(y+Y)/2,-inset+.001);
            const normal=p(mid,(y+Y)/2,1-inset+.001);
            windows.push({x,y:H,z,ry:Math.atan2(normal[0]-x,normal[2]-z),w:opening*.88,h:h*.87});
          }
        }
      }
    });
  }
  // Exterior shop and lobby line from the 2025 Suite 110 plan. An open arcade
  // passes behind the corner shops on both the Battery and Sansome frontages.
  const lower:Point[]=[[.47,.02],[4.58,.02],[4.93,.65],[4.42,.99],[4.59,1.19],[4.43,1.40],[4.52,1.49],[3.88,2.13],[1.22,2.13],[.59,1.49],[.68,1.40],[.48,1.19],[.65,1.01],[.25,.66]];
  solid(lower,grade,height(14),'#73777a');
  // The hotel and shop fronts occupy the splayed walls at the ends of the
  // arcade. The Sansome hotel doors are on the western, south-facing bevel.
  for(const i of [2,3,4,5,6,8,9,10,11,12]){
    const a=lower[i],b=lower[(i+1)%lower.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),n=Math.max(2,Math.round(L/.126));
    const p=(k:number,y:number,d:number)=>at([a[0]+k*dx+d*dz/L,a[1]+k*dz-d*dx/L],y);
    const panel=(s:number,e:number,y:number,Y:number,d:number,color:string)=>f.quad(p(s,y,d),p(s,Y,d),p(e,Y,d),p(e,y,d),color);
    panel(.035,.965,grade+.012,grade+.34,.002,'#a0927c');
    for(let k=0;k<n;k++){
      const l=.04+k*.92/n,r=.04+(k+1)*.92/n-.008/L;
      panel(l,r,grade+.022,grade+.222,.004,i===2?'#47585b':'#56666a');
      panel(l,r,grade+.233,grade+.325,.004,'#667274');
    }
    if(i===2){
      panel(.38,.62,grade+.026,grade+.215,.006,'#4d5a5d');
      panel(.495,.505,grade+.026,grade+.215,.008,'#ba9d6b');
      for(const k of [.47,.53])panel(k,k+.003/L,grade+.071,grade+.119,.011,'#bfaa87');
    }
  }
  const lobbyU=2.32;
  block(lobbyU-.245,2.128,lobbyU+.245,2.143,grade,height(12.9),'#9b7962');
  for(let k=0;k<4;k++){
    const x=lobbyU-.21+k*.106;
    block(x,2.143,x+.097,2.15,grade+.009,grade+.234,'#5e6461');
    block(x,2.15,x+.005,2.154,grade+.009,grade+.234,'#aa8b58');
  }
  block(lobbyU-.218,2.145,lobbyU+.218,2.152,grade+.238,height(12.9),'#78554f');
  // Polished cladding and brass frame at the end of the narrow California court.
  for(const s of [-1,1])block(lobbyU+s*.223-.012,2.135,lobbyU+s*.223+.012,2.163,grade,height(13.8),'#b29261');
  block(lobbyU-.236,2.135,lobbyU+.236,2.163,height(13.35),height(13.8),'#b29261');
  for(let i=0;i<13;i++){
    const v=2.15+i*.153;
    block(1.934,v,2.568,v+.153,.044,.051,i%2===0?'#c9beb1':'#856b62');
    block(2.079,v,2.155,v+.153,.051,.052,'#bdbab1');
    block(2.365,v,2.441,v+.153,.051,.052,'#bdbab1');
  }
  for(const x of [.01,4.58]){
    block(x,.02,x+.46,.57,grade,height(14),'#a59c93');
    block(x,1.93,x+.46,2.47,grade,height(14),'#afa49a');
    const front=x<1?x:x+.46;
    for(const z of [.13,.33,2.02,2.23])block(front-.004,z,front+.004,z+.134,grade+.03,height(11.7),'#596264');
  }
  // The owner's podium plate has V-shaped recesses at both short sides.
  const podium:Point[]=[[0,0],[5.06,0],[5.06,.60],[4.58,1.09],[4.73,1.24],[4.58,1.39],[5.06,1.87],[5.06,2.49],[0,2.49],[0,1.87],[.48,1.39],[.33,1.24],[.48,1.09],[0,.60]];
  facade(podium,height(14),height(23.4),2,false);cap(podium,height(14),'#797371',true);
  // Alternating roof paving stripes remain visible at all four corner terraces.
  for(const x of [.02,4.42])for(const z of [.025,1.95]){
    for(let k=-2;k<4;k++){
      const strip:Point[]=[];
      // Clip one diagonal band to the four-sided terrace.
      let poly=rect(0,0,.61,.51);
      for(const [edge,sign] of [[k*.23,1],[k*.23+.074,-1]]){
        const out:Point[]=[];
        poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length],A=(a[0]-a[1]-edge)*sign,B=(b[0]-b[1]-edge)*sign;
          if(A>=0)out.push(a);
          if(A*B<0){const t=A/(A-B);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
        });poly=out;
      }
      for(const [a,b] of poly)strip.push([x+a,z+b]);
      if(strip.length>2)cap(strip,height(23.4)+.001,'#c3b9a6');
    }
  }
  const body=hex(.34,4.64,.98);
  facade(body,height(23.4),height(144.8),31,true);
  solid(hex(.42,4.56,.85),height(144.8),height(151.2),'#827b7b',roof);
  facade(hex(.59,4.39,.61),height(151.2),height(158.3),2,true);

  // The plate photograph and 1.5 m DSM resolve two diamonds at each end:
  // a guest wing, and the smaller inward-stepped plant core beside the bridge.
  const base=height(151.2),top=height(188.2);
  for(const [wing,core,shaft] of [[1.29,1.88,2.30],[3.70,3.11,2.69]]){
    const outward=wing<2.5?1:-1;
    const near=wing+outward*.93,far=core+outward*.48;
    const seam=(near+core-outward*.48)/2,neck=Math.abs(near-seam);
    const wingRing:Point[]=[[wing-outward*.93,1.29],[wing,.36],[seam,1.29-neck],[core,.81],[far,1.29],[core,1.77],[seam,1.29+neck],[wing,2.22]];
    if(outward<0)wingRing.reverse();
    facade(wingRing,base,top,11,false);
    solid(diamond(core,1.29,.48),top,height(193.5),'#b2a69c','#b8b1a6');
    solid(diamond(wing,1.29,.25),top,height(191.3),'#928c86','#aaa499');
    solid(diamond(shaft,1.29,.138),height(188),height(204.6),'#b3a59b',light);
    solid(diamond(shaft,1.29,.071),height(204.6),height(212.2),'#96887d','#aa9c91');
    const pole:Point[]=Array.from({length:8},(_,k)=>[shaft+.012*Math.cos(k*Math.PI/4),1.29+.012*Math.sin(k*Math.PI/4)]);
    solid(pole,height(212.2),grade+220.98*.06,'#847c71');
    const flag=(dx:number,y:number,dz:number)=>at([shaft+dx,1.29+dz],y);
    const y=grade+220.98*.06;
    for(let k=0;k<3;k++){
      const s=k*.026,e=s+.026,a=.009*Math.sin(k*1.8),b=.009*Math.sin((k+1)*1.8);
      const A=flag(s,y-.008,a),B=flag(s,y-.057,a),C=flag(e,y-.059,b),D=flag(e,y-.009,b);
      f.quad(A,B,C,D,'#bcb4a4');f.quad(D,C,B,A,'#bcb4a4');
    }
  }
  const bridgeBase=height(158.3),pitch=(top-bridgeBase)/9;
  for(let j=0;j<9;j++){
    const y=bridgeBase+j*pitch;
    block(2.23,1.193,2.76,1.387,y,y+.036,'#6e7475');
    block(2.23,1.208,2.76,1.373,y+.036,y+pitch-.019,'#809298');
    block(2.23,1.195,2.76,1.385,y+pitch-.019,y+pitch-.005,'#a79c91');
  }
  const mesh=f.mesh(panelsMaterial);mesh.name='345 California Center';root.add(mesh);return true;
}
