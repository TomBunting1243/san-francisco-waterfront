import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import mapped from '../public/data/urban-context.json' with {type:'json'};
import {createUrbanContext} from '../app/urban-context.ts';
import {bayReliefGround,bayReliefPosition} from '../app/bay-relief.ts';
import {approachLengths,approachPose} from '../app/approach-road.ts';

function above(group,x,z) {
  const camera=new THREE.PerspectiveCamera(35,1,.1,52);
  camera.position.set(x,24,z);camera.up.set(0,0,-1);camera.lookAt(x,0,z);camera.updateMatrixWorld();
  for(const tile of group.children)tile.update(camera);
  group.updateMatrixWorld();
  return new THREE.Raycaster(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0)).intersectObjects(group.children,true)[0];
}

test('Mission Bay roofs preserve tagged heights and the stepped wings across McCovey Cove',()=>{
  const group=createUrbanContext();
  for(const name of ['Chase Center','Visa']){
    const [x,z,meters]=mapped.landmarks[name],hit=above(group,x,z);
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.y-bayReliefGround(x,z)-meters*.06)<.14,name);
    assert.ok(hit.face.normal.y>.999);
  }
  const high=above(group,-119,-62),low=above(group,-119,-60);
  assert.ok(Math.abs(high.point.y-bayReliefGround(-119,-62)-73*.06)<.14);
  assert.ok(high.point.y-low.point.y>3);
  assert.equal(above(group,...bayReliefPosition(-122.3915,37.7757)),undefined);
  assert.equal(above(group,0,0),undefined);
});

test('both motorway carriageways continue at approach grade into the US-101 interchange',()=>{
  const group=createUrbanContext();
  for(const [i,key] of ['west','east'].entries()){
    const path=mapped.joins[key],existing=approachPose(i===1,approachLengths[i],0);
    const [ax,az]=path[0],[bx,bz]=path[1],len=Math.hypot(bx-ax,bz-az);
    const x=ax+(bx-ax)*.08/len,z=az+(bz-az)*.08/len;
    const hit=above(group,x,z);
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.y-existing.y-.01375)<.025);
    assert.ok(hit.point.y-bayReliefGround(x,z)>.6);
    const [cx,cz]=path.at(-1),[px,pz]=path.at(-2);
    // Sample the surveyed section arriving at its next real road junction.
    assert.ok(above(group,cx*.93+px*.07,cz*.93+pz*.07).point.y-bayReliefGround(cx,cz)>.4);
  }
});

test('opening orbit uses bounded, frustum-built spatial batches and indexed geometry',()=>{
  const group=createUrbanContext(),camera=new THREE.PerspectiveCamera(20,1.6,.35,1800);
  assert.ok(mapped.counts.survey>48000&&mapped.counts.osmParts>380);
  assert.ok(group.children.every(tile=>tile.children.length===0));
  camera.position.set(49,10.9,16.9);camera.lookAt(0,2.4,0);camera.setFocalLength(40);camera.updateMatrixWorld();
  for(const tile of group.children)tile.update(camera);
  const cells=group.children.flatMap(tile=>tile.children);
  assert.ok(cells.length>10&&cells.length<55);
  assert.equal(new Set(cells.map(cell=>cell.material)).size,1);
  assert.ok(cells.reduce((sum,c)=>sum+c.geometry.index.count/3,0)<270000);
  for(const cell of cells){
    assert.ok(cell.geometry.boundingSphere.radius>0&&Number.isFinite(cell.geometry.boundingSphere.radius));
    assert.equal(cell.geometry.getAttribute('uv').count,cell.geometry.getAttribute('position').count);
  }
});
