import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {howardPoles} from '../app/howard-junction-signals.ts';

const parts=[];
addSurveyBlocks((g,color)=>{
  g.computeBoundingBox();
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color}));parts.push(m);return m;
});
const paint=parts.find(m=>m.name==='Howard waterfront bicycle turn box');
const nearby=parts.filter(m=>m.geometry.boundingBox.intersectsBox(new THREE.Box3(
  new THREE.Vector3(-25.1,.029,-1.2),new THREE.Vector3(-22.1,.12,-.45))));
const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,.13);
const inspect=(x,z,meshes=nearby)=>{
  ray.ray.origin.set(x,.155,z);
  return ray.intersectObjects(meshes,false).filter(h=>h.face.normal.y>.5);
};
const at=(u,v)=>inspect(-56+u/132,2-v/132);
const pigment=h=>h.object.geometry.hasAttribute('color')
  ?new THREE.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a).multiply(h.object.material.color).getHexString()
  :h.object.material.color.getHexString();

test('the 2024 turn box, arrows and hatching share the crossing bake and cover only bare road',()=>{
  assert.ok(paint);assert.equal(paint.geometry.userData.roadPaint,'Waterfront crossings');
  const pos=paint.geometry.attributes.position,n=pos.count/3;
  assert.ok(n>130&&n<210);
  for(let i=0;i<pos.count;i+=3){
    const x=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3;
    const z=(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;
    const hits=inspect(x,z),painted=hits.filter(h=>h.object.geometry.userData.roadPaint);
    assert.equal(painted.length,1,'paint layers intersect at '+[x,z]);assert.equal(painted[0].object,paint);
    const base=hits.find(h=>h.object!==paint);
    assert.ok(base);
    const u=(x+56)*132,v=(2-z)*132;
    const roadEdge=400.4+(u-4398)*.12;
    assert.equal(pigment(base),u>=4354&&v>roadEdge-37.4&&v<roadEdge-25.4?'707e7d':'899692');
    assert.ok(Math.abs(painted[0].point.y-base.point.y-.00024)<1e-5);
  }
  for(const [u,v] of [[4175,385],[4210,380],[4270,370],[4307,389]]){
    assert.ok(at(u,v).every(h=>h.object!==paint),'clear '+[u,v]);
  }
  assert.equal(pigment(at(4280,384)[0]),'859877');
  for(const [u,v] of [[4447,374.4],[4397.4,383.6],[4399.6,369.3],[4448.7,389.4],[4366.1,380]]){
    assert.equal(at(u,v)[0].object,paint,'missing opposing cycle marking at '+[u,v]);
  }
});

test('the tactile warning replaces the actual inclined north apron and opens onto the crossing',()=>{
  const probes=[344.8,346.2,348.1,349.5].map(v=>at(4330.6,v));
  for(const hits of probes){
    assert.equal(pigment(hits[0]),'d3b468');
    assert.equal(hits.filter(h=>Math.abs(h.point.y-hits[0].point.y)<.00001).length,1);
  }
  assert.ok(probes[0][0].point.y>probes.at(-1)[0].point.y+.0025);
  assert.ok(at(4330.6,354.3)[0].point.y<.0321);
  assert.ok(at(4330.6,343).every(h=>pigment(h)!=='d3b468'));
  assert.ok(at(4318,349.7).some(h=>pigment(h)==='ac6864'));
  assert.ok(at(4346,351.7).some(h=>pigment(h)==='ac6864'));
  // The pre-existing signal stands alongside the ramp. Nothing new projects
  // into its support or repeats its face across the pedestrian opening.
  const p=howardPoles[1];assert.ok(p.x>-56+4335/132);
  assert.ok(inspect(p.x,p.z).every(h=>h.object!==paint&&pigment(h)!=='d3b468'));
});

test('the back of the survey ramp meets the shared walker route across its full level approach',async()=>{
  const {addHowardRampLanding}=await import('../app/howard-waterfront-corner.ts');
  const {rinconExit,walkSurface}=await import('../app/waterfront-routes.ts');
  const edge=[],walk=new THREE.Mesh(walkSurface(rinconExit,.24,.06,edge),new THREE.MeshBasicMaterial());
  let landing;addHowardRampLanding(edge,g=>(landing=new THREE.Mesh(g,new THREE.MeshBasicMaterial())));
  for(const u of [4318.4,4323.2,4330.4,4340.7,4352.1]){
    let prev;
    for(let v=353.91;v>=310;v-=.47){
      const hits=inspect(-56+u/132,2-v/132,[...nearby,walk,landing]);
      assert.ok(hits.length,'missing paving at '+[u,v]);
      const y=hits[0].point.y;
      assert.ok(y>=.0309&&y<=.047,'landing height '+[u,v,y]);
      if(prev!==undefined)assert.ok(Math.abs(y-prev)<.0006,'discontinuous landing at '+[u,v]);
      prev=y;
    }
  }
  let steepest=0;for(let i=440;i<=1000;i++){
    const d=rinconExit.getTangentAt(i/1000);steepest=Math.max(steepest,Math.abs(d.y)/Math.hypot(d.x,d.z));
  }
  assert.ok(steepest<=1/12,'park exit slope '+steepest);
});
