import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import data from '../public/data/approach-soma.json' with {type:'json'};
import {approachBillboards,anthropicCopy,buildApproachBillboards,spaceXCopy,palantirCopy,palantirLines} from '../app/approach-billboards.ts';
import {approachDistance,approachGround,approachLengths,approachPose,buildApproachRoad} from '../app/approach-road.ts';
import {addBridgeDeck} from '../app/bridge-deck.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import {openingCamera,openingLens,orbitPitch} from '../app/camera.ts';
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

test('bridge displays retain their historic roadside metadata, custom lettering and baked Karp portrait',()=>{
  const root=new THREE.Group(),font=new FontLoader().parse(fontData);
  const group=buildApproachBillboards(addMesh,root,font);
  assert.equal(group.children.length,5);
  for(const [i,billboard] of group.children.entries()){
    const site=approachBillboards[i];
    assert.equal(billboard.name,site.name);
    if(i<4)assert.deepEqual(billboard.userData.location,{latitude:site.latitude,longitude:site.longitude});

  }
  const [yahoo,coke,anthropic,spacex,palantir]=group.children;
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
  assert.equal(palantirCopy,"Reliable. Dependable. You're Experiencing Compassionate Data Monitoring");
  for(const line of palantirLines)assert.ok(palantir.getObjectByName(line));
  const portrait=palantir.getObjectByName('Alex Karp portrait');
  assert.match(portrait.userData.credit,/Benamischarfstein.*CC BY-SA 4.0/);
  root.updateMatrixWorld(true);
  const baked=bakeBlocks([portrait],new THREE.MeshStandardMaterial({vertexColors:true}))[0];
  const pigments=baked.geometry.getAttribute('color');
  assert.ok(new Set(pigments.array).size>150);
  assert.ok(pigments.count>=48*48);
});

test('four cleats per sign bear on both real bridge chords and all components clear the traffic deck',()=>{
  const bridge=new THREE.Group();
  const deck=addBridgeDeck(bridge,addMesh,bridgeLayout.length,bridgeLayout.lowerDeck,bridgeLayout.upperDeck);
  const signs=buildApproachBillboards(addMesh,bridge,new FontLoader().parse(fontData));
  bridge.updateMatrixWorld(true);
  const chords=deck.children.filter(o=>o.position.x>0&&['Upper chord web','Lower chord web'].includes(o.name));
  assert.equal(chords.length,2);
  const bounds=o=>new THREE.Box3().setFromObject(o);
  const roadway=bounds(deck.getObjectByName('Upper westbound deck slab'));
  for(const sign of signs.children){
    const shoes=sign.children.filter(o=>o.name==='Chord mounting shoe');
    assert.equal(shoes.length,4);
    assert.ok(bounds(sign).min.x>roadway.max.x,sign.name+' intrudes on the lanes');
    for(const chord of chords)assert.equal(shoes.filter(o=>bounds(chord).intersectsBox(bounds(o))).length,2);
  }
});

test('each bridge sign has a readable, unobstructed desktop and mobile Ferry orbit view',()=>{
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const scenery=[...world.architectureChunks];
  world.relief.root.traverse(o=>{if(o instanceof THREE.Mesh)scenery.push(o);});
  const home=new THREE.Vector3(...openingCamera.target);
  const closeViews=[
    [[1.582,5.50],[1.684,9.00]],
    [[1.716,4.25],[1.821,4.25]],
    [[1.628,5.25],[1.502,9.00]],
    [[1.640,5.50],[1.736,7.25]],
    [[1.503,5.00],[1.614,8.25]],
  ];
  const boxes=scenery.map(o=>new THREE.Box3().setFromObject(o)),ray=new THREE.Raycaster();
  const casePane=world.root.getObjectByName('Sinbad display glass');
  assert.ok(casePane?.isMesh&&casePane.material.transparent&&!casePane.material.depthWrite);
  assert.equal(world.root.getObjectByName('HILLS BROS COFFEE').material,world.coffeeMaterial);
  for(const [i,site] of approachBillboards.entries()){
    const sign=world.root.getObjectByName(site.name);
    const local=(x,y,z)=>sign.localToWorld(new THREE.Vector3(x,y,z));
    const [desktop,mobile]=closeViews[i];
    for(const [width,height,yaw,zoom] of [[1440,940,...desktop],[390,844,...mobile]]){
      const lens=openingLens(width,height),r=Math.hypot(lens.elevation,lens.distance);
      const a=orbitPitch(yaw,-.095,Math.atan2(lens.elevation,lens.distance));
      const eye=new THREE.Vector3(r*Math.cos(a)*Math.sin(yaw),r*Math.sin(a),r*Math.cos(a)*Math.cos(yaw)).add(home);
      const camera=new THREE.PerspectiveCamera(20,width/height,.35,1800);
      camera.setFocalLength(lens.focalLength*zoom);camera.position.copy(eye);camera.lookAt(home);camera.updateMatrixWorld();
      const normal=new THREE.Vector3(0,0,1).transformDirection(sign.matrixWorld);
      assert.ok(normal.dot(eye.clone().sub(local(0,0,0)).normalize())>.8);
      const faceDepth=i===1?.07:.036;
      for(const x of [-.44,0,.44])for(const y of [-.38,0,.38]){
        const target=local(x*site.width,y*site.height,faceDepth),d=target.clone().sub(eye);
        const ndc=target.clone().project(camera);
        assert.ok(Math.max(Math.abs(ndc.x),Math.abs(ndc.y))<.95&&ndc.z>0&&ndc.z<1,'Outside orbit view '+site.name);
        ray.set(eye,d.clone().normalize());ray.far=d.length()+.15;
        const hit=ray.intersectObjects(scenery.filter((o,j)=>ray.ray.intersectsBox(boxes[j])),false)[0];
        assert.ok(hit&&hit.point.distanceTo(target)<.26,'Obstructed face '+site.name);
      }
      // These are the actual heights of the name, script, or smallest line of the main copy.
      const letterHeight=site.height*[.275,.67,.155,.205,.132][i];
      const top=local(0,letterHeight*.5,faceDepth).project(camera),bottom=local(0,-letterHeight*.5,faceDepth).project(camera);
      assert.ok((top.y-bottom.y)*height/2>8.5,'Lettering too small on '+site.name);
    }
  }
});
