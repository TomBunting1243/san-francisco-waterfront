import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import paint from '../public/data/promenade-crossings.json' with {type:'json'};
import {createLandscape} from '../app/landscape.ts';
import {howardTurnStopLine} from '../app/waterfront-signals.ts';

const triangles=paint.howardJunction.map(t=>t.map(([x,z])=>new THREE.Vector3(x,0,z)));
const inside=(x,z)=>triangles.some(([a,b,c])=>THREE.Triangle.containsPoint(new THREE.Vector3(x,0,z),a,b,c));
const inCrop=(u,v)=>inside((u+3870)/132-56,2-(v+300)/132);

test('both staggered limit lines and the separate painted island outlines follow the measured turn',()=>{
  assert.ok(inside(howardTurnStopLine.x,howardTurnStopLine.z));
  assert.ok(inCrop(258,514.8));
  assert.ok(inCrop(287,186.9));
  assert.ok(inCrop(392,143.1));
  for(const p of [[292,225],[381,218],[320,251],[228,514],[258,521]])assert.equal(inCrop(...p),false);
});

test('the baked markings are supported by the surveyed road and never cover a rail',()=>{
  const area=new THREE.Box3(new THREE.Vector3(-27,.024,-5),new THREE.Vector3(-21,.05,1));
  const chunks=createLandscape().architectureChunks.filter(m=>m.geometry.boundingBox.intersectsBox(area));
  const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,.062);
  const names=h=>new THREE.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a).getHexString();
  assert.ok(triangles.length>100&&triangles.length<300);
  for(const tri of paint.howardJunction){
    const center=tri.reduce((a,p)=>p.map((n,i)=>n/3+a[i]),[0,0,0]);
    const [x,z,y]=center;ray.ray.origin.set(x,.081,z);
    const hits=ray.intersectObjects(chunks,false);
    const i=hits.findIndex(h=>h.object.material.polygonOffset&&Math.abs(h.point.y-y)<.00001);
    assert.ok(i>=0,'missing paint at '+[x,z]);
    assert.ok(hits[i].object.material.polygonOffsetUnits<=-2);
    const base=hits[i+1];
    assert.ok(base&&['899692','92928a'].includes(names(base)),'paint lost its pavement at '+[x,z]);
    assert.ok(Math.abs(y-base.point.y-.00024)<.000012,'paint should follow the actual substrate');
    assert.ok(!hits.some(h=>names(h)==='909991'),'paint intersects a running rail');
  }
});
