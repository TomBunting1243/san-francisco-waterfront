import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createPier14Plaza,createPier14Chairs,pier14Ground,pier14Seats,pier14Chairs} from '../app/pier14-plaza.ts';
import sf from '../public/data/sf-waterfront.json' with {type:'json'};
const down=(m,x,z,start=.25)=>new T.Raycaster(new T.Vector3(x,start,z),new T.Vector3(0,-1,0)).intersectObject(m).map(h=>h.point.y);
test('Mission plaza supports eight seat blocks and Corpus, keeps its waterfront recess open and joins both thresholds',()=>{
 const plaza=createPier14Plaza();
 const floor=(x,z)=>down(plaza,x,z)[0];
 assert.ok(Math.abs(floor(-15.1954,-.807)-.060)<.0001);
 assert.equal(pier14Seats.length,8);
 for(const [x,z] of pier14Seats){
   const levels=down(plaza,x,z);
   assert.ok(Math.abs(levels[0]-pier14Ground(x,z)-.465*.06)<.00015);
   assert.ok(levels.some(y=>Math.abs(y-pier14Ground(x,z))<.001));
   assert.ok(Math.hypot(x+15.1954,z+.807)>.245);
 }
 assert.ok(Math.abs(floor(-14.223,-.246)-.096)<.0003);
 assert.ok(Math.abs(floor(-16.766,-.11)-.06)<.0003);
 assert.equal(floor(-16.50,-.60),undefined);
 // Both public accesses remain clear at chair/rail height.
 for(const [x,z] of [[-16.766,0],[-14.22,-.26],[-14.21,-.40],[-15.2,-.48]])assert.ok(floor(x,z)<.10);
 assert.ok(plaza.geometry.index.count/3<1350);
});

test('eight pairs and five swivel chairs fit the mapped pier with a continuous through passage',()=>{
 const m=createPier14Chairs(),ring=sf.piers.find(p=>p.name==='Pier 14').p;
 function inside(x,z){
   let yes=false;for(let i=1;i<ring.length;i++){
     const a=ring[i-1],b=ring[i];if((a[1]>z)!==(b[1]>z)&&x<a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]))yes=!yes;
   }return yes;
 }
 assert.equal(pier14Chairs.length,21);
 for(const [x,z] of pier14Chairs){
   assert.ok(Math.abs(down(m,x,z)[0]-(.060+.445*.06))<.00005);
   for(let k=0;k<8;k++)assert.ok(inside(x+.021*Math.cos(k*Math.PI/4),z+.021*Math.sin(k*Math.PI/4)));
   assert.ok(down(m,x+.012,z,.065).some(y=>Math.abs(y-.0618)<.00012));
 }
 for(let z=.4;z<11.6;z+=.08)assert.ok(!down(m,-17.29,z).length);
 assert.ok(m.geometry.index.count/3<3350);
});
