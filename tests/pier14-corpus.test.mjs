import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addPier14Corpus} from '../app/pier14-corpus.ts';
const root=new T.Group(),mesh=addPier14Corpus(root,0,0,0,0),g=mesh.geometry;
const vec=(x,y,z)=>new T.Vector3(x,y,z);
function across(x,h){return new T.Raycaster(vec(x*.06,h*.06,-.3),vec(0,0,1)).intersectObject(mesh)[0];}
test('the steel lips bracket a real through slit that rises toward the Agriculture Building',()=>{
  for(const x of [-1,0,1]){
    const seam=3.95+x*.105;
    assert.ok(!across(x,seam));
    assert.ok(across(x,seam+.095)&&across(x,seam-.095),'solid steel above and below');
  }
  assert.ok(across(0,4.25));
  assert.ok(!across(.23,2.2));
});
test('fourteen splayed feet touch the same surface, with substantial negative space beneath the shell',()=>{
  const a=g.getAttribute('position'),feet=[];
  for(let i=0;i<a.count;i++){
    const p=new T.Vector3().fromBufferAttribute(a,i).divideScalar(.06);
    assert.ok(p.y>=0);
    if(p.y<.00001&&!feet.some(f=>f.distanceTo(p)<.14))feet.push(p);
  }
  assert.equal(feet.length,14);
  assert.ok(Math.max(...feet.map(p=>p.x))-Math.min(...feet.map(p=>p.x))>4.9);
  assert.ok(Math.max(...feet.map(p=>p.z))-Math.min(...feet.map(p=>p.z))>3.5);
});
test('published height, estimated footprint and opaque mesh budget survive placement and rotation',()=>{
  const m=addPier14Corpus(new T.Group(),-15.1954,.060,-.807,Math.PI/2);
  m.geometry.computeBoundingBox();const bounds=m.geometry.boundingBox,size=bounds.getSize(new T.Vector3()).divideScalar(.06);
  assert.ok(Math.abs(bounds.min.y-.060)<1e-5&&Math.abs(size.y-4.8768)<1e-5);
  assert.ok(size.x>3.5&&size.x<3.8&&size.z>5&&size.z<5.2);
  assert.equal(root.children.length,1);assert.ok(mesh.material.vertexColors&&!mesh.material.transparent);
  assert.ok(g.index.count/3<=4000&&g.getAttribute('position').array.every(Number.isFinite));
});
