import {lightOpeningTrim} from './authored-window-spill.ts';
import {hillsPalomino} from './hills-plaza.ts';
import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {basinOutline,fountainCourses,observationDecks,planPoint,screenRuns,tubeWidth} from './vaillancourt-plan.ts';
import {footprintGeometry} from './sf-map.ts';
import {createFountainWater} from './fountain-flow.ts';

type XYZ=[number,number,number];

// Register the two 1969 concrete screens to their three endpoints in the 2024 SF ortho.
// Retain the drawing’s 4 ft 6 in module and the remembered working fountain.
const fountainSite=[5.26,.118,-8.22] as const;
const fountainYaw=.171;
const fountainBasin=basinOutline;
const poolOutline=fountainBasin.map(([x,z])=>[x*.907,z*.907]);
export const fountainPavingCut=fountainBasin.map(([x,z])=>[
  fountainSite[0]+x*Math.cos(fountainYaw)+z*Math.sin(fountainYaw),
  fountainSite[2]-x*Math.sin(fountainYaw)+z*Math.cos(fountainYaw),
]);
export function vaillancourtPoolContains(x:number,z:number){
  const dx=x-fountainSite[0],dz=z-fountainSite[2];
  const fx=dx*Math.cos(fountainYaw)-dz*Math.sin(fountainYaw), fz=dx*Math.sin(fountainYaw)+dz*Math.cos(fountainYaw);
  let inside=false;
  for(let i=0,j=poolOutline.length-1;i<poolOutline.length;j=i++){
    const [a,b]=poolOutline[i],[qa,qb]=poolOutline[j];
    if((b>fz)!==(qb>fz)&&fx<(qa-a)*(fz-b)/(qb-b)+a)inside=!inside;
  }
  return inside;
}

export function createRememberedWaterfront(font:Font,waterTime={value:0},nightInk={value:0}){
  const root=new THREE.Group();
  root.name='Remembered waterfront';
  const mats=new Map<string,THREE.MeshStandardMaterial>();
  const cream='#f0dfb7', metal='#637979', dark='#425a58', glass='#4f757a', timber='#9c8769';
  function mesh(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent:THREE.Group){
    let mat=mats.get(c);
    if(!mat){mat=new THREE.MeshStandardMaterial({color:c,roughness:.91});mats.set(c,mat);}
    const m=new THREE.Mesh(g,mat);
    m.position.set(x,y,z);
    m.castShadow=m.receiveShadow=true;
    parent.add(m);
    return m;
  }
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent:THREE.Group)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  function group(name:string,at:XYZ,parent=root){
    const g=new THREE.Group();g.name=name;g.position.set(...at);parent.add(g);return g;
  }
  function beam(a:XYZ,b:XYZ,w:number,color:string,parent:THREE.Group){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),mid=start.add(end).multiplyScalar(.5);
    const m=box(w,w,delta.length(),mid.x,mid.y,mid.z,color,parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());
  }
  function sign(label:string,px:number,y:number,z:number,width:number,color:string,parent:THREE.Group,angle=0){
    const g=new TextGeometry(label,{font,size:px,depth:.005,curveSegments:3});
    g.computeBoundingBox();
    const {min,max}=g.boundingBox!;
    g.translate(-(max.x+min.x)/2,0,0);
    const m=mesh(g,color,0,0,0,parent);
    m.position.set(0,y,z);m.rotation.y=angle;m.scale.x=Math.min(1,width/(max.x-min.x));m.name=label;
    return m;
  }
  function rail(ax:number,az:number,bx:number,bz:number,base:number,parent:THREE.Group){
    const d=Math.hypot(bx-ax,bz-az),n=Math.ceil(d/.19);
    for(const y of [.09,.18])beam([ax,base+y,az],[bx,base+y,bz],.016,metal,parent);
    for(let i=0;i<=n;i++)box(.017,.18,.017,ax+(bx-ax)*i/n,base+.09,az+(bz-az)*i/n,metal,parent);
  }
  function outdoorTable(x:number,z:number,y:number,color:string,parent:THREE.Group,umbrella=true){
    mesh(new THREE.CylinderGeometry(.103,.103,.018,12),'#b59c78',x,y+.176,z,parent);
    mesh(new THREE.CylinderGeometry(.014,.025,.168,7),metal,x,y+.084,z,parent);
    for(const dx of [-.141,.141]){
      box(.057,.018,.079,x+dx,y+.105,z,metal,parent);
      box(.018,.078,.068,x+dx*1.18,y+.133,z,metal,parent);
      for(const dz of [-.024,.024])box(.010,.104,.010,x+dx,y+.052,z+dz,metal,parent);
    }
    if(umbrella){
      mesh(new THREE.CylinderGeometry(.009,.009,.406,7),timber,x,y+.203,z,parent);
      mesh(new THREE.ConeGeometry(.172,.061,8),color,x,y+.382,z,parent);
    }
  }
  function storefront(x:number,z:number,y:number,w:number,h:number,frame:string,parent:THREE.Group,level:number){
    box(w+.031,h+.033,.032,x,y,z,frame,parent);
    const glazing=box(w,h,.025,x,y,z+.021,glass,parent);
    const firstTrim=parent.children.length;
    for(const side of [-1,0,1])box(.012,h,.014,x+side*w*.305,y,z+.039,frame,parent);
    box(w,.012,.017,x,y+h*.25,z+.039,frame,parent);
    lightOpeningTrim(parent,parent.children.slice(firstTrim),x,y,z+.0335,w,h,level);
    return glazing;
  }

  const fountain=group('Vaillancourt Fountain',[...fountainSite]);
  fountain.rotation.y=fountainYaw;
  const cement=['#b9afa2','#b2a99c','#c1b8a9','#bdb3a4'];
  const shadow='#514f44', mortar='#a39e90', stairMetal='#686d61';
  const basinHeight=-.013;
  const pool=mesh(footprintGeometry(poolOutline,.054),'#60928d',0,basinHeight-.054,0,fountain);
  pool.name='Sunken fountain pool';

  // Continuous mitred treads and risers form the basin edge. Each corner shares
  // its exact plan vertex with the next side, including the sloping east bank.
  const bankLevels=[[1,.022],[.974,.012],[.941,.001],[.907,basinHeight]];
  for(let i=1;i<bankLevels.length;i++){
    const [outside,upper]=bankLevels[i-1],[inside,lower]=bankLevels[i];
    const positions:number[]=[];
    const triangle=(a:XYZ,b:XYZ,c:XYZ)=>positions.push(...a,...b,...c);
    for(let j=0;j<fountainBasin.length;j++){
      const a=fountainBasin[j],b=fountainBasin[(j+1)%fountainBasin.length];
      const at=(p:number[],scale:number,y:number):XYZ=>[p[0]*scale,y,p[1]*scale];
      const outerA=at(a,outside,upper),outerB=at(b,outside,upper);
      const innerA=at(a,inside,upper),innerB=at(b,inside,upper);
      const lowA=at(a,inside,lower),lowB=at(b,inside,lower);
      triangle(outerA,innerB,outerB);triangle(outerA,innerA,innerB);
      triangle(innerA,lowB,innerB);triangle(innerA,lowA,lowB);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.computeVertexNormals();mesh(g,cement[i%cement.length],0,0,0,fountain).name='Mitred fountain basin coping';
  }
  // Pedestals thread between the columns and the two galleries, from side to side.
  const padTrace=[[491,655],[519,623],[545,593],[578,566],[602,535],[615,499],
    [637,469],[661,440],[690,420],[721,396],[750,366],[775,336],[791,302],
    [822,280],[855,266],[887,247],[916,223]];
  const pads:XYZ[]=padTrace.map(([u,v])=>{const [x,z]=planPoint(u,v);return [x,.030,z];});
  pads.forEach(([x,y,z],i)=>{
    box(.055,.074,.055,x,y-.058,z,cement[1],fountain);
    const pad=box(.081,.019,.073,x,y,z,cement[i%cement.length],fountain);
    pad.name='Concrete lily pad';pad.rotation.y=.12+(i%4-1.5)*.20;
  });

  type DuctSection={t:THREE.Vector3;u:THREE.Vector3;v:THREE.Vector3;length:number};
  const sectionsByColor=new Map<string,{positions:number[];pigment:number[]}>();
  const outlets:Parameters<typeof createFountainWater>[0]=[];
  function quad(color:string,a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,stain?:number[][]){
    const section=sectionsByColor.get(color)??{positions:[],pigment:[]};
    const corners=[a,b,c,d];
    for(const index of [0,1,2,0,2,3]){
      section.positions.push(...corners[index].toArray());
      section.pigment.push(...(stain?.[index]??[1,1,1]));
    }
    sectionsByColor.set(color,section);
  }
  function sample(x:number,y:number,z:number){
    const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);
    const t=(n:number)=>n*n*(3-2*n);
    const f=t(x-X),g=t(y-Y),h=t(z-Z);
    function layer(dz:number){
      const seed=(ax:number,ay:number)=>{
        let n=Math.imul(X+ax,195049)^Math.imul(Y+ay,97433)^Math.imul(Z+dz,209759);
        n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967295;
      };
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(seed(0,0),seed(1,0),f),
        THREE.MathUtils.lerp(seed(0,1),seed(1,1),f),g);
    }
    return THREE.MathUtils.lerp(layer(0),layer(1),h);
  }
  function concrete(color:string,a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,wetLip=false){
    const rows=Math.max(3,Math.min(7,Math.round(a.distanceTo(d)/.036))),columns=5;
    const points:THREE.Vector3[]=[],paint:number[][]=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
      const u=i/columns,v=j/rows;
      const p=a.clone().lerp(b,u).lerp(d.clone().lerp(c,u),v);points.push(p);
      const cloud=sample(p.x*13+32,p.y*12-17,p.z*13);
      const mineral=Math.max(0,sample(p.x*41,p.y*5.6,p.z*41)-.47)*.33;
      const gravel=sample(p.x*96+81,p.y*104+2,p.z*95);
      const edge=THREE.MathUtils.smoothstep(Math.abs(u-.5),.36,.50);
      const damp=wetLip?THREE.MathUtils.smoothstep(v,.58,1)*(.11+cloud*.07):0;
      const tone=.93+cloud*.13+mineral+(gravel-.5)*(.10+edge*.12)-damp;
      paint.push([tone+mineral*.053,tone+mineral*.079,tone-damp*.065]);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
      const start=j*(columns+1)+i,next=start+columns+1;
      const indices=[start,start+1,next+1,next];
      quad(color,points[start],points[start+1],points[next+1],points[next],indices.map(n=>paint[n]));
    }
  }
  let moduleCount=0;
  function duct(path:XYZ[],width:number,salt:number,outlet=true){
    const p=path.map(v=>new THREE.Vector3(...v));
    const sections:DuctSection[]=[];
    const transport=new THREE.Quaternion();
    let last:DuctSection|undefined;
    for(let i=1;i<p.length;i++){
      const axis=p[i].clone().sub(p[i-1]);
      const length=axis.length(),t=axis.divideScalar(length);
      const guide=last?last.u.clone().applyQuaternion(transport.setFromUnitVectors(last.t,t)):new THREE.Vector3(Math.cos(salt),0,Math.sin(salt));
      const u=guide.addScaledVector(t,-guide.dot(t)).normalize();
      const v=t.clone().cross(u).normalize();
      last={t,u,v,length};sections.push(last);
    }
    const plane=p.map((_,i)=>i===0?sections[0].t:i===p.length-1?sections[i-1].t:sections[i-1].t.clone().add(sections[i].t).normalize());
    const inside=width-.029;
    function ring(frame:DuctSection,position:THREE.Vector3,normal:THREE.Vector3,radius:number){
      return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>{
        const radial=frame.u.clone().multiplyScalar(u*radius).addScaledVector(frame.v,v*radius);
        return position.clone().add(radial).addScaledVector(frame.t,-radial.dot(normal)/frame.t.dot(normal));
      });
    }
    for(let i=0;i<sections.length;i++){
      const frame=sections[i];
      const parts=Math.max(1,Math.round(frame.length/.191));
      moduleCount+=parts;
      // Each full-width face is planar along its own axis. Both sides of a joint meet on its bisector.
      for(let j=0;j<parts;j++){
        const start=p[i].clone().lerp(p[i+1],j/parts),end=p[i].clone().lerp(p[i+1],(j+1)/parts);
        const nA=j===0?plane[i]:frame.t,nB=j===parts-1?plane[i+1]:frame.t;
        const a=ring(frame,start,nA,width/2), b=ring(frame,end.clone().addScaledVector(frame.t,-.0022),nB,width/2);
        const seam=ring(frame,end,nB,width/2-.0014);
        const ai=ring(frame,start,nA,inside/2),bi=ring(frame,end,nB,inside/2);
        for(let side=0;side<4;side++){
          const next=(side+1)%4,color=cement[(Math.round(salt*10)+i*2+j+side)%cement.length];
          concrete(color,a[side],a[next],b[next],b[side],outlet&&i===sections.length-1&&j===parts-1);
          quad(mortar,b[side],b[next],seam[next],seam[side]);
          quad(shadow,ai[side],bi[side],bi[next],ai[next]);
        }
      }
    }
    const end=p.at(-1)!,frame=sections.at(-1)!;
    const outer=ring(frame,end,frame.t,width/2-.0014), inner=ring(frame,end,frame.t,inside/2);
    for(let i=0;i<4;i++){
      const j=(i+1)%4;
      concrete(cement[2],outer[i],outer[j],inner[j],inner[i],outlet);
    }
    // The Stackpole details show a dark collar under each rounded bronze corner cap.
    for(let j=0;j<4;j++){
      const shoulder=outer[j].clone().lerp(inner[j],.37);
      const capAt=shoulder.clone().addScaledVector(frame.t,.0039);
      const collar=mesh(new THREE.CylinderGeometry(.0059,.0061,.0028,8),'#645d50',shoulder.x,shoulder.y,shoulder.z,fountain);
      const cap=mesh(new THREE.CylinderGeometry(.0036,.0048,.0062,8),'#867666',capAt.x,capAt.y,capAt.z,fountain);
      for(const bolt of [collar,cap])bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),frame.t);
    }
    if(!outlet)return;
    const mouth=ring(frame,end,frame.t,inside/2);
    const corners=mouth.sort((a,b)=>a.y-b.y).slice(0,2);
    const lip=corners[0].clone().lerp(corners[1],.5).addScaledVector(frame.t,.007);
    const across=corners[1].clone().sub(corners[0]);across.y=0;
    if(across.lengthSq()<.0003)across.set(frame.t.z,0,-frame.t.x);
    across.normalize();
    const travel=new THREE.Vector3(frame.t.x,0,frame.t.z).normalize();
    outlets.push({lip,across,travel,width:inside*.42});
  }
  fountainCourses.forEach((course,i)=>{
    const path=course.path, dx=path.at(-1)![0]-path[0][0],dz=path.at(-1)![2]-path[0][2];
    // The fixed cross axis of each initial column follows the bearing of its arm.
    const angle=Math.atan2(dz,dx)+Math.PI/2;
    duct(path,tubeWidth,angle+Math.PI*2*(i+1),course.fall);
  });
  for(const [c,{positions,pigment}] of sectionsByColor){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.computeVertexNormals();
    const name=c===shadow?'Hollow core concrete ducts':c===mortar?'Precast junctions':'Architectural cast concrete';
    const panel=mesh(geometry,c,0,0,0,fountain);panel.name=name;
    if(name==='Architectural cast concrete'){
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(pigment,3));
      geometry.userData.paintVertices=true;
      panel.material=panel.material.clone();panel.material.vertexColors=true;
    }
  }
  fountain.add(createFountainWater(outlets,poolOutline,basinHeight,waterTime,nightInk));
  fountain.userData.precastSections=moduleCount;

  // Hollow columns form a continuous bent screen along the north and east banks.
  for(const [start,end,count] of screenRuns){
    const [ax,az]=planPoint(start[0],start[1]),[bx,bz]=planPoint(end[0],end[1]);
    const yaw=Math.atan2(bx-ax,bz-az),length=Math.hypot(bx-ax,bz-az)/count;
    for(let i=0;i<count;i++){
      const t=(i+.5)/count, x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      const h=.234+(i%4)*.006;
      const post=group('Precast screen column',[x,0,z],fountain);post.rotation.y=yaw;
      const wall=.012, d=length-.002,w=tubeWidth;
      for(const side of [-1,1]){
        box(wall,h,d,side*(w-wall)/2,h/2,0,cement[(i+1)%4],post);
        box(w-2*wall,h,wall,0,h/2,side*(d-wall)/2,cement[i%4],post);
      }
      box(w-wall,.003,d-wall,0,h-.034,0,shadow,post);
    }
  }
  for(const gallery of observationDecks){
    const [x,z]=planPoint(...gallery.start as [number,number]);
    const [bx,bz]=planPoint(...gallery.end as [number,number]);
    const len=Math.hypot(bx-x,bz-z), g=group('Fountain overlook',[(x+bx)/2,0,(z+bz)/2],fountain);
    g.rotation.y=Math.atan2(bx-x,bz-z);
    box(.103,.025,len,0,.241,0,cement[2],g);
    for(const side of [-1,1]){
      box(.006,.009,len,side*.052,.316,0,stairMetal,g);
      for(let i=0;i<=12;i++)box(.005,.069,.005,side*.052,.284,len*(i/12-.5),stairMetal,g);
    }
    const steps=group('Overlook access stair',[0,.022,len/2+.342],g);
    for(let i=0;i<14;i++){
      const y=i*.0172, z=-i*.0262;
      box(.100,.008,.027,0,y,z,'#858879',steps);
      if(i%3===0)for(const x of [-.052,.052])box(.005,.061,.005,x,y+.034,z,stairMetal,steps);
    }
    for(const x of [-.052,.052]){
      beam([x,-.004,0],[x,.220,-.342],.009,stairMetal,steps);
      beam([x,.067,0],[x,.291,-.342],.006,stairMetal,steps);
    }
  }
  // Pier 2's dining room occupies the open slot between the agriculture building and the ferry apron.
  // Its shortened service end leaves walkable connections to both adjacent gates.
  const sinbads=group("Sinbad's",[-9.67,.075,2.64]);
  const blue='#87aeb5', harborBlue='#719ca8', blueTrim='#b9d0ca', rustyRed='#bc623e';
  function sinbadWordmark(size:number,x:number,y:number,z:number,width:number,parent:THREE.Group){
    const backing=sign("Sinbad's",size,y,z,width,'#3c5556',parent);
    backing.position.x=x;backing.scale.z=2.4;backing.name='Dark sign returns';
    const face=sign("Sinbad's",size,y,z+.012,width,'#f2db9c',parent);
    face.position.x=x;face.name="SINBAD'S";
  }
  box(2.04,.15,1.88,0,-.072,.18,timber,sinbads);
  for(const x of [-.91,.91])for(const z of [-.60,.17,1.07]){
    box(.079,.91,.086,x,-.45,z,'#8a7e62',sinbads);
    box(.14,.09,.15,x,-.09,z,timber,sinbads);
  }
  for(let x=-.96;x<.99;x+=.079)box(.009,.008,1.82,x,.007,.18,'#ad9a76',sinbads);
  box(1.84,.52,1.13,0,.26,-.144,blue,sinbads);
  box(1.90,.068,1.18,0,.534,-.144,blueTrim,sinbads);
  box(1.83,.481,.019,0,.26,.428,harborBlue,sinbads);
  for(let x=-.875;x<.9;x+=.064){
    box(.007,.485,.012,x,.266,-.713,'#76a1a9',sinbads);
    box(.006,.482,.009,x,.268,.440,'#69919e',sinbads);
  }
  const blueRoof=group('Shallow pitched roof',[0,.563,-.135],sinbads);
  const endCap=new THREE.Shape();
  endCap.moveTo(-.604,0);endCap.lineTo(0,.121);endCap.lineTo(.604,0);endCap.closePath();
  const roof=mesh(new THREE.ExtrudeGeometry(endCap,{depth:1.91,bevelEnabled:false}),'#7e8984',-.955,0,0,blueRoof);
  roof.rotation.y=Math.PI/2;
  for(let x=-.91;x<=.91;x+=.14){
    beam([x,0,-.612],[x,.125,0],.011,'#758988',blueRoof);
    beam([x,.125,0],[x,0,.612],.011,'#7d908e',blueRoof);
  }
  const townSide=group('Street entry',[0,0,-.714],sinbads);
  townSide.rotation.y=Math.PI;
  // Hafalia's 2015 photographs document the occupied dining room and bar.
  // Model dim window spill onto the lateral passenger walk beside Pier 2.
  for(const [x,w,h] of [[-.67,.33,.284],[.13,.44,.265]]){
    const pane=storefront(x,0,.279,w,h,blueTrim,townSide,.36);
    pane.userData.signLight=[.36,.24,.13];
    pane.userData.ferryWalkPool={radius:1.34,strength:.69};
  }
  box(.222,.423,.033,.63,.228,.022,dark,townSide);
  box(.173,.239,.016,.63,.305,.042,'#70949b',townSide);
  sinbadWordmark(.174,0,.393,.022,1.25,townSide);
  const open=sign('OPEN',.050,.248,.052,.213,'#e67555',townSide);
  open.position.x=-.67;open.userData.signLight=[.74,.22,.12];
  box(.156,.185,.025,-.34,.121,.045,'#cbb890',townSide).rotation.x=-.12;
  box(.46,.06,.17,.58,.022,.109,'#bdb39d',townSide);
  // The 2013 entrance portrait places a life-size figure in a glazed case
  // beside the doorway. Keep the landing and the door swing clear.
  const cabinet=group('Sinbad the Sailor entrance display',[.415,.052,.12],townSide);
  cabinet.rotation.y=-.46;
  box(.077,.009,.054,0,.0045,0,'#73553e',cabinet);
  box(.077,.006,.054,0,.140,0,'#876b50',cabinet);
  box(.072,.130,.002,0,.072,-.024,'#493e34',cabinet);
  for(const x of [-.036,.036])for(const z of [-.024,.024])box(.0024,.132,.0024,x,.074,z,'#b59467',cabinet);
  const sailor=group('Sinbad the Sailor',[0,.009,0],cabinet);
  function figurePart(x:number,y:number,z:number,w:number,h:number,d:number,c:string){
    const part=mesh(new THREE.SphereGeometry(1,10,8),c,x,y,z,sailor);part.scale.set(w,h,d);return part;
  }
  const cloth='#ead9b4',vest='#826952',sash='#a95440',skin='#bd9271';
  for(const side of [-1,1]){
    figurePart(side*.010,.006,.003,.007,.006,.012,'#4c4237');
    figurePart(side*.008,.031,0,.010,.025,.008,'#7d7361');
    figurePart(side*.020,.073,0,.008,.016,.008,cloth).rotation.z=side*.29;
    figurePart(side*.022,.060,.005,.005,.010,.005,skin);
  }
  figurePart(0,.073,0,.018,.023,.011,vest);
  figurePart(0,.053,.001,.018,.006,.012,sash);
  figurePart(0,.104,0,.010,.014,.009,skin);
  figurePart(0,.099,.006,.010,.009,.005,'#463d32');
  figurePart(0,.116,0,.014,.008,.012,cloth);
  figurePart(0,.122,0,.009,.005,.009,'#bfae88');
  const pane=box(.069,.124,.001,0,.074,.025,'#c5dddd',cabinet);
  pane.name='Sinbad display glass';pane.material=new THREE.MeshStandardMaterial({color:'#c7ddda',roughness:.16,transparent:true,opacity:.12,depthWrite:false});
  pane.castShadow=false;
  for(const x of [-.68,-.23,.23,.68]){
    const pane=storefront(x,.434,.296,.41,.283,blueTrim,sinbads,x<0?.31:.23);
    pane.userData.signLight=x<0?[.31,.22,.14]:[.23,.17,.11];
    pane.userData.ferryWalkPool={radius:1.29,strength:.69};
  }
  sinbadWordmark(.126,.077,.459,.448,1.14,sinbads);
  const fish=new THREE.Shape();
  fish.moveTo(-.095,-.028);fish.lineTo(-.065,0);fish.lineTo(-.095,.026);
  fish.lineTo(-.045,.013);fish.quadraticCurveTo(.02,.06,.092,.009);
  fish.quadraticCurveTo(.039,-.043,-.045,-.012);fish.closePath();
  mesh(new THREE.ExtrudeGeometry(fish,{depth:.004,bevelEnabled:false,curveSegments:7}),
    '#c47465',-.626,.495,.455,sinbads);
  mesh(new THREE.SphereGeometry(.005,6,4),dark,-.572,.502,.462,sinbads);
  box(1.81,.025,.144,0,.442,.486,blueTrim,sinbads).rotation.x=.14;
  for(const [x,z] of [[-.66,.738],[-.21,.87],[.26,.71],[.67,.88]])outdoorTable(x,z,.013,rustyRed,sinbads);
  rail(-.97,.53,-.97,1.10,.003,sinbads);
  rail(.97,1.10,-.97,1.10,.003,sinbads);
  for(let x=-.92;x<.84;x+=.23){
    beam([x,.036,1.097],[x+.22,.168,1.097],.011,'#85775e',sinbads);
    beam([x,.168,1.103],[x+.22,.036,1.103],.011,'#85775e',sinbads);
  }
  const pierSign=group('Pier 2 hanging sign',[.79,0,-.79],sinbads);
  pierSign.rotation.y=Math.PI;
  box(.031,.55,.034,.155,.28,0,timber,pierSign);
  box(.33,.025,.025,.006,.545,0,timber,pierSign);
  const shield=new THREE.Shape();
  shield.moveTo(-.144,-.028);shield.quadraticCurveTo(-.163,.015,-.142,.034);
  shield.quadraticCurveTo(-.126,.039,-.126,.064);shield.quadraticCurveTo(-.055,.044,0,.083);
  shield.quadraticCurveTo(.049,.045,.123,.064);shield.quadraticCurveTo(.125,.037,.147,.034);
  shield.quadraticCurveTo(.161,.012,.142,-.026);shield.quadraticCurveTo(.127,-.038,.127,-.050);
  shield.quadraticCurveTo(.055,-.039,0,-.074);shield.quadraticCurveTo(-.055,-.039,-.125,-.050);
  shield.quadraticCurveTo(-.125,-.036,-.144,-.028);shield.closePath();
  const shieldGeo=new THREE.ExtrudeGeometry(shield,{depth:.013,bevelEnabled:false,curveSegments:8});
  mesh(shieldGeo,'#9c8a66',-.012,.435,.012,pierSign);
  const field=mesh(shieldGeo.clone(),'#384a48',-.012,.435,.014,pierSign);
  field.scale.set(.91,.89,1);
  sign('PIER 2',.027,.467,.031,.118,'#abcac8',pierSign).position.x=-.030;
  const arrow=new THREE.Shape();
  arrow.moveTo(-.021,-.005);arrow.lineTo(.009,-.005);arrow.lineTo(.009,-.015);
  arrow.lineTo(.027,0);arrow.lineTo(.009,.015);arrow.lineTo(.009,.005);arrow.lineTo(-.021,.005);arrow.closePath();
  mesh(new THREE.ExtrudeGeometry(arrow,{depth:.003,bevelEnabled:false}),'#abcac8',.060,.480,.032,pierSign).name='Pier 2 directional arrow';
  sinbadWordmark(.046,-.022,.425,.029,.217,pierSign);
  mesh(new THREE.SphereGeometry(.012,8,6),'#bd795e',-.022,.400,.031,pierSign);
  for(const x of [-.092,.067])box(.007,.044,.008,x,.364,.022,timber,pierSign);
  box(.237,.052,.016,-.012,.331,.022,'#436e9e',pierSign);
  box(.240,.007,.018,-.012,.308,.022,'#c2b18b',pierSign);
  sign('RESTAURANT',.023,.323,.032,.211,'#f1ddae',pierSign).position.x=-.012;

  rail(.97,.46,.97,1.10,.003,sinbads);
  for(const x of [-.69,.71]){
    box(.17,.041,.17,x,.027,1.004,'#a99d78',sinbads);
    mesh(new THREE.IcosahedronGeometry(.076,1),'#657e5a',x,.091,1.004,sinbads);
  }

  // Palomino's red horse and capitals looked out over its Hills Plaza terrace.
  const palomino=group('Palomino',[hillsPalomino.x,hillsPalomino.y,hillsPalomino.z]);
  palomino.rotation.y=hillsPalomino.yaw;
  const red='#ae4338';
  const marquee=group('Palomino terrace sign',[-.70,0,.39],palomino);
  marquee.scale.setScalar(.33);
  marquee.rotation.y=.28;
  const plaque=new THREE.Shape();
  plaque.moveTo(-.29,-.064);plaque.lineTo(.29,-.064);plaque.lineTo(.27,.064);
  plaque.quadraticCurveTo(.16,.123,0,.137);plaque.quadraticCurveTo(-.16,.123,-.27,.064);plaque.closePath();
  mesh(new THREE.ExtrudeGeometry(plaque,{depth:.018,bevelEnabled:false}),cream,0,.294,0,marquee);
  for(const x of [-.225,.225])box(.020,.294,.026,x,.16,-.007,'#895d48',marquee);
  const horseOutline=[
    [-.104,.009],[-.073,.05],[.007,.056],[.043,.081],[.056,.118],[.073,.105],[.082,.115],
    [.087,.089],[.115,.067],[.096,.046],[.059,.061],[.036,.042],[.067,.016],[.114,.024],
    [.101,.005],[.057,-.003],[.01,.024],[-.029,.027],[-.062,-.016],[-.101,-.023],
    [-.078,.007],[-.075,.031],[-.118,.010],[-.147,.021],
  ];
  // The photographed sign uses thin Roman capitals and a reversed horse on its other face.
  const capitals:Record<string,number[][][]>={
    P:[[[0,0],[0,1],[.55,1],[.77,.91],[.81,.79],[.75,.63],[.56,.56],[0,.56]]],
    A:[[[0,0],[.42,1],[.84,0]],[[.16,.37],[.69,.37]]],
    L:[[[0,1],[0,0],[.72,0]]],
    O:[Array.from({length:19},(_,i)=>[.42+.42*Math.cos(i*Math.PI/9),.5+.5*Math.sin(i*Math.PI/9)])],
    M:[[[0,0],[0,1],[.46,.16],[.91,1],[.91,0]]],
    I:[[[.4,0],[.4,1]]],
    N:[[[0,0],[0,1],[.82,0],[.82,1]]],
  };
  const serifs:Record<string,number[][]>={
    P:[[0,0],[0,1]], A:[[0,0],[.84,0]], L:[[0,1],[.72,0]],
    O:[], M:[[0,0],[.91,0],[0,1],[.91,1]], I:[[.4,0],[.4,1]], N:[[0,0],[0,1],[.82,1]],
  };
  for(const side of [-1,1]){
    const face=group('Palomino sign face',[0,0,side>0?.020:-.002],marquee);
    face.rotation.y=side>0?0:Math.PI;
    const label=group('PALOMINO',[0,.254,0],face);
    [...'PALOMINO'].forEach((letter,i)=>{
      const x=-.224+i*.057,w=.052,y=.057;
      for(const stroke of capitals[letter])for(let j=1;j<stroke.length;j++){
        const [ax,ay]=stroke[j-1],[bx,by]=stroke[j];
        beam([x+ax*w,ay*y,0],[x+bx*w,by*y,0],.0031,red,label);
      }
      for(const [sx,sy] of serifs[letter])box(.012,.003,.003,x+sx*w,sy*y,0,red,label);
    });
    const horse=new THREE.Shape(horseOutline.map(([x,y])=>new THREE.Vector2(x*side,y)));
    mesh(new THREE.ExtrudeGeometry(horse,{depth:.007,bevelEnabled:false}),red,0,.323,.002,face).name='Palomino running horse';
  }
  // Keep the approaches to both pairs of doors open. Each dining set is
  // modeled at café scale: a 77 cm tabletop with a 46 cm seat height.
  for(const [index,[u,v]] of [[-.55,.14],[-.55,.31],[-.55,.50],[-.55,.69],[-.31,.63],[-.12,.64],[-.12,.47],[-.18,.14]].entries()){
    const table=group('Palomino dining set',[u,0,v],palomino);
    table.scale.setScalar(.25);table.rotation.y=index%2?.23:-.31;
    outdoorTable(0,0,0,'#b69772',table,false);
    const plate=mesh(new THREE.CylinderGeometry(.042,.037,.005,12),'#e8dfbf',.044,.187,0,table);
    plate.name='Plate of gorgonzola waffle fries';
    for(const i of [-1,0,1]){
      box(.049,.004,.004,.044,.192,i*.010,'#cd9d56',table);
      box(.004,.003,.031,.044+i*.013,.195,0,'#d8ad62',table);
    }
  }
  // A slim railing separates only the raised outer edge from the sidewalk.
  for(const y of [.033,.062])beam([-.78,y,.827],[.00,y,.827],.004,metal,palomino);
  for(let i=0;i<=5;i++)box(.005,.063,.005,-.78+i*.156,.0315,.827,metal,palomino);

  // Pier 1, south bulkhead. The period exterior and doorway photographs place
  // the two neon words behind the middle transom, under four six-light windows.
  const taqueria=group('Pancho Villa Taqueria at Pier 1',[10.151,.074,-1.47]);
  taqueria.rotation.y=-Math.PI/2;
  const limestone='#d4c8b1',doorSash='#363831';
  const arch=new THREE.Shape();
  arch.moveTo(-.267,0);arch.lineTo(.267,0);arch.lineTo(.267,.31);
  arch.quadraticCurveTo(0,.405,-.267,.31);arch.closePath();
  mesh(new THREE.ExtrudeGeometry(arch,{depth:.012,bevelEnabled:false,curveSegments:14}),'#58716a',0,.012,.032,taqueria);
  const head=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.267,.326,.054),new THREE.Vector3(0,.422,.054),new THREE.Vector3(.267,.326,.054));
  const transomTrim=taqueria.children.length;
  mesh(new THREE.TubeGeometry(head,16,.012,6,false),limestone,0,0,0,taqueria);
  for(const x of [-.271,.271])box(.021,.323,.038,x,.1615,.053,limestone,taqueria);
  for(const x of [-.092,.092])box(.011,.343,.012,x,.177,.057,doorSash,taqueria);
  box(.534,.019,.013,0,.241,.059,doorSash,taqueria);
  lightOpeningTrim(taqueria,taqueria.children.slice(transomTrim),0,.3,.056,.175,.096,.07);
  // The dark paired door has a shallow kick plate and narrow brass pulls.
  for(const x of [-.045,.045]){
    box(.082,.135,.009,x,.084,.063,'#727865',taqueria);
    box(.082,.016,.01,x,.022,.069,doorSash,taqueria);
    box(.003,.032,.007,x*.23,.081,.075,'#d3bd8c',taqueria);
  }
  for(const x of [-.224,-.075,.075,.224]){
    const pane=box(.080,.122,.010,x,.545,.052,'#aaa68c',taqueria);
    pane.userData.signLight=[.18,.115,.042];
    const firstTrim=taqueria.children.length;
    for(const dx of [-.043,0,.043])box(.004,.13,.009,x+dx,.545,.060,doorSash,taqueria);
    for(const dy of [-.063,-.021,.021,.063])box(.089,.005,.009,x,.545+dy,.060,doorSash,taqueria);
    lightOpeningTrim(taqueria,taqueria.children.slice(firstTrim),x,.545,.057,.080,.122,.18);
  }
  const transom=box(.175,.096,.008,0,.3,.052,'#738b77',taqueria);
  transom.userData.signLight=[.06,.07,.035];
  const letters=sign('TAQUERIA',.020,.32,.061,.156,'#9edab4',taqueria);
  letters.userData.signLight=[.16,.62,.32];
  // Sloped connected tube strokes of the red script, drawn on the transom.
  const script=group('Pancho Villa script neon',[0,.269,.064],taqueria);
  const strokes=[
    [[0,0],[2,7],[4,12],[7,12],[8,10],[6,7],[3,6]],
    [[4,2],[7,6],[9,6],[8,2],[10,5],[11,5],[10,2],[14,6],[14,4],[13,2],[16,4],[18,8],[20,12],[18,8],[15,2],[19,6],[18,2],[21,5],[23,6],[24,5],[22,2],[20,3],[25,6]],
    [[27,9],[30,12],[29,7],[29,2],[33,8],[36,12]],
    [[32,3],[35,6],[34,2],[37,5],[40,11],[41,12],[40,8],[36,2],[39,4],[43,11],[44,12],[43,8],[39,2],[42,4],[45,6],[47,6],[45,2],[48,5],[47,2],[50,4]],
  ];
  for(const points of strokes){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3((x-25)*.0032,y*.0031,0)));
    const tube=mesh(new THREE.TubeGeometry(curve,points.length*2,.00095,4,false),'#de6752',0,0,0,script);
    tube.userData.signLight=[.84,.095,.034];
  }
  // Square black café tables and spindle-back chairs in the close exterior.
  for(const [x,z] of [[-.22,.24],[.16,.26],[-.39,.37]]){
    box(.047,.003,.047,x,.046,z,doorSash,taqueria);
    box(.005,.044,.005,x,.023,z,doorSash,taqueria);
    for(const side of [-1,1]){
      const seat=z+side*.043;
      box(.027,.003,.026,x,.027,seat,doorSash,taqueria);
      for(const dx of [-.010,0,.010])box(.002,.026,.002,x+dx,.040,seat+side*.012,doorSash,taqueria);
      box(.027,.003,.003,x,.053,seat+side*.012,doorSash,taqueria);
      for(const dx of [-.010,.010])for(const dz of [-.009,.009])box(.002,.026,.002,x+dx,.013,seat+dz,doorSash,taqueria);
    }
  }
  return root;
}
