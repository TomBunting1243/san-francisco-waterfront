import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import data from '../public/data/approach-soma.json' with {type:'json'};
import {approachBillboards,displayRoofs,anthropicCopy,buildApproachBillboards,spaceXCopy} from '../app/approach-billboards.ts';
import {approachDistance,approachGround,approachLengths,approachPose,buildApproachRoad} from '../app/approach-road.ts';
import {openingLens,orbitPitch} from '../app/camera.ts';
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

test('four displays retain their historic roadside metadata and custom advertising copy',()=>{
  const root=new THREE.Group(),font=new FontLoader().parse(fontData);
  const group=buildApproachBillboards(addMesh,root,font);
  assert.equal(group.children.length,4);
  for(const [i,billboard] of group.children.entries()){
    const site=approachBillboards[i];
    assert.equal(billboard.name,site.name);
    assert.deepEqual(billboard.userData.location,{latitude:site.latitude,longitude:site.longitude});
    assert.equal(billboard.userData.displayRoof.id,displayRoofs[i].id);

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

test('the four billboard racks meet mapped roofs and their faces are visible from the Ferry orbit',()=>{
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const scenery=[...world.architectureChunks];
  world.relief.root.traverse(o=>{if(o instanceof THREE.Mesh)scenery.push(o);});
  const home=new THREE.Vector3(0,2.4,0);
  // Real user controls on a fixed Ferry orbit. Reserve space for the controls
  // and heading and check physical line of sight at the same magnification.
  const closeViews=[
    [[1.525,-.04,5.75],[1.4,.05,5.25]],
    [[1.10,-.095,3.5],[1.30,-.095,5.75]],
    [[1.575,-.075,20],[1.60,-.095,17.25]],
    [[1.25,-.095,20],[1.275,-.075,20]],
  ];
  const boxes=scenery.map(o=>new THREE.Box3().setFromObject(o)),ray=new THREE.Raycaster();
  function hit(origin,direction,distance){
    ray.set(origin,direction);ray.far=distance;
    return ray.intersectObjects(scenery.filter((o,i)=>ray.ray.intersectsBox(boxes[i])),false)[0];
  }
  const casePane=world.root.getObjectByName('Sinbad display glass');
  assert.ok(casePane?.isMesh&&casePane.material.transparent&&!casePane.material.depthWrite,'The baked scene must preserve transparent display glass');
  const neon=world.root.getObjectByName('HILLS BROS COFFEE');
  assert.equal(neon.material,world.coffeeMaterial,'The sign tubes must retain their night-lighting material');
  for(const [i,site] of approachBillboards.entries()){
    const sign=world.root.getObjectByName(site.name),roof=displayRoofs[i],base=roof.y-sign.position.y;
    const local=(x,y,z)=>sign.localToWorld(new THREE.Vector3(x,y,z));
    for(const side of [-1,1])for(const foot of i===1?[.16,.32,.47]:[.29,.45])for(const depth of [.016*1.25,-(i===1?.35:.22)*1.25]){
      const p=local(site.width*side*foot*1.06,base+.004,depth);
      const surface=hit(p,new THREE.Vector3(0,-1,0),.020);
      assert.ok(surface&&Math.abs(surface.point.y-roof.y)<.009,'Rack foot unsupported on '+roof.name+' '+p.toArray());
    }
    const [desktop,mobile]=closeViews[i];
    for(const [width,height,yaw,tilt,zoom] of [[1440,940,1.24,0,1],[1440,940,...desktop],[390,844,...mobile]]){
      const lens=openingLens(width,height),r=Math.hypot(lens.elevation,lens.distance);
      const a=orbitPitch(yaw,tilt,Math.atan2(lens.elevation,lens.distance));
      const eye=new THREE.Vector3(r*Math.cos(a)*Math.sin(yaw),r*Math.sin(a),r*Math.cos(a)*Math.cos(yaw)).add(home);
      const camera=new THREE.PerspectiveCamera(20,width/height,.35,1800);
      camera.setFocalLength(lens.focalLength*zoom);camera.position.copy(eye);camera.lookAt(home);camera.updateMatrixWorld();
      for(const x of [-.32,0,.32])for(const y of [-.22,0,.22]){
        const target=local(x*site.width,y*site.height,i===1?.07:.035),d=target.clone().sub(eye);
        const ndc=target.clone().project(camera);
        assert.ok(Math.max(Math.abs(ndc.x),Math.abs(ndc.y))<.99&&ndc.z>0&&ndc.z<1,'Outside orbit view '+site.name);
        const surface=hit(eye,d.clone().normalize(),d.length()+.14);
        assert.ok(surface&&surface.point.distanceTo(target)<.10,'Obstructed face '+site.name+' '+[width,zoom,x,y,surface?.point.distanceTo(target)]);
      }
    }
  }
});
