import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {boundWaterfrontFocus,moveWaterfrontFocus,openingLens,orbitOffset} from '../app/camera.ts';
import {ferryPose,ferryCycle,ferryFleet} from '../app/motion.ts';
import {boardingStops,buildFerryTerminal,createBoardingBrows} from '../app/ferry-terminal.ts';
import {bayReliefPosition} from '../app/bay-relief.ts';
import {gateSurvey} from '../app/golden-gate.ts';

test('camera-relative travel stays within the two ends and can enter and leave the narrow wooden pier',()=>{
  function walk(from,yaw,forward,strafe,seconds){
    let point=from;
    for(let i=0;i<seconds*30;i++){
      const next=moveWaterfrontFocus(point.x,point.z,yaw,forward,strafe,1/30);
      assert.ok(Math.hypot(next.x-point.x,next.z-point.z)<=5.2/30+.00001);
      point=next;
    }
    return point;
  }
  const home={x:0,z:0};
  const south=walk(home,Math.PI/2,1,0,25);
  assert.ok(south.x< -53&&south.x> -54);
  const north=walk(home,0,0,1,12);
  assert.ok(north.x>=27&&north.x<28);
  const spur=walk({x:27.3,z:0},Math.PI,1,0,12);
  assert.ok(Math.abs(spur.x-27.3)<.001&&Math.abs(spur.z-14.45)<.001);
  assert.ok(walk(spur,0,1,0,8).z<0);
  assert.deepEqual(boundWaterfrontFocus(0,-100),{x:0,z:-10.891666666666666});
  const diagonal=walk(home,0,1,1,.5);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-2.6)<.00001);
});

test('outward orbit frames the actual Bay islands and East Bay on desktop and phone',()=>{
  for(const [width,height] of [[1440,900],[390,844]]){
    for(const [lon,lat,h] of [[-122.363,37.81,4],[-122.370,37.824,.3],[-122.27,37.81,4]]){
      const [x,z]=bayReliefPosition(lon,lat),yaw=Math.atan2(-x,-z);
      const lens=openingLens(width,height);
      const c=new THREE.PerspectiveCamera(35,width/height,.35,1800);c.setFocalLength(lens.focalLength);
      orbitOffset(lens,yaw,0,c.position);c.position.y+=2.4;
      c.lookAt(0,2.4,0);c.updateMatrixWorld();
      const image=new THREE.Vector3(x,h,z).project(c);
      assert.ok(Math.abs(image.x)<.99&&Math.abs(image.y)<.99&&image.z<1);
    }
  }
  const [x,z]=bayReliefPosition(...gateSurvey.south);
  assert.ok(x>0&&z<0&&Math.hypot(x,z)>440,'Golden Gate is in the distant northwestern view');
});

test('the opening ferry is on final approach, all scheduled gates receive service and deployed brows reach their vessels',()=>{
  assert.equal(ferryFleet.length,8);
  const first=ferryPose(0,0);
  assert.equal(first.phase,'arriving');assert.ok(ferryPose(2,0).z<first.z);
  assert.ok(first.z-boardingStops.E[1]<6&&first.z-boardingStops.E[1]>3);
  const service=new Set(),root=new THREE.Group(),brows=createBoardingBrows(ferryFleet.length);
  const terminal=buildFerryTerminal((geometry,color,x,y,z,parent)=>{
    const mesh=new THREE.Mesh(geometry);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  },root);
  for(let i=0;i<ferryFleet.length;i++){
    const pose=ferryPose(0,i);let previous=pose;
    for(let t=.25;t<2*ferryCycle;t+=.25){
      const p=ferryPose(t,i);
      assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<.78+.012*Math.hypot(p.x,p.z));
      if(Math.hypot(p.x,p.z)<60)assert.ok(Math.abs(Math.atan2(Math.sin(p.heading-previous.heading),Math.cos(p.heading-previous.heading)))<.45);
      if(p.phase==='alongside'){
        service.add(p.gate);assert.equal(p.wake,0);
        assert.equal(p.x,previous.x);
        if(p.brow===1){
          const x=p.stopX,z=p.stopZ,side=Math.sign(p.x-x);
          const mat=new THREE.Matrix4();brows.update(i,p);brows.mesh.getMatrixAt(i,mat);
          const extent=new THREE.Box3().setFromBufferAttribute(brows.mesh.geometry.attributes.position).applyMatrix4(mat);
          assert.ok(extent.min.z<z&&extent.max.z>z);
          const shipDoor=p.x-side*(p.hullHalfBeam-.006);
          assert.ok(extent.min.x<shipDoor&&extent.max.x>shipDoor,'Deployed plate meets the passenger ledge');
          const landing=terminal.getObjectByName('Gate '+p.gate+' floating pontoon');
          for(const pile of (landing?.children||[]).filter(c=>c.name==='Independent guide pile')){
            assert.ok(Math.abs(p.x-pile.position.x)>p.hullHalfBeam+.055,'Hull clears the pile and its collar');
          }
        }
      }else assert.equal(p.brow,0);
      previous=p;
    }
  }
  assert.deepEqual([...service].sort(),['B','C','E','F','G']);
});
