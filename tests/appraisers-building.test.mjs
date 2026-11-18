import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addAppraisersBuilding} from '../app/appraisers-building.ts';

const root=new THREE.Group(),windows=[];
assert.ok(addAppraisersBuilding({id:1411189721},root,windows));
assert.ok(addAppraisersBuilding({id:32965865},root,windows));
assert.equal(root.children.length,1);
root.updateMatrixWorld(true);
const group=root.children[0],ray=new THREE.Raycaster();
const point=(x,y,z)=>group.localToWorld(new THREE.Vector3(x,y,z));
function top(u,v){
  ray.set(point(u,15,v),new THREE.Vector3(0,-1,0));
  return (ray.intersectObject(group,true)[0].point.y-.035)/.06;
}
test('the east light court and upper shoulders retain the measured roof levels',()=>{
  for(const [u,v,meters] of [[2,1.90,19.74],[.39,2.01,48.35],[.10,1.61,55.4],[.41,.17,62.08],[2.01,.85,65.35],[3.7,.75,68.72]]){
    assert.ok(Math.abs(top(u,v)-meters)<.03,`roof at ${u},${v}`);
  }
  assert.ok(group.children[0].geometry.index.count/3<16000);
});
test('the nine pairs on Sansome and three pairs on Jackson have recessed sash between deep piers',()=>{
  const hit=(u,v,x,z)=>{
    const a=point(u,1.64,v),b=point(x,1.64,z);
    ray.set(a,b.sub(a).normalize());return ray.intersectObject(group,true)[0].distance;
  };
  for(let i=0;i<9;i++){
    const u=.594+i*.46;
    for(const sample of [u-.077,u+.077])assert.ok(hit(sample,-.1,sample,0)>.111);
    assert.ok(hit(u,-.1,u,0)<.104);
  }
  for(const v of [.585,1.107,1.629]){
    assert.ok(hit(4.976,v+.081,4.876,v+.081)>.111);
    assert.ok(hit(4.976,v,4.876,v)<.104);
  }
  assert.ok(windows.length>55);
});
