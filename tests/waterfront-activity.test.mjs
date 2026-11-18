import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {waterfrontCar,waterfrontCarCount,waterfrontWalker,waterfrontWalkerCount} from '../app/waterfront-routes.ts';
import {createWaterfrontTraffic} from '../app/waterfront-traffic.ts';
import {createPlazaSkaters,plazaSkaterPose} from '../app/plaza-skaters.ts';
import {createLandscape} from '../app/landscape.ts';

test('a rebuilt waterfront keeps each set of skaters on its own single weather shader',()=>{
  function skaterPaint(){
    const world=createLandscape(),materials=new Set();
    world.skaters.root.traverse(mesh=>{if(mesh.isMesh)materials.add(mesh.material);});
    assert.equal(materials.size,1);
    return {material:[...materials][0],rain:world.rainOnStone};
  }
  const first=skaterPaint(),second=skaterPaint();
  assert.notEqual(first.material,second.material);
  assert.equal(first.material.customProgramCacheKey(),second.material.customProgramCacheKey());
  for(const {material,rain} of [first,second]){
    const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <fog_fragment>'};
    material.onBeforeCompile(shader,{});
    assert.equal(shader.vertexShader.match(/varying vec3 pigmentPosition;/g)?.length,1);
    assert.equal(shader.uniforms.rainOnStone,rain);
  }
});

test('both road directions keep varied headways and move forward through the curved carriageways',()=>{
  for(const region of [undefined,'street','plaza']){
    const count=waterfrontCarCount(region);
    for(const t of [0,5,22,143,9141]){
      for(const parity of [0,1]){
        const lane=Array.from({length:count/2},(_,i)=>waterfrontCar(t,2*i+parity,region).x).sort((a,b)=>a-b);
        const gaps=lane.slice(1).map((p,i)=>p-lane[i]);
        assert.ok(Math.min(...gaps)>.60&&Math.max(...gaps)>4*Math.min(...gaps));
        for(let i=parity;i<count;i+=2){
          const p=waterfrontCar(t,i,region),q=waterfrontCar(t+.001,i,region);
          assert.ok((q.x-p.x)*(parity?1:-1)>0);
        }
      }
    }
  }
  const full=createWaterfrontTraffic(new THREE.MeshStandardMaterial());
  assert.equal(full.traffic.length,12);assert.equal(full.traffic.reduce((sum,b)=>sum+b.count,0),56);
  const b=full.traffic[0];full.update(26);
  const paused=b.instanceMatrix.array.slice();full.update(26);assert.deepEqual(paused,b.instanceMatrix.array);
  full.update(27);assert.notDeepEqual(paused,b.instanceMatrix.array);
});

test('three skaters roll on brick clear of the vendor line and the basin, including at night and at a frozen clock',()=>{
  const scene=createLandscape();scene.root.updateMatrixWorld(true);
  const bricks=scene.root.getObjectByName('Halprin brick court');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.28);
  const skaters=createPlazaSkaters();
  const courts=[bricks,...scene.architectureChunks,scene.root.getObjectByName('Market granite and herringbone promenade')];
  for(const mesh of courts)mesh.geometry.computeBoundingBox();
  function checkFloor(p,meshes,tolerance){
    ray.ray.origin.set(p.x,p.y+.21,p.z);
    const local=meshes.filter(m=>{const b=m.geometry.boundingBox;return p.x>=b.min.x&&p.x<=b.max.x&&p.z>=b.min.z&&p.z<=b.max.z});
    const actual=ray.intersectObjects(local)[0]?.point.y;
    assert.ok(Math.abs(actual-p.y)<tolerance,'Unsupported or obstructed at '+JSON.stringify({x:p.x,z:p.z,y:p.y,actual}));
  }
  const vendors=[[.713,-8.175],[.787,-8.450],[.900,-8.713],[1.025,-8.988],[1.175,-9.238]];
  for(let t=0;t<60;t+=1.37){
    const poses=[0,1,2].map(i=>plazaSkaterPose(t,i));
    for(const p of poses){
      checkFloor(p,[bricks],.002);checkFloor(p,courts,.01);
      for(const [x,z] of vendors)assert.ok(Math.hypot(x-p.x,z-p.z)>.27);
    }
    for(const [i,p] of poses.entries()){
      const q=poses[(i+1)%3];assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>.32);
    }
  }
  assert.equal(skaters.root.children.length,3);
  skaters.update(101);const fixed=skaters.root.children.map(r=>r.position.toArray());
  skaters.update(101);assert.deepEqual(skaters.root.children.map(r=>r.position.toArray()),fixed);
  skaters.update(104);assert.notDeepEqual(skaters.root.children.map(r=>r.position.toArray()),fixed);
  assert.ok(waterfrontWalkerCount()>=60);
  // Sample each of the five added paths, including both halves of the pier.
  for(const id of [22,32,40,50,58]){
    for(let t=0;t<360;t+=7.8)checkFloor(waterfrontWalker(t,id),courts,.01);
  }
});
