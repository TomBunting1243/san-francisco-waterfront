import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const scale=.06,grade=.045;
const pt=(x:number,y:number,z:number):FacadePoint=>[x*scale,grade+y*scale,z*scale];
const flat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.79});
const gold=new THREE.MeshStandardMaterial({color:'#c3aa77',roughness:.57});
const ivory=new THREE.MeshStandardMaterial({color:'#d8d2b9',roughness:.72});
const wall='#9c9690',sash='#736e67',glass='#56666a',iron='#797b77',black='#292928';

// Local metres, photo-right towards Harbor Court, +Z across the Steuart sidewalk.
export function addGriffonFront(face:THREE.Group,length:number,h:number,font:Font,windows:Pane[]){
  const shell=new FacadePanels(),light:{start:number;value:number}[]=[];
  const half=length/(2*scale),roof=(h-grade)/scale;
  function front(a:number,b:number,lo:number,hi:number,z:number,tint:string,glow=0){
    shell.quad(pt(a,lo,z),pt(b,lo,z),pt(b,hi,z),pt(a,hi,z),tint);
    if(glow)light.push({start:shell.positions.length/3-4,value:glow});
  }
  function cap(a:number,b:number,y:number,back:number,out:number,c:string,down=false){
    const p=pt(a,y,out),q=pt(b,y,out),r=pt(b,y,back),s=pt(a,y,back);
    if(down)shell.quad(s,r,q,p,c);else shell.quad(p,q,r,s,c);
  }
  function side(x:number,lo:number,hi:number,back:number,out:number,c:string,normal:number){
    const a=pt(x,lo,back),b=pt(x,lo,out),p=pt(x,hi,out),q=pt(x,hi,back);
    if(normal>0)shell.quad(q,p,b,a,c);else shell.quad(a,b,p,q,c);
  }
  function box(a:number,b:number,lo:number,hi:number,back:number,out:number,c:string){
    front(a,b,lo,hi,out,c);cap(a,b,hi,back,out,c);cap(a,b,lo,back,out,c,true);
    side(a,lo,hi,back,out,c,-1);side(b,lo,hi,back,out,c,1);
  }
  function label(word:string,size:number,x:number,y:number,z:number,ry=0,glow=0,paint=gold){
    const g=new THREE.ShapeGeometry(font.generateShapes(word,size*scale),2);g.computeBoundingBox();
    const bounds=g.boundingBox!;g.translate(-(bounds.max.x+bounds.min.x)/2,0,0);
    const m=new THREE.Mesh(g,paint);m.position.set(...pt(x,y,z));m.rotation.y=ry;
    if(glow)m.userData.signLight=[glow,glow*.83,glow*.58];
    face.add(m);
  }
  function bar(x1:number,y1:number,x2:number,y2:number,z:number,thick:number,c:string){
    const len=Math.hypot(x2-x1,y2-y1),dx=(y2-y1)*thick/(2*len),dy=-(x2-x1)*thick/(2*len);
    shell.quad(pt(x1+dx,y1+dy,z),pt(x2+dx,y2+dy,z),pt(x2-dx,y2-dy,z),pt(x1-dx,y1-dy,z),c);
  }
  // The operator's broadside image resolves three bays below the fire escape.
  const door=-.88,l=door-1.54,r=door+1.54,head=3.65;
  front(-half,l,-.75,head,0,wall);front(r,half,-.75,head,0,wall);
  side(l,0,head,-1.31,0,'#998d79',1);side(r,0,head,-1.31,0,'#ac9e86',-1);
  cap(l,r,.012,-1.32,0,'#978d80');cap(l,r,head,-1.32,0,'#aa987e',true);
  front(l,r,0,head,-1.31,'#725c45',36);
  front(l+.42,r-.42,.18,2.68,-1.28,'#85735c',48);
  front(door-.045,door+.045,.12,2.72,-1.25,'#554a3b');
  front(l+.32,r-.32,2.69,2.77,-1.25,'#65533e');
  front(r-.46,r-.15,1.02,1.63,-.04,'#aaa18e',14);
  for(const [a,b] of [[-half+.42,l-.91],[r+1.15,half-.30]]){
    front(a,b,.13,3.05,.036,glass,9);
    for(let i=0;i<=4;i++){
      const x=a+(b-a)*i/4;front(x-.045,x+.045,.14,3.09,.062,sash);
    }
    for(const y of [.38,1.57,2.53])front(a,b,y,y+.09,.064,sash);
    front(a,b,2.43,2.57,.067,sash);
  }
  const out=1.95;
  // Bowed black entrance canopy, straight gold 155 valance, slim front legs.
  for(let i=0;i<12;i++){
    const x=(k:number)=>door+1.48*(k/6-1);
    const crown=(k:number)=>3.51+.29*Math.sin(k*Math.PI/12);
    shell.quad(pt(x(i),3.01,out),pt(x(i+1),3.01,out),pt(x(i+1),crown(i+1),out),pt(x(i),crown(i),out),black);
    shell.quad(pt(x(i),crown(i),out),pt(x(i+1),crown(i+1),out),pt(x(i+1),crown(i+1),-.04),pt(x(i),crown(i),-.04),black);
  }
  cap(door-1.48,door+1.48,3.01,-.04,out,'#514b40',true);
  side(door-1.48,3.01,3.51,-.04,out,black,-1);side(door+1.48,3.01,3.51,-.04,out,black,1);
  for(const x of [door-1.44,door+1.44])box(x-.026,x+.026,.01,3.02,out-.07,out-.018,'#393936');
  front(door-1.48,door+1.48,3.21,3.235,out+.005,'#93836a');
  label('155',.17,door,3.03,out+.014,0,.25);
  label('HOTEL GRIFFON',.115,door,3.26,out+.014,0,.18);
  // Small brass outline of the winged griffon on the arched valance.
  const emblem=[[0,0],[-.10,.05],[-.20,.04],[-.18,.10],[-.10,.12],[-.19,.23],[-.04,.18],[.025,.10],[.13,.17],[.12,.22],[.18,.19],[.15,.12],[.10,.09],[.06,.025],[-.015,.005]];
  for(let k=1;k<emblem.length;k++)bar(door+emblem[k-1][0],3.42+emblem[k-1][1],door+emblem[k][0],3.42+emblem[k][1],out+.019,.021,'#bba06e');
  box(r+1.08,half-.23,3.04,3.73,.01,.16,black);
  label("PERRY'S",.34,(r+1.08+half-.23)/2,3.20,.175,0,.28);
  // A blade is visible left of 155 in the day photo. Its far face and precise
  // height are obscured by the tree. Keep its night treatment local to its letters.
  const blade=l-.72;
  box(blade-.11,blade+.11,4.0,6.05,.12,.95,black);
  box(blade-.07,blade+.07,5.70,5.80,-.025,.18,iron);
  for(const dir of [-1,1]){
    const x=blade+dir*.124;
    label('HOTEL',.132,x,5.60,.55,dir*Math.PI/2,.32,ivory);
    for(const [i,ch] of [...'GRIFFON'].entries())label(ch,.141,x,5.28-i*.17,.55,dir*Math.PI/2,.34,ivory);
  }
  const split=3.85;
  front(-half,half,head,split,0,wall);
  const bays=5,pitch=length/scale/bays;
  for(let floor=0;floor<3;floor++){
    const lo=split+(roof-split)*floor/3,hi=split+(roof-split)*(floor+1)/3;
    for(let k=0;k<bays;k++){
      const start=-half+k*pitch,x=start+pitch/2,w=.68,bot=lo+.45,top=hi-.46,back=-.115;
      front(start,x-w,lo,hi,0,wall);front(x+w,start+pitch,lo,hi,0,wall);
      front(x-w,x+w,lo,bot,0,wall);front(x-w,x+w,top,hi,0,wall);
      front(x-w,x+w,bot,top,back,(k+floor)%4===2?'#84908d':glass);
      side(x-w,bot,top,back,0,'#807b72',1);side(x+w,bot,top,back,0,'#807b72',-1);
      cap(x-w,x+w,top,back,0,'#807b72',true);
      box(x-w-.07,x+w+.07,bot-.09,bot,back,.105,'#b2aaa0');
      front(x-w,x+w,(bot+top)/2,(bot+top)/2+.045,back+.015,sash);
      if((k+floor*2)%3===1){
        const p=new THREE.Vector3(...pt(x,(bot*3+top)/4,back+.02));face.localToWorld(p);
        windows.push({x:p.x,y:p.y,z:p.z,ry:face.rotation.y,w:(2*w-.08)*scale,h:((top-bot)*.5-.095)*scale});
      }
    }
  }
  box(-half,half,split-.15,split+.055,0,.12,'#78766f');
  box(-half,half,roof-.12,roof+.15,-.11,.22,'#b3aa9e');
  // Open grating, handrails, stair treads and sloping stringers; the street
  // remains visible through the escape in the broadside photograph.
  for(let f=0;f<3;f++){
    const y=4.09+f*(roof-split)/3,a=-.56,b=2.47,edge=1.03;
    box(a,b,y-.095,y,.0,edge,iron);
    for(const h of [.42,.84])front(a,b,y+h-.023,y+h+.023,edge,iron);
    for(let i=0;i<=13;i++){const x=a+(b-a)*i/13;front(x-.018,x+.018,y,y+.85,edge+.012,iron);}
    if(f===2)continue;
    const span=(roof-split)/3,left=a+.12,right=b-.18;
    for(const z of [.34,.72]){
      bar(left,y+.06,right,y+span,z,.095,iron);
      bar(left,y+.80,right,y+span+.80,z,.037,iron);
    }
    for(let j=0;j<15;j++){
      const x=left+(right-left)*j/15,sy=y+span*j/15;
      box(x,x+(right-left)/15,sy,sy+.035,.32,.74,iron);
    }
  }
  const mesh=shell.mesh(flat),energy=new Uint8Array(mesh.geometry.attributes.position.count*3);
  for(const {start,value} of light)for(let i=start;i<start+4;i++)energy.set([value,value*.77,value*.53],i*3);
  mesh.geometry.setAttribute('signLight',new THREE.BufferAttribute(energy,3,true));
  mesh.name='155 Steuart hotel and restaurant frontage';face.add(mesh);
}
