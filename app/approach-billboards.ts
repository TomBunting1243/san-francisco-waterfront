import * as THREE from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import cocaCola from '../public/data/approach-coke.json' with {type:'json'};
import {bayReliefPosition} from './bay-relief.ts';
import {approachGround,type ApproachMesh} from './approach-road.ts';

const feet=.3048*.06;
export const approachBillboards=[
  {name:'Yahoo! at 451 Sixth Street',latitude:37.7767809,longitude:-122.4032385,facing:201,width:65*feet,height:20*feet,aboveGrade:1.71},
  {name:'Coca-Cola at 701 Bryant Street',latitude:37.777545,longitude:-122.400403,facing:212,width:70*feet,height:30*feet,aboveGrade:112*feet-15*feet},
  {name:'Anthropic at the I-80 Fourth Street bulletin',latitude:37.7795941,longitude:-122.400674,facing:200,width:(68+2/12)*feet,height:25*feet,aboveGrade:2.17},
  {name:'SpaceX at the Bryant and Seventh bulletin',latitude:37.774504,longitude:-122.404293,facing:270,width:48*feet,height:14*feet,aboveGrade:.855},
] as const;
export const anthropicCopy='Building an equitable future, one trillion dollar IPO at a time';
export const spaceXCopy='Fuck you';
const paintedSteel='#71817d', darkSteel='#455952', butter='#f2d789';

// Contributions to the final night palette, after the scene has been shaded.
// The fixtures and the lettering can shine without lighting the support rack.
function nightLight(mesh:THREE.Mesh,r:number,g:number,b:number) {
  mesh.userData.signLight=[r,g,b];
  return mesh;
}

function scriptLogo(width:number,height:number){
  const positions=cocaCola.points.flatMap(([x,y])=>[x*width,y*height,0]);
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setIndex(cocaCola.index);
  g.computeVertexNormals();
  return g;
}

export function buildApproachBillboards(mesh:ApproachMesh,root:THREE.Group,font:Font){
  const billboards=new THREE.Group();
  billboards.name='SoMa freeway billboards';
  root.add(billboards);
  const unit=new THREE.BoxGeometry(1,1,1);
  const bulb=new THREE.SphereGeometry(.007,5,4);
  for(const [index,site] of approachBillboards.entries()){
    const [x,z]=bayReliefPosition(site.longitude,site.latitude);
    const group=new THREE.Group(),w=site.width,h=site.height;
    const grade=approachGround(x,z);
    group.name=site.name;group.position.set(x,grade+site.aboveGrade,z);
    group.rotation.y=Math.atan2(.04836012986,.03552029735)-THREE.MathUtils.degToRad(site.facing);
    group.userData.location={latitude:site.latitude,longitude:site.longitude};
    billboards.add(group);
    function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent=group){
      const part=mesh(unit,color,x,y,z,parent);part.scale.set(w,h,d);return part;
    }
    function tube(a:number[],b:number[],width:number,depth:number,color:string,parent=group){
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
      const delta=end.clone().sub(start),mid=start.lerp(end,.5);
      const m=box(width,delta.length(),depth,mid.x,mid.y,mid.z,color,parent);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    }
    function text(text:string,width:number,height:number,x:number,y:number,z:number,color:string,parent=group,{italic=0,rotate=0}={}){
      const g=new TextGeometry(text,{font,size:1,depth:.012,curveSegments:3,bevelEnabled:false});
      const p=g.getAttribute('position');
      for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+p.getY(i)*italic);
      g.computeBoundingBox();
      const size=g.boundingBox!.getSize(new THREE.Vector3()),middle=g.boundingBox!.getCenter(new THREE.Vector3());
      g.translate(-middle.x,-middle.y,0);g.scale(Math.min(width/size.x,height/size.y*1.32),height/size.y,.22);
      const m=mesh(g,color,x,y,z,parent);m.name=text;m.rotation.z=rotate;
      return m;
    }
    function panel(shape:THREE.Shape,color:string,z:number,depth=.011){
      return mesh(new THREE.ExtrudeGeometry(shape,{bevelEnabled:false,depth,curveSegments:7}),color,0,0,z,group);
    }
    const baseY=(index===1?.77:index===0?.30:index===2?.63:.57)-site.aboveGrade;
    const bottom=-h/2;
    const scaffold=index===1?'#c4c9b9':paintedSteel;
    // Maintenance catwalk, lamp outriggers and the tapered steel rack visible behind the panels.
    const back=index===1?.35:.22;
    box(w*1.06,.039,back,-.01,bottom-.054,-back*.32,darkSteel);
    for(const side of [-1,1]){
      for(const fraction of index===1?[.16,.32,.47]:[.29,.45]){
        const anchor=w*side*fraction;
        const foot=anchor*1.06,top=anchor*.98;
        for(const z of [-back,.016])tube([foot,baseY,z*1.25],[top,bottom+.035,z],.026,.022,scaffold);
        tube([foot,baseY,-back*1.25],[top,bottom+.035,.016],.015,.016,scaffold);
        tube([foot,baseY,.016],[top,bottom+.035,-back],.015,.015,scaffold);
      }
      for(const u of [.26,.54,.79])box(w*.95,.015,.018,0,THREE.MathUtils.lerp(baseY,bottom,u),side>0?.013:-back,scaffold);
      tube([side*w*.44,baseY,-back],[side*w*.07,bottom,-back],.017,.017,scaffold);
    }
    if(index===0){
      function boomerang(inset=0){
        const s=new THREE.Shape(),a=w/2-inset,b=h/2-inset;
        s.moveTo(-a*.94,-b*.60);
        s.bezierCurveTo(-a*.92,-b*.10,-a*1.15,b*.38,-a*.88,b*.86);
        s.bezierCurveTo(-a*.71,b*1.22,-a*.33,b*.96,0,b*.86);
        s.bezierCurveTo(a*.34,b*.79,a*.58,b*1.07,a*.82,b*.86);
        s.bezierCurveTo(a*1.08,b*.70,a*1.02,b*.26,a*.96,-b*.10);
        s.bezierCurveTo(a*.94,-b*.40,a*1.06,-b*.80,a*.78,-b*.92);
        s.bezierCurveTo(a*.48,-b*1.10,a*.24,-b*.69,-a*.08,-b*.70);
        s.bezierCurveTo(-a*.45,-b*.70,-a*.71,-b*.99,-a*.94,-b*.60);s.closePath();
        return s;
      }
      box(w,h,.035,0,0,-.022,'#516567');
      const rim=boomerang();
      panel(rim,'#ceaa42',.000);
      panel(boomerang(.018),'#6c497a',.012);
      for(const p of rim.getSpacedPoints(67)){
        nightLight(mesh(bulb,butter,p.x*.975,p.y*.948,.020,group),.90,.72,.34);
      }
      const logo='YAHOO!';
      const sizes=[.171,.123,.127,.133,.133,.136];
      for(const [i,character] of [...logo].entries()){
        nightLight(text(character,sizes[i]*1.08,h*(i===0?.342:.275),(i-2.45)*w*.132,h*(i===1?.13:.16),.026,'#f4a297',group,{rotate:.04-i*.012}),.70,.35,.26);
      }
      nightLight(text('A nice place to stay',w*.42,h*.077,w*.205,-h*.112,.027,'#e4cc6d',group,{italic:.25}),.39,.28,.08);
      nightLight(text('on the Internet.',w*.34,h*.078,w*.232,-h*.232,.027,'#e4cc6d',group,{italic:.25}),.39,.28,.08);
      const ribbon=new THREE.Shape();
      ribbon.moveTo(-w*.242,-h*.555);
      ribbon.lineTo(-w*.462,-h*.555);
      ribbon.quadraticCurveTo(-w*.513,-h*.555,-w*.475,-h*.445);
      ribbon.lineTo(-w*.407,-h*.274);ribbon.lineTo(-w*.462,-h*.234);ribbon.lineTo(-w*.332,-h*.197);
      ribbon.lineTo(-w*.318,-h*.36);ribbon.lineTo(-w*.352,-h*.327);ribbon.lineTo(-w*.402,-h*.431);
      ribbon.lineTo(-w*.242,-h*.431);ribbon.closePath();
      nightLight(panel(ribbon,'#508859',.033),.03,.22,.055);
      for(const p of ribbon.getSpacedPoints(27)){
        nightLight(mesh(bulb,'#afd87f',THREE.MathUtils.lerp(-w*.386,p.x,.94),THREE.MathUtils.lerp(-h*.433,p.y,.94),.046,group),.22,.81,.16);
      }
      box(w*.371,h*.26,.031,-w*.124,-h*.485,.050,'#42746e');
      nightLight(box(w*.351,h*.218,.013,-w*.124,-h*.485,.071,'#eee2bd'),.37,.29,.18);
      text('HEY SF, SUMMER',w*.323,h*.062,-w*.124,-h*.444,.080,'#3a4544');
      text('LOOKS GOOD ON YOU!',w*.33,h*.065,-w*.124,-h*.527,.081,'#3a4544');
      const medallion=new THREE.Shape().ellipse(0,0,w*.093,h*.058,0,Math.PI*2,false,0);
      const aqua=panel(medallion,'#448078',.023);aqua.position.set(-w*.15,h*.474,.023);
      nightLight(text('VACANCY',w*.149,h*.066,-w*.15,h*.474,.038,'#ee856e'),.85,.20,.12);
      const stemX=-w*.15,starY=h*.71;
      tube([stemX,h*.50,.019],[stemX,starY,.019],.015,.015,butter);
      mesh(new THREE.SphereGeometry(.023,8,5),butter,stemX,starY,.019,group);
      for(let i=0;i<15;i++){
        const a=i*Math.PI*2/15,len=i%3===0?.074:.054;
        const end=[stemX+Math.cos(a)*len,starY+Math.sin(a)*len,.023+(i%3)*.014];
        tube([stemX,starY,.019],end,.008,.008,'#48768a');
        nightLight(mesh(bulb,'#ec8877',...end as [number,number,number],group),.82,.20,.11);
      }
    }else if(index===1){
      box(w,h,.066,0,0,0,'#dfd1ae');
      for(const side of [-1,1]){
        const face=new THREE.Group();face.rotation.y=side<0?Math.PI:0;group.add(face);
        nightLight(box(w-.030,h-.030,.013,0,0,.037,'#ab5050',face),.43,.065,.054);
        for(let u=-w*.468;u<w*.47;u+=.027)nightLight(box(.004,h-.038,.008,u,0,.044,'#a34849',face),.33,.043,.041);
        nightLight(mesh(scriptLogo(w*.929,h*.67),'#f6e9cc',0,-h*.065,.054,face),.87,.81,.68).name='Coca-Cola script';
        nightLight(text('Enjoy',w*.18,h*.137,-w*.10,h*.324,.062,'#f5e5c6',face,{italic:.28}),.76,.69,.56);
      }
    }else{
      const warm=index===2;
      const ink=warm?'#534239':'#f1e5ca';
      box(w+.012,h+.010,.049,0,0,0,darkSteel);
      const face=box(w-.016,h-.016,.012,0,0,.029,warm?'#ded0af':'#344c5e');
      if(warm)nightLight(face,.29,.244,.17);
      else nightLight(face,.075,.105,.14);
      for(const frac of [-.38,-.12,.14,.40]){
        tube([frac*w,bottom-.085,0],[frac*w,bottom-.085,.12],.014,.014,paintedSteel);
        nightLight(box(.06,.018,.029,frac*w,bottom-.073,.113,butter),.46,.35,.20);
      }
      if(warm){
        text('Anthropic',w*.42,h*.16,-w*.239,h*.287,.038,'#805a4a');
        const lines=anthropicCopy.split(', ');
        text(lines[0]+',',w*.89,h*.155,0,h*.040,.039,ink);
        text(lines[1],w*.86,h*.155,0,-h*.204,.039,ink);
      }else{
        nightLight(text('SpaceX',w*.67,h*.205,0,h*.222,.037,ink,group,{italic:.10}),.24,.22,.17);
        nightLight(text(spaceXCopy,w*.78,h*.35,0,-h*.141,.040,ink),.27,.25,.20);
      }
    }
  }
  return billboards;
}
