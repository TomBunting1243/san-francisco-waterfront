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
        const lane=Array.from({length:count/2},(_,i)=>waterfrontCar(t,2*i+parity,region)).filter(p=>p.active).map(p=>p.x).sort((a,b)=>a-b);
        const gaps=lane.slice(1).map((p,i)=>p-lane[i]);
        assert.ok(Math.min(...gaps)>.60&&Math.max(...gaps)>4*Math.min(...gaps));
        for(let i=parity;i<count;i+=2){
          const p=waterfrontCar(t,i,region),q=waterfrontCar(t+.001,i,region);
          if(p.active&&q.active)assert.ok((q.x-p.x)*(parity?1:-1)>=-1e-10);
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

test('two shared walkers turn inside Pier 1½, pause, then return on supported clear lanes',()=>{
  const scene=createLandscape(),positions=[];
  scene.root.updateMatrixWorld(true);
  // Keep the actual baked triangles around this short route, including curb
  // furniture, roof beams and glazing. Probe both sides of the opaque geometry.
  const area=new THREE.Box3(new THREE.Vector3(15,-.15,-2.2),new THREE.Vector3(16.85,.67,-.83));
  const tri=new THREE.Triangle(),bounds=new THREE.Box3();
  for(const m of scene.architectureChunks){
    if(!area.intersectsBox(m.geometry.boundingBox))continue;
    const g=m.geometry,pos=g.attributes.position;
    for(let i=0;i<g.index.count;i+=3){
      for(const [k,v] of [tri.a,tri.b,tri.c].entries())v.fromBufferAttribute(pos,g.index.getX(i+k)).applyMatrix4(m.matrixWorld);
      bounds.setFromPoints([tri.a,tri.b,tri.c]);if(!area.intersectsBox(bounds))continue;
      for(const v of [tri.a,tri.b,tri.c])positions.push(v.x,v.y,v.z);
    }
  }
  const local=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(),v=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
  const first=waterfrontWalkerCount()-2,plaza=waterfrontWalkerCount('plaza')-2;
  let minSpace=Infinity;
  for(let i=0;i<2;i++){
    let outside=false,entered=false,looked=false,returned=false,held;
    for(let t=0;t<=155;t+=.38){
      const p=waterfrontWalker(t,first+i),other=waterfrontWalker(t,first+1-i);
      minSpace=Math.min(minSpace,Math.hypot(other.x-p.x,other.z-p.z));
      assert.deepEqual(p,waterfrontWalker(t,plaza+i,'plaza'));
      if(p.z<-1.94){outside=true;if(looked)returned=true;}
      if(p.z>-1.7&&p.z<-1.25){entered=true;assert.ok(Math.abs(p.x-16.515)<.06);}
      if(p.standing){
        assert.ok(p.x<15.45&&Math.abs(p.z+1.045)<.05);looked=true;
        if(held){assert.ok(Math.hypot(held.x-p.x,held.z-p.z)<1e-7);}
        held=p;
      }else held=undefined;
      assert.ok(p.z<-.98,'stay landward of the slip');
      for(const offset of [-.012,0,.012]){
        const x=p.x+Math.sin(p.heading)*offset,z=p.z-Math.cos(p.heading)*offset;
        ray.set(v.set(x,p.y+.012,z),down);ray.far=.022;
        const floor=ray.intersectObject(local,false)[0];assert.ok(floor&&Math.abs(floor.point.y-p.y)<.004,'foot support '+JSON.stringify(p));
      }
      ray.set(v.set(p.x,p.y+.012,p.z),up);ray.far=.136;
      assert.equal(ray.intersectObject(local,false).length,0,'head clearance '+JSON.stringify(p));
      for(const sign of [-1,1]){
        ray.set(v.set(p.x,p.y+.068,p.z),new THREE.Vector3(sign*Math.sin(p.heading),0,-sign*Math.cos(p.heading)));
        ray.far=.026;assert.equal(ray.intersectObject(local,false).length,0,'shoulder clearance '+JSON.stringify(p));
      }
    }
    assert.ok(outside&&entered&&looked&&returned);
  }
  assert.ok(minSpace>.055,'opposing pedestrians have separate passing lanes');
});
