import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {insideBuilding} from './building-character.ts';
import {footprintGeometry} from './sf-map.ts';

type Point=number[];
type Building={id:number;name:string;p:Point[];h:number;minH?:number;parent?:number};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const keys=new Set([1279504249,1279504251,260291407,260291406,32612362,32612471,148710877]);
const main={matson:1279504249,pge:1279504251,bank:32612362,california:32612471,front:148710877};
const closest=(face:{nx:number;nz:number},nx:number,nz:number)=>face.nx*nx+face.nz*nz;
const stone='#d1c6ac',cream='#e2d5b8',dark='#4e6261';
const warmCladding='#c9b99d';
const closed=(p:Point[])=>[...p,p[0]];

function facadeEdges(plan:Point[]){
  const raw=plan.slice(0,-1);
  const points=raw.filter((p,i)=>{
    const a=raw[(i+raw.length-1)%raw.length],b=raw[(i+1)%raw.length],ux=p[0]-a[0],uz=p[1]-a[1],vx=b[0]-p[0],vz=b[1]-p[1];
    return Math.abs(ux*vz-uz*vx)>.012*Math.hypot(ux,uz)*Math.hypot(vx,vz);
  });
  if(!THREE.ShapeUtils.isClockWise(points.map(([x,z])=>new THREE.Vector2(x,z))))points.reverse();
  return points.map((a,i)=>{
    const b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,nx=-dz/len,nz=dx/len;
    return {x,z,nx,nz,len,angle:Math.atan2(nx,nz)};
  }).filter(f=>f.len>.055);
}

function builder(name:string){
  const root=new THREE.Group(),windows:Pane[]=[],materials=new Map<string,THREE.MeshStandardMaterial>();
  root.name=name;
  const unitBox=new THREE.BoxGeometry(),column=new THREE.CylinderGeometry(1,1,1,10);
  function mesh(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Object3D=root){
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));
    const m=new THREE.Mesh(g,materials.get(color)!);
    m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:THREE.Object3D=root){
    const m=mesh(unitBox,color,x,y,z,parent);m.scale.set(w,h,d);return m;
  }
  function face(f:ReturnType<typeof facadeEdges>[number]){
    const node=new THREE.Group();node.position.set(f.x,0,f.z);node.rotation.y=f.angle;root.add(node);
    const point=(u:number,v:number)=>[f.x+f.nz*u+f.nx*v,f.z-f.nx*u+f.nz*v];
    return {node,point,...f};
  }
  function mass(p:Point[],low:number,high:number,color:string,name:string){
    const m=mesh(footprintGeometry(p,high-low),color,0,low,0);m.name=name;return m;
  }
  function label(s:string,size:number,x:number,y:number,z:number,color:string,font:Font,node:THREE.Object3D){
    const g=new TextGeometry(s,{font,size,depth:.0018,curveSegments:2});
    g.computeBoundingBox();g.translate(-(g.boundingBox!.max.x+g.boundingBox!.min.x)/2,0,0);
    mesh(g,color,x,y,z,node);
  }
  function pane(f:ReturnType<typeof face>,x:number,y:number,w:number,h:number,depth:number){
    const [px,pz]=f.point(x,depth+.011);
    windows.push({x:px,y,z:pz,ry:f.angle,w:w*.94,h:h*.91});
  }
  function window(f:ReturnType<typeof face>,x:number,y:number,w:number,h:number,depth=.023,paint=dark){
    box(w+.012,h+.010,.016,x,y,depth,paint,f.node);
    pane(f,x,y,w,h,depth);
  }
  function arch(f:ReturnType<typeof face>,x:number,y:number,w:number,h:number,paint=dark,trim='#d8c7a8',depth=.037){
    const r=w/2,base=h-r,shape=new THREE.Shape();
    shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,base);shape.absarc(0,base,r,0,Math.PI,false);shape.closePath();
    mesh(new THREE.ExtrudeGeometry(shape,{depth:.009,bevelEnabled:false,curveSegments:7}),paint,x,y,depth,f.node);
    const casing=.017;
    mesh(new THREE.TorusGeometry(r+.008,casing,4,12,Math.PI),trim,x,y+base,depth+.017,f.node);
    for(const side of [-1,1])box(casing*2,base,.026,x+side*(r+.010),y+base/2,depth+.013,trim,f.node);
    box(.013,h-.02,.011,x,y+(h-.02)/2,depth+.015,'#b8b9ac',f.node);
    box(w,.013,.014,x,y+base*.63,depth+.016,'#a5a795',f.node);
  }
  function pillar(node:THREE.Object3D,x:number,low:number,high:number,z:number,r:number,paint:string){
    const m=mesh(column,paint,x,(low+high)/2,z,node);m.scale.set(r,high-low,r);
    box(r*2.55,.023,r*2.55,x,low+.015,z,paint,node);
    box(r*2.62,.028,r*2.62,x,high-.015,z,paint,node);
  }
  // Rectangular hipped roof, with actual sloped glazed tile fields and a short ridge.
  function hip(node:THREE.Object3D,width:number,length:number,base:number,depth:number,high:number,color:string){
    const x=width/2,z=length/2,ridge=Math.max(0,x-z*.58);
    const points=[[-x,base,depth-z],[x,base,depth-z],[x,base,depth+z],[-x,base,depth+z],[-ridge,base+high,depth],[ridge,base+high,depth]];
    const vertices=[];
    for(const i of [0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0])vertices.push(...points[i]);
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();return mesh(geometry,color,0,0,0,node);
  }
  return {root,windows,mesh,box,mass,face,label,pane,window,arch,pillar,hip};
}
// North and east measured elevations in Matson NPS PDF pp. 13–14, and north
// and west elevations in PG&E’s nomination pp. 15–16. Three shared base/crown
// datum lines can be read directly. Each shaft retains the mapped L.
// https://npgallery.nps.gov/GetAsset/0c7d0f1a-78cf-444c-911c-434ea04a7d4c#page=13
// https://npgallery.nps.gov/NRHP/GetAsset/NRHP/95001385_text#page=15
const rustication=.80,cornice=3.53,matsonArcade=2.77,pgeArcade=2.97;
function historicBlock(b:Building,buildings:Building[],font:Font){
  const matson=b.id===main.matson,tall=buildings.find(p=>p.parent===b.id&&p.h>4);
  if(!tall)return undefined;
  const a=builder(matson?'Matson Building at 215 Market':'PG&E General Office at 245 Market');
  const paint=matson?stone:warmCladding,shaftTop=matson?matsonArcade:pgeArcade;
  a.mass(b.p,0,b.h,paint,'Ground floor and court base');
  a.mass(tall.p,tall.minH||b.h,cornice,paint,'Setback L-shaped office wings');
  for(const part of buildings.filter(p=>p.parent===b.id&&p.id!==tall.id))a.mass(part.p,part.minH||b.h,part.h,paint,'Historic low courtyard wing');

  const edges=facadeEdges(tall.p);
  const market=edges.filter(f=>closest(f,1,0)>.90).sort((x,y)=>y.len-x.len)[0];
  const side=edges.filter(f=>closest(f,0,matson?1:-1)>.87).sort((x,y)=>y.len-x.len)[0];
  function principal(edge:typeof market,front:boolean){
    const f=a.face(edge),l=f.len,bays=front||matson?8:5,step=l/bays;
    const band=(y:number,h:number,d:number,color:string)=>a.box(l+.024,h,d,0,y,d*.35,color,f.node);
    const opening=(x:number,y:number,w:number,h:number)=>a.window(f,x,y,w,h);
    band(.081,.16,.035,'#aaa395');band(rustication-.034,.058,.065,cream);
    band(rustication+.025,.030,.056,'#beae91');
    for(let n=0;n<bays;n++){
      const x=-l/2+(n+.5)*step,pier=x-step*.5;
      if(!front||n!==bays/2-1&&n!==bays/2){
        if(matson){
          opening(x,.31,step*.64,.46);
          a.pillar(f.node,pier,.086,.575,.036,.025,cream);
          opening(x,.678,step*.57,.128);
        }else a.arch(f,x,.097,step*.59,.51,dark,'#c6b491');
      }
      // Tall windows are paired in each real structural bay.
      for(let row=0;row<9;row++){
        const h=(shaftTop-rustication)/9,y=rustication+(row+.5)*h;
        for(const d of [-.18,.18])opening(x+d*step,y,step*.27,h*.69);
        a.box(step*.70,.016,.028,x,y-h*.37,.015,cream,f.node);
      }
      if(matson){
        a.arch(f,x,shaftTop+.045,step*.80,.42,dark,'#d2c2a0');
        opening(x,3.366,step*.64,.102);
      }else{
        a.arch(f,x,shaftTop+.044,step*.74,.43,dark,cream);
        a.pillar(f.node,pier,shaftTop+.025,3.45,.051,.034,cream);
        if(front){
          const finial=a.mesh(new THREE.SphereGeometry(.022,8,6),cream,pier,3.595,.063,f.node);
          finial.scale.y=1.42;
        }
      }
    }
    if(front){
      a.arch(f,0,.074,step*1.50,.712,'#435754',matson?'#d8caac':'#d4c09c',.05);
      const plaque=a.mesh(new THREE.SphereGeometry(.059,10,7),matson?'#749287':'#ab9e80',0,.832,.068,f.node);
      plaque.scale.set(1,.82,.29);
      if(matson)a.label('MATSON BUILDING',.035,0,.906,.042,'#786b53',font,f.node);
    }
    band(shaftTop+.014,.047,.055,matson?'#7c9c91':'#c2ae8e');
    band(cornice-.058,.051,.066,cream);
    band(cornice-.014,.042,matson?.113:.076,matson?'#d7c9ad':'#e0d0ad');
    if(matson)band(cornice+.016,.026,.071,'#809f90');
  }
  principal(market,true);principal(side,false);
  for(const edge of edges.filter(f=>f!==market&&f!==side)){
    const f=a.face(edge),count=Math.max(1,Math.round(edge.len/.30));
    for(let floor=0;floor<10;floor++)for(let j=0;j<count;j++){
      const x=-edge.len/2+(j+.5)*edge.len/count,y=.54+floor*.283;
      const [px,pz]=f.point(x,.047);
      if(buildings.some(p=>p.id!==b.id&&p.id!==tall.id&&p.h>y&&(p.minH||0)<y&&insideBuilding(px,pz,p.p)))continue;
      a.window(f,x,y,Math.min(.117,.48*edge.len/count),.144,.018,'#667372');
    }
  }

  const roof=a.face(market);
  if(matson){
    // Main Street arm and Market Street arm meet beneath the four-part cupola.
    a.box(market.len*.76,.128,.55,0,3.59,-.37,'#ccbea2',roof.node).name='Recessed sixteenth floor';
    a.box(.77,.33,.68,0,3.79,-.43,paint,roof.node).name='Matson cupola plinth';
    a.box(.66,.43,.59,0,4.165,-.43,stone,roof.node);
    const [x,z]=roof.point(0,-.43);
    for(let side=0;side<4;side++){
      const angle=roof.angle+side*Math.PI/2,nx=Math.sin(angle),nz=Math.cos(angle);
      const f=a.face({x:x+nx*.298,z:z+nz*.298,nx,nz,len:.58,angle});
      for(const u of [-.18,0,.18])a.arch(f,u,4.00,.112,.325,'#617873','#dbc8a7',.013);
      a.box(.70,.031,.063,0,4.378,.011,'#6d8c81',f.node);
    }
    a.hip(roof.node,.749,.69,4.394,-.43,.262,'#71998c').name='Aquamarine glazed Mission-tile roof';
    for(const [y,r,h,c] of [[4.677,.100,.073,'#91aa94'],[4.80,.071,.170,'#baa98c'],[4.922,.084,.104,'#749990']] as const){
      a.mesh(new THREE.CylinderGeometry(y>4.9?.052:r,r,h,10),c,0,y,-.43,roof.node).name='Matson lantern';
    }
  }else{
    const height=.35,w=market.len*.88;
    a.box(w,height,.74,0,cornice+height/2,-.43,paint,roof.node).name='PG&E recessed upper storeys';
    for(let n=0;n<8;n++){
      const x=-w/2+(n+.5)*w/8;
      a.box(.088,.148,.019,x,3.72,-.055,'#61716c',roof.node);
      a.box(.093,.047,.021,x,3.862,-.055,'#748079',roof.node);
    }
    a.hip(roof.node,w+.09,.83,3.88,-.43,.355,'#8f8e71').name='PG&E hipped tile roof';
    for(const x of [-w*.45,w*.45])a.box(.042,.068,.044,x,4.238,-.43,'#aba48a',roof.node);
  }
  return a;
}

// Survey A/B for 101 Market records the polished granite, freestanding loggia
// and setbacks above floor four. The Bank's opening photographs show the
// stone panel joints, ribbons of glass and planting across its lower terrace.
// https://sfplanning.s3.amazonaws.com/archives/CDG/docs/transit_center/Survey_A_and_B_forms.pdf
// https://fraser.stlouisfed.org/files/docs/historical/frbsf/federalreservenotes/frnotes_frbsf_198303.pdf
// Street photograph by BrokenSphere: https://commons.wikimedia.org/wiki/File:Fed_Reserve_Bank_of_SF,_101_Market_St.JPG
function clipped(plan:Point[],nx:number,nz:number,limit:number):Point[]{
  const points=plan.slice(0,-1),result:Point[]=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=a[0]*nx+a[1]*nz-limit,db=b[0]*nx+b[1]*nz-limit;
    if(da<=0)result.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){
      const t=da/(da-db);
      result.push([THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)]);
    }
  }
  return result.length<3?plan:closed(result);
}

function federalReserve(b:Building,buildings:Building[],font:Font){
  const a=builder('Federal Reserve Bank at 101 Market');
  const tall=buildings.find(p=>p.parent===b.id&&p.h>3);
  if(!tall)return undefined;
  const plaza=.88,normal=facadeEdges(tall.p).filter(e=>e.nx>.90).sort((a,b)=>b.len-a.len)[0];
  const edge=normal.x*normal.nx+normal.z*normal.nz;
  a.mass(b.p,0,.63,'#a9a094','Federal Reserve ground complex');
  for(const part of buildings.filter(p=>p.parent===b.id&&p.id!==tall.id))a.mass(part.p,part.minH||.63,part.h,'#b0a796','Federal Reserve side court');
  a.mass(tall.p,.63,plaza,'#ada497','Federal Reserve four-floor base');
  const floors=8,floorHeight=(tall.h-plaza)/floors;
  for(let row=0;row<floors;row++){
    const floor=plaza+row*floorHeight,plan=clipped(tall.p,normal.nx,normal.nz,edge-.125-row*.097);
    a.mass(plan,floor,floor+floorHeight,row===floors-1?'#b4a99d':'#a79b90','Granite terrace '+(row+5));
    for(const e of facadeEdges(plan).filter(e=>e.len>.35)){
      const f=a.face(e),y=floor+floorHeight*.50;
      const count=Math.max(1,Math.round(e.len/.28)),gap=e.len/count;
      const exposure=e.nx>.8;
      a.box(e.len-.014,floorHeight*.36,.013,0,y,.009,'#435953',f.node);
      if(exposure)a.box(e.len-.005,.015,.028,0,floor+.024,.012,'#76948b',f.node);
      for(let j=0;j<count;j++){
        const x=-e.len/2+(j+.5)*gap;
        a.window(f,x,y,gap*.77,floorHeight*.31,.012,j%4===1?'#5c6f67':'#4b605c');
        if(exposure)a.box(.009,floorHeight*.42,.012,x-gap*.48,floor+floorHeight*.79,.003,'#b6ab9f',f.node);
      }
    }
  }
  const f=a.face(normal),node=f.node,l=f.len;
  // A gallery stands forward of the actual lower wall. The narrow gap behind
  // the beam and the gaps between columns remain open to the pavement.
  a.box(l+.031,.099,.25,0,.868,.139,'#c4bbaa',node).name='Freestanding granite loggia beam';
  a.box(l+.047,.037,.29,0,.935,.145,'#b9ad9d',node);
  for(let i=0;i<=10;i++){
    const x=(i/10-.5)*l,r=i%2===0?.057:.050;
    a.pillar(node,x,.032,.825,.188,r,'#c0b8aa');
    a.box(.026,.035,.012,x,.868,.268,'#ded1bd',node);
  }
  a.box(l*.50,.294,.031,0,.205,.034,'#60736c',node);
  for(let i=0;i<8;i++)a.box(.011,.29,.018,(i/7-.5)*l*.50,.204,.060,'#9a9e8b',node);
  a.box(l*.48,.046,.028,0,.353,.066,'#5f7469',node);
  a.label('FEDERAL RESERVE BANK OF SAN FRANCISCO',.024,0,.346,.083,'#bdb6a2',font,node);
  for(let i=0;i<7;i++){
    const x=l*(i/7-.43);
    a.box(.34,.046,.105,x,.958,-.062,'#9d9d83',node);
    a.box(.017,.100,.017,x,1.000,-.061,'#817868',node);
    const crown=a.mesh(new THREE.IcosahedronGeometry(.075,1),'#7e936b',x,1.081,-.063,node);
    crown.scale.set(1.18,.81,.68);
  }
  return a;
}

// Architect's photographs of the California/Market lobby and continuous
// granite approaches: https://www.brereton.com/one-california
// Contemporary tower height and form: https://www.skyscrapercenter.com/building/one-california/12783
function oneCalifornia(b:Building,font:Font){
  const a=builder('One California Street');
  const bodyTop=b.h-.29,firstOffice=.56,roofCap=.041,floors=32;
  a.mass(b.p,0,.42,'#5b6460','Recessed granite lobby');
  a.mass(b.p,.42,bodyTop,'#647673','Dark office curtain wall');
  a.mass(b.p,bodyTop,bodyTop+roofCap,'#b8b7a9','One California cornice');
  const edges=facadeEdges(b.p);
  const ground=edges.filter(f=>f.nx<-.55).sort((x,y)=>y.len-x.len)[0];
  const room=b.p.slice(0,-1).reduce(([x,z],p)=>[x+p[0]/(b.p.length-1),z+p[1]/(b.p.length-1)],[0,0]);
  a.box(.90,.249,.88,room[0],b.h-.126,room[1],'#9ea79d').name='Inset mechanical penthouse';
  for(const e of edges){
    const f=a.face(e),l=e.len,bays=Math.max(1,Math.round(l/.19)),w=l/bays;
    if(l>.36)a.box(l-.019,.322,.031,0,.232,.025,'#536a66',f.node);
    for(let i=0;i<=bays;i++){
      const x=-l/2+i*w;
      a.box(.028,bodyTop-.48,.057,x,(.48+bodyTop)/2,.025,'#c9c9bb',f.node);
      if(i===bays)continue;
      for(let row=0;row<floors;row++){
        const pitch=(bodyTop-firstOffice)/floors,y=firstOffice+(row+.5)*pitch;
        a.pane(f,x+w/2,y,w*.77,pitch*.64,.014);
      }
      if(l>.36)a.box(.017,.34,.047,x,.231,.041,'#cabfac',f.node);
    }
    for(let row=1;row<floors;row++){
      const y=firstOffice+(bodyTop-firstOffice)*row/floors;
      a.box(l,.019,.025,0,y,.020,'#a7ae9f',f.node);
    }
    if(e===ground){
      a.box(l*.54,.028,.20,0,.042,.074,'#c7beab',f.node).name='Market approach granite step';
      a.box(l*.44,.026,.111,0,.066,.062,'#d1c6ad',f.node);
      a.label('ONE',.075,-l*.31,.081,.074,'#c9b79c',font,f.node);
    }
  }
  return a;
}

// Shaklee Terraces retained rounded setbacks on its Market shoulder. The
// property sheet photograph records the dark ribbons and raised light fascia.
// https://api-paramount-group.reol.com/pdf?file_name=esg_spec_sheet_one_front_street_1.pdf&id=4d89befa020d348edf8ba7d1a63bf4bf79f0ea73
function oneFront(b:Building){
  const a=builder('One Front Street');
  const faces=facadeEdges(b.p),first=.48,floor=(b.h-first)/38;
  const shoulder=faces.filter(f=>f.nx<-.66).sort((x,y)=>y.len-x.len)[0];
  const outer=Math.max(...b.p.map(([x,z])=>x*shoulder.nx+z*shoulder.nz));
  a.mass(b.p,0,first,'#a4a69a','One Front lobby podium');
  for(const [start,end,retreat] of [[0,30,0],[30,34,.24],[34,36,.47],[36,38,.65]] as const){
    const plan=retreat?clipped(b.p,shoulder.nx,shoulder.nz,outer-retreat):b.p;
    const y=first+start*floor;
    a.mass(plan,y,first+end*floor,'#a9aaa0','Rounded office terraces');
    for(const e of facadeEdges(plan)){
      const f=a.face(e),l=e.len,wanted=Math.max(1,Math.round(l/.255));
      for(let row=start;row<end;row++){
        const y=first+(row+.5)*floor;
        a.box(l-.003,floor*.60,.020,0,y,.011,row%9===1?'#5f7576':'#51696d',f.node);
        a.box(l+.003,.023,.048,0,y+floor*.34,.021,'#c0c3b6',f.node);
        for(let col=0;col<wanted;col++)if((row+col)%3!==0)a.pane(f,(col+.5-wanted/2)*l/wanted,y,(l/wanted)*.87,floor*.53,.020);
      }
    }
  }
  return a;
}
function annex(b:Building,buildings:Building[]){
  const matson=b.id===260291407,a=builder(matson?'Matson seven-storey annex':'PG&E Beale Street annex');
  const part=buildings.find(p=>p.parent===b.id&&p.h>3),paint=matson?'#baab90':'#c6b79a';
  const top=matson?b.h:3.11;
  a.mass(b.p,0,b.h,paint,'Annex lower building');
  if(part)a.mass(part.p,part.minH||b.h,top,paint,'Beale Street annex upper wing');
  for(const e of facadeEdges(part?.p??b.p)){
    if(e.len<.24)continue;
    const f=a.face(e),floors=matson?7:13,bays=Math.max(1,Math.round(e.len/.28)),span=e.len/bays;
    for(let i=0;i<floors;i++)for(let j=0;j<bays;j++){
      const x=(j+.5-bays/2)*span,y=(i+.5)*top/floors;
      const [px,pz]=f.point(x,.035);
      if(buildings.some(p=>p.id!==b.id&&p.parent!==b.id&&p.h>y&&(p.minH||0)<y&&insideBuilding(px,pz,p.p)))continue;
      a.window(f,x,y,span*.52,top/floors*.67);
    }
    a.box(e.len+.021,.052,.080,0,top-.018,.024,cream,f.node);
  }
  if(part){
    const e=facadeEdges(part.p).sort((x,y)=>y.len-x.len)[0],f=a.face(e);
    a.hip(f.node,e.len*.88,.65,top,-.39,.23,'#8f8d72').name='Annex set-back roof';
  }
  return a;
}

/** Each mapped family contributes exactly one replacement, including its OSM parts. */
export function marketArchitecture(b:Building,buildings:Building[],font:Font):{root?:THREE.Group;windows:Pane[]}|undefined{
  if(b.parent&&keys.has(b.parent))return {windows:[]};
  switch(b.id){
    case main.matson:
    case main.pge:return historicBlock(b,buildings,font);
    case main.bank:return federalReserve(b,buildings,font);
    case main.california:return oneCalifornia(b,font);
    case main.front:return oneFront(b);
    case 260291406:
    case 260291407:return annex(b,buildings);
    default:return undefined;
  }
}
