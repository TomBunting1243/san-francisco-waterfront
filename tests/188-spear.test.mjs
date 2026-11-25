import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLandscape} from '../app/landscape.ts';
import {add188Spear,spearCanopyGlassName} from '../app/188-spear.ts';
import {driverPose} from '../app/driver-rides.ts';
const plate=(u,v)=>new THREE.Vector3(-27.00800104+.0012973094*u-.0084729829*v,0,-33.37263659+.0084728164*u+.0012965840*v);
function model(){
  const root=new THREE.Group(),windows=[];
  assert.equal(add188Spear({id:192026934},root,windows),false);
  assert.equal(add188Spear({id:192026937},root,windows),true);
  root.updateMatrixWorld(true);return {root,windows};
}
test('the 188 Spear canopy covers the three middle entrance bays on Spear and leaves Howard and the public passage open',()=>{
  const {root}=model(),down=new THREE.Raycaster();
  down.ray.direction.set(0,-1,0);
  const hit=(u,v)=>{down.ray.origin.copy(plate(u,v));down.ray.origin.y=4;return down.intersectObjects(root.children)[0]};
  const canopy=hit(2334,-15);
  assert.equal(canopy.object.name,'188 Spear glass entrance canopy');
  assert.ok(Math.abs(canopy.point.y-(.045+4.2*.06))<.001);
  assert.equal(hit(2334,85),undefined);
  assert.equal(hit(2334,-140),undefined);
  assert.equal(hit(2344,-15),undefined);
  assert.equal(hit(2200,145),undefined);
  for(let v=-180;v<=130;v+=10)assert.equal(hit(2065,v),undefined);
  assert.ok(Math.abs(hit(2114,73).point.y-(.045+48.35*.06))<.001);
  assert.ok(Math.abs(hit(2200,-45).point.y-(.045+53.8*.06))<.001);
});
test('occupied panes align with real outward-facing glass on all four elevations',()=>{
  const {root,windows}=model(),building=root.children[0];
  assert.ok(windows.length>=48&&windows.length<65);
  const ray=new THREE.Raycaster();
  for(const w of windows){
    const normal=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    ray.set(new THREE.Vector3(w.x,w.y,w.z).addScaledVector(normal,.012),normal.clone().negate());
    assert.ok(Math.abs(ray.intersectObject(building)[0].distance-.0133)<.0001);
  }
});
test('the eastbound front-left passenger sightline meets the actual Howard facade',()=>{
  const {root}=model(),t=286,{eye,look}=driverPose('bridge',t);
  const bearing=Math.atan2(look.z-eye.z,look.x-eye.x);
  const angle=bearing-Math.PI/8;
  const ray=new THREE.Raycaster(new THREE.Vector3(eye.x,eye.y,eye.z),new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)));
  const wall=ray.intersectObjects(root.children)[0];assert.equal(wall.object.name,'188 Spear Street');
  assert.ok(wall.distance>1&&wall.distance<8);
});
test('the three Spear arches open above the canopy, leaving the photographed stone shoulders',()=>{
  const {root}=model(),pitch=329/8;
  const inward=plate(0,0).sub(plate(1,0)).normalize();
  const wall=root.children[0];
  function range(v){
    const start=plate(2332,v);start.y=.045+(4.2+.78*(8.3-4.2))*.06;
    return new THREE.Raycaster(start,inward).intersectObject(wall)[0].distance;
  }
  for(const bay of [3,4,5]){
    const s=-201+bay*pitch;
    assert.ok(range(s+pitch*.5)-range(s+pitch*.17)>.03);
  }
});

test('the post-bake city keeps the twelve translucent canopy panels visible from the Spear sidewalk',()=>{
  const city=createLandscape(),glass=city.root.getObjectByName(spearCanopyGlassName);
  assert.ok(glass?.isMesh);
  assert.equal(glass.material.transparent,true);assert.equal(glass.material.depthWrite,false);
  assert.equal(glass.material.side,THREE.DoubleSide);assert.equal(glass.material.forceSinglePass,true);
  assert.ok(glass.material.opacity>.45&&glass.material.opacity<.61);
  assert.equal(glass.geometry.index.count/3,24);
  assert.equal(glass.geometry.hasAttribute('signLight'),false);
  city.root.updateMatrixWorld(true);
  const inward=plate(0,0).sub(plate(1,0)).normalize();
  for(const bay of [2,3,4,5,6]){
    const eye=plate(2330,-201+(329/8)*(bay+.42));eye.y=.045+5.3*.06;
    const wall=new THREE.Raycaster(eye,inward,0,.3).intersectObjects(city.architectureChunks)[0];
    assert.ok(wall);
    const glow=wall.object.geometry.getAttribute('signLight');
    const red=glow?.getX(wall.face.a)??0;
    if(bay>=3&&bay<=5)assert.ok(red>.08&&red<.25);
    else assert.equal(red,0);
  }
  const q=plate(2334,-15);q.y=.045+4.2*.06;
  for(const [u,y] of [[2338,.145],[2348,.48]]){
    const eye=plate(u,-15);eye.y=y;
    const ray=new THREE.Raycaster(eye,q.clone().sub(eye).normalize());
    const hit=ray.intersectObject(glass)[0];assert.ok(hit&&hit.point.distanceTo(q)<.001);
  }
});

test('the lobby light is limited to its three recessed entrances, graduating from the glass to the street',()=>{
  const {root}=model(),g=root.children[0].geometry,pos=g.getAttribute('position'),light=g.getAttribute('signLight');
  const start=plate(2324,-201),tangent=plate(2324,128).sub(start).normalize();
  const inward=plate(0,0).sub(plate(1,0)).normalize(),pitch=plate(2324,128).distanceTo(start)/8;
  const bays=new Set();let lit=0,back=0,edge=0,peak=0;
  for(let i=0;i<pos.count;i++){
    const r=Math.round(light.getX(i)*255);if(!r)continue;
    const delta=new THREE.Vector3().fromBufferAttribute(pos,i).sub(start);
    const s=delta.dot(tangent),d=delta.dot(inward),y=pos.getY(i);
    assert.ok(s>=pitch*3-.00001&&s<=pitch*6+.00001&&y<.545);
    assert.ok(d>-.00001&&d<.097);
    assert.ok(light.getX(i)>=light.getY(i)&&light.getY(i)>=light.getZ(i));
    bays.add(Math.min(5,Math.max(3,Math.floor(s/pitch))));
    lit++;peak=Math.max(peak,r);
    if(d>.09&&y>.29&&y<.3)back=Math.max(back,r);
    if(d<.005&&y>.29&&y<.3)edge=Math.max(edge,r);
  }
  assert.equal(bays.size,3);assert.ok(lit>180&&lit<320);assert.equal(peak,61);
  assert.ok(back>=3*edge&&edge>0);
});
