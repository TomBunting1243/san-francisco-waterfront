import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {setPackedNormals} from '../app/packed-normals.ts';

function compare(xyz,indices){
  const position=new THREE.BufferAttribute(xyz,3);
  const index=indices&&new THREE.BufferAttribute(indices,1);
  const make=()=>new THREE.BufferGeometry().setAttribute('position',position).setIndex(index);
  const reference=make(),candidate=make();
  reference.computeVertexNormals();
  setPackedNormals(candidate);
  const actual=candidate.attributes.normal,expected=reference.attributes.normal;
  assert.equal(candidate.attributes.position,position);
  assert.equal(candidate.index,index);
  assert.equal(actual.version,expected.version);
  assert.equal(actual.itemSize,3);
  assert.equal(actual.normalized,false);
  assert.deepEqual(new Uint32Array(actual.array.buffer),new Uint32Array(expected.array.buffer));
}
test('packed indexed normals match Three for shared, opposed, repeated and unused vertices',()=>{
  const xyz=new Float32Array([-.2,1.67,3, 3.6,4.37,-.035, -8.93,7.2,.77, 2.8,.1,-7.9, 9,9,9]);
  for(const Type of [Uint16Array,Uint32Array]){
    compare(xyz,new Type([0,1,2, 0,3,1, 0,2,1, 2,0,3, 2,2,0]));
    compare(xyz,new Type([]));
  }
});
test('triangle soup preserves Float32 rounding, signed zeros, winding and degenerate faces',()=>{
  const data=[0,-0,0, 0,1,0, 1,-0,0, 0,-0,0, 1,0,0, 0,1,0, 1,2,3, 1,2,3, 1,2,3];
  for(let j=0;j<900;j++)data.push(Math.sin(j*3.73)*10**(j%13-6));
  compare(new Float32Array(data),null);
  compare(new Float32Array(),null);
});
