import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHarborRain} from '../app/harbor-rain.ts';

function lens(width,height,focal,yaw){
  const camera=new THREE.PerspectiveCamera(20,width/height,.35,1800);
  camera.position.set(49*Math.sin(yaw),13+10*Math.max(0,-Math.cos(yaw)),49*Math.cos(yaw));
  camera.lookAt(0,2.4,0);camera.setFocalLength(focal);camera.updateMatrixWorld();return camera;
}
function field(effect,camera){
  const {geometry}=effect.mesh,c=geometry.attributes.dropCenter,point=new THREE.Vector3(),bins=new Set();let visible=0;
  for(let i=0;i<geometry.instanceCount;i++){
    point.fromBufferAttribute(c,i).project(camera);
    if(Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&Math.abs(point.z)<1){
      visible++;bins.add((point.x>0?1:0)+(point.y>0?2:0));
    }
  }
  return {visible,bins};
}
const wind=new THREE.Vector2(1,0);

test('wet frames cover the viewport through a full orbit and changes of focal length on desktop and phone',()=>{
  const fx=createHarborRain();
  for(const [w,h] of [[1440,900],[390,844]])for(const focal of [24,40,95])for(const yaw of [0,1.24,2.6,4.9]){
    const cam=lens(w,h,focal,yaw);
    fx.update(cam,w,h,.93,wind,.92,0,1/60);
    const {visible,bins}=field(fx,cam);
    assert.equal(bins.size,4);assert.ok(visible>fx.mesh.geometry.instanceCount*.81);
    assert.ok(fx.mesh.geometry.instanceCount<=960);
  }
  assert.ok(fx.mesh.material.depthTest&&!fx.mesh.material.depthWrite);
  assert.ok(fx.mesh.material.forceSinglePass&&fx.mesh.geometry.isInstancedBufferGeometry);
});

test('wind blows away from its compass source, while pause freezes the same drops and dry clears the batch',()=>{
  const fx=createHarborRain(),cam=lens(1440,900,40,.3);
  const update=(amount,dt)=>fx.update(cam,1440,900,amount,wind,.8,0,dt);
  update(.85,0);
  const centers=fx.mesh.geometry.attributes.dropCenter;
  const p0=new THREE.Vector3().fromBufferAttribute(centers,0);
  update(.85,.1);
  const p1=new THREE.Vector3().fromBufferAttribute(centers,0);
  assert.ok(p1.x<p0.x&&p1.y<p0.y);assert.ok(p1.distanceTo(p0)<.15);
  const saved=centers.array.slice();update(.85,0);assert.deepEqual(centers.array,saved);
  update(0,.1);assert.equal(fx.mesh.visible,false);assert.equal(fx.mesh.geometry.instanceCount,0);
  update(.85,0);assert.equal(fx.mesh.visible,true);
});

test('holiday snow falls without rainfall, drifts more slowly and stays legible at night and on low settings',()=>{
  const fx=createHarborRain(),cam=lens(1440,900,40,1.24);
  fx.update(cam,1440,900,0,wind,.2,1,0,'snow',0);
  const {geometry,material}=fx.mesh,c=geometry.attributes.dropCenter;
  assert.equal(fx.mesh.visible,true);assert.equal(material.uniforms.snow.value,1);assert.equal(material.uniforms.night.value,1);
  assert.ok(geometry.instanceCount<=280);assert.equal(field(fx,cam).bins.size,4);
  const before=new THREE.Vector3().fromBufferAttribute(c,1);
  fx.update(cam,1440,900,0,wind,.2,1,.1,'snow',0);
  const after=new THREE.Vector3().fromBufferAttribute(c,1);
  assert.ok(before.y>after.y&&before.y-after.y<.015);
  assert.ok(Math.abs(after.z-before.z)>.00001);
  fx.update(cam,1440,900,0,wind,0,0,0,'rain',0);
  assert.equal(fx.mesh.visible,false);
});
test('a strong wet report produces short denser bursts without enabling rain for dry reports',()=>{
  const fx=createHarborRain(),cam=lens(1080,720,40,1.24);
  const update=(wet,dt)=>fx.update(cam,1080,720,wet,wind,1,0,dt);
  update(.95,0);const baseline=fx.mesh.geometry.instanceCount;
  let peak=baseline;
  for(let i=0;i<195;i++){update(.95,.1);peak=Math.max(peak,fx.mesh.geometry.instanceCount);}
  assert.ok(peak>baseline*1.28);
  update(0,.1);assert.equal(fx.mesh.visible,false);
});

test('rainfall projected onto a phone keeps its pace at 30 and 60 frames per second',()=>{
  const w=390,h=844,cam=lens(w,h,36,1.49);
  function medianDrop(fps){
    const rain=createHarborRain(),dt=1/fps,down=[];
    rain.update(cam,w,h,.8,wind,.6,0,0);
    const centers=rain.mesh.geometry.attributes.dropCenter;
    const before=new THREE.Vector3(),after=new THREE.Vector3();
    for(let frame=0;frame<fps;frame++){
      const previous=centers.clone();rain.update(cam,w,h,.8,wind,.6,0,dt);
      for(let i=0;i<rain.mesh.geometry.instanceCount;i++){
        before.fromBufferAttribute(previous,i).project(cam);after.fromBufferAttribute(centers,i).project(cam);
        const dy=(before.y-after.y)*h/2;
        if(dy>0&&dy<80)down.push(dy*fps);
      }
    }
    rain.dispose();down.sort((a,b)=>a-b);
    return down[Math.floor(down.length/2)];
  }
  const thirty=medianDrop(30),sixty=medianDrop(60);
  assert.ok(thirty>125&&sixty>125);
  assert.ok(Math.abs(sixty/thirty-1)<.06);
});
