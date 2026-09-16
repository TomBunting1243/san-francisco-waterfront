import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createLandscape } from '../app/landscape.ts';
import { pacificLighting } from '../app/lighting.ts';
import { sfMap, mappedBuildings, center } from '../app/sf-map.ts';
import { streetPose } from '../app/streets.ts';
import { bridgeLayout, bridgePoint } from '../app/bridge-layout.ts';

test('detailed geometry stays finite and uses batched rendering',()=>{
  const scene=createLandscape();let meshes=0,windows=0;
  scene.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){if(o instanceof THREE.Mesh)meshes++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));if(o instanceof THREE.InstancedMesh){windows+=o.count;for(const v of o.instanceMatrix.array)assert.ok(Number.isFinite(v));}}});
  assert.ok(meshes<240,`Too many separately culled batches: ${meshes}`);assert.ok(scene.architectureChunks.length>20);assert.ok(windows>3000);
  assert.equal(scene.hitTargets.length,3);assert.equal(scene.clockHands.length,4);
});
test('Pacific daylight and standard time are independent of the visitor timezone',()=>{
  for(const [date,hour,phase] of [['2026-09-09T19:00:00Z',12,'day'],['2026-09-10T07:00:00Z',0,'night'],['2026-12-09T20:00:00Z',12,'day'],['2026-12-10T08:00:00Z',0,'night']]){
    const light=pacificLighting(new Date(date));assert.equal(light.hours,hour);assert.equal(light.phase,phase);
  }
});
test('Pacific clock handles both daylight-saving transitions',()=>{
  assert.equal(pacificLighting(new Date('2026-03-08T09:59:00Z')).hours,1);
  assert.equal(pacificLighting(new Date('2026-03-08T10:01:00Z')).hours,3);
  assert.equal(pacificLighting(new Date('2026-11-01T08:30:00Z')).hours,1);
  assert.equal(pacificLighting(new Date('2026-11-01T09:30:00Z')).hours,1);
});
test('sunset interpolates through warmer light into night',()=>{
  const day=pacificLighting(new Date('2026-09-09T22:00:00Z'));
  const evening=pacificLighting(new Date('2026-09-10T02:15:00Z'));
  const night=pacificLighting(new Date('2026-09-10T05:00:00Z'));
  assert.ok(day.night<evening.night);assert.ok(evening.night<night.night);
  assert.notEqual(day.sky,evening.sky);assert.notEqual(evening.sky,night.sky);
  assert.ok(day.sunIntensity>night.sunIntensity);
});

test('ferry lanes clear every pier and each other throughout a complete crossing',async()=>{
  const {ferryPose}=await import('../app/motion.ts');
  const world=createLandscape();
  const piers=sfMap.piers.filter(p=>p.closed).map(p=>new THREE.Box2().setFromPoints(p.p.map(([x,z])=>new THREE.Vector2(x,z))));
  for(let t=0;t<=600;t+=.5){
    const poses=[ferryPose(t,0),ferryPose(t,1)];
    for(const [i,p] of poses.entries()){

      assert.ok(Number.isFinite(p.x));
      world.ferries[i].position.set(p.x,p.y,p.z);world.ferries[i].rotation.y=p.heading;
      const bounds=new THREE.Box3().setFromObject(world.ferries[i]);
      assert.ok(bounds.max.y<3.4,'Vessel must clear the underside of the bridge');
      const hull=new THREE.Box2(new THREE.Vector2(bounds.min.x,bounds.min.z),new THREE.Vector2(bounds.max.x,bounds.max.z));
      for(const pier of piers)assert.ok(!hull.intersectsBox(pier),'Vessel intersects a mapped pier');
      for(const t of bridgeLayout.towers){const p=bridgePoint(0,t);assert.ok(hull.distanceToPoint(new THREE.Vector2(p.x,p.z))>1.5,'Vessel intersects a bridge caisson');}
    }
    assert.ok(Math.abs(poses[0].z-poses[1].z)>2,'Ferry shipping lanes overlap');
  }
});
test('birds travel, bank and flap rather than translating a static flock',async()=>{
  const {birdPose}=await import('../app/motion.ts');
  for(let i=0;i<7;i++){
    const a=birdPose(0,i),b=birdPose(7,i);
    assert.ok(Math.hypot(b.x-a.x,b.z-a.z)>2);
    assert.notEqual(a.flap,b.flap);assert.notEqual(a.heading,b.heading);
    for(const value of Object.values(b))assert.ok(Number.isFinite(value));
  }
});

test('San Francisco footprint positions preserve the waterfront skyline order',()=>{
  assert.ok(mappedBuildings.length>700);
  const find=name=>mappedBuildings.find(b=>b.name===name);
  assert.ok(center(find('Salesforce Tower').p)[0]<center(find('San Francisco Ferry Building').p)[0]);
  assert.ok(center(find('Transamerica Pyramid').p)[0]>center(find('San Francisco Ferry Building').p)[0]);
  assert.ok(find('Salesforce Tower').h>find('Transamerica Pyramid').h);
});
test('street traffic follows both curved carriageways without lane jumps',()=>{
  for(const direction of [-1,1]){
    let last=streetPose(-65,direction);
    for(let x=-64.95;x<65;x+=.05){const p=streetPose(x,direction);assert.ok(Number.isFinite(p.heading));assert.ok(Math.abs(p.z-last.z)<.6,`Road discontinuity at ${x}`);last=p;}
  }
  assert.ok(Math.abs(streetPose(-60).z-streetPose(0).z)>2);
});

test('Bay Bridge follows the mapped crossing and has two full suspension spans',()=>{
  const end=bridgePoint(0,bridgeLayout.length);
  assert.ok(Math.hypot(end.x+14.3286,end.z-160.9848)<.001);
  assert.equal(bridgeLayout.towers.length,4);
  assert.ok(Math.abs((bridgeLayout.towers[1]-bridgeLayout.towers[0])/.06-704.1)<1);
  assert.ok(bridgePoint(0,36.85).x<-45);
  assert.ok(bridgePoint(0,36.85).z>10);
});


test('opening composition keeps the Ferry Building and bridge tower inside desktop and phone frames', async()=>{
  const {openingCamera: view}=await import('../app/camera.ts');
  const bridge=bridgePoint(0,bridgeLayout.towers[0]);
  for(const [width,height] of [[1440,950],[1010,1031],[390,844]]){
    const setup=width<650?view.mobile:view.desktop;
    const camera=new THREE.PerspectiveCamera(20,width/height,1.5,650);
    camera.setFocalLength(setup.focalLength);camera.zoom=view.zoom;camera.updateProjectionMatrix();
    const target=new THREE.Vector3(...view.target);
    camera.position.copy(target).add(new THREE.Vector3(0,setup.elevation,setup.distance).applyAxisAngle(new THREE.Vector3(0,1,0),view.yaw));
    camera.lookAt(target);camera.updateMatrixWorld();
    for(const point of [new THREE.Vector3(0,4.6,0),new THREE.Vector3(bridge.x,9.8,bridge.z)]){
      point.project(camera);
      assert.ok(Math.abs(point.x)<.9&&Math.abs(point.y)<.8,`Landmark cropped at ${width}×${height}`);
      assert.ok(point.z>-1&&point.z<1);
    }
  }
});


test('cartoon walkers keep finite transforms while their arms and feet move',async()=>{
  const {createPeople}=await import('../app/people.ts');const crowd=createPeople();
  for(let i=0;i<22;i++)crowd.update(i,i*.3,0,0,i%2?1:-1);
  const before=crowd.group.children.map(mesh=>Array.from(mesh.instanceMatrix.array));
  for(let i=0;i<22;i++)crowd.update(i,i*.3,0,.3,i%2?1:-1);
  crowd.flush();
  crowd.group.children.forEach((mesh,index)=>{for(const v of mesh.instanceMatrix.array)assert.ok(Number.isFinite(v));assert.notDeepEqual(Array.from(mesh.instanceMatrix.array),before[index]);});
  assert.equal(crowd.heads.count,22);assert.ok(crowd.bodies.instanceColor);
});


test('ferry materials and wakes receive the same world-space haze as the waterfront',()=>{
  const world=createLandscape();
  const materials=new Set();
  for(const boat of world.ferries)boat.traverse(o=>{if(o instanceof THREE.Mesh)materials.add(o.material);});
  assert.ok(materials.size>3);
  materials.add(world.waterMaterial);
  for(const material of materials){
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <fog_fragment>'};
    material.onBeforeCompile(shader,{});
    assert.equal(shader.uniforms.edgeFogColor,world.edgeFogColor);
    assert.match(shader.vertexShader,/modelMatrix\*harborWorld/);
    assert.match(shader.fragmentShader,/mix\(gl_FragColor.rgb,edgeFogColor,edgeHaze\)/);
  }
  assert.equal(world.walkerHeads.count,22+world.residentPositions.length);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3();
  world.residentPositions.forEach((anchor,i)=>{
    world.walkerHeads.getMatrixAt(i+22,matrix);position.setFromMatrixPosition(matrix);
    assert.ok(Math.abs(position.x-anchor.x)<.05);
    assert.ok(position.y>anchor.y+.35);
  });
});


test('regional city views reuse geometry and exclude most of the full city',async()=>{
  const {createCityVignette}=await import('../app/landscape.ts');
  const full=createLandscape();
  for(const variant of ['street','plaza']){
    const view=createCityVignette(variant);
    assert.ok(view.architectureChunks.length<full.architectureChunks.length/3);
    for(const chunk of view.architectureChunks){assert.ok(full.architectureChunks.some(source=>source.geometry===chunk.geometry));assert.equal(chunk.userData.sharedGeometry,true);assert.notEqual(chunk.material,full.architectureChunks[0].material);}
    assert.ok(view.walkers.count<full.walkers.count);assert.equal(view.ferries.length,0);assert.ok(view.traffic.length>0);
  }
});

test('adaptive quality backs off under sustained load and avoids rapid oscillation',async()=>{
  const {createQualityMonitor,edgeOrbit,walkingTime}=await import('../app/city-runtime.ts');
  const quality=createQualityMonitor(2);let level;
  for(let i=0;i<120;i++)level=quality.sample(35,1000+i*35);
  assert.equal(level,1);
  for(let i=0;i<120;i++)level=quality.sample(16,6000+i*16);
  assert.equal(level,1,'cooldown prevents immediate quality bounce');
  for(let i=0;i<120;i++)level=quality.sample(16,20000+i*16);
  assert.equal(level,2);
  assert.equal(edgeOrbit(.99,.9),0);assert.equal(edgeOrbit(.5,.5),0);assert.ok(edgeOrbit(.99,.5)>0);
  for(let i=0;i<22;i++)for(let t=0;t<100;t+=.1){const delta=walkingTime(t+.01,i)-walkingTime(t,i);assert.ok(delta>=-1e-10&&delta<=.0100001,'no jumps or reverse steps around pauses');}
});


test('waterfront character windows avoid adjoining building volumes',async()=>{
  const {buildingCharacter,insideBuilding}=await import('../app/building-character.ts');
  const {FontLoader}=await import('three/addons/loaders/FontLoader.js');
  const {readFileSync}=await import('node:fs');
  const font=new FontLoader().parse(JSON.parse(readFileSync(new URL('../app/harbor-font.json',import.meta.url),'utf8')));
  for(const name of ['Hotel Griffon','Army and Navy Y.M.C.A. Building','1 Hotel San Francisco','Fireboat Station 35']){
    const parts=mappedBuildings.filter(b=>b.name===name);
    let panes=0;
    for(const b of parts){const detail=buildingCharacter(b,mappedBuildings,font);panes+=detail.windows.length;
      for(const p of detail.windows){assert.ok([p.x,p.y,p.z,p.w,p.h].every(Number.isFinite));assert.ok(p.w>0&&p.h>0);for(const neighbor of mappedBuildings.filter(n=>n.id!==b.id&&n.h>p.y&&p.y>(n.minH||0)))assert.ok(!insideBuilding(p.x,p.z,neighbor.p),`${name} has glazing buried inside ${neighbor.name}`);}
      detail.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
    }
    assert.ok(panes>5,`${name} lost its exposed glazing`);
  }
});

test('fireboat departs, salutes and returns without crossing piers or ferry lanes',async()=>{
  const {fireboatPose,fireboatCycle,createFireboat}=await import('../app/fireboat.ts');
  const {waterHeight}=await import('../app/water-surface.ts');
  const {insideBuilding}=await import('../app/building-character.ts');
  const dock=fireboatPose(0),again=fireboatPose(fireboatCycle);
  assert.equal(dock.x,again.x);assert.equal(dock.z,again.z);assert.equal(dock.spray,0);
  assert.equal(fireboatPose(16).phase,'departing');assert.ok(fireboatPose(45).spray>.99);assert.equal(fireboatPose(87).phase,'returning');
  assert.ok(Math.hypot(fireboatPose(45).x-dock.x,fireboatPose(45).z-dock.z)>12);
  const boat=createFireboat();let previous=fireboatPose(0);
  for(let t=0;t<=fireboatCycle*2;t+=.25){
    const pose=boat.update(t);assert.ok([pose.x,pose.y,pose.z,pose.heading,pose.spray].every(Number.isFinite));
    const surface=waterHeight(pose.x,pose.z,t);assert.ok(pose.y-.13<surface&&pose.y+.23>surface,'hull sits in the water with its deck above it');
    assert.ok(Math.hypot(pose.x-previous.x,pose.z-previous.z)<.3,'continuous speed at phase boundaries');previous=pose;
    assert.ok(pose.z+1.4<28,'stays shoreward of ferry lanes');
    for(const [x,z]of [[1.35,0],[-1.15,-.43],[-1.15,.43],[.72,-.43],[.72,.43]]){
      const wx=pose.x+x*Math.cos(pose.heading)+z*Math.sin(pose.heading),wz=pose.z-x*Math.sin(pose.heading)+z*Math.cos(pose.heading);
      for(const pier of sfMap.piers.filter(p=>p.closed))assert.ok(!insideBuilding(wx,wz,pier.p),'hull intersects a mapped pier');
    }
    boat.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)for(const v of o.instanceMatrix.array)assert.ok(Number.isFinite(v),'finite cannon/splash instances');});
  }
  const before=boat.update(45);const matrices=[];boat.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)matrices.push([...o.instanceMatrix.array]);});
  assert.deepEqual(boat.update(45),before);let index=0;boat.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)assert.deepEqual([...o.instanceMatrix.array],matrices[index++]);});
});

test('fireboat water contact matches the actual animated surface triangles',async()=>{
  const {waterHeight,waterSurface}=await import('../app/water-surface.ts');
  const geometry=new THREE.PlaneGeometry(waterSurface.size,waterSurface.size,waterSurface.columns,waterSurface.rows);
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surface=new THREE.Mesh(geometry,material);
  surface.rotation.x=-Math.PI/2;surface.position.y=waterSurface.level;surface.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,-1,0),vertices=geometry.attributes.position;
  for(const time of [0,37,68,95]){
    for(let i=0;i<vertices.count;i++)vertices.setZ(i,Math.sin(vertices.getX(i)*.47+time*.5)*.08+Math.cos(vertices.getY(i)*.64+time*.65)*.06);
    vertices.needsUpdate=true;geometry.computeBoundingSphere();geometry.computeBoundingBox();
    for(let i=0;i<12;i++){const x=-45+i*1.37,z=5+i*1.61;ray.set(new THREE.Vector3(x,10,z),direction);const hit=ray.intersectObject(surface)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-waterHeight(x,z,time))<1e-5);}
  }
  geometry.dispose();material.dispose();
});
