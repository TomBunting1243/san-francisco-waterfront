import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.79});
const lettering=new THREE.MeshStandardMaterial({color:'#e9e0cd',roughness:.76});
const brick='#b18b75',stone='#c9c0b1',metal='#44433d',frame='#c2bcb0',glass='#606e70';
const ground=.045,scale=.06;
const pt=(x:number,y:number,z:number):FacadePoint=>[x*scale,ground+y*scale,z*scale];

/** Steuart Street's lower western wing, observed on the city's 2021 site sheet.
 * Local +X follows the photograph from Griffon toward the YMCA, +Z faces the street. */
export function addHarborCourtFront(face:THREE.Group,length:number,h:number,font:Font,windows:Pane[]){
  const panels=new FacadePanels(),glows:{first:number;intensity:number}[]=[];
  const half=length/(2*scale),roof=(h-ground)/scale;
  const facade=(a:number,b:number,lo:number,hi:number,z:number,tint:string,light=0)=>{
    panels.quad(pt(a,lo,z),pt(b,lo,z),pt(b,hi,z),pt(a,hi,z),tint);
    if(light)glows.push({first:panels.positions.length/3-4,intensity:light});
  };
  const cap=(a:number,b:number,y:number,back:number,front:number,tint:string,down=false)=>{
    const p=pt(a,y,front),q=pt(b,y,front),r=pt(b,y,back),s=pt(a,y,back);
    if(down)panels.quad(s,r,q,p,tint);else panels.quad(p,q,r,s,tint);
  };
  const side=(x:number,lo:number,hi:number,back:number,front:number,tint:string,right:boolean)=>{
    const a=pt(x,lo,back),b=pt(x,lo,front),c=pt(x,hi,front),d=pt(x,hi,back);
    if(right)panels.quad(d,c,b,a,tint);else panels.quad(a,b,c,d,tint);
  };
  function box(a:number,b:number,lo:number,hi:number,back:number,front:number,tint:string){
    facade(a,b,lo,hi,front,tint);
    cap(a,b,hi,back,front,tint);cap(a,b,lo,back,front,tint,true);
    side(a,lo,hi,back,front,tint,false);side(b,lo,hi,back,front,tint,true);
  }
  // LiDAR canted-window clusters centre near plate v -415, -378, -342 and -306.
  const centers=[-8.0,-2.7,2.45,7.6],door=centers[2],left=door-1.82,right=door+1.82;
  const base=4.72;
  facade(-half,left,-.75,base,0,stone);facade(right,half,-.75,base,0,stone);
  facade(left,right,3.24,base,0,stone);
  side(left,0,3.24,-1.12,0,'#b9aa93',true);side(right,0,3.24,-1.12,0,'#b9aa93',false);
  cap(left,right,3.24,-1.12,0,'#bcae92',true);
  cap(left,right,.012,-1.13,0,'#9e9586');
  facade(left,right,0,3.24,-1.12,'#655e50',27);
  facade(left+.21,right-.21,.22,2.58,-1.10,'#746e58',43);
  facade(left+.19,right-.19,2.63,3.06,-1.10,'#b3a387',47);
  facade(door-.05,door+.05,.12,2.62,-1.07,metal);
  for(const x of [left+.12,right-.12])facade(x-.04,x+.04,.11,3.10,-1.07,frame);
  for(const x of [-10.7,-5.3,10.75]){
    facade(x-1.15,x+1.15,.39,3.24,.04,'#575d58');
    facade(x-.035,x+.035,.39,3.24,.07,frame);
    facade(x-1.15,x+1.15,2.62,2.68,.07,frame);
  }
  // The marquee has a dark straight fascia, pale double bottom lip and a small
  // H monogram on the end; the separate flat projecting hotel blade is unlit.
  const mc=door,front=1.89;
  box(mc-2.77,mc+2.77,3.32,4.15,-.06,front,'#42403b');
  box(mc-2.80,mc+2.80,3.18,3.33,-.06,front+.035,'#c4beb0');
  box(mc-2.81,mc+2.81,3.13,3.18,-.06,front+.06,'#817c70');
  cap(mc-2.54,mc+2.54,3.128,-.02,front-.1,'#bdaf92',true);
  glows.push({first:panels.positions.length/3-4,intensity:19});
  for(const x of [mc-1.48,mc+1.48]){
    cap(x-.09,x+.09,3.12,.88,1.06,'#ede0c2',true);
    glows.push({first:panels.positions.length/3-4,intensity:120});
  }
  const bladeX=-half+1.15;
  box(bladeX-.10,bladeX+.10,3.52,4.65,.12,1.73,'#393835');
  box(bladeX-.08,bladeX+.08,4.50,4.62,-.02,.20,metal);
  function label(word:string,size:number,x:number,y:number,z:number,ry=0,lit=false){
    const geo=new THREE.ShapeGeometry(font.generateShapes(word,size*scale),2);
    geo.computeBoundingBox();const bounds=geo.boundingBox!;
    geo.translate(-(bounds.max.x+bounds.min.x)/2,0,0);
    const m=new THREE.Mesh(geo,lettering);m.position.set(...pt(x,y,z));m.rotation.y=ry;
    if(lit)m.userData.signLight=[.20,.157,.103];
    face.add(m);
  }
  label('HARBOR COURT',.28,mc,3.62,front+.015,0,true);
  for(const sign of [-1,1]){
    label('H',.43,mc+sign*2.792,3.53,front*.55,sign*Math.PI/2);
    label('HARBOR',.195,bladeX+sign*.113,4.16,.94,sign*Math.PI/2);
    label('COURT',.195,bladeX+sign*.113,3.88,.94,sign*Math.PI/2);
  }
  facade(-half,half,base,roof,0,brick);
  box(-half,half,base-.10,base+.08,0,.16,stone);
  for(const x of centers){
    // Three plane oriels have narrow angled cheeks, a panelled apron and horizontal sash.
    const y0=5.22,y1=9.32,w=1.60,z=.58;
    const trace=[[x-w,0.02],[x-w+.42,z],[x+w-.42,z],[x+w,.02]];
    for(let i=0;i<3;i++){
      const [a,za]=trace[i],[b,zb]=trace[i+1];
      const section=(l:number,h:number,tint:string,offset=0)=>{
        panels.quad(pt(a,l,za+offset),pt(b,l,zb+offset),pt(b,h,zb+offset),pt(a,h,za+offset),tint);
      };
      section(y0,y0+.44,frame);section(y0+.44,y1-.11,glass);section(y1-.11,y1,frame);
      for(let j=1;j<5;j++){const y=y0+.44+j*.70;section(y,y+.055,frame,.018);}
      for(const [s,d] of [[a,za],[b,zb]])facade(s-.024,s+.024,y0+.44,y1,d+.029,frame);
    }
    cap(x-w+.42,x+w-.42,y1,.01,z,frame);
    const room=new THREE.Vector3(...pt(x,y0+.44+2.5*.70+.025,z+.025));
    face.localToWorld(room);
    windows.push({x:room.x,y:room.y,z:room.z,ry:face.rotation.y,w:(2*w-.96)*scale,h:.60*scale});
    // Narrow pairs high in the otherwise unfenestrated wall (not guest floors).
    for(const xx of [x-.45,x+.45]){
      const y=13.15,r=.27;
      facade(xx-r,xx+r,y,y+1.69,.022,'#515d59');
      for(let k=0;k<8;k++){
        const arc=(i:number)=>pt(xx+r*Math.cos(i*Math.PI/8),y+1.69+r*Math.sin(i*Math.PI/8),.022);
        panels.triangle(pt(xx,y+1.69,.022),arc(k),arc(k+1),'#515d59');
      }
      facade(xx-r,xx+r,y+1.50,y+1.54,.036,frame);
    }
  }
  box(-half,half,roof-.16,roof+.44,0,.21,stone);
  box(-half,half,roof+.44,roof+.54,-.19,.25,'#d3c7b3');
  // The south end meets the higher gym wall immediately next door.
  const step=half-3.35;
  box(step,half,roof+.54,roof+2.57,-.20,0,brick);
  box(step,half,roof+2.57,roof+2.93,-.24,.20,stone);
  const mesh=panels.mesh(material),energy=new Uint8Array(mesh.geometry.attributes.position.count*3);
  for(const g of glows)for(let i=g.first;i<g.first+4;i++)energy.set([g.intensity,g.intensity*.75,g.intensity*.45],i*3);
  mesh.geometry.setAttribute('signLight',new THREE.BufferAttribute(energy,3,true));
  mesh.name='165 Steuart western hotel frontage';face.add(mesh);
}
