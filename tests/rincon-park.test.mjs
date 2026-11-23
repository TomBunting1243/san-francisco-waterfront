import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cupidsSpan,knollHeight,rinconKnoll,rinconPoint,rinconUplights} from '../app/rincon-park.ts';

const art=cupidsSpan(),hill=new THREE.Mesh(rinconKnoll());
art.updateMatrixWorld(true);
const byName=name=>art.getObjectByName(name);
const foot=(mesh,t)=>new THREE.Vector3(0,(t-.5)*mesh.geometry.parameters.height,0).applyMatrix4(mesh.matrixWorld);
const shaft=byName('Continuous stainless steel shaft'),buried=foot(shaft,0),tip=foot(shaft,1);
const axis=new THREE.Line3(buried,tip),bounds=m=>new THREE.Box3().setFromObject(m,true);

test('the slope-shaped knoll supports the same point heights used by planted pieces and people',()=>{
  for(const q of [[350,222],[376,213],[396,236],[424,221],[474,230],[502,219],[556,225],[457,190],[432,164],[438,246]]){
    const [x,z]=rinconPoint(...q),ground=knollHeight(x,z);
    const hit=new THREE.Raycaster(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0)).intersectObject(hill)[0];
    assert.ok(hit&&Math.abs(ground-hit.point.y)<.00002,'shared lawn surface '+q);
  }
  assert.ok(knollHeight(...rinconPoint(432,173))-knollHeight(...rinconPoint(432,245))>.066);
});
test('the diagonal steel shaft emerges from the turf and both cable ends seat on the same nock',()=>{
  assert.ok(buried.y<knollHeight(buried.x,buried.z)-.04);
  assert.ok(Math.hypot(tip.x-buried.x,tip.z-buried.z)>.46);
  const left=foot(byName('Low tension cable'),1),right=foot(byName('High tension cable'),1);
  assert.ok(left.distanceTo(right)<.00001);
  assert.ok(axis.closestPointToPoint(left,true,new THREE.Vector3()).distanceTo(left)<.00001);
  for(const t of [.23,.42,.62]){
    const p=foot(shaft,t);assert.ok(p.y>knollHeight(p.x,p.z)+.14);
  }
});
test('the wings have unequal visible arcs below the tall notched fletching and readable front and back faces',()=>{
  const low=bounds(byName('Low returning bow limb')),high=bounds(byName('High swept bow limb'));
  assert.ok(low.max.y-art.position.y<.36 && high.max.y-low.max.y>.55 && tip.y-high.max.y>.18);
  for(const vane of art.getObjectsByProperty('name','Ribbed red fletching')){
    const b=bounds(vane);assert.ok(b.min.y<art.position.y+.54 && b.max.y>art.position.y+1.06);
    const n=vane.geometry.getAttribute('normal');
    assert.ok(Array.from({length:n.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(n,i).length()).every(x=>x>.97));
    const half=n.count/2;
    assert.ok(new THREE.Vector3().fromBufferAttribute(n,22).dot(new THREE.Vector3().fromBufferAttribute(n,22+half))<-.98);
  }
});

test('the bow grip is buried, the tension cables reach the tips, and all three members enter the recorded crest',()=>{
  const grip=byName('Buried bow grip'),g=grip.geometry.attributes.position;
  for(let i=0;i<g.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(g,i).applyMatrix4(grip.matrixWorld);
    assert.ok(p.y<knollHeight(p.x,p.z)-.025,'buried extrapolation stays below turf');
  }
  for(const [limb,cable] of [['Low returning bow limb','Low tension cable'],['High swept bow limb','High tension cable']]){
    const member=byName(limb),p=member.geometry.attributes.position,end=foot(byName(cable),0);
    const tipCenter=new THREE.Vector3();
    for(let j=p.count-8;j<p.count;j++)tipCenter.add(new THREE.Vector3().fromBufferAttribute(p,j));
    tipCenter.multiplyScalar(1/8).applyMatrix4(member.matrixWorld);
    assert.ok(tipCenter.distanceTo(end)<.04);
  }
  const pos=hill.geometry.attributes.position,col=hill.geometry.attributes.color;
  const low=new THREE.Color(),high=new THREE.Color();
  low.setRGB(1,1,1);high.setRGB(0,0,0);
  for(let i=0;i<pos.count;i++){low.r=Math.min(low.r,col.getX(i));high.r=Math.max(high.r,col.getX(i));}
  assert.ok(high.r-low.r>.15,'contrast between worn crest and outer grass');
});

test('three grounded uplights produce separate lawn pools and a grazing highlight on the near bow',()=>{
  const turf=hill.geometry.getAttribute('signLight');
  assert.equal(turf.normalized,true);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  function lawnAt(x,z){
    ray.set(new THREE.Vector3(x,2,z),down);
    const hit=ray.intersectObject(hill)[0];assert.ok(hit,'fixture and spill stay inside surveyed lawn');
    const {a,b,c}=hit.face,w=hit.barycoord;
    return {y:hit.point.y,light:turf.getX(a)*w.x+turf.getX(b)*w.y+turf.getX(c)*w.z};
  }
  const lights=rinconUplights().getObjectsByProperty('name','Lawn uplight lens').map(m=>m.getWorldPosition(new THREE.Vector3()));
  assert.equal(lights.length,3);
  for(const p of lights){
    const grass=lawnAt(p.x,p.z);
    assert.ok(p.y>grass.y&&p.y-grass.y<.005&&grass.light>.13);
  }
  const gap=lights[0].clone().lerp(lights[1],.5);
  assert.ok(lawnAt(gap.x,gap.z).light<.015);
  function levels(m){
    const n=new THREE.Matrix3().getNormalMatrix(m.matrixWorld),g=m.geometry;
    return Array.from({length:g.attributes.position.count},(_,i)=>m.userData.uplight(
      new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(m.matrixWorld),
      new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i).applyNormalMatrix(n)));
  }
  const near=levels(byName('Low returning bow limb')),far=levels(byName('High swept bow limb'));
  assert.ok(Math.max(...near)>1.2&&Math.min(...near)<.04);
  assert.ok(Math.max(...near)>4*Math.max(...far));
  assert.ok(Math.max(...levels(shaft))>.1&&Math.max(...levels(byName('Ribbed red fletching')))>.12);
});
