import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {protectedTrackRider,trackRidePeriod} from '../app/protected-track-riders.ts';
import {howardMissionCyclePoint} from '../app/howard-mission-bikeway.ts';
import {waterfrontCyclist,waterfrontCyclistCount,bicycleScale,bicycleWheelBottom} from '../app/waterfront-routes.ts';
import {bicycleContacts,createWaterfrontBicycle,pedalBicycle} from '../app/waterfront-bicycle.ts';

test('both new riders stay in the directional lanes, turn inside the ends, and return without a jump',()=>{
  assert.equal(waterfrontCyclistCount,5);
  let minimum=Infinity,maxSpeed=0,slowTurn=0;
  for(let i=0;i<2;i++){
    const seen=new Set();
    for(let t=0;t<trackRidePeriod;t+=.021){
      const p=waterfrontCyclist(t,i+3),q=protectedTrackRider(t+.001,i),other=protectedTrackRider(t,1-i);
      const u=(p.x+56)*132,n=howardMissionCyclePoint(u,1),s=howardMissionCyclePoint(u,-1);
      const speed=Math.hypot(q.x-p.x,q.z-p.z)*1000;
      minimum=Math.min(minimum,Math.hypot(other.x-p.x,other.z-p.z));maxSpeed=Math.max(maxSpeed,speed);
      assert.ok(u>=4369.499&&u<=5597.501);
      assert.ok(p.z>=s.z-1e-7&&p.z<=n.z+1e-7);
      assert.equal(p.y,.031);
      assert.ok(Math.cos(p.heading)*(q.x-p.x)+Math.sin(p.heading)*(q.z-p.z)>.000045);
      assert.ok(Math.abs(Math.atan2(Math.sin(q.heading-p.heading), Math.cos(q.heading-p.heading)))<.003);
      if(u>4377&&u<5590){
        const forward=Math.cos(p.heading)>0;
        assert.ok(Math.abs(p.z-(forward?n:s).z)<1e-7);seen.add(forward);
      }else slowTurn=Math.max(slowTurn,speed);
    }
    assert.equal(seen.size,2);
    const first=protectedTrackRider(0,i),last=protectedTrackRider(trackRidePeriod,i);
    assert.ok(Math.hypot(first.x-last.x,first.z-last.z)<1e-9);
  }
  assert.ok(minimum>.110,'riders must pass with at least 1.83 m between centres: '+minimum);
  assert.ok(maxSpeed<.301&&maxSpeed>.29);assert.ok(slowTurn<.068);
});
test('the tire contact patch meets asphalt and pedaling moves both legs in two opaque meshes',()=>{
  const m=new T.MeshStandardMaterial({vertexColors:true}),bike=createWaterfrontBicycle(3,m);
  const [frame,legs]=bike.children;
  assert.equal(bike.children.length,2);assert.equal(frame.material,legs.material);
  frame.geometry.computeBoundingBox();
  assert.ok(Math.abs((frame.geometry.boundingBox.min.y-bicycleWheelBottom)*bicycleScale)<1e-7);
  const a=new T.Vector3(),b=new T.Vector3();let moving=0;
  pedalBicycle(bike,0);
  for(let i=0;i<legs.geometry.attributes.position.count;i+=8){
    pedalBicycle(bike,0);legs.getVertexPosition(i,a);pedalBicycle(bike,Math.PI);legs.getVertexPosition(i,b);
    if(a.distanceTo(b)>.06)moving++;
  }
  assert.ok(moving>15);
  for(const t of [-.01,0,.19,Math.PI,Math.PI*2]){pedalBicycle(bike,t);assert.ok(Math.abs(1-legs.morphTargetInfluences.reduce((a,b)=>a+b,0))<1e-8);}
  frame.geometry.dispose();legs.geometry.dispose();m.dispose();
});

test('all tire receivers share one transparent draw just above pavement and follow each bike',()=>{
  const bikes=[new T.Group(),new T.Group()];
  const {mesh,update}=bicycleContacts(bikes);
  bikes.forEach((b,i)=>{
    const p=protectedTrackRider(18,i);
    b.position.set(p.x,p.y-bicycleWheelBottom*bicycleScale,p.z);b.scale.setScalar(bicycleScale);b.rotation.y=-p.heading;
  });
  update();assert.equal(mesh.count,bikes.length);assert.equal(mesh.material.depthWrite,false);
  const color=mesh.geometry.attributes.color;assert.equal(color.itemSize,4);assert.equal(color.getW(13),0);
  for(const [i,b] of bikes.entries()){
    const mat=new T.Matrix4();mesh.getMatrixAt(i,mat);
    for(const x of [-.4,.4]){
      const mark=new T.Vector3(x,.033,0).applyMatrix4(mat);
      const tire=new T.Vector3(x,bicycleWheelBottom,0).applyMatrix4(b.matrix);
      assert.ok(Math.hypot(mark.x-tire.x,mark.z-tire.z)<1e-5);
      assert.ok(mark.y>tire.y+.00024&&mark.y<tire.y+.001);
    }
  }
  mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();
});
