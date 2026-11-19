import {pccFrontDoorX,pccFrontLeafWidth,pccCabDoorZ} from './pcc-layout.ts';
import * as THREE from 'three';
import {StreetAssembly,createStreetPaint} from './street-amenities.ts';

// Along is positive towards the back of the car, across is positive towards
// the platform. The same four physical leaves are seen on both sides of the sill.
const leafWidth=pccFrontLeafWidth,leafHeight=2.08,doorName='PCC four folding entrance leaves';
export const pccTreads=[.38,.61,.80,.96] as const;
export function foldingEntrance(){
  const frame=new StreetAssembly(),w=leafWidth;
  const rail=(u:number,y:number,width:number,height:number,ink:string)=>{
    frame.box(u,y,0,width,height,.036,ink);
  };
  const cream='#d8cf9f',gasket='#47564a',trim='#72786b';
  for(const u of [.037,w-.037])rail(u,leafHeight/2,.074,leafHeight,cream);
  for(const [y,h] of [[.11,.22],[.69,.20],[2.025,.11]])rail(w/2,y,w-.148,h,cream);
  for(const [a,b] of [[.22,.59],[.79,1.97]]){
    for(const u of [.081,w-.081])rail(u,(a+b)/2,.014,b-a,gasket);
    for(const y of [a+.009,b-.009])rail(w/2,y,w-.174,.018,trim);
  }
  rail(w-.012,leafHeight*.5,.024,leafHeight,'#465249');
  const material=createStreetPaint(),source=frame.bake(doorName,material);
  const leaves=new THREE.InstancedMesh(source.geometry,material,4);leaves.name=doorName;
  leaves.castShadow=false;leaves.receiveShadow=true;leaves.frustumCulled=false;
  setPccFrontDoor(leaves,0);return leaves;
}
const transform=new THREE.Matrix4();
export function setPccFrontDoor(object:THREE.Object3D,opening:number){
  const leaves=(object.name===doorName?object:object.getObjectByName(doorName)) as THREE.InstancedMesh|undefined;
  if(!leaves||leaves.userData.opening===opening)return;
  const angle=THREE.MathUtils.clamp(opening,0,1)*1.44,cos=Math.cos(angle),sin=Math.sin(angle);
  for(let i=0;i<4;i++){
    const pair=i<2?1:-1,inside=i%2===1;
    const start=pair*(-2*leafWidth+(inside?leafWidth*cos:0));
    // The leading leaf turns inward. Its partner returns to the sill plane.
    const dx=pair*cos,dz=inside?sin:-sin;
    transform.set(dx,0,-dz, start, 0,1,0,0, dz,0,dx,inside?-leafWidth*sin:0, 0,0,0,1);
    leaves.setMatrixAt(i,transform);
  }
  leaves.instanceMatrix.needsUpdate=true;leaves.userData.opening=opening;
}
// Exterior builder units have independent scales along the car's three axes.
export function mountExteriorEntrance(scale:THREE.Vector3){
  const leaves=foldingEntrance();
  leaves.matrixAutoUpdate=false;
  leaves.matrix.set(-.06/scale.x,0,0,pccFrontDoorX, 0,.06/scale.y,0,.38*.06/scale.y,
    0,0,.06/scale.z,.42, 0,0,0,1);
  return leaves;
}
export function mountCabEntrance(){
  const leaves=foldingEntrance();leaves.matrixAutoUpdate=false;
  leaves.matrix.set(0,0,.06,1.506*.06, 0,.06,0,(.38-2.15)*.06, .06,0,0,pccCabDoorZ*.06, 0,0,0,1);
  return leaves;
}
