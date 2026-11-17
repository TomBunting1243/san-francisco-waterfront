import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import data from '../public/data/approach-soma.json' with {type:'json'};
import {approachBillboards,anthropicCopy,buildApproachBillboards,spaceXCopy} from '../app/approach-billboards.ts';
import {approachDistance,approachGround,approachLengths,approachPose,buildApproachRoad} from '../app/approach-road.ts';
import {bridgeLayout} from '../app/bridge-layout.ts';
import {createLandscape} from '../app/landscape.ts';

function addMesh(geometry,color,x,y,z,parent){
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color}));
  parent.add(mesh);mesh.position.set(x,y,z);return mesh;
}

test('the Skyway continues from both suspension decks past Sixth with supported flyovers',()=>{
  assert.equal(data.ramps.length,11);
  for(const [index,road] of [data.west,data.east].entries()){
    const east=index===1,span=east?bridgeLayout.lowerDeck+.058:bridgeLayout.upperDeck+.0755;
    const start=approachPose(east,0,0);
    assert.equal(start.x,bridgeLayout.origin[0]);assert.equal(start.z,bridgeLayout.origin[1]);
    assert.ok(Math.abs(start.y+.01375-span)<1e-6);
    const end=approachPose(east,approachLengths[index],0);
    assert.ok(end.z< -148&&end.y-approachGround(end.x,end.z)>.5);
    for(let distance=1;distance<approachLengths[index]-.5;distance+=.7){
      const a=approachPose(east,distance-.04,0),b=approachPose(east,distance+.04,0);
      assert.ok((Math.cos(a.heading)*(b.x-a.x)-Math.sin(a.heading)*(b.z-a.z))*(east?-1:1)>.04);
      assert.ok(Math.abs(a.y-b.y)<.02);
      assert.ok(approachDistance(a.x,a.z,road.points)<.13);
    }
  }
});

test('approach traffic updates in four batches and construction stays finite',()=>{
  const root=new THREE.Group();
  const update=buildApproachRoad(addMesh,root);
  const traffic=root.children[0].children.filter(o=>o instanceof THREE.InstancedMesh);
  assert.equal(traffic.length,4);
  const matrix=new THREE.Matrix4();
  traffic[0].getMatrixAt(0,matrix);
  const before=matrix.clone();
  update(3);
  traffic[0].getMatrixAt(0,matrix);
  assert.ok(!before.equals(matrix));
  assert.ok(traffic.every(o=>o.count===15&&o.instanceMatrix.array.every(Number.isFinite)));
  const piers=root.children[0].children.filter(o=>o.name==='Concrete pier');
  assert.ok(piers.length>100);
  assert.ok(piers.every(o=>o.scale.y>.09&&Number.isFinite(o.position.y)));
});

test('four billboards preserve their ordered roadside sites and custom advertising copy',()=>{
  const root=new THREE.Group(),font=new FontLoader().parse(fontData);
  const group=buildApproachBillboards(addMesh,root,font);
  assert.equal(group.children.length,4);
  for(const [i,billboard] of group.children.entries()){
    const site=approachBillboards[i];
    assert.equal(billboard.name,site.name);
    const x=billboard.position.x,z=billboard.position.z;
    assert.ok(approachDistance(x,z,data.west.points)<12);
    assert.ok(billboard.position.y>approachGround(x,z)+.5);
  }
  const [yahoo,coke,anthropic,spacex]=group.children;
  const vacancy=yahoo.getObjectByName('VACANCY');
  assert.ok(vacancy.userData.signLight[0]>vacancy.userData.signLight[1]);
  assert.ok(yahoo.children.some(mesh=>mesh.userData.signLight?.[1]>.8),'Yahoo chase bulbs include a bright green arrow');
  const cokeFaces=coke.children.filter(o=>o.type==='Group');
  assert.equal(cokeFaces.length,2);
  for(const face of cokeFaces)assert.ok(face.getObjectByName('Coca-Cola script').userData.signLight[0]>.8);
  assert.ok(anthropic.children.some(mesh=>mesh.userData.signLight?.[0]===.29));
  assert.equal(Math.abs(cokeFaces[0].rotation.y-cokeFaces[1].rotation.y),Math.PI);
  assert.equal(anthropicCopy,'Building an equitable future, one trillion dollar IPO at a time');
  assert.ok(anthropic.getObjectByName('Building an equitable future,'));
  assert.ok(anthropic.getObjectByName('one trillion dollar IPO at a time'));
  assert.ok(spacex.getObjectByName(spaceXCopy));
});

test('Yahoo and the Bryant Street billboard clear their actual roofs and face the open approach',()=>{
  const world=createLandscape();
  world.root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),visibleTerrain=[...world.architectureChunks];
  world.relief.root.traverse(object=>{if(object instanceof THREE.Mesh)visibleTerrain.push(object);});
  for(const [index,roofHeight] of [[0,.253],[3,.210]]){
    const site=approachBillboards[index];
    const sign=world.root.getObjectByName(site.name);
    const pivot=sign.getWorldPosition(new THREE.Vector3());
    const local=(x,y,z)=>sign.localToWorld(new THREE.Vector3(x,y,z));
    const normal=new THREE.Vector3(0,0,1).transformDirection(sign.matrixWorld);
    const target=local(0,0,.032);
    // Cast from the road-facing side through the packed terrain and buildings.
    for(const angle of [0,22,41]){
      const a=THREE.MathUtils.degToRad(angle),eye=local(6*Math.sin(a),1.48,6*Math.cos(a));
      ray.set(eye,target.clone().sub(eye).normalize());
      ray.far=eye.distanceTo(target)+.12;
      const hit=ray.intersectObjects(visibleTerrain,false)[0];
      assert.ok(hit&&hit.point.distanceTo(target)<.06,'A foreground building hides '+site.name);
      assert.ok(hit.face.normal.dot(normal)>.8,'The ray must hit the front face');
    }
    const aboveRoof=local(0,10,-.15);
    ray.set(aboveRoof,new THREE.Vector3(0,-1,0));
    ray.far=20;
    const roof=ray.intersectObjects(visibleTerrain,false)
      .find(hit=>hit.point.y<pivot.y-site.height/2-.09);
    assert.ok(roof&&Math.abs(roof.point.y-roofHeight)<.018,'Missing mapped roof beneath '+site.name);
    assert.ok(roof.point.y>approachGround(aboveRoof.x,aboveRoof.z)+.24,'Sign should stand on its building');
    assert.ok(pivot.y-site.height/2-roof.point.y>.12,'Roof buries the billboard face');
  }
});
