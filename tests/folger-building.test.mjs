import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import {addFolgerBuilding} from '../app/folger-building.ts';

test('the Folger factory and its lower warehouse occupy their adjacent parcels and expose their different elevations',()=>{
  const root=new THREE.Group(),lit=[];
  const factory=sfMap.buildings.find(b=>b.id===192305909),warehouse=sfMap.buildings.find(b=>b.id===192305907);
  assert.deepEqual(factory.p[1],warehouse.p[1]);
  assert.deepEqual(factory.p[2],warehouse.p[2]);
  assert.ok(addFolgerBuilding(factory,root,lit));
  assert.ok(addFolgerBuilding(warehouse,root,lit));
  assert.equal(addFolgerBuilding({...factory,id:0},root,lit),false);
  root.updateMatrixWorld(true);
  const howard=root.getObjectByName('Nine Howard Street bays'),spear=root.getObjectByName('Six Spear Street bays'),storage=root.getObjectByName('Spear Street warehouse front');
  assert.equal(howard.getObjectsByProperty('name','Paired mullion').length,45);
  assert.equal(spear.getObjectsByProperty('name','Paired mullion').length,30);
  assert.equal(storage.getObjectsByProperty('name','Paired mullion').length,4);
  assert.equal(howard.getObjectsByProperty('name','Historic iron fire balcony').length,4);
  assert.equal(lit.length,158);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const baked=bakeBlocks(meshes,new THREE.MeshStandardMaterial({vertexColors:true}));
  const ray=new THREE.Raycaster();
  function surface(face,x,y){
    const p=face.localToWorld(new THREE.Vector3(x,y,.17));
    const dir=new THREE.Vector3(0,0,-1).transformDirection(face.matrixWorld);
    ray.set(p,dir);ray.far=.24;
    const hit=ray.intersectObjects(baked,false)[0];
    assert.ok(hit,'No surface at '+face.name+' '+[x,y]);
    return {z:face.worldToLocal(hit.point.clone()).z,color:hit.object.geometry.getAttribute('color').getX(hit.face.a)};
  }
  const width=Math.hypot(factory.p[0][0]-factory.p[3][0],factory.p[0][1]-factory.p[3][1]);
  const step=width/9,bay=step*.5;
  const glazed=surface(howard,bay-.038,1.23),masonry=surface(howard,bay+step*.45,1.23);
  assert.ok(glazed.z<masonry.z-.019&&glazed.color<masonry.color*.5);
  const archCrown=surface(howard,bay-.017,1.324),archHaunch=surface(howard,bay+step*.30,1.324);
  assert.ok(archCrown.z<archHaunch.z-.012,'The arched head must admit glazing at its center');
  assert.ok(surface(howard,step*4.5-.02,.064).color<masonry.color*.5,'Recessed street entrance opens at sidewalk level');
  const factoryRoof=new THREE.Box3().setFromObject(root.children[0].getObjectByName('Flat roofing')).max.y;
  const lowerRoof=new THREE.Box3().setFromObject(root.children[1].getObjectByName('Flat roofing')).max.y;
  const raisedRoof=new THREE.Box3().setFromObject(storage.getObjectByName('Warehouse roof coping')).max.y;
  assert.ok(factoryRoof-lowerRoof>.34&&raisedRoof<factoryRoof&&raisedRoof>lowerRoof+.18);
});

test('an upper Howard Street bay has a clear line of sight from the elevated waterfront viewpoint',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const face=world.root.getObjectByName('Nine Howard Street bays');
  const target=face.localToWorld(new THREE.Vector3(.72,1.158,.003));
  // This elevation clears the surveyed roof of Rincon Center II on Spear.
  const eye=new THREE.Vector3(50.866087,7.504430,12.760722),home=new THREE.Vector3(0,2.4,0);
  const camera=new THREE.PerspectiveCamera(20,1440/940,.35,1800);
  camera.position.copy(eye);camera.setFocalLength(40*4.5);camera.lookAt(home);camera.updateMatrixWorld();
  const screen=target.clone().project(camera);
  assert.ok(Math.abs(screen.x)<.94&&Math.abs(screen.y)<.94&&screen.z<1);
  const delta=target.clone().sub(eye),ray=new THREE.Raycaster(eye,delta.clone().normalize(),0,delta.length()+.06);
  const chunks=world.architectureChunks.filter(o=>ray.ray.intersectsBox(new THREE.Box3().setFromObject(o)));
  const hit=ray.intersectObjects(chunks,false)[0];
  assert.ok(hit&&hit.point.distanceTo(target)<.075);
});
