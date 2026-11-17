import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {bakeBlocks} from '../app/city-blocks.ts';

test('static districts combine nearby sparse geometry while dense buildings and long terrain stay separate',()=>{
  const paint=new THREE.MeshStandardMaterial({color:'#a38977'});
  const box=new THREE.BoxGeometry(1,1,1);
  const dense=new THREE.SphereGeometry(.46,84,44);
  const ground=new THREE.BoxGeometry(174,.4,6);
  const parts=[
    [box,1,0,2],[box,25,0,2],[dense,1,0,26],
    [ground,-20,-.35,51],[box,-47,0,52],
    [box,-21,0,25],[box,-45,0,25],
  ].map(([geo,x,y,z])=>{
    const mesh=new THREE.Mesh(geo,paint);
    mesh.position.set(x,y,z);mesh.updateMatrixWorld(true);return mesh;
  });
  const baked=bakeBlocks(parts,new THREE.MeshStandardMaterial({vertexColors:true}));
  const batches=new Map(baked.map(b=>[b.name,b.geometry]));
  assert.deepEqual([...batches.keys()].sort(),[
    'City block -1,2','City block -2,2','City block 0,1','City block district -1,0','City block district 0,0',
  ]);
  for(const name of ['City block district -1,0','City block district 0,0']){
    assert.equal(batches.get(name).index.count,72);
  }
  assert.equal(batches.get('City block 0,1').index.count,dense.index.count);
  const original=parts.reduce((total,mesh)=>total+mesh.geometry.index.count,0);
  const packed=baked.reduce((total,mesh)=>total+mesh.geometry.index.count,0);
  assert.equal(packed,original);
  const color=batches.get('City block district 0,0').getAttribute('color');
  assert.ok(Math.abs(color.getX(0)-paint.color.r)<1/255);
});

test('billboard light packs beside daylight pigment only in batches that contain a lamp',()=>{
  const geometry=new THREE.BoxGeometry(1,1,1);
  const paint=new THREE.MeshStandardMaterial({color:'#977b61'});
  const parts=[2,3,101].map(x=>{
    const mesh=new THREE.Mesh(geometry,paint);
    mesh.position.set(x,1,0);
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  const [baseline,unmarked]=bakeBlocks(parts,paint);
  parts[1].userData.signLight=[.9,.5,.25];
  const [lit,neighbor]=bakeBlocks(parts,paint);
  assert.equal(lit.geometry.index.count,baseline.geometry.index.count);
  for(const attr of ['position','normal','color'])assert.deepEqual(
    lit.geometry.getAttribute(attr).array,baseline.geometry.getAttribute(attr).array);
  const attribute=lit.geometry.getAttribute('signLight');
  assert.ok(attribute.normalized);
  const vertices=geometry.getAttribute('position').count;
  assert.equal(attribute.count,vertices*2);
  assert.ok(attribute.array.slice(0,vertices*3).every(channel=>channel===0));
  assert.deepEqual(Array.from(attribute.array.slice(vertices*3,vertices*3+3)),[230,128,64]);
  assert.equal(neighbor.name,unmarked.name);
  assert.ok(!neighbor.geometry.hasAttribute('signLight'));
});
