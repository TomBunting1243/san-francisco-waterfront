import {pccFrontDoorX,pccFrontLeafWidth,pccCabDoorZ,pccExitSpacing} from './pcc-layout.ts';
import * as THREE from 'three';
import {StreetAssembly,createStreetPaint} from './street-amenities.ts';

// Along is positive towards the back of the car, across is positive towards
// the platform. The same four physical leaves are seen on both sides of the sill.
const leafWidth=pccFrontLeafWidth,leafHeight=2.08,doorName='PCC four folding entrance leaves';
export const pccTreads=[.38,.61,.80,.96] as const;
export function foldingEntrance(exterior=false){
  const frame=new StreetAssembly(),w=leafWidth;
  const rail=(u:number,y:number,width:number,height:number,ink:string)=>{
    frame.box(u,y,0,width,height,.036,ink);
  };
  const cream='#d8cf9f',gasket='#47564a',trim='#72786b';
  // The car 1051 side elevation shows three lights per leaf: two small
  // lower panes and one taller upper pane. The waist stripe continues across
  // the door. Only the center exit continues the lower green body panel.
  const green='#285b41',lowerPaint='#ddd2a1';
  const painted=(x:number,a:number,b:number,width:number)=>{
    for(const [low,high,tint] of [[0,.76,exterior?lowerPaint:cream],[.76,1.29,cream],[1.29,leafHeight,exterior?green:cream]] as const){
      const lo=Math.max(low,a),hi=Math.min(high,b);
      if(hi>lo)rail(x,(lo+hi)/2,width,hi-lo,tint);
    }
  };
  for(const u of [.037,w-.037])painted(u,0,leafHeight,.074);
  for(const [a,b] of [[0,.15],[.44,.56],[.86,1.36],[1.87,leafHeight]])painted(w/2,a,b,w-.148);
  for(const [a,b] of [[.15,.44],[.56,.86],[1.36,1.87]]){
    for(const u of [.081,w-.081])rail(u,(a+b)/2,.014,b-a,gasket);
    for(const y of [a+.009,b-.009])rail(w/2,y,w-.174,.018,trim);
  }
  rail(w-.012,leafHeight*.5,.024,leafHeight,'#465249');
  const material=createStreetPaint(),source=frame.bake(doorName,material);
  if(exterior){
    const pigment=new THREE.Color(lowerPaint),colors=source.geometry.getAttribute('color');
    const lower=new Float32Array(colors.count);
    for(let i=0;i<lower.length;i++)if(Math.round(colors.getX(i)*255)===Math.round(pigment.r*255))lower[i]=1;
    source.geometry.setAttribute('lowerSash',new THREE.BufferAttribute(lower,1));
    source.geometry.setAttribute('exitLeaf',new THREE.InstancedBufferAttribute(new Float32Array([0,0,0,0,1,1,1,1]),1));
    material.onBeforeCompile=shader=>{
      shader.uniforms.exitPigment={value:new THREE.Color(green)};
      shader.vertexShader='attribute float lowerSash;\nattribute float exitLeaf;\nuniform vec3 exitPigment;\n'+
        shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\n vColor.rgb=mix(vColor.rgb,exitPigment,lowerSash*exitLeaf);');
    };
    material.customProgramCacheKey=()=> 'pcc-exterior-door-enamel';
  }
  const leaves=new THREE.InstancedMesh(source.geometry,material,8);leaves.name=doorName;
  leaves.castShadow=false;leaves.receiveShadow=true;leaves.frustumCulled=false;
  setPccFrontDoor(leaves,0);setPccExitDoor(leaves,0);return leaves;
}
const transform=new THREE.Matrix4();
export function setPccFrontDoor(object:THREE.Object3D,opening:number){
  moveLeaves(object,opening,false);
}
export function setPccExitDoor(object:THREE.Object3D,opening:number){
  moveLeaves(object,opening,true);
}
function moveLeaves(object:THREE.Object3D,opening:number,exit:boolean){
  const leaves=(object.name===doorName?object:object.getObjectByName(doorName)) as THREE.InstancedMesh|undefined;
  const state=exit?'exitOpening':'opening';
  if(!leaves||leaves.userData[state]===opening)return;
  const angle=THREE.MathUtils.clamp(opening,0,1)*1.44,cos=Math.cos(angle),sin=Math.sin(angle);
  for(let i=0;i<4;i++){
    const pair=i<2?1:-1,inside=i%2===1;
    const start=(exit?pccExitSpacing:0)+pair*(-2*leafWidth+(inside?leafWidth*cos:0));
    const dx=pair*cos,dz=inside?sin:-sin;
    transform.set(dx,0,-dz,start, 0,1,0,0, dz,0,dx,inside?-leafWidth*sin:0, 0,0,0,1);
    leaves.setMatrixAt((exit?4:0)+i,transform);
  }
  leaves.instanceMatrix.needsUpdate=true;leaves.userData[state]=opening;
}
// Exterior builder units have independent scales along the car's three axes.
export function mountExteriorEntrance(scale:THREE.Vector3){
  const leaves=foldingEntrance(true);
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
