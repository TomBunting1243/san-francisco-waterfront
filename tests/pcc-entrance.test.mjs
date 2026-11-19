import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {bakePccBody,createStreetcar,setPccFrontDoor} from '../app/streetcar.ts';
import {createRideInteriors} from '../app/ride-interior.ts';
import {pccFrontDoorX,pccFrontLeafWidth,pccCabDoorZ} from '../app/pcc-layout.ts';
import {pccTreads} from '../app/pcc-entrance.ts';

const zDir=new THREE.Vector3(0,0,-1);
function ray(x,y,z,direction=zDir,far=.7){
  return new THREE.Raycaster(new THREE.Vector3(x,y,z),direction,0,far);
}
test('both pairs fold inward with constant leaf widths and open a route to the saloon',()=>{
  const {group,glazing,lamp}=createStreetcar();
  bakePccBody(group,glazing,lamp);group.updateMatrixWorld(true);
  const leaves=group.getObjectByName('PCC four folding entrance leaves'),m=new THREE.Matrix4();
  const jamb=pccFrontDoorX*group.scale.x,sill=.42*group.scale.z;
  const atDoor=ray(jamb-.012,.38*.06+.04,sill+.05);
  assert.equal(leaves.count,4);assert.ok(atDoor.intersectObject(leaves).length);
  for(const opening of [.15,.55,1]){
    setPccFrontDoor(group,opening);
    const ends=[];
    for(let i=0;i<4;i++){
      leaves.getMatrixAt(i,m);
      const start=new THREE.Vector3(0,0,0).applyMatrix4(m),end=new THREE.Vector3(pccFrontLeafWidth,0,0).applyMatrix4(m);
      assert.ok(Math.abs(end.distanceTo(start)-pccFrontLeafWidth)<1e-6);ends.push([start,end]);
    }
    assert.ok(ends[0][1].distanceTo(ends[1][0])<1e-6&&ends[2][1].distanceTo(ends[3][0])<1e-6);
    assert.ok(ends[0][1].z<0&&ends[2][1].z<0);
  }
  assert.equal(atDoor.intersectObject(leaves).length,0);
  assert.equal(ray(jamb,1.54*.06,sill+.002,zDir,.098).intersectObject(group,true).length,0,'open entrance reaches into aisle at chest height');
  const down=new THREE.Vector3(0,-1,0);
  for(const [i,h] of pccTreads.entries()){
    for(const offset of [-.55,0,.55]){
      const first=ray(jamb+offset*.06,1.46*.06,sill-(i+.5)*.21*.06,down,.09).intersectObject(group,true)[0];
      assert.ok(first&&Math.abs(first.point.y-h*.06)<1e-6,'the tread is the first physical surface across the open walking path');
    }
  }
  setPccFrontDoor(group,0);assert.ok(atDoor.intersectObject(leaves).length);
  const tris=group.children.reduce((sum,o)=>sum+(o.isInstancedMesh?o.count:1)*o.geometry.index.count/3,0);
  assert.equal(group.children.length,5);assert.ok(tris<11000,'indexed exterior including trucks and folding doors');
});
test('the same opening between the four leaves and four step heights is visible inside the cab',()=>{
  const cab=createRideInteriors();cab.show('tram');cab.root.updateMatrixWorld(true);
  const commuter=cab.root.getObjectByName('1051 split windshield and sill');
  const across=new THREE.Vector3(1,0,0);
  const sightline=ray(.70*.06,(1.04-2.15)*.06,(pccCabDoorZ+.13)*.06,across,.06);
  assert.ok(sightline.intersectObject(commuter,true).length);
  cab.setFrontDoor(1);assert.equal(sightline.intersectObject(commuter,true).length,0);
  for(const [k,h] of pccTreads.entries()){
    const x=(1.506-.21*(k+.5))*.06,y=(h-2.15)*.06,z=pccCabDoorZ*.06;
    const hits=ray(x,y+.005,z,new THREE.Vector3(0,-1,0),.006).intersectObject(commuter,true);
    assert.ok(hits.some(hit=>Math.abs(hit.point.y-y)<1e-6));
  }
  cab.setFrontDoor(0);assert.ok(sightline.intersectObject(commuter,true).length);cab.dispose();
});

test('the curved route roll and both amber lenses are visible from the curb',()=>{
  const {group}=createStreetcar();group.updateMatrixWorld(true);
  const shell=group.getObjectByName('1051 formed shell and windshield');
  const fittings=group.getObjectByName('1051 enamel fittings and number plates');
  const roll=group.getObjectByName('1051 backlit destination lettering');
  const amber=group.getObjectByName('1051 amber running lights');
  const toward=new THREE.Vector3(-1,0,-.34).normalize();
  for(const detail of [roll,amber]){
    const {position}=detail.geometry.attributes,index=detail.geometry.index;
    const n=index?.count??position.count,point=new THREE.Vector3(),v=new THREE.Vector3();
    let visible=0;
    for(let i=0;i<n;i+=3){
      point.set(0,0,0);
      for(let j=0;j<3;j++)point.add(v.fromBufferAttribute(position,index?index.getX(i+j):i+j));
      point.multiplyScalar(1/3).applyMatrix4(detail.matrixWorld);
      const eye=point.clone().addScaledVector(toward,-.1);
      if(!new THREE.Raycaster(eye,toward,0,.09998).intersectObjects([shell,fittings]).length)visible++;
    }
    assert.ok(visible/(n/3)>(detail===roll?.99:.60),detail.name+' must clear the formed nose');
  }
});
