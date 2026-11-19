import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {addProvidianBuilding} from '../app/providian-building.ts';

test('Pacific Gateway resolves the two mapped parts once and keeps the measured roof and podium steps',()=>{
  const root=new THREE.Group(),windows=[];
  for(const id of [32862919,616813259]){
    const record=sfMap.buildings.find(b=>b.id===id);
    assert.ok(addProvidianBuilding(record,root,windows));
  }
  assert.equal(addProvidianBuilding({id:0,p:[],h:1},root,windows),false);
  assert.equal(root.children.length,2);
  for(const [name,expected] of [['Stepped podium roof',.84],['Lower end terraces',1.22],
    ['End shoulder terraces',7.31],['Main roof',7.648],['Mechanical enclosure roof',8.112]]){
    assert.ok(Math.abs(new THREE.Box3().setFromObject(root.getObjectByName(name)).max.y-expected)<.001);
  }
  assert.ok(windows.length>180&&windows.length<600);
  for(const w of windows)assert.ok(w.w>0&&w.h>0&&[w.x,w.y,w.z,w.ry].every(Number.isFinite));
});

test('a baked Mission-facing bay retains a real precast return, recessed glass and floor spandrel',()=>{
  const root=new THREE.Group(),lights=[];
  addProvidianBuilding(sfMap.buildings.find(b=>b.id===616813259),root,lights);
  root.updateMatrixWorld(true);
  const meshes=[];root.traverse(obj=>{if(obj.isMesh)meshes.push(obj);});
  const block=bakeRigidChunk('Pacific Gateway test',meshes,new THREE.MeshStandardMaterial({vertexColors:true}));
  const a=new THREE.Vector3(-16.77,0,-23.95),b=new THREE.Vector3(-16.93,0,-25);
  const axis=b.clone().sub(a).normalize(),out=new THREE.Vector3(-axis.z,0,axis.x);
  assert.ok(out.x>.95);
  const ray=new THREE.Raycaster(),width=a.distanceTo(b)/5;
  function hit(at,y){
    const atWall=a.clone().addScaledVector(axis,at);atWall.y=y;
    ray.set(atWall.clone().addScaledVector(out,.2),out.clone().negate());ray.far=.26;
    const hit=ray.intersectObject(block)[0];assert.ok(hit);
    return {depth:hit.point.sub(atWall).dot(out),red:block.geometry.attributes.color.getX(hit.face.a)};
  }
  const floor=(7.31-1.22)/24,base=1.22+14*floor;
  const pane=hit(width*2.5,base+floor*.62),column=hit(width*2,base+floor*.62),spandrel=hit(width*2.5,base+floor*.2);
  assert.ok(column.depth-pane.depth>.025&&column.red>pane.red*3);
  assert.ok(spandrel.depth>pane.depth+.004&&spandrel.red>pane.red*2);
  assert.ok(block.geometry.index.count/3<7500);
});

test('upper Mission-facing shaft glazing is on screen and has a clear architectural sightline from the fixed waterfront viewpoint',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const root=new THREE.Group(),slots=[];
  addProvidianBuilding(sfMap.buildings.find(b=>b.id===616813259),root,slots);
  const eye=new THREE.Vector3(49.180768,10.9,16.889407),target=new THREE.Vector3(0,2.4,0);
  const camera=new THREE.PerspectiveCamera(20,1440/940,.35,1800);
  camera.position.copy(eye);camera.lookAt(target);camera.setFocalLength(40);camera.updateMatrixWorld(true);
  const chunks=world.architectureChunks.map(mesh=>({mesh,box:new THREE.Box3().setFromObject(mesh)}));
  const facing=slots.filter(w=>Math.sin(w.ry)>.9&&w.y>5.4&&w.y<7.3);
  const ray=new THREE.Raycaster();
  let visible=0;
  for(const w of facing){
    const p=new THREE.Vector3(w.x,w.y,w.z),screen=p.clone().project(camera);
    if(Math.abs(screen.x)>=1||Math.abs(screen.y)>=1||Math.abs(screen.z)>=1)continue;
    const d=p.clone().sub(eye);ray.far=d.length()-.015;ray.set(eye,d.normalize());
    if(!ray.intersectObjects(chunks.filter(c=>ray.ray.intersectsBox(c.box)).map(c=>c.mesh),false).length)visible++;
  }
  assert.ok(visible>=3,'At least three distinct upper panes must clear the surrounding buildings');
});
