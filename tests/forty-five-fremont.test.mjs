import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {addFortyFiveFremont} from '../app/forty-five-fremont.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';

const b=sfMap.buildings.find(b=>b.id===32946535),root=new THREE.Group(),lights=[];
assert.equal(addFortyFiveFremont(b,root,lights),true);
assert.equal(addFortyFiveFremont({...b,id:288716396},root,lights),false);
const parts=[];root.traverse(o=>{if(o.isMesh)parts.push(o);});
const block=bakeRigidChunk('45 Fremont test',parts,new THREE.MeshStandardMaterial({vertexColors:true}));
const origin=b.p[4],dx=b.p[0].map((v,i)=>v-origin[i]),dz=b.p[3].map((v,i)=>v-origin[i]);
const width=Math.hypot(...dx),depth=Math.hypot(...dz);
function point(u,y,v){return new THREE.Vector3(origin[0]+u*dx[0]+v*dz[0],y,origin[1]+u*dx[1]+v*dz[1]);}
const ray=new THREE.Raycaster();
function roof(u,v){ray.set(point(u,10,v),new THREE.Vector3(0,-1,0));return ray.intersectObject(block)[0]?.point.y;}
test('45 Fremont has a long raised enclosure and lower transverse roof extensions on the USGS roof plane',()=>{
  for(const [u,v,y] of [[.3,.17,8.147],[.6,.24,8.405],[.46,.77,8.405],[.36,.5,8.715]]){
    assert.ok(Math.abs(roof(u,v)-y)<.003);
  }
  assert.equal(roof(.0005,.0005),undefined,'radius continues through the roof');
});
test('five Fremont bays and three Market-facing bays have differently divided banks of glazing; upper plant floors carry louvers',()=>{
  function hit(front,bay,pane,row,frac=.45){
    const n=front?5:3,span=front?width:depth,unit=(.04+(bay+pane)*(span-.08)/n)/span;
    const p=front?point(unit,.315+(row+frac)*(8.147-.315)/33,0):point(1,.315+(row+frac)*(8.147-.315)/33,unit);
    const normal=front?new THREE.Vector3(-dz[0],0,-dz[1]).normalize():new THREE.Vector3(dx[0],0,dx[1]).normalize();
    ray.set(p.clone().addScaledVector(normal,.17),normal.clone().negate());const h=ray.intersectObject(block)[0];assert.ok(h);
    return {depth:p.sub(h.point).dot(normal)};
  }
  for(const [front,count,n] of [[true,5,3],[false,3,4]]){
    for(let k=0;k<count;k++){
      const glass=Array.from({length:n},(_,i)=>hit(front,k,(i+.5)/n,5));
      assert.ok(glass.every(w=>w.depth>.008&&w.depth<.01));
      const bayWidth=((front?width:depth)-.08)/count;
      for(let division=1;division<n;division++){
        const divider=(.014+(bayWidth-.028)*division/n+.0017)/bayWidth;
        assert.ok(Math.abs(hit(front,k,divider,5).depth-.005)<.001);
      }
    }
    assert.ok(hit(front,1,.5,22,.436).depth<.004);
    assert.ok(hit(front,1,.5,23,.436).depth<.004);
    assert.ok(hit(front,1,.43,24,.436).depth>.006);
  }
  assert.equal(parts.length,2);assert.ok(lights.length>120);
  assert.ok(block.geometry.index.count/3<16500);
});
