import * as THREE from 'three';
import survey from '../public/data/plaza-survey.json' with {type:'json'};
import {bayReliefGround} from './bay-relief.ts';
import {waterfrontTree,waterfrontPalm} from './waterfront-trees.ts';

type MeshFactory=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
type Canopy={id:number;p:number[];palm:boolean;supplemental:boolean;surface?:string;estimatedHeightM?:number;estimatedCrownM?:number;heightM?:number;crownM?:number;groundM?:number};
export const plazaTreeRecords=new Map<number,Canopy>(survey.trees.map(t=>[t.id,t]));
export const plazaBenches=survey.benches;
export const southPlazaTop=.106;
const unit=new THREE.BoxGeometry(1,1,1);

const roadTops:Record<string,number>={curb:.049,sidewalk:.045,street:.031,alley:.032,courtyard:.022,garden:.011,parking:.013,stall:.017};
export function treePavingHeight(record:Canopy){
  const [x,z]=record.p;
  return Math.max(bayReliefGround(x,z),roadTops[record.surface??'']??-Infinity);
}

/** Map the rendered trunk and crown to the observed canopy envelope. OSM anchors the trunk. */
export function addSurveyedTree(mesh:MeshFactory,root:THREE.Group,record:Canopy,x:number,y:number,z:number,palm:boolean,species:string,trunkRadius?:number){
  const height=record.heightM??record.estimatedHeightM,diameter=record.crownM??record.estimatedCrownM;
  if(!height||!diameter)return false;
  const h=height*.06,d=diameter*.06;
  const tree=new THREE.Group();tree.name='Surveyed tree '+record.id;
  const plant=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number)=>mesh(g,c,x,y,z,tree);
  if(palm)waterfrontPalm(plant,0,0,0,record.id,h,d/2,trunkRadius,species);
  else waterfrontTree(plant,0,0,0,record.id,h,species);
  const bounds=new THREE.Box3().setFromObject(tree,true),size=bounds.getSize(new THREE.Vector3());
  // Airborne returns measure a mean horizontal spread. Preserve asymmetric branching.
  const scale=d/Math.sqrt(size.x*size.z);
  if(palm&&trunkRadius){
    for(const member of tree.children){
      if(member instanceof THREE.Mesh&&member.geometry instanceof THREE.CylinderGeometry)member.scale.set(1/scale,1,1/scale);
    }
  }
  tree.scale.set(scale,h/bounds.max.y,scale);
  tree.position.set(x,y,z);
  root.add(tree);
  return true;
}

/** OSM survey locations and back/arm/material tags. Seat depth and height are nominal. */
export function addPlazaBenches(mesh:MeshFactory,root:THREE.Group){
  const field=new THREE.Group();field.name='Mapped waterfront benches';root.add(field);
  for(const record of plazaBenches){
    const [x,z]=record.p,bench=new THREE.Group();
    bench.name='Bench '+record.id;
    bench.position.set(x,record.area==='south'?southPlazaTop:record.area==='north'?bayReliefGround(x,z):.110,z);
    bench.rotation.y=record.yaw;field.add(bench);
    const width=((record.seats??3)*.53+.12)*.06;
    const slat=record.metal?'#637a78':'#997d5f',iron='#4c6263';
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,color:string)=>{
      const part=mesh(unit,color,x,y,z,bench);part.scale.set(w,h,d);return part;
    };
    for(let i=0;i<4;i++)box(width,.003,.0065,0,.026,-.01125+i*.0075,slat);
    for(const u of [-.36,.36]){
      box(.004,.025,.022,u*width,.0125,0,iron).name='Bench foot';
      box(.004,.044,.0035,u*width,.026,-.015,iron);
      if(record.arms){
        box(.003,.012,.003,u*width,.033,.009,iron);
        box(.004,.003,.026,u*width,.040,-.002,iron);
      }
    }
    for(const y of [.036,.043,.050])box(width,.0055,.0035,0,y,-.015,slat);
  }
  return field;
}
