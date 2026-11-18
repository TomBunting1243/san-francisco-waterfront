import * as THREE from 'three';
import {treeWell} from './tree-wells.ts';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {createGatewayClub,gatewayClubGround} from './gateway-club.ts';
import treeSurvey from '../public/data/waterfront-tree-survey.json' with {type:'json'};
import landscapeData from '../public/data/waterfront-landscape.json' with {type:'json'};
import {sfMap,center,footprintGeometry} from './sf-map.ts';
import {insideBuilding} from './building-character.ts';
import {harryBridgesGround} from './curb-survey.ts';
import {plazaTreeRecords,addSurveyedTree,treePavingHeight} from './plaza-survey.ts';
import {waterfrontPalm,waterfrontTree} from './waterfront-trees.ts';

type Building={id:number;p:number[][];h:number;minH?:number};
type Area={id:number;name:string;kind:string;sport?:string|null;p:number[][]};
type Path={id:number;kind:string;p:number[][];layer:string;level?:string;bridge?:string;width?:string};
export const waterfrontLandscape=landscapeData as {areas:Area[];paths:Path[];trees:{id:number;p:number[];species:string;height:string|null;diameter:string|null}[]};
const surveyedTrees:Record<string,{sfId:number;species:string;dbhInches:number|null}>=treeSurvey.trees;
const brickPlaza=sfMap.parks.find(park=>park.name==='Embarcadero Plaza')!;
const rinconPaving=sfMap.parks.find(park=>park.name==='Rincon Park')!;
const contains=(p:number[],area:Area)=>insideBuilding(p[0],p[1],area.p);
const walton=sfMap.parks.find(p=>p.name.includes('Walton'))!;
export const gardenAreas:Area[]=[...waterfrontLandscape.areas.filter(a=>['park','commercial','podium'].includes(a.kind)),{...walton,id:-1,kind:'park'}];
const ecAreas=gardenAreas.filter(a=>a.kind==='podium');
const plantedAreas=gardenAreas.filter(a=>a.kind!=='podium');

/** Mapped lawns and paths, with lidar crown dimensions where survey returns resolve an individual tree. */
export function waterfrontGardens(buildings:Building[],font?:Font){
  const root=new THREE.Group();root.name='Referenced waterfront parks and gardens';
  const materials=new Map<string,THREE.MeshStandardMaterial>(),treeAnchors:{id:number;x:number;y:number;z:number}[]=[],pathSegments:{x:number;z:number;area:number}[]=[];
  const mat=(c:string)=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.95}));return materials.get(c)!;};
  const mesh=(g:THREE.BufferGeometry,c:string,x=0,y=0,z=0,parent:THREE.Object3D=root)=>{const m=new THREE.Mesh(g,mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent:THREE.Object3D=root)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,parent);
  const height=(area:Area)=>area.kind==='commercial'?.46:.12;
  const solidAt=(x:number,z:number,y:number)=>buildings.some(b=>b.h>y+.08&&(b.minH||0)<y+.08&&insideBuilding(x,z,b.p));
  const areaAt=(p:number[])=>plantedAreas.find(a=>contains(p,a));
  function strip(a:number[],b:number[],w:number,y:number,color:string){const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)return;const m=box(w,.022,len,(a[0]+b[0])/2,y,(a[1]+b[1])/2,color);m.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);return m;}
  function tree(x:number,z:number,y:number,id:number,species='',heightTag:string|null=null,site:'street'|'garden'|'rincon'='garden'){
    const seed=Math.abs(Math.sin(id*1.618)),tag=parseFloat(heightTag||'');
    const metres=Number.isFinite(tag)&&tag>0?tag:site==='street'?5.8+seed*3.8:site==='rincon'?3.2+seed*2.5:7.8+seed*5.6;
    const h=metres*.06;
    waterfrontTree(mesh,x,y,z,id,h,species);
    treeAnchors.push({id,x,y,z});
  }
  function shrub(x:number,z:number,y:number,s=.12){const crown=mesh(new THREE.IcosahedronGeometry(s,1),'#617f55',x,y+s*.55,z);crown.scale.set(1,.65,1);}
  for(const area of plantedAreas){
    const y=height(area);
    if(area.id!==-1){
      // Sue Bierman's west lawn has a mapped service-building hole.
      const holes=waterfrontLandscape.areas.filter(a=>a.kind==='park-hole'&&contains(center(a.p),area));
      if(holes.length){
        const shape=new THREE.Shape(area.p.map(([x,z])=>new THREE.Vector2(x,-z)));
        for(const hole of holes)shape.holes.push(new THREE.Path(hole.p.map(([x,z])=>new THREE.Vector2(x,-z))));
        const geo=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});geo.rotateX(-Math.PI/2);mesh(geo,'#8d9f70',0,y-.06,0);
      }else mesh(footprintGeometry(area.p,.06),area.kind==='commercial'?'#b8b5a0':'#8d9f70',0,y-.06,0);
    }
  }
  // The individually mapped lawn patches preserve Sue Bierman's curving paths.
  for(const area of waterfrontLandscape.areas.filter(a=>a.kind==='grass'||a.kind==='scrub')){
    const p=center(area.p),garden=areaAt(p);if(!garden||solidAt(p[0],p[1],height(garden)))continue;
    mesh(footprintGeometry(area.p,.018),area.kind==='scrub'?'#658563':'#99aa78',0,height(garden)+.006,0);
  }
  for(const path of waterfrontLandscape.paths){
    if(parseFloat(path.layer)<0||path.level?.startsWith('-'))continue;
    const elevated=path.bridge==='yes'||parseFloat(path.layer)>0;
    if(elevated)continue;
    for(let i=1;i<path.p.length;i++){
      const a=path.p[i-1],b=path.p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(len/.12));
      for(let j=0;j<steps;j++){
        const t=(j+.5)/steps,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],area=areaAt(p);if(!area||solidAt(p[0],p[1],height(area)))continue;
        const at=(u:number)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
        strip(at(j/steps),at((j+1)/steps),THREE.MathUtils.clamp(parseFloat(path.width||'2.4')*.06,.08,.25),height(area)+.029,'#d2c8ae');pathSegments.push({x:p[0],z:p[1],area:area.id});
      }
    }
  }
  root.add(createGatewayClub(waterfrontLandscape.areas,waterfrontLandscape.paths,font).root);
  for(const node of waterfrontLandscape.trees){
    const [x,z]=node.p,area=areaAt(node.p),inPark=insideBuilding(x,z,rinconPaving.p),y=area?height(area):inPark?.11:-.01;
    // Preserve street trees too, but never plant through a roof or traffic carriageway.
    if(solidAt(x,z,y)||gatewayClubGround(x,z)||ecAreas.some(a=>contains(node.p,a))||!area&&(z< -31||x< -45||x>56))continue;
    const record=surveyedTrees[node.id],canopy=plazaTreeRecords.get(node.id);
    const palms=canopy?.palm||record?.species==='Phoenix canariensis'||
      (node.id>=10828325148&&node.id<=10828325152)||(node.id>=10828325274&&node.id<=10828325286);
    const trunkRadius=record?.dbhInches ? record.dbhInches*.0254*.06/2 : undefined;
    const support=harryBridgesGround(x,z)??(area?y+.024:inPark?.11:insideBuilding(x,z,brickPlaza.p)?.11:canopy?treePavingHeight(canopy):y);
    if(record)treeWell(mesh,record.sfId,x,support,z,-Math.atan(.15));
    if(canopy&&addSurveyedTree(mesh,root,canopy,x,support,z,palms,record?.species??node.species,trunkRadius)){
      treeAnchors.push({id:node.id,x,y:support,z});
    }else if(palms){
      const seed=Math.abs(Math.sin(node.id));
      waterfrontPalm(mesh,x,y,z,node.id,.52+.13*seed,.20+.04*seed,trunkRadius);
      treeAnchors.push({id:node.id,x,y,z});
    }else{
      const atRincon=x> -43&&x< -24.8&&z> -3;
      tree(x,z,y,node.id,record?.species??node.species,node.height,atRincon?'rincon':area?'garden':'street');
    }
  }
  // Two broadleaf rows on Harry Bridges Plaza are absent from the OSM extract.
  // 2024 imagery locates every well. Two unresolved heights use their measured row neighbors.
  for(const record of plazaTreeRecords.values()){
    if(!record.supplemental)continue;
    const [x,z]=record.p,y=harryBridgesGround(x,z)??treePavingHeight(record);
    if(!solidAt(x,z,y)&&addSurveyedTree(mesh,root,record,x,y,z,false,'Platanus x hispanica')){
      treeAnchors.push({id:record.id,x,y,z});
      treeWell(mesh,record.id,x,y,z,0,true);
    }
  }
  // OSM records the eastern Sue Bierman trees, but not its dense western grove,
  // or all of Walton's perimeter groves. These supplemental
  // placements follow the photographed planting zones, rather than pretending
  // missing tree nodes mean bare paving. Negative IDs distinguish interpretation.
  for(const area of plantedAreas){
    if(area.id===175516006)continue;
    const [cx,cz]=center(area.p),xs=area.p.map(p=>p[0]),zs=area.p.map(p=>p[1]),spacing=.76,y=height(area);
    let index=0;
    for(let x=Math.min(...xs)+.3;x<Math.max(...xs)-.25;x+=spacing)for(let z=Math.min(...zs)+.3;z<Math.max(...zs)-.25;z+=spacing){
      index++;
      if(![-.20,.20].every(dx=>[-.20,.20].every(dz=>contains([x+dx,z+dz],area)&&!solidAt(x+dx,z+dz,y))))continue;
      if(area.id===-1&&Math.hypot((x-cx)/2.6,(z-cz)/2.3)<.63)continue;
      if(pathSegments.some(p=>p.area===area.id&&Math.hypot(p.x-x,p.z-z)<.24)||treeAnchors.some(p=>Math.hypot(p.x-x,p.z-z)<.54))continue;
      const id=-Math.abs(area.id*1000+index);tree(x,z,y,id,area.id===585983823?'Populus':'');
      if(area.kind==='commercial'){box(.52,.025,.50,x,y+.018,z,'#8e9e70');}
    }
  }
  // Photographed planted roof courts of the Commons; no invented rooftop furniture.
  for(const b of buildings.filter(b=>[941869554,941869555,941869556].includes(b.id))){
    const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);
    for(let x=Math.min(...xs)+.4;x<Math.max(...xs)-.3;x+=.45)for(let z=Math.min(...zs)+.4;z<Math.max(...zs)-.3;z+=.45){
      if(![-.16,.16].every(dx=>[-.16,.16].every(dz=>insideBuilding(x+dx,z+dz,b.p)&&!solidAt(x+dx,z+dz,b.h))))continue;
      box(.453,.025,.453,x,b.h+.023,z,'#82916a');
      if(Math.sin(x*23+z*31)>.50)shrub(x+.045,z-.03,b.h+.05,.105);
    }
  }
  return {root,treeAnchors,pathSegments};
}
