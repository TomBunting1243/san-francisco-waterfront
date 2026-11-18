import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { addBridgeDeck, bridgeLaneCenters } from '../app/bridge-deck.ts';
import { addBridgeAnchorages, bridgeAnchorageStations } from '../app/bridge-anchorage.ts';
import { bridgeLayout } from '../app/bridge-layout.ts';
import { createDoradoFerry,doradoDimensions,doradoWake } from '../app/dorado-ferry.ts';
import { createStreetcar,pccDimensions } from '../app/streetcar.ts';
import { buildStreetcarTrack,streetcarPose,streetcarTrack,trackAt,trackCenterlines } from '../app/streets.ts';
import { ferryPose } from '../app/motion.ts';
import { createStreetVehicle, streetVehicleMaterial } from '../app/street-vehicles.ts';
import { waterHeight } from '../app/water-surface.ts';

function addMesh(geometry,color,x,y,z,parent) {
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color}));
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}

test('ferry livery has a single visible surface across each longitudinal paint seam',()=>{
  const ferry=createDoradoFerry(addMesh,'Dorado');
  ferry.updateMatrixWorld(true);
  const bands=ferry.children.filter(mesh=>mesh.name==='Continuous painted hull band');
  assert.equal(bands.length,4);
  const ray=new THREE.Raycaster();
  for(const side of [-1,1]){
    for(let x=-1.15;x<1.24;x+=.041){
      for(let y=.029;y<.174;y+=.007){
        ray.set(new THREE.Vector3(x,y,side),new THREE.Vector3(0,0,-side));
        assert.equal(ray.intersectObjects(bands).filter(hit=>hit.distance<.85).length,1);
      }
    }
  }
});

test('both ferry skins match fleet length, beam and draft throughout a crossing',()=>{
  for(const [i,name] of ['Dorado','Delphinus'].entries()){
    const ferry=createDoradoFerry(addMesh,name);
    const bounds=new THREE.Box3().setFromObject(ferry,true);
    const bands=ferry.children.filter(mesh=>mesh.name==='Continuous painted hull band');
    const skin=new THREE.Box3();
    for(const band of bands)skin.expandByObject(band,true);
    for(const box of [skin,bounds]){
      const {x,z}=box.getSize(new THREE.Vector3());
      assert.ok(Math.abs(x-doradoDimensions.length)<1e-6);
      assert.ok(Math.abs(z-doradoDimensions.beam)<1e-6);
      assert.ok(Math.abs(box.min.y+doradoDimensions.draft)<1e-6);
    }
    assert.ok(Math.abs(skin.min.x-doradoWake.stern)<1e-6);
    // A ray from below each transom meets its submerged demihull.
    for(const side of [-1,1]){
      const ray=new THREE.Raycaster(new THREE.Vector3(doradoWake.stern+.015,-1,side*doradoWake.hullOffset),new THREE.Vector3(0,1,0));
      assert.ok(ray.intersectObjects(bands).some(hit=>hit.point.y<0));
    }
    for(let t=0;t<600;t+=.75){
      const p=ferryPose(t,i),surface=waterHeight(p.x,p.z,t);
      assert.ok(Math.abs(p.y+bounds.min.y-(surface-1.4*.06))<1e-6);
    }
  }
});

test('1051 body envelope, wheel treads and collector agree with the rendered tracks',()=>{
  const {group}=createStreetcar();
  group.updateMatrixWorld();
  const body=new THREE.Box3();
  for(const m of group.children.slice(0,-3))body.expandByObject(m,true);
  const size=body.getSize(new THREE.Vector3());
  for(const [n,ref] of [[size.x,pccDimensions.length],[size.z,pccDimensions.width],[size.y,pccDimensions.height]]){
    assert.ok(Math.abs(n-ref)<1e-5);
  }
  const track=new THREE.Group(),paint=new THREE.MeshBasicMaterial();
  buildStreetcarTrack((w,h,d,x,y,z)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),paint);m.position.set(x,y,z);track.add(m);return m;
  },(a,b,r)=>{
    const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),paint);
    m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());track.add(m);return m;
  });
  track.updateMatrixWorld();
  const rails=track.getObjectsByProperty('name','Running rail'),wire=track.getObjectsByProperty('name','Contact wire');
  const railClearance=rails[0].position.distanceTo(rails[1].position)-rails[0].geometry.parameters.width;
  assert.ok(Math.abs(railClearance-1.435*.06)<1e-6);
  const downward=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
  for(const x of [-64.1,-45.2,-1.21,21.8,60.9]){
    const pose=streetcarPose(x);
    group.position.set(x,pose.y,pose.z);group.rotation.y=pose.heading;group.updateMatrixWorld();
    for(const wheel of group.getObjectsByProperty('name','Wheel tread')){
      const bounds=new THREE.Box3().setFromObject(wheel,true),point=bounds.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(bounds.min.y-streetcarTrack.railTop)<1e-6);
      // On a curve the fixed miniature trucks can be slightly offset from
      // the rail crown. Verify that each actual tread spans the running rail.
      const p=trackAt(point.x),dz=point.z-p.z;
      const across=Math.abs(dz*Math.cos(p.heading));
      assert.ok(Math.abs(across-(streetcarTrack.gauge+streetcarTrack.railHead)/2)<.007);
    }
    const shoe=group.getObjectByName('Trolley contact shoe');
    const contact=shoe.getWorldPosition(new THREE.Vector3());
    ray.set(contact.clone().addScaledVector(downward,-.02),downward);
    const hit=ray.intersectObjects(wire)[0];
    assert.ok(hit,'The trailing collector follows the overhead on bends');
    assert.ok(Math.abs(hit.point.y-new THREE.Box3().setFromObject(shoe,true).max.y)<.002);
  }
  assert.equal(trackCenterlines.length,2);
});

test('both bridge roadways have five marked lanes wide enough for the traffic models',()=>{
  const bridge=new THREE.Group();
  const deck=addBridgeDeck(bridge,addMesh,16,3.6,4.4);
  assert.equal(bridgeLaneCenters.length,5);
  const laneWidth=bridgeLaneCenters[1]-bridgeLaneCenters[0];
  const stripes=deck.children.filter(o=>o.name==='Lane stripe'&&o.position.z===.62);
  assert.equal(stripes.length,8);
  for(const level of [3.6,4.4]){
    assert.equal(new Set(stripes.filter(o=>Math.abs(o.position.y-level)<.10).map(o=>o.position.x)).size,4);
  }
  const paint=streetVehicleMaterial();
  for(let i=0;i<4;i++){
    const car=createStreetVehicle(i,paint,true);
    car.scale.setScalar(.25);
    car.rotation.y=i%2===0?Math.PI/2:-Math.PI/2;
    const bounds=new THREE.Box3().setFromObject(car);
    assert.ok(bounds.getSize(new THREE.Vector3()).x<laneWidth);
    assert.ok(Math.abs(bounds.min.y-.01375)<1e-5);
  }
});


test('the two Bay Bridge anchorages and Pier W1 have separate masses without obstructing either road deck',()=>{
  const bridge=new THREE.Group(),{lowerDeck:lower,upperDeck:upper}=bridgeLayout;
  const {land,w1,w4}=addBridgeAnchorages(bridge,addMesh,lower,upper);
  bridge.updateMatrixWorld(true);
  assert.ok(Math.abs(w1.position.z-land.position.z-890*.3048*.06)<.0001);
  assert.equal(w4.position.z,bridgeAnchorageStations.w4);
  const ray=new THREE.Raycaster();
  const along=(x,y,z,dir=1,far=8)=>{
    ray.set(new THREE.Vector3(x,y,z),new THREE.Vector3(0,0,dir));ray.far=far;
    return ray.intersectObjects(bridge.children,true);
  };
  for(const anchor of [land,w1,w4]){
    const {z}=anchor.position;
    for(const lane of bridgeLaneCenters)for(const offset of [-.045,0,.045]){
      for(const level of [lower,upper]){
        for(const height of [.089,.18]){
          assert.equal(along(lane+offset,level+height,z-2.2,1,4.4).length,0,anchor.name+' blocks a roadway');
        }
      }
    }
    assert.equal(along(0,upper+.75,z-2.2,1,4.4).length,0,anchor.name+' puts a crossbar over the upper road');
  }
  const inset=along(0,1.63,w1.position.z-2,1,4)[0],shoulder=along(.62,1.63,w1.position.z-2,1,4)[0];
  assert.ok(inset&&shoulder&&inset.point.z-shoulder.point.z>.14,'Pier W1 has a backed architectural recess');
  assert.ok(along(0,-.73,w4.position.z-2,1,3).length,'The center caisson extends below the bay');
  assert.equal(w4.getObjectsByProperty('name','W4 folded steel A-frame shroud').length,2);
  for(const cable of bridge.getObjectsByProperty('name','Continuous land cable tail')){
    const bounds=new THREE.Box3().setFromObject(cable);
    assert.ok(bounds.min.z<land.position.z+1.66&&bounds.max.z>w1.position.z-.01);
    assert.ok(bounds.min.y<.75&&bounds.max.y>4.84);
  }
  assert.equal(bridge.getObjectsByProperty('name','Continuous land cable tail').length,2);
});
