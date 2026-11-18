import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installOrderedArchitecture} from '../app/ordered-architecture.ts';
function fixture(){
  const positions=[],indices=[];
  for(const x of [-15,0,15])for(let i=0;i<6;i++){
    const j=positions.length/3;positions.push(x-.4,0,i*.02,x+.4,0,i*.02,x,.8,i*.02);indices.push(j,j+1,j+2);
  }
  const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);
  return new T.Mesh(geo,new T.MeshBasicMaterial());
}
function camera(x){
 const cam=new T.PerspectiveCamera(15,1,.1,110);cam.position.set(x,.4,5);cam.lookAt(x,.4,0);cam.updateMatrixWorld();return cam;
}
test('both cameras retain original triangle order, trim disjoint ends and restore full shared raycast geometry',()=>{
 const mesh=fixture(),g=mesh.geometry,idx=g.index,orig=idx.array.slice();
 const result=installOrderedArchitecture(mesh,1,3);assert.equal(result.leaves,6);
 const c=camera(0),light=camera(15);mesh.onBeforeRender(null,null,c,g,mesh.material,null);
 assert.deepEqual(g.drawRange,{start:18,count:18});
 mesh.onAfterRender();assert.equal(g.drawRange.count,Infinity);
 mesh.onBeforeShadow(null,mesh,c,light,g,mesh.material,null);
 assert.deepEqual(g.drawRange,{start:36,count:18});mesh.onAfterShadow();assert.equal(g.drawRange.count,Infinity);
 mesh.onBeforeRender(null,null,c,g,mesh.material,null);assert.deepEqual(g.drawRange,{start:18,count:18});mesh.onAfterRender();
 mesh.position.x=100;mesh.updateMatrixWorld();mesh.onBeforeRender(null,null,c,g,mesh.material,null);assert.equal(g.drawRange.count,0);mesh.onAfterRender();
 assert.equal(g.index,idx);assert.deepEqual(g.index.array,orig);
});
test('leaves small batches, grouped materials, authored draw ranges and custom callbacks alone',()=>{
 for(const type of ['small','group','range','hook']){
  const m=fixture();if(type==='group')m.geometry.addGroup(0,9,0);
  if(type==='range')m.geometry.setDrawRange(0,18);if(type==='hook')m.onBeforeRender=()=>{};
  assert.equal(installOrderedArchitecture(m,type==='small'?1000:1),undefined);
 }
});
