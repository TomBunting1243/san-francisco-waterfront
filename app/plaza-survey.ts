import * as THREE from 'three';
import survey from '../public/data/plaza-survey.json' with {type:'json'};
import {fitStationTree} from './ferry-market-platform.ts';
import {pccDimensions} from './pcc-layout.ts';
import {trackAt,waterfrontRailTop} from './streets.ts';
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

// The survey resolves a broad plane crown next to the northbound curve. Its
// rail-facing low bough must leave room for the full PCC body and its sweep.
function clearMedianBough(tree:THREE.Group){
  const center=trackAt(tree.position.x),slope=-Math.tan(center.heading);
  const roof=waterfrontRailTop(center.x)+pccDimensions.height;
  tree.updateMatrixWorld(true);
  const world=new THREE.Vector3(),inverse=new THREE.Matrix4();
  for(const part of tree.children){
    if(!(part instanceof THREE.Mesh))continue;
    const g=part.geometry,p=g.attributes.position;
    inverse.copy(part.matrixWorld).invert();
    for(let i=0;i<p.count;i++){
      world.fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld);
      const rail=center.z+slope*(world.x-center.x);
      const distance=world.z-rail;
      const floor=roof+.016-2.4*(distance-pccDimensions.width/2-.020);
      const transition=.014,room=world.y-floor;
      if(room>=transition)continue;
      // Lift the low overhang while preserving the measured crown spread,
      // height, trunk anchor and the order of vertices within each bough.
      world.y=floor+transition*Math.exp(room/transition-1);
      world.applyMatrix4(inverse);p.setXYZ(i,world.x,world.y,world.z);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  }
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
      if(!(member instanceof THREE.Mesh))continue;
      if(member.geometry instanceof THREE.CylinderGeometry)member.scale.set(1/scale,1,1/scale);
      const g=member.geometry,axis=g.userData.datePalmAxis;
      if(axis){
        // Fit the surveyed crown spread and trunk lean, while retaining the
        // measured radius at each stem ring around its own local center.
        const inverseScale=1/scale,shear=1-inverseScale;
        g.applyMatrix4(new THREE.Matrix4().set(
          inverseScale,axis[0]*shear,0,0,
          0,1,0,0,
          0,axis[1]*shear,inverseScale,0,
          0,0,0,1));
      }
    }
  }
  tree.scale.set(scale,h/bounds.max.y,scale);
  tree.position.set(x,y,z);
  if(record.id===-870123)clearMedianBough(tree);
  if(record.supplemental)fitStationTree(tree);
  root.add(tree);
  return tree;
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
