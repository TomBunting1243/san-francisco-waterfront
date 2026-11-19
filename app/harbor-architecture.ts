import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { center, footprintGeometry, mappedBuildings, sfMap } from './sf-map.ts';
import {pierFive} from './pier-five.ts';
import {createStreetVehicle,streetVehicleMaterial} from './street-vehicles.ts';
import type { FerryConnection } from './ferry-terminal.ts';
import {addPier14Corpus} from './pier14-corpus.ts';
import {createPier14Plaza,createPier14Chairs,pier14Ground} from './pier14-plaza.ts';

type Building = (typeof mappedBuildings)[number];
type Pier = (typeof sfMap.piers)[number];
type Point = number[];
type Pane = {x:number;y:number;z:number;ry:number;w:number;h:number};
const stone = '#d6cdb8';
const shadow = '#435457';
const glass = '#476971';
const timber = '#846f56';

function openRing(p: Point[]) {
  return p[0][0] === p.at(-1)?.[0] && p[0][1] === p.at(-1)?.[1] ? p.slice(0,-1) : p;
}

function edges(p: Point[]) {
  const points = openRing(p);
  const winding = Math.sign(points.reduce((sum,[x,z],i) => {
    const [qx,qz] = points[(i+1)%points.length];
    return sum + x*qz - z*qx;
  },0));
  return points.map(([x,z],i) => {
    const [qx,qz] = points[(i+1)%points.length];
    const w = Math.hypot(qx-x,qz-z);
    return {x:(x+qx)/2,z:(z+qz)/2,w,nx:winding*(qz-z)/w,nz:winding*(x-qx)/w};
  }).filter(e => e.w > .006);
}

function scaleRing(p: Point[], scale: number, offsetX=0, offsetZ=0) {
  const [cx,cz] = center(openRing(p));
  return p.map(([x,z]) => [cx+(x-cx)*scale+offsetX,cz+(z-cz)*scale+offsetZ]);
}

function contains(p: Point[], x: number, z: number) {
  let inside = false;
  for(let i=0,j=p.length-1;i<p.length;j=i++) {
    const [ax,az]=p[j], [bx,bz]=p[i];
    if((az>z)!==(bz>z) && x<(bx-ax)*(z-az)/(bz-az)+ax) inside=!inside;
  }
  return inside;
}

function model(name:string, font:Font) {
  const root = new THREE.Group();
  root.name = name;
  const mats = new Map<string,THREE.MeshStandardMaterial>();
  const windows: Pane[] = [];
  function mesh(geo: THREE.BufferGeometry, color: string, x=0, y=0, z=0, parent: THREE.Group=root) {
    let material = mats.get(color);
    if(!material) {
      material = new THREE.MeshStandardMaterial({color,roughness:.86});
      mats.set(color,material);
    }
    const m = new THREE.Mesh(geo,material);
    m.position.set(x,y,z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent=root) {
    return mesh(new THREE.BoxGeometry(w,h,d),color,x,y,z,parent);
  }
  function beam(a:THREE.Vector3,b:THREE.Vector3,width:number,color:string,parent=root) {
    const v=b.clone().sub(a);
    const m=box(width,width,v.length(),(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,color,parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v.normalize());
    return m;
  }
  function slab(p:Point[],bottom:number,top:number,color:string) {
    return mesh(footprintGeometry(p,top-bottom),color,0,bottom,0);
  }
  function facade(e:ReturnType<typeof edges>[number]) {
    const g=new THREE.Group();
    g.position.set(e.x,0,e.z);
    g.rotation.y=Math.atan2(e.nx,e.nz);
    root.add(g);
    return g;
  }
  function sign(label:string,size:number,x:number,y:number,z:number,color:string,parent=root,maxWidth=Infinity) {
    const geometry=new TextGeometry(label,{font,size,depth:.004,curveSegments:3});
    geometry.computeBoundingBox();
    const {min,max}=geometry.boundingBox!;
    geometry.translate(-(max.x+min.x)/2,-min.y,0);
    const m=mesh(geometry,color,x,y,z,parent);
    m.name=label;
    m.scale.x=Math.min(1,maxWidth/(max.x-min.x));
    return m;
  }
  function pane(face:THREE.Group,w:number,h:number,x:number,y:number,depth=.028) {
    face.updateMatrixWorld(true);
    const p=face.localToWorld(new THREE.Vector3(x,y,depth));
    windows.push({x:p.x,y:p.y,z:p.z,ry:face.rotation.y,w,h});
  }
  function quads(strips: number[][][], color: string) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(strips.flatMap(([a,b,c,d])=>[...a,...b,...c,...a,...c,...d]),3));
    geometry.computeVertexNormals();
    return mesh(geometry,color);
  }
  return {root,windows,mesh,box,beam,slab,facade,sign,pane,quads};
}

type Model=ReturnType<typeof model>;

// All sections use the same footprint ordering so walls meet at each bend.
function skin(m:Model, bottom:Point[], top:Point[], low:number, high:number|number[], colors:string[]) {
  const lo=openRing(bottom), hi=openRing(top);
  const area=lo.reduce((sum,[x,z],i) => {
    const [qx,qz]=lo[(i+1)%lo.length];
    return sum+x*qz-z*qx;
  },0);
  const groups=new Map<string,number[][][]>();
  for(let i=0;i<lo.length;i++){
    const j=(i+1)%lo.length;
    const [ax,az]=lo[i], [bx,bz]=lo[j], [cx,cz]=hi[j], [dx,dz]=hi[i];
    const next=typeof high==='number'?high:high[j], last=typeof high==='number'?high:high[i];
    const quad=[[ax,low,az],[bx,low,bz],[cx,next,cz],[dx,last,dz]];
    const color=colors[i%colors.length];
    const strips=groups.get(color)??[];
    strips.push(area<0?quad:quad.reverse());
    groups.set(color,strips);
  }
  for(const [color,strips] of groups) m.quads(strips,color);
}

function frontFace(faces:ReturnType<typeof edges>, bay:boolean) {
  return faces.filter(e=>e.w>.28).sort((a,b)=>
    (b.nz*(bay?1:-1)+.3*b.w)-(a.nz*(bay?1:-1)+.3*a.w))[0];
}

function streetFront(a:Point,b:Point){
  const w=Math.hypot(a[0]-b[0],a[1]-b[1]);
  return {x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,w,nx:(b[1]-a[1])/w,nz:(a[0]-b[0])/w};
}

function diner(b:Building,m:Model) {
  const hi=b.id===104600008;
  const base=.068, eave=hi?.66:.49;
  const siding=hi?'#659b90':'#e2d5b9', trim=hi?'#775542':'#aa433b', roof=hi?'#6e6153':'#926859';
  const faces=edges(b.p);
  const front=frontFace(faces,false), bay=frontFace(faces,true);
  const [cx,cz]=center(openRing(b.p));
  m.slab(b.p,base,eave,siding);
  const cap=scaleRing(b.p,1.083);
  m.slab(cap,eave,eave+.044,trim);
  if(hi){
    // The later gabled room meets the original flat-roofed street-side section.
    const width=bay.w*.96, depth=.30;
    const profile=new THREE.Shape();
    profile.moveTo(-width/2,0);
    profile.lineTo(width/2,0);
    profile.lineTo(0,.14);
    profile.closePath();
    m.mesh(new THREE.ExtrudeGeometry(profile,{depth,bevelEnabled:false}),roof,0,eave+.044,-depth,m.facade(bay));
  }else{
    m.slab(scaleRing(b.p,.97),eave+.043,eave+.075,roof);
    m.box(.10,.14,.13,cx-.14,eave+.11,cz+.12,'#8c8d7d');
  }
  for(const e of faces) {
    if(e.w<.10)continue;
    const f=m.facade(e);
    for(let y=base+.055;y<eave-.025;y+=.047)m.box(e.w-.011,.007,.012,0,y,.005,hi?'#58877e':'#c7b99b',f);
    m.box(e.w,.048,.022,0,base+.035,.013,trim,f);
    if(e.w<.27)continue;
    const bays=e===front?3:Math.max(1,Math.round(e.w/(hi?.26:.22)));
    const spacing=e.w/bays;
    for(let i=0;i<bays;i++){
      const door=e===front&&i===(hi?2:1);
      const x=(i+.5)*spacing-e.w/2, h=door?eave-base-.11:hi?.2:.15;
      const y=door?base+h/2:hi?.39:.29, w=spacing*(door?.78:.75);
      m.box(w+.035,h+.035,.034,x,y,.019,trim,f);
      m.box(w,h,.024,x,y,.037,door?'#394e4d':glass,f);
      if(!door){
        m.box(.012,h,.009,x,y,.051,siding,f);
        m.box(w,.011,.009,x,y-.026,.051,siding,f);
        m.box(w+.048,.014,.047,x,y-h/2-.014,.041,trim,f);
      }else{
        m.box(w*.76,h*.51,.011,x,y+h*.12,.051,'#698984',f);
        m.box(.015,.03,.018,x+w*.31,y-.055,.057,'#c6ac78',f);
      }
    }
    if(e!==front&&e!==bay)continue;
    const label=hi?'Hi Dive':"Red's JAVA HOUSE";
    const signY=hi?eave-.086:eave+.064;
    const width=e.w*(hi?.68:.97);
    m.box(width,hi?.087:.122,.024,0,signY+.037,.042,hi?siding:'#ecdfc7',f);
    const lettering=m.sign(label,hi?.088:.077,0,signY+.009,.058,hi?'#274840':'#a13631',f,width*.96);
    lettering.name=label.toUpperCase();
    if(!hi)m.box(width,.015,.032,0,signY-.018,.047,trim,f);
    if(e===front) {
      m.box(.115,.16,.025,-e.w*.23,.154,.193,'#4d5a55',f).rotation.x=-.19;
      for(const y of [.174,.201,.228])m.box(.078,.004,.009,-e.w*.23,y,.202,'#e9d8af',f);
      if(hi){
        const clock=m.mesh(new THREE.CylinderGeometry(.069,.069,.023,20),'#f2d7a0',width*.54,eave-.07,.067,f);
        clock.rotation.x=Math.PI/2;
        for(const a of [-.54,.72]){
          const hand=m.box(.008,.041,.008,clock.position.x,eave-.054,.083,shadow,f);
          hand.rotation.z=a;
        }
        const neon='#df876c', side=e.w*.25;
        for(const [a,b] of [
          [[-1,.55],[1,.55]],[[1,.55],[0,0]],[[0,0],[-1,.55]],[[0,0],[0,-.63]],[[-.42,-.63],[.42,-.63]],
        ])m.beam(new THREE.Vector3(side+.026*a[0],.435+.050*a[1],.061),
          new THREE.Vector3(side+.026*b[0],.435+.050*b[1],.061),.005,neon,f);
        m.sign('OPEN',.021,side,.376,.06,neon,f,Math.min(.10,e.w*.22));
        const canopy=m.box(.27,.027,.13,e.w*.32,.52,.079,trim,f);
        canopy.rotation.x=.16;
      }
    }
  }
  patio(b,m,hi,bay);
}

function patio(b:Building,m:Model,hi:boolean,bay:ReturnType<typeof edges>[number]) {
  const wall=m.facade(bay);
  const width=hi?bay.w*1.18:.79, depth=hi?.43:.78;
  const bounds=sfMap.piers.find(p=>p.name==='Piers 30-32')!.p;
  const apronX=bay.x-.57, apronZ=bay.z-.12;
  const group=hi?wall:new THREE.Group();
  if(!hi){
    // The patio sits on the apron immediately west of the diner, behind the street door.
    group.position.set(apronX,0,apronZ);
    group.rotation.y=-.59;
    m.root.add(group);
  }
  const z=hi?depth/2:0;
  m.box(width,.17,depth,0,-.018,z,hi?timber:'#aaa392',group);
  for(let i=0;i<8;i++)m.box(width-.01,.005,.007,0,.07,z-depth/2+(i+.5)*depth/8,hi?'#a18665':'#a49d87',group);
  for(const x of [-width*.47,width*.47]){
    m.box(.018,.018,depth,x,.34,z,shadow,group);
    for(const d of [-.43,0,.43])m.box(.014,.27,.016,x,.20,z+d*depth,shadow,group);
  }
  m.box(width,.019,.018,0,.34,z+depth*.47,shadow,group);
  for(const side of [-1,1]){
    const x=side*width*.24,zz=z+(hi?0:.17);
    for(const row of [0,1]){
      if(hi&&row)continue;
      const tz=zz-row*.34;
      m.box(.19,.025,.14,x,.235,tz,hi?'#965d45':'#a35244',group);
      for(const dx of [-.07,.07])m.box(.024,.16,.09,x+dx,.149,tz,timber,group);
      for(const dz of [-.10,.10])m.box(.19,.025,.052,x,.169,tz+dz,hi?timber:'#a35244',group);
      if(hi||row===0){
        m.box(.014,.49,.014,x,.31,tz,'#796b50',group);
        m.mesh(new THREE.ConeGeometry(.145,.052,8),hi?'#bc775e':'#cf6245',x,.56,tz,group);
      }
    }
  }
  if(hi){
    for(const x of [-width*.39,width*.39]){
      m.box(.084,.83,.088,x,-.36,depth*.82,timber,group);
      m.box(.105,.10,.095,x,-.13,depth*.84,'#8f7a5d',group);
    }
  }else if(contains(bounds,apronX,apronZ)){
    m.box(.65,.043,.035,0,.092,z-depth*.49,'#c5b497',group);
  }
  const vent=m.box(.10,.095,.08,b.p[0][0],.33,b.p[0][1],hi?'#735d49':'#8f4e40');
  vent.rotation.y=.64;
}

function mira(b:Building,m:Model) {
  const corners=[b.p[0],b.p[1],b.p[3],b.p[4]], faces=edges(corners);
  const floors=38, start=.34, floor=(b.h-start)/floors;
  m.slab(corners,0,start,'#607a7b');
  // Repeated bay windows pivot in place at each floor; the main slab stays aligned to the street.
  function bays(y:number){
    const ring:Point[]=[];
    faces.forEach(({nx,nz,w},side)=>{
      const columns=Math.round(w/.64), spacing=w/columns;
      for(let col=0;col<columns;col++){
        const twist=(y-start)*.76-col*.63+side*.52;
        const offset=spacing*(.42+Math.sin(twist)*.21), reach=.12+Math.cos(twist)*.052;
        const a=corners[side], q=corners[(side+1)%corners.length];
        for(const [along,depth] of [[col*spacing,0],[col*spacing+offset,reach]]){
          ring.push([a[0]+(q[0]-a[0])*along/w+nx*depth,a[1]+(q[1]-a[1])*along/w+nz*depth]);
        }
      }
    });
    return ring;
  }
  for(let i=0;i<floors;i++){
    const y=start+i*floor, a=bays(y), q=bays(y+floor);
    skin(m,a,a,y,y+.025,['#e1e4d4']);
    skin(m,a,q,y+.025,y+floor,['#86a6a9','#bed1ce']);
  }
  m.slab(bays(b.h),b.h,b.h+.045,'#e0dec9');
  m.slab(scaleRing(corners,.72),b.h+.045,b.h+.19,'#bcc5bb');
}

function fremont(b:Building,m:Model){
  const points=openRing(b.p);
  const corners=points.filter(([x,z],i)=>{
    const [ax,az]=points[(i+points.length-1)%points.length], [bx,bz]=points[(i+1)%points.length];
    return Math.abs((x-ax)*(bz-z)-(z-az)*(bx-x))>.025;
  });
  const height=b.h, top=height-.48;
  const section=(y:number)=>scaleRing(corners,1-y/height*.16,y/height*.24,-y/height*.13);
  const bands=[0,.44,3.2,6.25,9.36,12.05,top];
  for(let i=1;i<bands.length;i++){
    const low=bands[i-1], high=bands[i], bottom=section(low), upper=section(high);
    skin(m,bottom,upper,low,high,['#79969b','#536f78','#6e8992','#9eaead']);
    if(i===1)continue;
    bottom.forEach(([x,z],j)=>{
      const next=(j+1)%bottom.length;
      const [bx,bz]=bottom[next];
      if(Math.hypot(bx-x,bz-z)<1.15)return;
      const [tx,tz]=upper[j], [ux,uz]=upper[next];
      const [cx,cz]=center(bottom);
      const p=(x:number,y:number,z:number)=>new THREE.Vector3(x+(x-cx)*.032,y,z+(z-cz)*.032);
      const offset=i%2?.16:.81;
      m.beam(p(x,low,z),p(tx+(ux-tx)*offset,high,tz+(uz-tz)*offset),.066,'#dce1d7');
      m.beam(p(bx,low,bz),p(tx+(ux-tx)*offset,high,tz+(uz-tz)*offset),.056,'#cad5d1');
    });
    for(let y=low+.21;y<high-.08;y+=.23){
      skin(m,scaleRing(section(y),1.011),scaleRing(section(y+.016),1.011),y,y+.016,['#a2b6b6']);
    }
  }
  const base=section(top), crown=scaleRing(base,.46,.36,-.15);
  const [cx]=center(crown);
  const ridges=crown.map(([x])=>height+(x-cx)*.51);
  skin(m,base,crown,top,ridges,['#abbfbe','#6a8790','#8ca2a7','#d0d6cb']);
  const cap=new THREE.BufferGeometry();
  const triangles=THREE.ShapeUtils.triangulateShape(crown.map(([x,z])=>new THREE.Vector2(x,-z)),[]);
  const vertices=triangles.flatMap(tri=>tri.flatMap(i=>[crown[i][0],ridges[i],crown[i][1]]));
  cap.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  cap.computeVertexNormals();
  m.mesh(cap,'#a1b4b6');
  const [sx,sz]=center(crown);
  m.beam(new THREE.Vector3(sx+.13,height-.08,sz),new THREE.Vector3(sx+.16,height+.34,sz),.028,'#c8d1c6');
}

function infinity(b:Building,m:Model){
  const floors=b.id===421816061?40:35, step=(b.h-.16)/floors;
  const sideColors=['#6d929d','#6d929d','#7195a1','#79a0ac','#769aa5'];
  const walls=scaleRing(b.p,.946);
  m.slab(b.p,0,.16,'#879d9c');
  skin(m,walls,walls,.16,b.h,sideColors);
  for(let i=1;i<=floors;i++){
    const y=.16+i*step, p=scaleRing(b.p,i%4===0?1.037:1.019);
    m.slab(p,y-.026,y,'#b9cecb');
    if(i<floors){
      const rails=scaleRing(p,.992);
      skin(m,rails,rails,y,y+.050,['#86a8ae']);
      skin(m,p,p,y+.050,y+.060,['#c7d5cc']);
    }
  }
  for(const [i,e] of edges(walls).entries()){
    if(i%2!==0)continue;
    const f=m.facade(e);
    m.box(.014,b.h-.19,.013,0,(b.h+.16)/2,.016,'#aec1c0',f);
  }
  m.slab(b.p,b.h,b.h+.032,'#adbbaf');
  m.slab(scaleRing(b.p,.67),b.h+.032,b.h+.20,'#a5b1a8');
}

function anonymousSkyline(b:Building,m:Model){
  const palette=[
    {base:'#839b9c',trim:'#c3c9b8',pane:.68,h:.55,step:.29},
    {base:'#a89b8c',trim:'#d4c6ac',pane:.52,h:.60,step:.35},
    {base:'#6f8894',trim:'#93aab0',pane:.86,h:.66,step:.33},
    {base:'#9aaca2',trim:'#d1d4bf',pane:.62,h:.49,step:.29},
    {base:'#8d9692',trim:'#bdc5b8',pane:.58,h:.57,step:.36},
  ];
  const style=b.id%palette.length, p=palette[style];
  const points=openRing(b.p);
  const convex=points.every(([x,z],i)=>{
    const [ax,az]=points[(i+points.length-1)%points.length], [bx,bz]=points[(i+1)%points.length];
    return (x-ax)*(bz-z)-(z-az)*(bx-x)>=-.001;
  })||points.every(([x,z],i)=>{
    const [ax,az]=points[(i+points.length-1)%points.length], [bx,bz]=points[(i+1)%points.length];
    return (x-ax)*(bz-z)-(z-az)*(bx-x)<=.001;
  });
  const tiers=convex&&style!==2 ? (style===3?[[.76,1],[.91,.82],[1,.58]]:[[.88,1],[1,.77]]) : [[1,1]];
  let low=0;
  for(const [height,scale] of tiers){
    const high=b.h*height, shape=scale===1?b.p:scaleRing(b.p,scale);
    m.slab(shape,low,high,p.base);
    m.slab(convex?scaleRing(shape,1.013):shape,high,high+.04,p.trim);
    for(const e of edges(shape)){
      if(e.w<.36)continue;
      const f=m.facade(e), bays=Math.max(1,Math.round(e.w/(style===1?.34:.41)));
      const spacing=e.w/bays;
      for(let floor=low+p.step*.68;floor<high-.15;floor+=p.step){
        for(let j=0;j<bays;j++)m.pane(f,spacing*p.pane,p.step*p.h,(j+.5)*spacing-e.w/2,floor,.012);
        if(style===0||style===2)m.box(e.w,.022,.024,0,floor-p.step*.43,.007,p.trim,f);
      }
      if(style===1||style===3)for(let j=0;j<bays-1;j++)m.box(.024,high-low,.032,(j+1)*spacing-e.w/2,(high+low)/2,.014,p.trim,f);
    }
    low=high;
  }
  if(convex)m.slab(scaleRing(b.p,tiers.at(-1)![1]*.52),b.h+.04,b.h+.19,p.base);
}

function pierShed(b:Building,m:Model) {
  const pier=b.id===186071977?24:b.id===104599978?26:28;
  const faces=edges(b.p), [cx,cz]=center(openRing(b.p));
  const front=pier===24?frontFace(faces,false):pier===26?streetFront(b.p[1],b.p[2]):streetFront(b.p[8],b.p[0]);
  const bay=pier===24?frontFace(faces,true):faces.reduce((a,c)=>a.z>c.z?a:c);
  const roof=b.h-(pier===24?.025:.17), wall=pier===24?'#c5c2ac':'#cfc9b3', metal='#839186';
  m.slab(b.p,.06,roof,wall);
  m.slab(scaleRing(b.p,1.014),roof,roof+.045,pier===24?'#9f9e86':'#a7a798');
  const walls=pier===24?faces:[front,...faces.filter(e=>e.z>front.z+.55)];
  for(const e of walls){
    if(e.w<.33)continue;
    const f=m.facade(e);
    const main=e===front&&pier!==24;
    if(main){
      const w=e.w+.16, crown=pier===26?.28:.31;
      const parapet=new THREE.Shape();
      parapet.moveTo(-w/2,0);
      parapet.lineTo(-w/2,.081);
      parapet.bezierCurveTo(-w*.345,.081,-w*.38,crown*.68,-w*.16,crown*.68);
      parapet.quadraticCurveTo(0,crown*1.33,w*.16,crown*.68);
      parapet.bezierCurveTo(w*.38,crown*.68,w*.345,.081,w/2,.081);
      parapet.lineTo(w/2,0);
      parapet.closePath();
      m.box(w,roof+.031,.105,0,roof/2,.025,wall,f);
      m.mesh(new THREE.ExtrudeGeometry(parapet,{depth:.12,bevelEnabled:false,curveSegments:12}),stone,0,roof,.014,f);
      m.sign(`PIER ${pier}`,.112,0,roof+.032,.139,'#57685f',f,w*.53);
      const arches=[[-w*.31,w*.17,roof*.64],[0,w*.29,roof*.82],[w*.31,w*.17,roof*.64]];
      arches.forEach(([x,aw,ah])=>{
        const foot=.063, straight=ah-aw/2;
        const opening=new THREE.Shape();
        opening.moveTo(-aw/2,0);
        opening.lineTo(aw/2,0);
        opening.lineTo(aw/2,straight);
        opening.absarc(0,straight,aw/2,0,Math.PI,false);
        opening.closePath();
        m.mesh(new THREE.ExtrudeGeometry(opening,{depth:.018,bevelEnabled:false}),shadow,x,foot,.088,f);
        m.mesh(new THREE.TorusGeometry(aw/2+.014,.026,5,20,Math.PI),stone,x,foot+straight,.111,f);
        for(const dir of [-1,1]){
          m.box(.05,straight,.05,x+dir*(aw/2+.012),foot+straight/2,.107,stone,f);
          m.box(.091,.037,.073,x+dir*(aw/2+.012),foot+straight,.113,stone,f);
        }
        for(const dx of [-aw*.24,0,aw*.24])m.box(.011,ah*.97,.012,x+dx,foot+ah*.485,.111,metal,f);
        m.box(aw,.014,.024,x,foot+straight,.117,metal,f);
      });
      for(const x of [-w*.463,w*.463])m.box(.06,roof+.045,.055,x,roof*.5,.102,stone,f);
    }else{
      const bays=Math.max(1,Math.round(e.w/(pier===24?.52:.72))), spacing=e.w/bays;
      for(let i=0;i<bays;i++){
        const x=-e.w/2+(i+.5)*spacing;
        if(pier!==24&&i%5===3) {
          m.box(spacing*.70,roof*.61,.032,x,roof*.31+.04,.026,'#888f82',f);
          for(let j=0;j<8;j++)m.box(spacing*.67,.008,.009,x,(.105+j*.059)*(roof/.95),.046,'#a5aa98',f);
        }else{
          const height=roof*(pier===24?.43:.237), y=roof*(pier===24?.56:.74), width=spacing*.76;
          m.box(width,height,.025,x,y,.015,glass,f);
          for(const dx of [-width*.25,0,width*.25])m.box(.013,height,.019,x+dx,y,.031,metal,f);
          m.box(width+.028,.022,.036,x,y-height/2,.024,stone,f);
        }
        m.box(.048,roof-.025,.047,x-spacing/2+.036,roof/2,.018,stone,f);
      }
      if(e===front||e===bay){
        if(pier===24)m.box(.71,.118,.025,0,roof+.024,.031,stone,f);
        m.sign(`PIER ${pier}`,pier===24?.089:.079,0,pier===24?roof-.015:roof-.105,.055,shadow,f,e.w*.56);
      }
    }
  }
  if(pier!==24){
    const e=faces.reduce((a,q)=>a.w>q.w?a:q);
    for(let d=-e.w*.39;d<e.w*.39;d+=.66){
      const x=cx+e.nz*d,z=cz-e.nx*d;
      if(!contains(b.p,x,z))continue;
      const monitor=m.box(.27,.14,.63,x,roof+.098,z,'#a6b7ae');
      monitor.rotation.y=Math.atan2(e.nz,-e.nx);
      const lip=m.box(.34,.026,.65,x,roof+.174,z,metal);
      lip.rotation.y=monitor.rotation.y;
    }
  }
}

function rinconTower(b:Building,m:Model) {
  const base=b.minH??0, floors=23, step=(b.h-base-.08)/floors;
  const concrete='#c9b7a5', band='#d6c4ae', frame='#a89580', rail='#73817b';
  m.slab(b.p,base,b.h-.06,concrete);
  m.slab(b.p,b.h-.06,b.h,band);
  for(const [i,e] of edges(b.p).entries()){
    if(e.w<.25)continue;
    const f=m.facade(e), bays=Math.max(1,Math.round(e.w/.34)), spacing=e.w/bays;
    const terraces=e.nz>.57&&e.w>.52 || Math.abs(e.nx)>.8&&i%3===0&&e.w>.57;
    for(let j=0;j<bays;j++){
      const x=(j+.5)*spacing-e.w/2, hasTerrace=terraces&&j%2===0;
      // Continuous paired glazing reads as vertical residential bays. Slab fronts and rails break their rhythm.
      m.box(spacing*.72,b.h-base-.24,.015,x,(b.h+base)/2-.055,.011,'#678289',f);
      m.box(.012,b.h-base-.24,.019,x,(b.h+base)/2-.055,.022,frame,f);
      for(let floor=1;floor<=floors;floor++){
        const y=base+floor*step;
        if(hasTerrace&&floor>=3&&floor<=floors-2){
          m.box(spacing*.89,.032,.102,x,y,.054,band,f);
          m.box(spacing*.85,.043,.010,x,y+.039,.105,rail,f);
          for(const side of [-1,1])m.box(.012,.061,.083,x+side*spacing*.43,y+.035,.062,rail,f);
        }else m.box(spacing*.79,.032,.026,x,y,.021,band,f);
        if(floor%3!==0)m.pane(f,spacing*.30,step*.59,x-spacing*.17,y-step/2,.025);
      }
    }
  }
}

// Three open shelters are mapped as buildings. Their fabric sheds span a clear
// boarding aisle, as shown in the City's 2024 orthophoto of the cruise pier.
function cruiseShelter(b:Building,m:Model){
  m.root.name='Pier 3 boarding shelter '+b.id;
  const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);
  const left=Math.min(...xs),right=Math.max(...xs),start=Math.min(...zs),end=Math.max(...zs);
  const mid=(left+right)/2,span=(right-left)/2,eave=.244,rise=.055;
  for(const side of [-1,1]){
    const roof=m.box(Math.hypot(span,rise)+.012,.014,end-start,mid+side*span/2,eave+rise/2,(start+end)/2,'#e3dfd1');
    roof.rotation.z=-side*Math.atan2(rise,span);
    for(let i=0;i<=6;i++){
      const z=start+.015+(end-start-.03)*i/6,x=mid+side*(span-.013);
      m.box(.013,eave-.06,.013,x,(eave+.06)/2,z,'#788884');
      m.beam(new THREE.Vector3(x,eave-.005,z),new THREE.Vector3(mid,eave+rise-.008,z),.013,'#a3aaa1');
    }
  }
}

const buildingModels=new Map<number,(building:Building,model:Model)=>void>([
  [1181064591,cruiseShelter],[1181064592,cruiseShelter],[1181064594,cruiseShelter],
  [104600008,diner],[124659443,diner],
  [186071977,pierShed],[104599978,pierShed],[104599994,pierShed],
  [939499092,mira],[445566153,fremont],
  [421816061,infinity],[421816062,infinity],
  [944891683,rinconTower],[944891684,rinconTower],
]);

// Preserve small, individually modeled structures below the citywide footprint cutoff.
export const smallHarborBuildings=sfMap.buildings.filter(b=>buildingModels.has(b.id)&&!mappedBuildings.some(mapped=>mapped.id===b.id));

export function harborBuilding(b:Building,font:Font){
  if(b.id===91913148)return pierFive(b.p,font);
  const stylized=!b.name&&!b.part&&!b.parent&&b.h>3&&b.h<14&&b.p.length<=10&&center(b.p)[1]>-56;
  const build=buildingModels.get(b.id)??(stylized?anonymousSkyline:undefined);
  if(!build)return;
  const m=model(b.name||`Skyline ${b.id}`,font);
  build(b,m);
  return {root:m.root, windows:m.windows};
}

// The 2022 California NAIP plate is rectified to this pier's oceanward
// and southward axes. Coordinates below are pixels on the 48 px/unit plate.
function cargoApron(m:ReturnType<typeof model>,outline:Point[]){
  const at=(u:number,v:number):[number,number]=>[
    -63.48-(.53*u+.848*v)/48, -7.12+(.848*u-.53*v)/48,
  ];
  const positions:number[]=[],colors:number[]=[],ink=new THREE.Color();
  function patch(u:number,v:number,w:number,h:number,y:number,color:string){
    const corners=[at(u,v),at(u+w,v),at(u+w,v+h),at(u,v+h)];
    if(!corners.every(([x,z])=>contains(outline,x,z)))return;
    ink.set(color);
    for(const i of [0,2,1,0,3,2]){
      const [x,z]=corners[i];positions.push(x,y,z);colors.push(ink.r,ink.g,ink.b);
    }
  }
  // Rectangular repairs in the central working bay and the wearing courses of
  // the two parking fields are visible in the aerial even when the lot is empty.
  patch(146,219,536,120,.063,'#b9b9af');
  patch(312,223,100,76,.065,'#c5c6ba');
  patch(151,265,132,62,.065,'#b4b5ab');
  patch(478,227,202,78,.065,'#b3b5ad');
  for(const y of [18,57,76,117,155,200,392,436,482,523]){
    const start=y<210?22:150,end=y<210?688:646;
    patch(start,y,end-start,.46,.069,'#d2d1be');
    for(let x=start;x<end;x+=7.5){
      if((x>564&&y<130)||(x>597&&y>425))continue;
      patch(x,y-(y%2===0?0:12),.42,12,.069,'#d9d7c3');
    }
  }
  for(const [x,y,w,h] of [[148,219,.8,120],[142,340,545,.9],[397,20,.62,182],[307,218,.68,78],[687,111,.6,219]]){
    patch(x,y,w,h,.071,'#a7a69a');
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.userData.paintVertices=true;
  m.mesh(g,'#ffffff').name='Piers 30–32 parking fields and concrete working apron';
  const stalls=[
    [30,76],[45,76],[53,76],[67,76],[74,76],[89,76],[112,76],[120,76],[142,76],
    [37,111],[52,111],[75,111],[105,111],[157,111],[30,157],[45,157],[67,157],
    [188,23],[210,23],[240,23],[172,196],
  ];
  parkVehicles(m,stalls.map(([u,v])=>at(u,v)).filter(([x,z])=>contains(outline,x,z)),Math.atan2(.53,-.848));
}

function parkVehicles(m:Model,points:number[][],heading:number){
  const paint=streetVehicleMaterial();
  const prototypes=[0,1,2,5,3,4].map(type=>{
    const car=createStreetVehicle(type,paint,true);
    car.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.userData.paintVertices=true;});
    return car;
  });
  points.forEach(([x,z],i)=>{
    const car=prototypes[i%prototypes.length].clone();
    car.position.set(x,.06-.055*.25,z);car.scale.setScalar(.25);
    car.rotation.y=heading+(i%3===1?Math.PI:0);m.root.add(car);
  });
}

function cruiseApron(m:Model){
  // Pier 3, 2024. Short rows of parked cars face one another along the middle
  // aisle. Preserve curbside access to the vessels, shelter aisles and gangways.
  m.box(2.30,.006,10.48,18.29,.063,6.46,'#b3afa2');
  const spaces:number[][]=[];
  for(const [x,from,to] of [[18.12,2.15,10.71],[17.53,2.08,4.68],[18.43,8.06,10.55]]){
    const count=Math.floor((to-from)/.155);
    for(let i=0;i<=count;i++){
      const z=from+i*.155;
      m.box(.309,.006,.013,x,.072,z,'#ded9c6');
      if(i<count && (z<3.37||z>7.15||(i%9===4&&z>4.1)) && (i+Math.round(x*10))%7!==0)spaces.push([x,z+.0775]);
    }
  }
  parkVehicles(m,spaces,0);

}

export function harborPublicPiers(piers:Pier[],font:Font){
  const m=model('Public waterfront piers',font);
  const classic=piers.find(p=>p.name==='Pier 7')!;
  const modern=piers.find(p=>p.name==='Pier 14')!;
  const apron=piers.find(p=>p.name==='Piers 30-32')!;
  for(const p of [classic,modern]){
    const historic=p===classic, x=historic?27.28:-17.31;
    const length=historic?14.42:11.97, width=historic?.437:.275;
    const color=historic?'#537277':'#80999e', top=historic?.35:.128;
    // The historic timber promenade has cast iron balusters. The breakwater uses an open modern rail.
    for(const edge of edges(p.p)){
      if(edge.z<.02)continue;
      const f=m.facade(edge);
      m.box(edge.w+.008,historic?.026:.004,historic?.034:.005,0,top,-.019,color,f);
      m.box(edge.w,historic?.018:.003,historic?.021:.004,0,historic?top*.53:.095,-.020,color,f);
      const d=historic?.15:.25, count=Math.max(1,Math.round(edge.w/d));
      for(let i=0;i<count;i++){
        const sx=((i+.5)/count-.5)*edge.w,w=historic?.012:.0045,base=historic?.07:.06;
        m.box(w,top-base,w,sx,(top+base)/2,-.019,color,f);
      }
    }
    if(historic){
      for(let z=.04;z<length;z+=.125)m.box(width-.015,.006,.011,x,.064,z,'#998561');
      for(const z of [6.18,14.12])for(const side of [-1,1]){
        const px=x+side*.36;
        m.box(.09,.026,.35,px,.19,z,timber);
        m.box(.018,.09,.36,px+side*.052,.242,z,timber);
        for(const dz of [-.135,.135])m.box(.024,.13,.024,px,.13,z+dz,color);
      }
    }else{
      for(let z=.2;z<length;z+=.39){
        m.box(width,.006,.009,x,.064,z,'#a9ada3');
        m.box(.029,.011,.069,x-.097,.067,z,'#acbdba');
      }
      m.root.add(createPier14Plaza(),createPier14Chairs());
      addPier14Corpus(m.root,-15.1954,pier14Ground(-15.1954,-.807),-.807,-.08);
    }
    const marker=m.facade({x:x+(historic?-.40:.30),z:historic?-.45:-.10,w:.37,nx:0,nz:-1});
    m.box(.055,.43,.056,0,.253,0,color,marker);
    m.box(.36,.117,.025,0,.50,.024,color,marker);
    m.sign(p.name.toUpperCase(),.065,0,.473,.039,'#f0dfba',marker,.33);
  }
  cargoApron(m,apron.p);
  cruiseApron(m);
  // Fenders and restraint hardware trace the mapped perimeter.
  for(const e of edges(apron.p)){
    if(e.w<2)continue;
    const f=m.facade(e);
    const n=Math.ceil(e.w/1.3);
    for(let i=0;i<n;i++){
      const x=((i+.5)/n-.5)*e.w;
      m.box(.095,.61,.084,x,-.315,.054,timber,f);
      m.box(.14,.097,.013,x,-.119,.098,'#9d9d89',f);
      m.box(.15,.058,.10,x,.101,-.18,shadow,f);
      m.box(.084,.15,.07,x,.136,-.18,shadow,f);
    }
  }
  const entry=m.facade({x:-65.82,z:-8.53,w:1,nx:.64,nz:-.77});
  for(const x of [-.41,.41])m.box(.032,.53,.033,x,.32,.02,shadow,entry);
  m.box(.91,.20,.043,0,.51,.024,'#667d7a',entry);
  m.sign('PIERS 30–32',.099,0,.466,.051,'#eedfbe',entry,.84);
  return m.root;
}

export function ferryPortal(entry:FerryConnection,font:Font){
  const m=model(`Ferry Gate ${entry.gate}`,font);
  const frame=new THREE.Group();
  frame.position.set(entry.from[0],entry.landY,entry.from[1]);
  frame.rotation.y=Math.atan2(entry.to[0]-entry.from[0],entry.to[1]-entry.from[1]);
  m.root.add(frame);
  if(!entry.covered){
    const color='#56818c';
    m.box(.019,.206,.018,-entry.width*.89,.106,-.042,color,frame);
    m.box(.125,.069,.019,-entry.width*.89,.189,-.042,color,frame);
    m.sign(`GATE ${entry.gate}`,.026,-entry.width*.89,.180,-.054,'#ebe2c8',frame,.110).rotation.y=Math.PI;
    return m.root;
  }

  // Four masonry entries share the shallow pediment and upper transom.
  const south=entry.gate!=='B',span=south?.447:.398,depth=south?.118:.135;
  const eave=south?.36:.342,rise=south?.049:.057;
  const facing=south?'#bcb7a5':'#a9afa3', edge='#d5cdb5';
  for(const side of [-1,1]){
    const x=side*(span/2-.044);
    m.box(.073,eave,.082,x,eave/2,-.030,facing,frame);
    m.box(.087,.032,.115,x,.016,-.030,edge,frame);
    m.box(.083,.023,.103,x,eave-.023,-.030,edge,frame);
    for(const y of [.085,.146,.222,.295])m.box(.07,.003,.006,x,y,-.074,'#a5a396',frame);
  }
  m.box(span,.049,depth,0,eave-.020,-.03,facing,frame);
  const pediment=new THREE.Shape();
  pediment.moveTo(-span/2,0);pediment.lineTo(0,rise);pediment.lineTo(span/2,0);pediment.closePath();
  m.mesh(new THREE.ExtrudeGeometry(pediment,{bevelEnabled:false,depth}),edge,0,eave-.003,-.03-depth/2,frame);
  for(const side of [-1,1]){
    const roof=m.box(Math.hypot(span/2+.025,rise),.014,depth+.042,side*span/4,eave+rise*.53,-.030,'#718487',frame);
    roof.rotation.z=-side*Math.atan2(rise,span/2);
  }
  const plaque=new THREE.Group();plaque.rotation.y=Math.PI;frame.add(plaque);
  m.sign(`GATE ${entry.gate}`,.035,0,eave-.017,.093,'#566b6a',plaque,span*.51);
  for(const x of [-.098,-.049,0,.049,.098])m.box(.040,.035,.028,x,eave-.082,-.03,'#789498',frame);
  m.box(span-.136,.009,.055,0,eave-.107,-.03,'#7b9394',frame);

  const passage=entry.width*.48;
  for(const side of [-1,1]){
    const x=side*(passage+.030);
    m.box(.032,.074,.036,x,.047,-.139,'#8da19d',frame);
    m.box(.037,.010,.040,x,.089,-.139,'#5c7676',frame);
    m.box(.016,.013,.016,x,.091,-.157,'#a6b585',frame);
  }
  return m.root;
}
