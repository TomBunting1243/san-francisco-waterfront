import * as THREE from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {footprintGeometry} from './sf-map.ts';
import {bakeRigidChunk} from './city-blocks.ts';

type Pane={x:number;y:number;z:number;w:number;h:number;ry:number};
type XY=[number,number];
const plaster='#c9bda9',trim='#e0d5bc',sill='#b2a991',iron='#465657',glass='#597478';
const cube=new THREE.BoxGeometry(1,1,1);

// Port National Register district, section 7, Pier 5; photograph 13 (street face).
// https://www.sfport.com/files/2022-12/EmbarcaderoRegisterNominationSec7.pdf
// https://npgallery.nps.gov/GetAsset/4ef55c34-b96e-447d-b225-ed553f82516a
// The 2024 8 cm city ortho and 2023 USGS DSM place the tall pavilion at x=23.86.
// Only four flat-roofed bays now survive, two at each side of the pavilion.
export function pierFive(footprint:number[][],font:Font){
  const root=new THREE.Group(),frame=new THREE.Group(),materials=new Map<string,THREE.MeshStandardMaterial>();
  const parts:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[],windows:Pane[]=[];
  const [a,b]=footprint,angle=Math.atan2(b[1]-a[1],b[0]-a[0]),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  frame.position.set(a[0],0,a[1]);frame.rotation.y=-angle;frame.updateMatrixWorld();
  function part(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,parent=frame){
    if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.89}));
    const m=new THREE.Mesh(g,materials.get(c)!);m.position.set(x,y,z);parent.add(m);parts.push(m);return m;
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,parent=frame){
    const m=part(cube,c,x,y,z,parent);m.scale.set(w,h,d);return m;
  }
  const ring=(coords:XY[])=>new THREE.Shape(coords.map(([x,y])=>new THREE.Vector2(x,y)));
  function prism(points:XY[],holes:XY[][],depth:number,z:number,c:string){
    const shape=ring(points);shape.holes=holes.map(ring);
    return part(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),c,0,0,z);
  }
  function rect(cx:number,w:number,lo:number,hi:number):XY[]{
    return [[cx-w/2,lo],[cx+w/2,lo],[cx+w/2,hi],[cx-w/2,hi]];
  }
  const threshold=.06;
  function arch(x:number,w:number,spring:number,rise:number):XY[]{
    const p:XY[]=[[x-w/2,threshold],[x+w/2,threshold]];
    for(let i=0;i<=16;i++){
      const theta=i*Math.PI/16;p.push([x+w/2*Math.cos(theta),spring+rise*Math.sin(theta)]);
    }
    return p;
  }
  function night(x:number,y:number,z:number,w:number,h:number){
    const point=frame.localToWorld(new THREE.Vector3(x,y,z));
    windows.push({x:point.x,y,z:point.z,w,h,ry:Math.PI-angle});
  }
  // Recess the west wall behind the new openings; the mapped east wall steps back mid-block.
  const plan=footprint.slice(0,-1).map(([x,z])=>[(x-a[0])*Math.cos(angle)+(z-a[1])*Math.sin(angle),-(x-a[0])*Math.sin(angle)+(z-a[1])*Math.cos(angle)]);
  plan[0][1]=plan[1][1]=.138;
  part(footprintGeometry(plan,.674),plaster,0,0,0);
  const cx=1.922,left=cx-.786,right=cx+.786,shoulder=.827,peak=.998;
  const holes:XY[][]=[];
  function sash(x:number,w:number,lo:number,hi:number,door=false){
    holes.push(rect(x,w,lo,hi));
    box(x,(lo+hi)/2,.065,w+.004,hi-lo,.012,glass);
    box(x,lo+(hi-lo)*(door?.23:.56),.050,w,.009,.017,iron);
    box(x,(hi+lo)/2,.050,.009,hi-lo,.017,iron);
    if(door){
      box(x,lo+.025,.048,w,.05,.015,iron);
      box(x+.016,lo+.066,.038,.007,.031,.011,sill);
    }else box(x,lo-.005,-.006,w+.023,.011,.032,sill);
    night(x-w*.26,(lo+hi)*.5,.057,w*.39,(hi-lo)*.39);
  }
  const gate=arch(cx,.93,.43,.335),spurX=left*.24,spur=arch(spurX,.405,.276,.060);
  holes.push(gate,spur);
  for(const [lo,hi,south] of [[0,left,true],[right,length,false]] as const){
    const span=(hi-lo)/2;
    for(let j=0;j<2;j++){
      const bay=lo+(j+.5)*span;
      for(let k=0;k<4;k++)sash(bay+(k-1.5)*span*.18,span*.141,.444,.579);
      if(!(south&&j===0)){
        sash(bay-span*.165,span*.207,.11,.345);
        sash(bay+span*.165,span*.205,threshold,.345,true);
      }
    }
    box((lo+hi)/2,.642,-.008,hi-lo,.028,.057,trim);
    box((lo+hi)/2,.680,.059,hi-lo,.026,.150,plaster);
  }
  // The returning soffits are the actual thickness of the stucco cutouts.
  prism([[0,0],[length,0],[length,.674],[right,.674],[right,shoulder],[cx+.52,shoulder],
    [cx,peak],[cx-.52,shoulder],[left,shoulder],[left,.674],[0,.674]],holes,.139,0,plaster);
  prism(gate,[],.012,.115,glass);prism(spur,[],.012,.119,glass);
  for(const [x,w,spring,rise] of [[cx,.93,.43,.335],[spurX,.405,.276,.060]]){
    for(let i=0;i<16;i++){
      const t0=i*Math.PI/16+.008,t1=(i+1)*Math.PI/16-.008;
      const pt=(t:number,dr:number):XY=>[x+(w/2+dr)*Math.cos(t),spring+(rise+dr)*Math.sin(t)];
      prism([pt(t0,0),pt(t1,0),pt(t1,.036),pt(t0,.036)],[],.024,-.015,trim);
    }
    for(const side of [-1,1]){
      box(x+side*(w/2+.016),(threshold+spring)/2,-.003,.032,spring-threshold,.031,trim);
      box(x+side*(w/2-.018),.093,-.004,.028,.068,.044,sill);
    }
    for(let i=-3;i<=3;i++){
      const u=i/4,top=spring+rise*Math.sqrt(1-u*u);
      box(x+w*u/2,(top+threshold)/2,.105,.010,top-threshold,.016,iron);
    }
    for(const y of [.204,spring])box(x,y,.102,w,.014,.017,iron);
    night(x-w*.31,.146,.110,w*.09,.131);
    box(x+.019,.134,.091,.007,.036,.014,trim);
  }
  // Thick gabled front, capped shoulder piers and the lower roof behind it.
  for(const side of [-1,1]){
    const foot=cx+side*.696;
    prism([[foot-.086,.038],[foot+.086,.038],[foot+.066,shoulder],[foot-.066,shoulder]],[],.067,-.028,plaster);
    box(foot,shoulder-.024,-.001,.189,.032,.092,trim);
    const dx=.52,dy=peak-shoulder;
    const rake=box(cx+side*dx/2,(peak+shoulder)/2,-.009,Math.hypot(dx,dy),.018,.048,trim);
    rake.rotation.z=-side*Math.atan2(dy,dx);
  }
  prism([[left,.666],[right,.666],[right,.725],[cx,.877],[left,.725]],[],.548,.116,sill);
  const sign=new TextGeometry('PIER 5',{font,size:.061,depth:.0018,curveSegments:2});
  sign.computeBoundingBox();sign.translate(-(sign.boundingBox!.max.x+sign.boundingBox!.min.x)/2,0,0);
  part(sign,iron,cx,.831,-.004).rotation.y=Math.PI;
  const pole=part(new THREE.CylinderGeometry(.003,.005,.486,8),sill,cx,1.212,.097);
  pole.name='Gable flagstaff';
  // The north return was reconstructed after removal of the adjoining three bays.
  // Keep its paired entrance and sash on the broad return, alongside the public walk.
  const depth=plan[2][1];
  for(const side of [0,length]){
    const endDepth=side===0?plan.at(-1)![1]:depth,sign=side===0?-1:1;
    for(let i=0;i<4;i++){
      const z=.14+(i+.5)*(endDepth-.14)/4;
      for(const y of [.228,.506]){
        const door=side===length&&i===1&&y<.3;
        const h=door?.268:.136,w=(endDepth-.14)*.17;
        box(side+sign*.002,door?threshold+h/2:y,z,.013,h,w,glass);
        box(side+sign*.010,door?.14:y,z,.008,.009,w,iron);
      }
    }
  }
  // Along the PortWalk, the rebuilt former shed wall has industrial windows.
  for(let i=2;i<plan.length;i++){
    const [x0,z0]=plan[i-1],[x1,z1]=plan[i],w=Math.hypot(x1-x0,z1-z0);
    if(x1>=x0||w<.5)continue;
    const bays=Math.max(2,Math.round(w/.29));
    for(let j=0;j<bays;j++)for(const y of [.25,.505]){
      const t=(j+.5)/bays,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;
      box(x,y,z+.005,w/bays*.71,.145,.014,glass);
      box(x,y,z+.013,.009,.145,.010,iron);
    }
  }
  frame.updateMatrixWorld(true);
  const batch=bakeRigidChunk('Pier 5 bulkhead and glazed entries',parts,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.89}));
  root.name='Pier 5';root.add(batch);
  return {root,windows};
}
