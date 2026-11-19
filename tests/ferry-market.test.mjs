import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFerryMarket,ferryMarketSchedule} from '../app/ferry-market.ts';
import {fixedFerryApron} from '../app/ferry-terminal.ts';
import {routes,routeWidth} from '../app/waterfront-routes.ts';

const at=iso=>new Date(iso);
function scene(market,iso,still=false){
  const rev=market.update(+at(iso),still);
  const [boxes,roofs,people]=market.root.children;
  const matrix=new THREE.Matrix4();
  function transforms(mesh){
    return Array.from({length:mesh.count},(_,i)=>{mesh.getMatrixAt(i,matrix);return matrix.elements.slice();});
  }
  return {rev,boxes:transforms(boxes),roofs:transforms(roofs),people:transforms(people)};
}
const section=(array,where)=>array.filter(m=>where==='rear'?m[14]>1:where==='artist'?m[14]<-8:m[14]>-3&&m[14]<-1);
const position=(matrix)=>matrix.slice(12,15);
const width=(matrix)=>Math.hypot(...matrix.slice(0,3));
test('Foodwise dates follow Pacific trading time through DST and the three published closures',()=>{
  for(const iso of ['2026-03-03T18:00Z','2026-03-10T17:00Z','2026-10-29T17:00Z','2026-11-03T18:00Z']){
    assert.deepEqual(ferryMarketSchedule(at(iso)),{front:1,rear:0,artist:1});
  }
  for(const day of ['2026-11-26','2026-12-24','2026-12-31','2026-11-18']){
    assert.deepEqual(ferryMarketSchedule(at(day+'T20:00Z')),{front:1,rear:0,artist:1});
  }
  assert.deepEqual(ferryMarketSchedule(at('2026-11-21T16:00Z')),{front:1,rear:1,artist:0});
  assert.deepEqual(ferryMarketSchedule(at('2026-11-21T05:00Z')),{front:1,rear:0,artist:0});
});
test('front stalls stay fully stocked at midnight while Saturday crews pack the rear plaza',()=>{
  const market=createFerryMarket(),sample=time=>scene(market,'2026-11-21T'+time+'Z');
  const midnight=sample('08:00'),before=sample('15:30'),early=sample('15:32'),half=sample('15:45'),open=sample('16:00');
  assert.equal(section(midnight.roofs,'front').length,14);
  for(const meshes of ['boxes','roofs','people']){
    assert.ok(section(midnight[meshes],'front').length);
    assert.deepEqual(section(midnight[meshes],'front'),section(open[meshes],'front'));
  }
  assert.equal(section(before.boxes,'rear').length,0);
  assert.ok(section(early.boxes,'rear').length>0&&section(early.people,'rear').length>0);
  assert.equal(section(early.roofs,'rear').length,0);
  const halfRoof=section(half.roofs,'rear')[0],openRoof=section(open.roofs,'rear')[0];
  assert.ok(width(halfRoof)<width(openRoof)&&halfRoof[13]<openRoof[13]);
  assert.deepEqual(section(half.roofs,'rear'),section(sample('22:15').roofs,'rear'));
  assert.deepEqual(section(early.people,'rear'),section(sample('22:28').people,'rear'));
  assert.equal(section(sample('22:30').boxes,'rear').length,0);
});
test('Saturday rear pitches remain on the fixed deck clear of the loop, with three active batches',()=>{
  const market=createFerryMarket(),s=scene(market,'2026-11-21T20:00Z');
  const rear=section(s.roofs,'rear'),artists=section(s.roofs,'artist');
  assert.equal(rear.length,16);assert.equal(artists.length,5);
  const boundary=fixedFerryApron.p.map(p=>new THREE.Vector2(...p));
  const shape=new THREE.Shape(boundary),geometry=new THREE.ShapeGeometry(shape);
  const deck=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(),foot=routes.ferry.getSpacedPoints(250);
  for(const m of rear){
    const [x,,z]=position(m);
    for(const dx of [-.1,.1])for(const dz of [-.1,.1]){
      ray.set(new THREE.Vector3(x+dx,z+dz,1),new THREE.Vector3(0,0,-1));assert.ok(ray.intersectObject(deck).length);
    }
    assert.ok(Math.min(...foot.map(p=>Math.hypot(x-p.x,z-p.z)))>routeWidth.ferry/2+.1);
  }
  assert.ok(market.root.children.every(m=>m.isInstancedMesh&&m.visible&&m.count<=m.instanceMatrix.count&&Number.isFinite(m.boundingSphere.radius)));
  assert.ok(section(s.boxes,'artist').length>section(s.boxes,'front').length/14);
});
test('seeking, reload and quiet-mode tableaux reconstruct deterministic geometry',()=>{
  const market=createFerryMarket(),target='2026-11-21T15:44:53Z',fresh=scene(createFerryMarket(),target);
  scene(market,'2026-11-21T19:45Z');scene(market,'2026-11-17T08:01Z');
  const seek=scene(market,target);
  for(const key of ['boxes','roofs','people'])assert.deepEqual(seek[key],fresh[key]);
  const quiet=scene(market,target,true),hold=scene(market,'2026-11-21T15:44:59Z',true);
  assert.deepEqual(quiet,hold);
  assert.notDeepEqual(scene(market,'2026-11-21T15:50:00Z',true).roofs,hold.roofs);
  const open=scene(market,'2026-11-17T18:00Z',true);
  assert.equal(scene(market,'2026-11-17T19:00Z',true).rev,open.rev);
});
