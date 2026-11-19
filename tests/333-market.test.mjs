import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import {add333Market} from '../app/333-market.ts';

test('333 Market retains the sawtooth column survey, recessed lobby, flat terrace and mechanical well',()=>{
 const b=map.buildings.find(b=>b.id===288505729),root=new T.Group(),windows=[];
 assert.equal(add333Market({...b,id:32946526},root,windows),false);
 assert.ok(add333Market(b,root,windows));assert.equal(root.children.length,1);
 const mesh=root.children[0],s=Math.sin(-.148),c=Math.cos(-.148);
 const pos=(u,h,v)=>new T.Vector3(-7.131+.06*(c*u-s*v),.045+.06*h,-30.936+.06*(s*u+c*v));
 const height=(u,v)=>{
   const hit=new T.Raycaster(pos(u,200,v),new T.Vector3(0,-1,0)).intersectObject(mesh)[0];return (hit.point.y-.045)/.06;
 };
 for(const [u,v,want] of [[15,13,135.9],[5,6,145.9],[0,-6,145.75],[0,4,135.9],[-18,1,139.7]]){
   assert.ok(Math.abs(height(u,v)-want)<.035);
 }
 const outward=new T.Vector3(-s,0,c),scan=(u,h)=>{
   const origin=pos(u,h,26),hit=new T.Raycaster(origin,outward.clone().negate()).intersectObject(mesh)[0];
   assert.ok(hit);return origin.distanceTo(hit.point)/.06;
 };
 // Physical OSM column nose lies near u=+4.54, v=24.39; the bay between it and u=0 is behind.
 for(const h of [2,75,133])assert.ok(scan(2.2,h)-scan(4.54,h)>.67);
 assert.ok(scan(2.2,2)-scan(2.2,75)>1.13);
 assert.ok(windows.length>=40&&windows.length<=65);
 assert.ok(mesh.geometry.index.count/3<7000);
});
