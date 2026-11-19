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

test('large internal gaps save submissions while preserving every potentially visible primitive in source order',()=>{
  const geo=new T.BufferGeometry(),positions=[],indices=[],centers=[];
  // Several disjoint offscreen runs compete for the three supplemental draws.
  for(const [x,count] of [[0,2048],[15,16384],[0,1024],[-15,12288],[0,2048],[15,10240],[0,1024],[-15,18432],[0,2048],[15,9216],[0,1024]]){
    const i=positions.length/3;positions.push(x-.2,0,0,x+.2,0,0,x,.6,0);
    for(let j=0;j<count;j++){indices.push(i,i+1,i+2);centers.push(x);}
  }
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);
  const mat=new T.MeshBasicMaterial(),mesh=new T.Mesh(geo,mat),idx=geo.index;
  const scene=new T.Scene(),shader={renderBufferDirect(cam,scope,g,material,object,group){
    assert.equal(object,mesh);assert.equal(material,mat);assert.equal(scope,scene);assert.deepEqual(group,{start:0,count:idx.count,materialIndex:0});
    drawn.push([g.drawRange.start/3,g.drawRange.count/3]);
  }};
  installOrderedArchitecture(mesh);
  let drawn=[];
  const ray=new T.Raycaster(new T.Vector3(0,.2,2),new T.Vector3(0,0,-1));
  function render(x){
    const c=camera(x);drawn=[];
    mesh.onBeforeRender(shader,scene,c,geo,mat,null);
    drawn.push([geo.drawRange.start/3,geo.drawRange.count/3]);
    mesh.onAfterRender(shader,scene,c,geo,mat,null);
    assert.deepEqual(geo.drawRange,{start:0,count:Infinity});assert.equal(geo.index,idx);
    const surviving=[];
    for(const [start,count] of drawn)for(let j=start;j<start+count;j++)if(centers[j]===x)surviving.push(j);
    assert.deepEqual(surviving,centers.flatMap((v,j)=>v===x?[j]:[]));
    return drawn;
  }
  const ranges=render(0);
  assert.equal(ranges.length,4);
  assert.equal(ranges.reduce((n,[,count])=>n+count,0),centers.length-18432-16384-12288);
  const vignette=mesh.clone(); // Regional copies share geometry but have their own render hooks.
  assert.equal(vignette.geometry,geo);
  assert.equal(ray.intersectObject(mesh,false).length,centers.filter(x=>x===0).length);
  vignette.onBeforeRender(shader,scene,camera(-15),geo,mat,null);
  assert.deepEqual(vignette.geometry.drawRange,{start:0,count:Infinity});
  const light=camera(15);
  mesh.onBeforeShadow(shader,mesh,camera(0),light,geo,mat);
  assert.equal(geo.drawRange.start/3,2048);
  mesh.onAfterShadow();assert.equal(geo.drawRange.count,Infinity);
  render(-15);render(0);
  scene.overrideMaterial=new T.MeshDepthMaterial();
  assert.equal(render(0).length,1);
  scene.overrideMaterial=null;mat.transparent=true;assert.equal(render(0).length,1);
});

test('a supplemental draw failure restores the full raycast range',()=>{
  const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,.3,0,0,0,.4,0, 50,0,0,50.3,0,0,50,.4,0],3));
  const indices=new Uint32Array(3*70016);
  for(let i=0;i<indices.length;i++)indices[i]=(i>=192&&i<indices.length-192?3:0)+i%3;
  geo.setIndex(new T.BufferAttribute(indices,1));const mat=new T.MeshBasicMaterial(),m=new T.Mesh(geo,mat);
  installOrderedArchitecture(m);
  const r={renderBufferDirect(){throw Error('lost frame');}},s=new T.Scene(),c=camera(0);
  m.onBeforeRender(r,s,c,geo,mat,null);
  assert.throws(()=>m.onAfterRender(r,s,c,geo,mat,null),/lost frame/);
  assert.deepEqual(geo.drawRange,{start:0,count:Infinity});
});
