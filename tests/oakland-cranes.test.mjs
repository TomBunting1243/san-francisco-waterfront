import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {oaklandContainerCranes, oaklandWharves} from '../app/oakland-cranes.ts';
import {bayReliefPosition, bayReliefGround} from '../app/bay-relief.ts';
import {waterSurface} from '../app/water-surface.ts';

const feet = [], material = new THREE.MeshStandardMaterial({vertexColors:true});
const cranes = oaklandContainerCranes(bayReliefPosition,(x,z)=>{
  const height = bayReliefGround(x,z);
  feet.push({x,z,height});
  return height;
},material);

test('all 128 wheel bogies sit on the mapped terminal side of their quay',()=>{
  assert.equal(feet.length,128);
  for (const {x,z,height} of feet) assert.ok(height>waterSurface.level,'submerged wheel at '+[x,z]);
  for (const wharf of oaklandWharves) for (const [lng,lat] of wharf.stations) {
    const offshore = wharf.offshore*Math.PI/180;
    const overWater = bayReliefPosition(lng+Math.sin(offshore)*16/(111320*Math.cos(lat*Math.PI/180)),
                                        lat+Math.cos(offshore)*16/111320);
    assert.ok(bayReliefGround(...overWater)<waterSurface.level,wharf.name+' offshore at '+lng);
  }
});

test('gantries use a single color-instanced draw and keep both working and stowed silhouettes',()=>{
  assert.equal(cranes.isInstancedMesh,true);
  assert.equal(cranes.material,material);
  assert.ok(cranes.count*cranes.geometry.index.count/3 < 14000);
  const bogie = new THREE.Color('#626860'), color = new THREE.Color(), matrix = new THREE.Matrix4();
  const bounds = new THREE.Box3(), reference = new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
  let matched = 0;
  for (let i=0;i<cranes.count;i++) {
    cranes.getMatrixAt(i,matrix); cranes.getColorAt(i,color);
    assert.ok(matrix.determinant()>0);
    const box = reference.clone().applyMatrix4(matrix);
    bounds.union(box);
    if (Math.abs(color.r-bogie.r)+Math.abs(color.g-bogie.g)+Math.abs(color.b-bogie.b)<1e-6) {
      const {x,z,height} = feet[matched++];
      assert.ok(Math.abs(matrix.elements[12]-x)<.001 && Math.abs(matrix.elements[14]-z)<.001);
      assert.ok(Math.abs(box.min.y-height)<.001);
    }
  }
  assert.equal(matched,128);
  assert.ok(bounds.max.y-Math.max(...feet.map(f=>f.height)) > 115*.06);
  assert.ok(bounds.max.y-Math.min(...feet.map(f=>f.height)) < 140*.06);
  const working = oaklandWharves.flatMap(w=>w.stations).filter(s=>s[2]<8 && s[3]!=='low-profile');
  assert.ok(working.length>12 && working.length<23);
  assert.equal(working.filter(s=>s[3]==='giant').length,3);
});
