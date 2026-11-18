import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][]};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type Point=[number,number,number];
const annex=44106213,spear=32863010,ft=.3048*.06;

class Surfaces{
  positions:number[]=[];colors:number[]=[];indices:number[]=[];
  palette=new Map<string,THREE.Color>();
  quad(a:Point,b:Point,c:Point,d:Point,paint:string){
    let color=this.palette.get(paint);
    if(!color){color=new THREE.Color(paint);this.palette.set(paint,color);}
    const i=this.positions.length/3;
    for(const q of [a,b,c,d]){this.positions.push(...q);this.colors.push(color.r,color.g,color.b);}
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  rect(x:number,y:number,w:number,h:number,z:number,c:string){
    this.quad([x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z],c);
  }
  block(x:number,y:number,w:number,h:number,back:number,front:number,c:string){
    const a=x-w/2,b=x+w/2,l=y-h/2,t=y+h/2;
    this.rect(x,y,w,h,front,c);
    this.quad([a,t,front],[b,t,front],[b,t,back],[a,t,back],c);
    this.quad([a,l,back],[b,l,back],[b,l,front],[a,l,front],c);
    this.quad([a,l,back],[a,l,front],[a,t,front],[a,t,back],c);
    this.quad([b,l,front],[b,l,back],[b,t,back],[b,t,front],c);
  }
  build(g:THREE.Group,name:string){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geo.setIndex(this.indices);geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.83}));
    m.name=name;g.add(m);
  }
}

function face(parent:THREE.Group,u:number,v:number,yaw:number,name:string){
  const g=new THREE.Group();g.position.set(u,0,v);g.rotation.y=yaw;g.name=name;parent.add(g);g.updateWorldMatrix(true,false);return g;
}
function night(out:Pane[],g:THREE.Group,x:number,y:number,z:number,w:number,h:number){
  const p=g.localToWorld(new THREE.Vector3(x,y,z)),n=new THREE.Vector3(0,0,1).transformDirection(g.matrixWorld);
  out.push({x:p.x,y:p.y,z:p.z,w,h,ry:Math.atan2(n.x,n.z)});
}
function volume(g:THREE.Group,w:number,h:number,d:number,u:number,y:number,v:number,c:string,name:string){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c}));
  m.position.set(u,y,v);m.name=name;g.add(m);return m;
}
function legend(g:THREE.Group,font:Font,s:string,size:number,x:number,y:number,z:number){
  const geo=new TextGeometry(s,{font,size,depth:.0008,curveSegments:2});
  geo.computeBoundingBox();geo.translate(-geo.boundingBox!.max.x/2,0,0);
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#4c5451'}));m.position.set(x,y,z);g.add(m);
}

// NPS designation describes eight colossal piers, tall windows, an attic and dolphin panels.
// https://npgallery.nps.gov/GetAsset/71f080f2-84c3-4329-badf-0f36e39fbdbe
// Mission and Spear entries: 2020 architect's plan, sheet A101.1 (PDF p. 8).
// https://sfocii.org/sites/default/files/inline-files/2020039.pdf#page=8
// Existing elevations and entry photographs, PDF pp. 70–73, City Board of Appeals:
// https://media.api.sf.gov/documents/Item_4A_4B_4C_and_4D_Appeal_Nos._23-020_23-021_23-022_and_23-023_at_101_Spear_Street.pdf
// https://commons.wikimedia.org/wiki/File:Rincon_Annex_(San_Francisco).jpg
function rincon(g:THREE.Group,w:number,d:number,p:Building['p'],out:Pane[],font:Font){
  const cream='#dad4c4',white='#e0ddd3',blue='#839799',stone='#c5bda8',metal='#787f75',glass='#596864';
  const toLocal=g.matrix.clone().invert();
  const plan=p.map(([x,z])=>{const v=new THREE.Vector3(x,0,z).applyMatrix4(toLocal);return [v.x,v.z];});
  const shell=new THREE.Mesh(footprintGeometry(plan,1.145),new THREE.MeshStandardMaterial({color:white}));
  shell.name='Historic post office perimeter';g.add(shell);
  // 2024 SF orthophoto and 2023 3DEP distinguish the 1.14 parapet from the
  // setback fifth floor and the long cross-shaped glass roof.
  const x0=w*.115,x1=w*.889,z0=d*.187,z1=d*.965;
  volume(g,x1-x0,.405,z1-z0,(x0+x1)/2,1.346,(z0+z1)/2,'#c6c6b9','Setback office floors');
  for(const [u,v,width,depth] of [[.148,.300,.121,.199],[.833,.251,.101,.102],[.190,.776,.098,.093],[.817,.775,.102,.10],[.361,.259,.107,.075]]){
    volume(g,width*w,.107,depth*d,u*w,1.602,v*d,'#babbb0','Mechanical housing');
    volume(g,width*w+.012,.016,depth*d+.012,u*w,1.663,v*d,'#d7d5c7','Mechanical coping');
  }
  const glassRoof=new Surfaces(),roofY=1.55;
  // Each slope gets separate panes with narrow structural glazing bars.
  function glassBay(l:number,r:number,front:number,back:number){
    const middle=(l+r)/2;
    for(let j=0;j<8;j++)for(let i=0;i<8;i++){
      const left=l+(r-l)*i/8+.0025,right=l+(r-l)*(i+1)/8-.0025;
      const a=front+(back-front)*j/8+.003,b=front+(back-front)*(j+1)/8-.003;
      const y=(x:number)=>roofY+.055+.090*(1-Math.abs(x-middle)/((r-l)/2));
      glassRoof.quad([left,y(left),a],[left,y(left),b],[right,y(right),b],[right,y(right),a],i<4?'#829696':'#637b7e');
    }
  }
  glassBay(w*.381,w*.614,d*.321,d*.947);
  glassBay(w*.351,w*.381,d*.334,d*.549);glassBay(w*.614,w*.647,d*.334,d*.549);
  glassRoof.build(g,'Cross-shaped atrium glazing');
  for(const [u,v,length,yaw] of [[w/2,z0,x1-x0,Math.PI],[x0,(z0+z1)/2,z1-z0,-Math.PI/2],[x1,(z0+z1)/2,z1-z0,Math.PI/2]]){
    const fg=face(g,u,v,yaw,'Setback office windows'),s=new Surfaces();
    for(let j=0;j<Math.round(length/.19);j++)for(const y of [1.235,1.420]){
      const x=length*((j+.5)/Math.round(length/.19)-.5);
      s.rect(x,y,.116,.112,.004,'#6d7c78');s.rect(x,y,.006,.113,.006,stone);
    }
    s.build(fg,'Upper sash');
  }
  const dolphinShape=new THREE.Shape();
  dolphinShape.moveTo(-.031,-.010);dolphinShape.quadraticCurveTo(-.018,.027,.010,.012);
  dolphinShape.lineTo(.019,.021);dolphinShape.lineTo(.020,.010);dolphinShape.lineTo(.035,.001);
  dolphinShape.lineTo(.022,.001);dolphinShape.quadraticCurveTo(.002,.014,-.020,-.007);
  dolphinShape.lineTo(-.031,-.016);dolphinShape.lineTo(-.027,-.009);dolphinShape.closePath();
  const dolphin=new THREE.ShapeGeometry(dolphinShape,6),enamel=new THREE.MeshStandardMaterial({color:'#788882'});
  for(const [name,fg,len,count] of [
    ['Mission',face(g,w/2,0,Math.PI,'Mission Street lobby elevation'),w,7],
    ['Spear',face(g,0,d/2,-Math.PI/2,'Spear Street lobby elevation'),d,9],
    ['Steuart',face(g,w,d/2,Math.PI/2,'Steuart Street elevation'),d,9]
  ] as const){
    const s=new Surfaces(),span=len*.82,step=span/count;
    s.block(0,.056,len,.112,-.012,.015,blue);
    s.block(0,.823,span+.04,.033,.018,.068,'#829490');
    s.block(0,.852,span+.06,.023,.018,.079,'#bcc3b9');
    for(let j=0;j<=count;j++){
      const x=-span/2+j*step;
      s.block(x,.45,step*.40,.72,-.001,.047,cream);
      s.rect(x,.182,.044,.083,.048,'#a29e8e');
      s.rect(x,.19,.033,.051,.050,'#b9b7a7');
    }
    for(let j=0;j<count;j++){
      const x=step*(j+.5-count/2),ww=step*.58;
      const entry=name==='Mission'?(j===1||j===5):name==='Spear'&&j===1;
      const bottom=entry?.035:.117,top=.722;
      s.rect(x,(bottom+top)/2,ww,top-bottom,.002,glass);
      for(let k=1;k<5;k++)s.rect(x+ww*(k/5-.5),(top+bottom)/2,.007,top-bottom,.008,metal);
      for(let k=1;k<9;k++)s.rect(x,bottom+(top-bottom)*k/9,ww,.005,.008,metal);
      s.rect(x,.444,ww,.028,.009,'#626962');
      s.rect(x,.761,ww,.075,.008,white);s.rect(x,.742,ww,.008,.011,blue);
      for(let k=-1;k<=1;k++){
        const relief=new THREE.Mesh(dolphin,enamel);relief.position.set(x+k*ww*.26,.763,.013);fg.add(relief);
      }
      night(out,fg,x,.57,.009,ww*.70,.155);
      if(entry){
        s.block(x,.253,ww*.95,.065,.008,.044,'#aca89a');
        s.rect(x,.120,ww*.72,.194,.014,'#505e5a');s.rect(x,.114,.007,.191,.019,stone);
        if(name==='Spear'){
          legend(fg,font,'UNITED STATES POST OFFICE',.018,x,.269,.048);
          legend(fg,font,'RINCON ANNEX',.016,x,.246,.048);
        }
      }
    }
    for(let i=0;i<count*2+3;i++){
      const x=len*((i+.5)/(count*2+3)-.5);
      s.rect(x,.954,.078,.140,.019,'#717971');s.rect(x,.953,.064,.128,.021,'#606e68');
      s.rect(x,.954,.065,.005,.023,metal);
    }
    for(const sign of [-1,1]){
      const x=sign*len*.46;s.rect(x,.45,.062,.62,.016,'#74817b');
      for(const k of [-1,0,1])s.rect(x+k*.015,.45,.004,.62,.019,stone);
    }
    s.block(0,1.141,len,.019,-.006,.018,'#c6c7ba');s.build(fg,'Postal piers, casements and entrance relief');
  }
}

// OTJ's dimensioned existing elevations, pp. 49–52, distinguish the brick
// north service block from the three precast elevations. The owner's new
// rooftop framing is represented without treating the restaurant as operating.
// https://media.api.sf.gov/documents/Item_6_Appeal_No._24-022_at_100_Mission_Street_Mission_Spear_Street_Frontages__4gJcuzR.pdf#page=49
// https://presidiobay.com/projects/88-spear-street-san-francisco-office/
// https://www.thespear.com/
function spearBuilding(g:THREE.Group,w:number,d:number,out:Pane[],font:Font){
  const precast='#d1cdc1',rim='#e2ded4',shadow='#b0b3a9',glass='#667a7d',brick='#9b7466';
  const core=d*.205,front=d-core,roof=160*ft,brickTop=(186+4/12)*ft;
  volume(g,w,brickTop,core,w/2,brickTop/2,core/2,brick,'North brick service core');
  volume(g,w-.035,roof-.49,front-.018,w/2,(roof+.49)/2,core+front/2,'#848f8c','Office backing');
  volume(g,w-.128,.535,front-.109,w/2,.2675,core+front/2,'#627675','Inset double-height lobby');
  for(const [label,fg,len] of [
    ['Spear',face(g,w,core+front/2,Math.PI/2,'Spear Street elevation'),front],
    ['Mission',face(g,w/2,d,0,'Mission Street elevation'),w],
    ['West',face(g,0,core+front/2,-Math.PI/2,'West elevation'),front]
  ] as const){
    const s=new Surfaces(),count=20,span=len*.923,step=span/count;
    const paneDepth=.003,outer=.031;
    s.rect(0,(roof+.52)/2,len,roof-.52,.001,'#bfc0b5');
    for(let floor=0;floor<8;floor++){
      const base=(33+floor*14)*ft,top=base+14*ft;
      for(let j=0;j<count;j++){
        const x=(j+.5-count/2)*step;
        s.rect(x,base+4.9*ft,step*.69,7.3*ft,paneDepth,glass);
        s.block(x,base+1.21*ft,step*.73,1.5*ft,.003,.020,precast);
        s.block(x-step*.46,(base+top)/2,step*.16,top-base,.002,outer,rim);
        s.block(x,base+11.4*ft,step*.81,3.48*ft,.003,.021,precast);
        s.rect(x,base+11.4*ft,step*.63,2.46*ft,.022,'#bbbbb0');
        s.rect(x,base+11.6*ft,step*.56,2.04*ft,.023,'#c9c7bb');
        if((floor+j)%3===0)night(out,fg,x,base+4.9*ft,.005,step*.53,5.9*ft);
      }
    }
    s.block(0,.546,len,.093,.002,outer,precast);
    for(const sign of [-1,1])s.block(sign*len*.48,(roof+.545)/2,len*.04,roof-.545,.002,outer,rim);
    for(let j=0;j<10;j++){
      const x=(j-4.5)*2*step;
      s.rect(x,150*ft,step*1.72,7.6*ft,.004,glass);
      s.rect(x,150*ft,.006,7.6*ft,.008,shadow);
      s.block(x,157*ft,step*1.74,5*ft,.005,.023,precast);
      // Blade projects at its foot and recedes to the cap.
      const left=x-step,right=left+.014;
      s.quad([left,145*ft,.066],[right,145*ft,.066],[right,roof,.021],[left,roof,.021],rim);
      s.quad([right,145*ft,.066],[right,145*ft,.004],[right,roof,.004],[right,roof,.021],shadow);
    }
    for(let j=0;j<4;j++){
      const x=(j-1.5)*len*.234,ww=len*.222;
      s.rect(x,.265,ww,.447,-.034,'#697c7b');
      for(const k of [-1,0,1])s.rect(x+k*ww*.25,.265,.009,.443,-.022,'#525b57');
      s.rect(x,.275,ww,.016,-.019,'#4d5754');
      s.block(x-ww/2,.26,.035,.52,-.04,.009,'#505651');
      if((label==='Spear'&&j===3)||(label==='Mission'&&j===1)){
        s.rect(x,.115,ww*.7,.181,-.015,'#445758');
        s.rect(x,.117,.007,.18,-.009,shadow);
        s.block(x,.221,ww*.86,.025,-.024,.061,'#686e67');
        legend(fg,font,label==='Spear'?'88 SPEAR':'100 MISSION',.017,x,.227,.064);
      }
    }
    s.build(fg,'Recessed glazing and coffered precast');
  }
  for(const [u,yaw] of [[w,Math.PI/2],[0,-Math.PI/2]]){
    const fg=face(g,u,core/2,yaw,'Brick stair elevation'),s=new Surfaces();
    s.rect(0,brickTop/2,.058,brickTop,.004,'#c2ad98');
    for(let floor=0;floor<13;floor++)s.rect(0,.21+floor*.24,.046,.072,.008,'#6b746f');
    s.build(fg,'Stair slots');
  }
  volume(g,w*.72,.18,front*.7,w*.50,roof+.09,core+front*.49,'#919992','Setback mechanical base');
  // Steel of the two-story rooftop addition was already erected during the 2026 renovation.
  for(const [y,width,depth] of [[roof+.21,w*.79,front*.72],[roof+.47,w*.68,front*.61],[roof+.705,w*.68,front*.61]]){
    volume(g,width,.021,depth,w*.49,y,core+front*.48,'#716e61','Rooftop framing');
    if(y<roof+.4)continue;
    for(const dx of [-.47,0,.47])for(const dv of [-.46,.46]){
      volume(g,.014,.235,.014,w*.49+dx*width,y-.125,core+front*.48+dv*depth,'#777b70','Rooftop column');
    }
  }
}

export function addMarketHistoricFrontage(b:Building,root:THREE.Group,windows:Pane[],font:Font){
  if(b.id!==annex&&b.id!==spear)return false;
  const isAnnex=b.id===annex;
  const a=b.p[isAnnex?14:3],end=b.p[0],back=b.p[isAnnex?13:2];
  const w=Math.hypot(end[0]-a[0],end[1]-a[1]),d=Math.hypot(back[0]-a[0],back[1]-a[1]);
  const g=face(root,a[0],a[1],Math.atan2(a[1]-end[1],end[0]-a[0]),isAnnex?'Rincon Annex':'The Spear');
  if(isAnnex)rincon(g,w,d,b.p,windows,font);else spearBuilding(g,w,d,windows,font);
  return true;
}
