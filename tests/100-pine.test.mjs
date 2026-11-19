import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {sfMap} from '../app/sf-map.ts';
import {add100Pine} from '../app/100-pine.ts';
const root=new T.Group(),lights=[];
for(const id of [944025918,32946479])assert.ok(add100Pine(sfMap.buildings.find(b=>b.id===id),root,lights));
const c=1.48/Math.hypot(1.48,.747),s=.747/Math.hypot(1.48,.747);
const at=(u,y,v)=>new T.Vector3(.233+c*u-s*v,y,-34.404+s*u+c*v);
const ray=new T.Raycaster();
function hit(p,d){ray.set(p,d);return ray.intersectObjects(root.children)[0];}
const top=(u,v)=>hit(at(u,10,v),new T.Vector3(0,-1,0))?.point.y;
const near=(x,y,t=.001)=>assert.ok(Math.abs(x-y)<t,`expected ${y}, got ${x}`);
test('the lidar footprint has stepped corners, a low roof surround, a tall screen and higher plant',()=>{
  near(top(.35,-2.2),.045+138*.06);near(top(.5,-.45),.045+145.25*.06);
  near(top(.1,-.1),.045+138*.06);assert.equal(top(-.08,-.12),undefined);
  near(top(.75,-1.12),.045+145.25*.06+.074);
});
test('Pine Street has a recessed entry behind a projecting canopy and thirty-two alternating office bands',()=>{
  const d=new T.Vector3(c,0,s),dist=(v,y)=>hit(at(-.55,y,v),d)?.distance;
  near(dist(-1.12,.275),.55-.247,.003);
  assert.ok(dist(-1.12,.12)>.53);
  const pitch=(.045+139.1*.06-.309)/32;
  for(let i=0;i<32;i++){
    const y=.309+i*pitch;
    assert.ok(dist(-1.016,y+pitch*.54)>dist(-1.016,y+pitch*.161)+.02);
  }
});
test('the north courtyard retains its elevated seating deck, falls, Front Street approach and clear aisles',()=>{
  near(top(1.925,-1.33),.218,.002);near(top(2.275,-1.27),.370);
  near(top(2,-.15),.048);assert.ok(top(2.01,-.745)>top(2.01,-.53));
  assert.equal(top(2.40,-1.34),undefined);
});
test('both mapped parts batch separately and every night pane sits on a glazed facade',()=>{
  const triangles=root.children.reduce((a,m)=>a+m.geometry.index.count/3,0);
  assert.equal(root.children.length,2);assert.ok(triangles<14500);
  assert.ok(lights.length>160&&lights.length<300);
  for(const {x,y,z,ry} of lights){
    const d=new T.Vector3(Math.sin(ry),0,Math.cos(ry)),p=new T.Vector3(x,y,z).addScaledVector(d,.002);
    near(hit(p,d.negate()).distance,.0035,.00025);
  }
  assert.equal(add100Pine({id:256067709,p:[]},root,lights),false);assert.equal(root.children.length,2);
});
