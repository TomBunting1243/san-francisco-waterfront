import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {howardBoardingDeckY,howardBoardingPoint} from '../app/howard-boarding-island.ts';
import {addHowardBikeway} from '../app/howard-bikeway.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {driverPose} from '../app/driver-rides.ts';

const root=new THREE.Group(),paint=addHowardBikeway(root),island=root.getObjectByName('Howard at Spear boarding island');
const streets=new THREE.Group(),mat=new THREE.MeshBasicMaterial();
addSurveyBlocks((g,c,x,y,z)=>{const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);streets.add(m);return m;});
streets.updateMatrixWorld(true);
const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,.24);
function hit(mesh,u,v){const p=howardBoardingPoint(u,v);ray.ray.origin.set(p.x,.21,p.z);return ray.intersectObject(mesh,true)[0];}
function tint(h){return new THREE.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a).getHexString();}
const near=(a,b,tol=.00005)=>assert.ok(Math.abs(a-b)<tol,a+' vs '+b);

test('the Spear crosswalk reaches the warned ramp and level accessible boarding deck without a curb lip',()=>{
  near(hit(island,367,1563.45).point.y,.031,.00016);
  let previous=.031;
  for(let v=1563.45;v<1590;v+=.75){
    const y=hit(island,367,v).point.y;assert.ok(y>=previous-.00018);
    assert.ok((y-previous)/(.75/200)<.10);previous=y;
  }
  for(const v of [1593,1620,1655,1699,1726])for(const u of [354.5,368,382]){
    near(hit(island,u,v).point.y,howardBoardingDeckY);
    near(hit(streets,u,v).point.y,.031);
  }
  assert.equal(hit(island,366,1558),undefined);assert.equal(hit(island,366,1736),undefined);
  assert.notEqual(tint(hit(island,367,1568)),tint(hit(island,367,1582)));
  assert.notEqual(tint(hit(island,367,1582)),tint(hit(island,367,1608)));
});
test('the bike bypass and through lane stay at road grade; all island triangles avoid the existing green and white paint',()=>{
  const geom=island.geometry,p=geom.attributes.position,index=geom.index;
  const v=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<index.count;i+=3){
    a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
    for(const [one,two] of [[.333,.333],[.995,.001],[.001,.995],[.001,.001]]){
      v.copy(a).multiplyScalar(one).addScaledVector(b,two).addScaledVector(c,1-one-two);
      ray.ray.origin.set(v.x,.21,v.z);assert.equal(ray.intersectObject(paint).length,0,'existing paint under solid island');
    }
  }
  for(const v of [1578,1600,1643,1680,1722]){
    assert.equal(hit(island,344,v),undefined);near(hit(streets,344,v).point.y,.031);
    assert.equal(hit(island,395,v),undefined);near(hit(paint,395,v).point.y,.03124);
  }
});
test('red stenciled boarding edge and the two flexible parking-end posts appear in the static city mesh',()=>{
  const n=island.geometry.attributes.position.count;assert.ok(n>200&&n<3200);
  for(const u of [354.4,384.9])near(hit(island,u,1730.2).point.y,howardBoardingDeckY+.92*.06);
  near(hit(island,370,1730.2).point.y,howardBoardingDeckY);
  assert.notEqual(tint(hit(island,351.6,1620)),tint(hit(island,369,1620)));
  const origin=driverPose('bridge',293.8).eye,eye=new THREE.Vector3(origin.x,origin.y,origin.z);
  const target=howardBoardingPoint(366,1578),delta=target.clone().sub(eye);
  assert.ok(new THREE.Raycaster(eye,delta.normalize()).intersectObject(island)[0]);
});
