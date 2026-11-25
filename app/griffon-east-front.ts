import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type XY=[number,number];
type Ink=[number,number,number];
const metres=.06,grade=.045;
const point=(x:number,y:number,z:number):FacadePoint=>[x*metres,grade+y*metres,z*metres];
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.81});
const wall='#908989',stone='#ada59d',shade='#746e6b',sash='#c4c2b6',iron='#757775',panes='#697a80',black='#383638';
const warm:Ink=[28,20,12],creamTube:Ink=[145,136,99],amberTube:Ink=[160,89,22],blueTube:Ink=[13,63,113];

// The wub, 18 July 2023, CC BY-SA 4.0. Look across the waterfront at this
// elevation: +X is photo-right, +Z is streetward. The operator's close-up
// distinguishes the cream hotel letters and amber outline on a brass box.
// https://commons.wikimedia.org/wiki/File:Embarcadero_between_Mission_and_Howard,_San_Francisco_2023-07-18.jpg
export function addGriffonEastFront(face:THREE.Group,length:number,h:number,font:Font,windows:Pane[]){
  const panels=new FacadePanels(),sources:{first:number;count:number;ink:Ink}[]=[];
  const half=length/(2*metres),roof=(h-grade)/metres,groundHead=roof*.186,cornice=roof*.725;
  const lampY=roof*.251-.12,lamps=[half*.395,half-.98];
  const lit=(count:number,ink?:Ink)=>{if(ink)sources.push({first:panels.positions.length/3-count,count,ink});};
  function front(a:number,b:number,lo:number,hi:number,z:number,c:string,ink?:Ink){
    panels.quad(point(a,lo,z),point(b,lo,z),point(b,hi,z),point(a,hi,z),c);lit(4,ink);
  }
  function masonry(a:number,b:number,lo:number,hi:number){
    const local=hi>lampY&&lo<lampY+2.65&&lamps.some(x=>b>x-1.0&&a<x+1.0);
    if(!local){front(a,b,lo,hi,0,wall);return;}
    const columns=Math.ceil((b-a)/.29),rows=Math.ceil((hi-lo)/.28);
    const line=(p:number,q:number,i:number,n:number)=>p+(q-p)*i/n;
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
      const x=line(a,b,i,columns),u=line(a,b,i+1,columns),y=line(lo,hi,j,rows),v=line(lo,hi,j+1,rows);
      front(x,u,y,v,0,wall);
      const start=panels.positions.length/3-4;
      for(const [k,[px,py]] of [[x,y],[u,y],[u,v],[x,v]].entries()){
        const rise=py-lampY;
        if(rise<0||rise>2.65)continue;
        const dx=Math.min(...lamps.map(l=>Math.abs(px-l)));
        const z=95*(1-rise/2.65)**2*Math.exp(-((dx/(.19+rise*.32))**2));
        if(z>1)sources.push({first:start+k,count:1,ink:[z,z*.62,z*.30]});
      }
    }
  }
  function top(a:number,b:number,y:number,back:number,out:number,c:string){
    panels.quad(point(a,y,out),point(b,y,out),point(b,y,back),point(a,y,back),c);
  }
  function side(x:number,lo:number,hi:number,back:number,out:number,c:string,right:boolean){
    const a=point(x,lo,back),b=point(x,hi,back),s=point(x,hi,out),d=point(x,lo,out);
    if(right)panels.quad(a,b,s,d,c);else panels.quad(d,s,b,a,c);
  }
  function block(a:number,b:number,lo:number,hi:number,back:number,out:number,c:string){
    front(a,b,lo,hi,out,c);top(a,b,hi,back,out,c);
    panels.quad(point(a,lo,back),point(b,lo,back),point(b,lo,out),point(a,lo,out),c);
    side(a,lo,hi,back,out,c,false);side(b,lo,hi,back,out,c,true);
  }
  function bar(x1:number,y1:number,x2:number,y2:number,z:number,w:number,c:string){
    const len=Math.hypot(x2-x1,y2-y1),x=(y2-y1)*w/(2*len),y=(x1-x2)*w/(2*len);
    panels.quad(point(x1+x,y1+y,z),point(x2+x,y2+y,z),point(x2-x,y2-y,z),point(x1-x,y1-y,z),c);
  }
  // Keep all lettering and crest triangles in the same static mesh. Opposite
  // blade faces use opposite tangents so both read correctly from the sidewalk.
  const glyphs=new Map<string,THREE.ShapeGeometry>();
  function label(text:string,size:number,x:number,y:number,z:number,facing:-1|0|1,c:string,ink?:Ink){
    let g=glyphs.get(text);
    if(!g){g=new THREE.ShapeGeometry(font.generateShapes(text,1),2);g.computeBoundingBox();glyphs.set(text,g);}
    const bounds=g.boundingBox!,mid=(bounds.min.x+bounds.max.x)/2,pos=g.attributes.position,index=g.index;
    const vertex=(i:number)=>{
      const k=index?index.getX(i):i,u=(pos.getX(k)-mid)*size,v=pos.getY(k)*size;
      return point(x+(facing===0?u:0),y+v,z-facing*u);
    };
    for(let i=0;i<(index?.count??pos.count);i+=3){
      panels.triangle(vertex(i),vertex(i+1),vertex(i+2),c);lit(3,ink);
    }
  }
  function room(x:number,y:number,z:number,w:number,height:number){
    const p=face.localToWorld(new THREE.Vector3(...point(x,y,z)));
    windows.push({x:p.x,y:p.y,z:p.z,w:w*metres,h:height*metres,ry:face.rotation.y});
  }
  // Ground-floor restaurant glazing is set into separate shop openings. The
  // black left awning and its short valance are visible past the umbrellas.
  const openings=[[-half+.34,-half*.48],[-half*.45,-half*.09],[-half*.06,half*.21],[half*.25,half-.31]];
  let edge=-half;
  for(const [a,b] of openings){
    front(edge,a,-.75,groundHead,0,wall);edge=b;
    front(a,b,-.75,.17,0,shade);front(a,b,groundHead-.39,groundHead,0,wall);
    side(a,.17,groundHead-.39,-.19,0,shade,true);side(b,.17,groundHead-.39,-.19,0,shade,false);
    top(a,b,.17,-.19,0,stone);front(a,b,.17,groundHead-.39,-.19,'#535c5b',warm);
    const num=Math.max(2,Math.round((b-a)/1.05));
    for(let k=1;k<num;k++){const x=a+(b-a)*k/num;front(x-.025,x+.025,.17,groundHead-.39,-.15,black);}
    for(const y of [.45,2.23,2.62])front(a,b,y,y+.05,-.14,black);
  }
  front(edge,half,-.75,groundHead,0,wall);
  const awningEnd=-half*.17,canopy=1.36;
  panels.quad(point(-half+.12,2.75,canopy),point(awningEnd,2.75,canopy),point(awningEnd,groundHead-.07,.02),point(-half+.12,groundHead-.07,.02),black);
  front(-half+.12,awningEnd,2.50,2.75,canopy,black);
  label("PERRY'S",.17,(-half+.12+awningEnd)/2,2.54,canopy+.014,0,'#d4c29a');
  // Five bays on each of three floors below the course. The first two rows
  // have segmental arches and individual keystones; the third has flat heads.
  const rowHeight=(cornice-groundHead)/3;
  for(let floor=0;floor<3;floor++){
    const lo=groundHead+floor*rowHeight,hi=lo+rowHeight;
    for(let k=0;k<5;k++){
      const a=-half+2*half*k/5,b=-half+2*half*(k+1)/5,x=(a+b)/2;
      const w=.57,bot=lo+.44,spring=hi-.73,rise=floor===2?0:.24,back=-.15;
      masonry(a,x-w,lo,hi);masonry(x+w,b,lo,hi);front(x-w,x+w,lo,bot,0,wall);
      front(x-w,x+w,bot,spring,back,panes);
      side(x-w,bot,spring,back,0,shade,true);side(x+w,bot,spring,back,0,shade,false);
      if(rise){
        const y=(u:number)=>spring+rise*(1-u*u);
        for(let j=0;j<6;j++){
          const u=j/3-1,v=(j+1)/3-1;
          const ax=x+u*w,bx=x+v*w,ay=y(u),by=y(v);
          panels.quad(point(ax,ay,0),point(bx,by,0),point(bx,hi,0),point(ax,hi,0),wall);
          panels.quad(point(ax,ay,back),point(bx,by,back),point(bx,by,0),point(ax,ay,0),shade);
          panels.triangle(point(x,spring,back),point(bx,by,back),point(ax,ay,back),panes);
          panels.quad(point(ax,ay,.018),point(bx,by,.018),point(bx,by+.065,.018),point(ax,ay+.065,.018),stone);
        }
        panels.quad(point(x-.065,spring+rise+.064,.023),point(x+.065,spring+rise+.064,.023),
          point(x+.134,spring+rise+.27,.023),point(x-.134,spring+rise+.27,.023),shade);
      }else front(x-w,x+w,spring,hi,0,wall);
      block(x-w-.055,x+w+.055,bot-.085,bot,-.16,.085,shade);
      const rail=bot+(spring-bot)*.55;
      front(x-w,x+w,rail-.022,rail+.022,back+.02,sash);
      front(x-.018,x+.018,bot,rail-.022,back+.024,sash);
      if((floor+k)%3===1)room(x,(rail+spring)/2,back+.02,2*w-.10,spring-rail-.09);
    }
  }
  // Deep continuous entablature, regular dentils, and paired upper triplets.
  // The central setback leaves the fire-escape ladder visible against the roof.
  const upper=14.10;
  block(-half,half,cornice,upper-.30,-.03,.17,wall);
  block(-half,half,upper-.34,upper-.16,-.02,.30,'#676463');
  block(-half,half,upper-.16,upper,-.04,.40,stone);
  for(let i=0;i<25;i++){
    const x=-half+.25+(2*half-.50)*i/24;block(x-.055,x+.055,upper-.42,upper-.29,.16,.25,shade);
  }
  for(const x of [-half+.32,-half+.55,half-.55,half-.32]){
    block(x-.085,x+.085,cornice+.09,upper-.34,.16,.31,shade);
  }
  const gap=half*.19;
  const seam=-3.25;
  front(-gap,gap,upper,roof,seam,'#787477');
  top(-gap,gap,upper,seam,-.04,'#827d77');
  for(const [x,rightward] of [[-half,false],[-gap,true],[gap,false],[half,true]] as const){
    side(x,upper,roof,seam,.015,shade,rightward);
  }
  for(const [a,b] of [[-half,-gap],[gap,half]]){
    top(a,b,roof,seam,-.05,'#8e8881');
    const cen=(a+b)/2,w=(b-a)*.29,bot=upper+.34,head=roof-.91;
    front(a,cen-w,upper,roof,.015,wall);front(cen+w,b,upper,roof,.015,wall);
    front(cen-w,cen+w,upper,bot,.015,wall);front(cen-w,cen+w,head,roof,.015,wall);
    front(cen-w,cen+w,bot,head,-.105,'#71818b');
    for(let j=0;j<4;j++){
      const x=cen-w+(2*w)*j/3;
      front(x-.046,x+.046,bot-.055,head+.055,-.085,sash);
    }
    front(cen-w,cen+w,bot-.02,bot+.044,-.08,sash);front(cen-w,cen+w,head-.045,head+.028,-.08,sash);
    front(cen-w,cen+w,(bot+head)/2-.026,(bot+head)/2+.026,-.08,sash);
    block(a,b,roof-.16,roof+.02,-.05,.15,shade);
    room(cen,(bot*3+head)/4,-.085,2*w/3-.12,(head-bot)/2-.12);
  }
  // Open iron escape: the landings project, connecting flights have actual
  // treads, and light passes between the slim front rails.
  const left=-1.57,right=1.57,zEdge=.87;
  for(let i=0;i<4;i++){
    const y=groundHead+.37+i*rowHeight;
    for(let j=0;j<6;j++)top(left,right,y,.07+j*.134,.158+j*.134,iron);
    front(left,right,y-.09,y,zEdge,iron);
    for(const offset of [.43,.83])front(left,right,y+offset,y+offset+.032,zEdge,iron);
    for(let j=0;j<=12;j++){
      const x=left+(right-left)*j/12;front(x-.017,x+.017,y,y+.862,zEdge+.01,iron);
    }
    for(const x of [left,right])side(x,y+.82,y+.86,.07,zEdge,iron,x>0);
    if(i===3)continue;
    for(const z of [.24,.65]){
      bar(.67,y+.08,-.60,y+rowHeight,z,.075,iron);
      bar(.67,y+.80,-.60,y+rowHeight+.72,z,.039,iron);
    }
    for(let j=0;j<13;j++){
      const x=.67-j*1.27/13,sy=y+.08+j*(rowHeight-.08)/13;
      top(x-.105,x+.035,sy,.23,.68,iron);
    }
  }
  const signX=half-.98,bottom=roof*.251,signTop=roof*.635,brassLo=roof*.413,brassHi=roof*.466;
  const hotelBack=.23,hotelOut=1.23,bladeHalf=.095;
  for(const [y1,y2] of [[bottom,brassLo],[brassHi,signTop]])block(signX-bladeHalf,signX+bladeHalf,y1,y2,hotelBack,hotelOut,black);
  block(signX-.137,signX+.137,brassLo,brassHi,hotelBack-.025,hotelOut+.06,'#ac8a52');
  for(const y of [bottom+.28,brassHi+.28,signTop-.33])block(signX-.036,signX+.036,y,y+.074,-.015,hotelBack+.025,iron);
  // A winged griffon in profile with the tail, haunch and raised forepaw.
  const crest:XY[][]=[
    [[-.39,-.12],[-.29,-.11],[-.25,-.02],[-.31,.04],[-.37,.02],[-.34,-.025]],
    [[-.32,-.14],[-.16,-.17],[-.06,-.12],[.055,-.16],[.15,-.135],[.18,-.04],[.28,.015],[.31,.12],[.36,.15]],
    [[-.25,-.045],[-.13,-.06],[-.025,-.025],[.065,-.06]], [[-.17,.055],[-.04,.035],[.065,-.005],[.09,-.065]],
    [[-.10,.15],[.015,.09],[.105,.04],[.17,-.035]],
    [[.18,-.035],[.14,.095],[.065,.20],[.085,.265],[.17,.30],[.225,.275],[.17,.24],[.26,.19],[.31,.235]],
  ];
  for(const dir of [-1,1] as const){
    const x=signX+dir*(bladeHalf+.007),z=(hotelBack+hotelOut)/2;
    for(const [word,low,high] of [['HOTEL',brassHi,signTop],['GRIFFON',bottom,brassLo]] as const){
      const pitch=(high-low-.14)/word.length,size=Math.min(pitch*.79,.40);
      for(const [j,ch] of [...word].entries())label(ch,size,x,high-.07-(j+.5)*pitch-size*.48,z,dir,'#eee7ce',creamTube);
    }
    for(const path of crest)for(let j=1;j<path.length;j++){
      const [a,b]=path[j-1],[c,d]=path[j],len=Math.hypot(c-a,d-b),du=(d-b)*.010/len,dv=(a-c)*.010/len;
      const p=(u:number,v:number)=>point(signX+dir*.145,(brassLo+brassHi)/2+v,z-dir*u);
      panels.quad(p(a+du,b+dv),p(c+du,d+dv),p(c-du,d-dv),p(a-du,b-dv),'#dfb45d');lit(4,amberTube);
    }
  }
  for(const x of lamps){
    block(x-.115,x+.115,lampY-.13,lampY-.015,-.01,.15,black);
    top(x-.082,x+.082,lampY-.012,.034,.146,'#edc897');lit(4,[120,76,36]);
  }
  const perryX=-half+.53,perryLo=roof*.259,perryHi=roof*.413;
  block(perryX-.076,perryX+.076,perryLo,perryHi,.19,.93,'#284563');
  for(const y of [perryLo+.19,perryHi-.16])block(perryX-.026,perryX+.026,y,y+.06,-.015,.22,iron);
  for(const dir of [-1,1] as const)for(const [i,ch] of [..."PERRY'S"].entries()){
    label(ch,.25,perryX+dir*.082,perryHi-.33-i*(perryHi-perryLo-.30)/7,.56,dir,'#c9d6ce',blueTube);
  }
  // Three pale café parasols are visible in July 2023. The existing sidewalk
  // is level at these poles, 3 m out, and curb 3801308 is over 7.5 m out.
  const patioZ=3.0;
  for(const [x,r] of [[-half*.82,1.12],[-half*.16,1.16],[half*.35,1.08]]){
    const base=.12,canopyY=2.16;
    block(x-.15,x+.15,0,base,patioZ-.15,patioZ+.15,'#5d5b53');
    block(x-.024,x+.024,base,canopyY+.21,patioZ-.024,patioZ+.024,'#726e61');
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4,b=(k+1)*Math.PI/4;
      const tip=(t:number)=>point(x+r*Math.cos(t),canopyY,patioZ+r*Math.sin(t));
      panels.triangle(point(x,canopyY+.28,patioZ),tip(b),tip(a),k%2?'#d9d2bf':'#e4ddca');
      panels.triangle(point(x,canopyY+.24,patioZ),tip(a),tip(b),'#c0b9a8');
    }
  }
  const m=panels.mesh(material),energy=new Uint8Array(m.geometry.attributes.position.count*3);
  for(const {first,count,ink} of sources)for(let i=first;i<first+count;i++)energy.set(ink,i*3);
  m.geometry.setAttribute('signLight',new THREE.BufferAttribute(energy,3,true));
  m.geometry.userData.paintVertices=true;m.name='Hotel Griffon Embarcadero elevation';face.add(m);
  glyphs.forEach(g=>g.dispose());
}
