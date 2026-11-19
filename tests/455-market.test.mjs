import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import {add455Market} from '../app/455-market.ts';

test('455 Market’s stepped two-part roof, First Street setback, Market arcade and glass relief',()=>{
  const group=new T.Group(),windows=[],a=-Math.atan2(.368,2.485),c=Math.cos(a),s=Math.sin(a);
  const pos=(u,h,v)=>new T.Vector3(-12.423+.06*(c*u-s*v),.045+.06*h,-40.35+.06*(s*u+c*v));
  for(const id of [159280395,1410934053]){
    const b=map.buildings.find(b=>b.id===id);assert.ok(b);assert.equal(add455Market(b,group,windows),true);
  }
  assert.equal(add455Market({id:288505729},group,windows),false);
  const cast=(start,end)=>new T.Raycaster(start,end.clone().sub(start).normalize()).intersectObjects(group.children)[0];
  const height=(u,v)=>{const hit=cast(pos(u,180,v),pos(u,0,v));return (hit.point.y-.045)/.06;};
  for(const [u,v,h] of [[10,13,96.36],[15,21,99.05],[28,6,100.45],[6,5,62.3],[8,2,26.15],[44,9,33.55],[66,13,36.55],[63,.95,29.85]]){
    assert.ok(Math.abs(height(u,v)-h)<.02,`at ${u},${v}: ${height(u,v)} versus ${h}`);
  }
  const front=(v,h)=>cast(pos(90,h,v),pos(40,h,v)).distance/.06;
  assert.ok(front(22.3,2)-front(12.46,2)>3.5); // deeper covered arcade on the plaza side
  assert.ok(front(12.46,10)<front(12.46,2)-.6);
  const meshCount=group.children.length,triangles=group.children.reduce((n,m)=>n+m.geometry.index.count/3,0);
  assert.equal(meshCount,2);assert.ok(triangles<18000);assert.ok(windows.length>45);
  for(const w of windows)assert.ok(w.w>0&&w.h>0&&Number.isFinite(w.ry));
  console.log({triangles,nightPanes:windows.length});
});
