import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createWashingtonPlatforms,washingtonRiderPose} from '../app/washington-platform.ts';
import {ambientStreetcarCall,washingtonStopX,washingtonDoorOpening,washingtonDwell} from '../app/washington-call.ts';
import {driverPose,washingtonRideArrival} from '../app/driver-rides.ts';
import {createStreetcar,setPccFrontDoor} from '../app/streetcar.ts';
import {trackAt,trackCenterlines} from '../app/streets.ts';

const scene=createWashingtonPlatforms(),platforms=scene.root.children.slice(0,2);
scene.root.updateMatrixWorld(true);
function below(group,x,y,z){
  return new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,-1,0),0,.35)
    .intersectObjects(group,true).find(hit=>hit.face.normal.y>.8)?.point.y;
}
test('opposing Washington stops have raised accessible landings, lower boarding faces and arch roofs outside car clearance',()=>{
  for(const [i,dir,end,shelter,access] of [[0,1,16.105,14.825,13.73],[1,-1,8.76,10.09,11.08]]){
    const platform=platforms[i],along=(x,d,y)=>below([platform],x,y,trackAt(x,trackCenterlines[i]).z+d*dir);
    assert.ok(Math.abs(along(end-.15*dir,.13,.19)-.1146)<.0002);
    assert.ok(Math.abs(along(access+.14*dir,.18,.12)-.056)<.0002);
    assert.ok(Math.abs(along(shelter,.14,.09)-.067)<.0002);
    assert.ok(along(shelter,.226,.3)>along(shelter-.16,.226,.3)+.009);
    for(let x=Math.min(end,access);x<=Math.max(end,access);x+=.07){
      assert.equal(along(x,.076,.16),undefined,'track envelope stays open at '+x);
    }
  }
});
test('one waiting rider approaches from the crosswalk, boards 1051 through the open front door and uses all four real treads',()=>{
  const {group:car}=createStreetcar();
  const pose=driverPose('streetcar',washingtonRideArrival+2).body;
  car.position.set(pose.x,pose.y,pose.z);car.rotation.y=pose.heading;
  setPccFrontDoor(car,1);car.updateMatrixWorld(true);
  for(let t=-29.5;t<=2.5;t+=.24){
    const p=washingtonRiderPose(t),top=below(platforms,p.x,p.y+.004,p.z);
    assert.ok(Math.abs(top-p.y)<.0003,'on ramp or waiting island at '+t);
  }
  const surveyTimes=[2.98,3.52,4.10,4.68];
  for(const [i,t] of surveyTimes.entries()){
    const p=washingtonRiderPose(t);
    assert.equal(washingtonDoorOpening(t),1);
    assert.ok(Math.abs(below([car],p.x,p.y+.005,p.z)-p.y)<.0003,'real tread '+i+' at '+t);
    const local=car.worldToLocal(new T.Vector3(p.x,p.y,p.z));
    assert.ok(Math.abs(local.x-1.521)<.002,'on front entrance centerline');
    assert.ok(Math.abs(p.y-(.057+[.38,.61,.80,.96][i]*.06))<.0001);
  }
  const a=washingtonRiderPose(-12),b=washingtonRiderPose(-9);
  assert.deepEqual([a.x,a.z,a.walking],[b.x,b.z,false]);
  assert.equal(washingtonRiderPose(5.49).visible,true);
  scene.update(2.98);const expected=scene.root.children[2].position.clone();scene.update(2.98);
  assert.deepEqual(scene.root.children[2].position.toArray(),expected.toArray());
  scene.update(6);assert.equal(scene.root.children[2].visible,true);
});
test('ambient and POV streetcars use the same continuous seven-second Washington dwell and door timing',()=>{
  for(const plaza of [false,true]){
    const first=ambientStreetcarCall(0,plaza),arrival=-first.t;
    assert.ok(arrival>0);
    for(let t=-3;t<10;t+=.10){
      const v=ambientStreetcarCall(arrival+t,plaza),ride=driverPose('streetcar',washingtonRideArrival+t);
      if(t>=0&&t<=washingtonDwell){
        assert.ok(Math.abs(v.station-washingtonStopX)<1e-9);
        assert.ok(Math.abs(ride.station-v.station)<1e-9);
      }else{
        assert.equal(washingtonDoorOpening(t),0);
        assert.ok(Math.abs(ambientStreetcarCall(arrival+t+.02,plaza).station-v.station)<.018);
      }
    }
  }
});

test('the assembled median supports the Washington approach and leaves its walking aisle open',async()=>{
  const {createLandscape}=await import('../app/landscape.ts'),world=createLandscape();
  const batch=world.transit.batch;
  const fixed=[...world.architectureChunks,batch];
  world.transit.update(0,720,false,undefined,-100);
  world.root.updateMatrixWorld(true);
  for(let t=-29.5;t<=2.5;t+=1.15){
    const p=washingtonRiderPose(t);
    const hit=below(fixed,p.x,p.y+.010,p.z);
    assert.ok(Math.abs(hit-p.y)<.0006,'assembled platform supports passenger at '+t);
    for(const dir of [[1,0],[-1,0],[0,1],[0,-1]]){
      const caster=new T.Raycaster(new T.Vector3(p.x,p.y+.068,p.z),new T.Vector3(dir[0],0,dir[1]),0,.011);
      const obstructions=caster.intersectObjects(fixed,false);
      assert.ok(!obstructions.length,'waiting aisle clearance at '+t);
    }
  }
});

function assertPassengerHit(transit,actor,hit){
  const meshes=[];
  transit.poses.traverse(p=>{if(p.isMesh)meshes.push(p);});
  assert.equal(hit?.object.name,transit.batch.name,'first ray hit is in transit draw');
  assert.ok(actor.getObjectById(meshes[hit.batchId].id),'first visible instance belongs to this passenger');
}

test('the same batched passenger clears the stairs and holds the actual stanchion through departure, bends and the final stop',async()=>{
  const {createRideInteriors}=await import('../app/ride-interior.ts');
  const {createPromenadeTransit}=await import('../app/promenade-transit.ts');
  const {rideDuration}=await import('../app/driver-rides.ts');
  const transit=createPromenadeTransit(),actor=transit.poses.getObjectByName('Washington front-door passenger');
  const arm=actor.children.at(-1),cab=createRideInteriors(),camera=new T.PerspectiveCamera();
  cab.show('tram');
  const down=new T.Vector3(0,-1,0),target=new T.Vector3(),head=new T.Vector3();
  let previous,travel=0;
  for(const t of [5.48,6.55,7.70,8.65,9,12,22,30,rideDuration('streetcar')-washingtonRideArrival]){
    const car=driverPose('streetcar',washingtonRideArrival+t);
    transit.update(t,720,false,undefined,t,car.body);
    assert.equal(actor.visible,true);assert.equal(transit.root.children.length,1);
    camera.position.set(car.eye.x,car.eye.y,car.eye.z);
    camera.lookAt(car.look.x,car.look.y,car.look.z);
    cab.root.position.copy(camera.position);cab.root.quaternion.copy(camera.quaternion);cab.root.updateMatrixWorld(true);
    const feet=cab.root.worldToLocal(actor.position.clone()).divideScalar(.06);
    assert.ok(Math.abs(feet.y+1.19)<.001,'feet stay at saloon floor');
    const floorRay=new T.Raycaster(actor.position.clone().addScaledVector(down,-.001),down,0,.003);
    assert.ok(floorRay.intersectObject(cab.root,true).some(h=>Math.abs(h.point.y-actor.position.y)<.0001));
    if(t<9)continue;
    assert.ok(Math.abs(feet.x-.350)<.002&&Math.abs(feet.z-2.961)<.002);
    const hand=arm.localToWorld(new T.Vector3(-.125,-.05,.201));
    target.copy(cab.root.worldToLocal(hand.clone())).divideScalar(.06);
    assert.ok(Math.hypot(target.x-.67,target.z-2.76)<.002,'fingers meet the first right stanchion');
    const inward=cab.root.localToWorld(new T.Vector3(.67*.06,target.y*.06,2.76*.06));
    const side=new T.Vector3(1,0,0).applyQuaternion(cab.root.quaternion);
    const railRay=new T.Raycaster(inward.addScaledVector(side,.003),side.negate(),0,.006);
    assert.ok(railRay.intersectObject(cab.root,true).length,'physical stanchion present');
    head.copy(actor.localToWorld(new T.Vector3(0,1.53,0)));
    const glance=new T.Raycaster(camera.position,head.clone().sub(camera.position).normalize(),0,.5);
    assertPassengerHit(transit,actor,glance.intersectObjects([cab.root,transit.batch],true)[0]);
    if(previous)travel+=actor.position.distanceTo(previous);
    previous=actor.position.clone();
  }
  assert.ok(travel>12,'passenger travelled to Broadway inside the moving car');
  cab.dispose();
});

test('ambient streetcar carries the rider behind its window and both loop resets leave the platform entrance clear',async()=>{
  const {createPromenadeTransit}=await import('../app/promenade-transit.ts');
  const {streetcarPose}=await import('../app/streets.ts');
  const transit=createPromenadeTransit(),actor=transit.poses.getObjectByName('Washington front-door passenger'),car=createStreetcar().group;
  for(const plaza of [false,true]){
    const arrival=-ambientStreetcarCall(0,plaza).t,period=(plaza?32:130)/.85+3.6+7;
    const loop=period-(plaza?7:42)/.85;
    for(const time of [arrival+9,loop-.01,loop,loop+.10]){
      const call=ambientStreetcarCall(time,plaza),pose=streetcarPose(call.station);
      transit.update(time,720,false,undefined,call.t,pose);
      if(time>=loop){assert.equal(actor.visible,false,'no platform teleport on reset');continue;}
      assert.ok(actor.visible);
      car.position.set(pose.x,pose.y,pose.z);car.rotation.y=pose.heading;car.updateMatrixWorld(true);
      const target=actor.localToWorld(new T.Vector3(0,1.53,0));
      const outward=new T.Vector3(Math.sin(pose.heading),0,Math.cos(pose.heading));
      const eye=target.clone().addScaledVector(outward,.55);
      const ray=new T.Raycaster(eye,outward.negate(),0,.58);
      assertPassengerHit(transit,actor,ray.intersectObjects([car,transit.batch],true)[0]);
    }
    transit.update(loop+.1,720,false,undefined,-29,streetcarPose(-12));
    assert.ok(actor.visible&&actor.position.x<13.83,'next approach enters at the far crosswalk');
  }
});
