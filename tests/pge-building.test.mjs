import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {addPgeBuilding} from '../app/pge-building.ts';
import {openingCamera} from '../app/camera.ts';

const tower=sfMap.buildings.find(b=>b.id===260291405),link=sfMap.buildings.find(b=>b.id===260291408);
function model(){
  const root=new THREE.Group(),windows=[];
  assert.ok(addPgeBuilding(tower,root,windows));assert.ok(addPgeBuilding(link,root,windows));
  assert.equal(addPgeBuilding({...tower,id:1279504251},root,windows),false);
  root.updateMatrixWorld(true);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const block=bakeRigidChunk('77 Beale test',meshes,new THREE.MeshStandardMaterial({vertexColors:true}));
  return {root,windows,block};
}
function probe(block,i,j,fraction,y){
  const a=tower.p[i],b=tower.p[j],dx=b[0]-a[0],dz=b[1]-a[1];
  const point=new THREE.Vector3(a[0]+dx*fraction,y,a[1]+dz*fraction),normal=new THREE.Vector3(dz,0,-dx).normalize();
  const ray=new THREE.Raycaster(point.clone().addScaledVector(normal,.25),normal.clone().negate(),0,.36);
  const hit=ray.intersectObject(block)[0];assert.ok(hit);
  return {depth:hit.point.sub(point).dot(normal),red:block.geometry.attributes.color.getX(hit.face.a)};
}
test('77 Beale has ten- and eight-bay granite elevations, three smoked lights per bay and a deep screened crown',()=>{
  const {block}=model(),y=.48+(7.835-.48)/31*20.62;
  for(const [i,j,n] of [[2,4,10],[6,7,8],[9,10,10],[12,0,8]]){
    for(let k=0;k<n;k++){
      const rib=probe(block,i,j,(k+.055)/n,y);
      const lights=[.23,.50,.77].map(t=>probe(block,i,j,(k+t)/n,y));
      assert.ok(lights.every(t=>t.depth<rib.depth-.010&&t.red<rib.red*.45));
      assert.equal(new Set(lights.map(t=>t.red)).size,3);
    }
    const window=probe(block,i,j,.5/n,y),screen=probe(block,i,j,.52/n,8.14),hood=probe(block,i,j,.52/n,8.59);
    assert.ok(screen.depth<window.depth-.032&&hood.depth>screen.depth+.04);
  }
  assert.ok(block.geometry.index.count/3<13000);
});
test('the service connection shares its tower edge and has a 21.4 m surveyed roof below the 144.5 m main roof',()=>{
  const {root}=model();
  assert.deepEqual(link.p[0],tower.p[4]);assert.deepEqual(link.p[1],tower.p[3]);
  const roof=name=>new THREE.Box3().setFromObject(root.getObjectByName(name)).max.y;
  assert.ok(Math.abs(roof('Main-side service roof')-1.286)<.0001);
  assert.ok(Math.abs(roof('77 Beale parapet roof')-8.668)<.0001);
  assert.ok(Math.abs(roof('77 Beale penthouse')-8.945)<.0001);
});
test('the opening camera reaches the registered upper Main Street bays between neighboring buildings',async()=>{
  const {block,windows}=model(),lens=openingCamera.desktop;
  const target=new THREE.Vector3(...openingCamera.target);
  const eye=new THREE.Vector3(Math.sin(openingCamera.yaw)*lens.distance,lens.elevation,Math.cos(openingCamera.yaw)*lens.distance).add(target);
  const camera=new THREE.PerspectiveCamera(20,1440/940,.35,1800);
  camera.position.copy(eye);camera.lookAt(target);camera.setFocalLength(lens.focalLength);camera.updateMatrixWorld();
  const {createLandscape}=await import('../app/landscape.ts');
  const city=createLandscape();city.root.updateMatrixWorld(true);
  assert.ok(city.root.getObjectByName('77 Beale PG&E tower'));
  assert.ok(city.root.getObjectByName('77 Beale Main-side service connection'));
  const chunks=city.architectureChunks.map(o=>({o,box:new THREE.Box3().setFromObject(o)}));
  const ray=new THREE.Raycaster();
  const hits=windows.filter(w=>{
    if(w.y<5||Math.cos(w.ry)<.85)return false;
    const p=new THREE.Vector3(w.x,w.y,w.z),ndc=p.clone().project(camera);
    if(Math.abs(ndc.x)>=1||Math.abs(ndc.y)>=1||Math.abs(ndc.z)>=1)return false;
    const d=p.clone().sub(eye);ray.set(eye,d.clone().normalize());ray.far=d.length()+.03;
    if(!(ray.intersectObject(block)[0]?.point.distanceTo(p)<.025))return false;
    const hit=ray.intersectObjects(chunks.filter(c=>ray.ray.intersectsBox(c.box)).map(c=>c.o),false)[0];
    return hit&&hit.point.distanceTo(p)<.025;
  });
  assert.ok(hits.length>=10);
});
