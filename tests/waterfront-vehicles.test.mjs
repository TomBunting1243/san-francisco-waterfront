import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { addBridgeDeck, bridgeLaneCenters } from '../app/bridge-deck.ts';
import { addBridgeAnchorages, bridgeAnchorageStations } from '../app/bridge-anchorage.ts';
import { bridgeLayout } from '../app/bridge-layout.ts';
import { createDoradoFerry } from '../app/dorado-ferry.ts';
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
  const ferry=createDoradoFerry(addMesh,1,'Dorado');
  ferry.updateMatrixWorld(true);
  const bands=ferry.children.filter(mesh=>mesh.name==='Continuous painted hull band');
  const hullBounds=new THREE.Box3().setFromObject(ferry);
  assert.ok(hullBounds.getSize(new THREE.Vector3()).x>5);
  assert.equal(bands.length,4);
  const ray=new THREE.Raycaster();
  for(const side of [-1,1]){
    for(let x=-2.44;x<2.62;x+=.091){
      for(let y=-.097;y<.447;y+=.019){
        ray.set(new THREE.Vector3(x,y,side*2),new THREE.Vector3(0,0,-side));
        assert.equal(ray.intersectObjects(bands).filter(hit=>hit.distance<1.75).length,1);
      }
    }
  }
});

test('the active ferry keel remains below the rendered water during a crossing',()=>{
  for(const [i,scale] of [.68,.58].entries()){
    const ferry=createDoradoFerry(addMesh,scale,'Ferry');
    const localKeel=new THREE.Box3().setFromObject(ferry).min.y;
    for(let t=0;t<600;t+=.75){
      const p=ferryPose(t,i),surface=waterHeight(p.x,p.z,t);
      assert.ok(p.y+localKeel<surface,'The keel must remain submerged at the crest and trough');
      assert.ok(p.y+scale*.49>surface,'The lower working deck must remain above the surface');
    }
  }
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
