import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {courtyardPoint} from '../app/howard-public-courtyard.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';

const all=[];
addSurveyBlocks((g,color)=>{g.computeBoundingBox();const m=new T.Mesh(g,new T.MeshBasicMaterial({color}));all.push(m);return m;});
const court=all.find(m=>m.name==='120 Howard public courtyard');
const ray=new T.Raycaster();
function down(w,s,objects=all,h=2){
  const [x,y,z]=courtyardPoint(w,s,h);
  ray.set(new T.Vector3(x,y,z),new T.Vector3(0,-1,0));ray.near=0;ray.far=.3;
  return ray.intersectObjects(objects.filter(({geometry:{boundingBox:b}})=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z),false);
}
test('both aisles meet the original surveyed Howard sidewalk at the same height, with a single supported walking surface',()=>{
  for(const w of [.34,1.12,2.75,3.82,5.70]){
    const outside=down(w,-.10);
    assert.ok(outside.some(h=>Math.abs(h.point.y-.045)<.00001));
    assert.ok(outside.every(h=>h.object!==court));
    for(const s of [.013,.18,1.4,3.34,8.25,14.8,24.37,35.24,39.7,43.6,45.6]){
      const hits=down(w,s);
      assert.equal(hits[0].object,court,'aisle obstacle '+[w,s]);
      assert.ok(Math.abs(hits[0].point.y-.045)<.00001,'aisle height '+[w,s]);
      assert.equal(hits.filter(h=>Math.abs(h.point.y-.045)<.00001).length,1,'overlapping paving '+[w,s]);
    }
  }
  assert.ok(down(1.95,2.65)[0].point.y>.045+.06);
  assert.ok(Math.abs(down(3.52,45.965)[0].point.y-(.045+.487*.06))<.00001);
  assert.ok(Math.abs(down(4.8,46.24)[0].point.y-(.045+.734*.06))<.00001);
});
test('opal lights are on the two pier lines, with a localized baked response at the paving and a clear passage along the door side',()=>{
  const g=court.geometry,pos=g.attributes.position,light=g.attributes.signLight;
  assert.equal(pos.count,light.count);
  assert.equal(light.normalized,true);
  const normal=new T.Vector3(...courtyardPoint(1,0)).sub(new T.Vector3(...courtyardPoint(0,0))).normalize();
  for(const [w,s,sign] of [[0,1.63,1],[0,6.595,1],[6.23,1.79,-1],[6.23,7.645,-1]]){
    ray.set(new T.Vector3(...courtyardPoint(w+sign*.75,s+.016,3.05)),normal.clone().multiplyScalar(-sign));ray.far=.1;
    const hits=ray.intersectObject(court);assert.ok(hits.some(h=>light.getX(h.face.a)>.48),'emitting diffuser at '+[w,s]);
  }
  const near=down(.3,6.6,[court],.2)[0],mid=down(3.2,6.6,[court],.2)[0];
  const floor=(hit)=>light.getX(hit.face.a)+light.getX(hit.face.b)+light.getX(hit.face.c);
  assert.ok(floor(near)>floor(mid)*1.6,'floor falloff toward mid-aisle');
  const bounds=g.boundingBox;
  assert.ok(bounds.max.y<.045+.06*3.7,'fixtures remain below the first floor');
  assert.ok(g.index.count/3<6500);
});

test('the planter crowns meet visually over the gaps and leave both walking aisles open',()=>{
  for(let i=0;i<11;i++){
    const gap=1.65+i*3.18+2.995;
    const crown=down(1.935,gap,[court])[0];
    assert.ok(crown&&crown.point.y>.045+1.22*.06,'unbroken crown across gap '+i);
    for(const lane of [1.19,2.73]){
      const paving=down(lane,gap,[court])[0];
      assert.ok(paving&&Math.abs(paving.point.y-.045)<.0001);
    }
  }
});
