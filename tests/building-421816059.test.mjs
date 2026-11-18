import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {addLuminaMainStreet} from '../app/building-421816059.ts';

const ids=[1328554757,421816059,421816065,421816064];
const root=new THREE.Group(),lights=[],parts=new Map();
for(const id of ids){
  const b=sfMap.buildings.find(b=>b.id===id);
  assert.ok(addLuminaMainStreet(b,root,lights));
  parts.set(id,root.children.at(-1));
}
const point=(p,q,h)=>new THREE.Vector3(-39.312-.991*(p/145-.6)-.136*(q/145-.5),h,
                                       -18.095+.136*(p/145-.6)-.991*(q/145-.5));
const ray=new THREE.Raycaster();
function top(p,q,mesh=root){
  ray.set(point(p,q,10),new THREE.Vector3(0,-1,0));
  return ray.intersectObject(mesh)[0]?.point.y;
}
function near(y,target){assert.ok(Math.abs(y-target)<.002,'expected '+target+', got '+y);}

test('338 Main has the mapped opposing tower setbacks, diagonal roof screen and eastern plant',()=>{
  near(top(735,95),4.38);near(top(500,340),4.38);
  near(top(735,120),6.17);near(top(500,310),6.17);
  near(top(748,180),6.53);near(top(495,260),6.53);
  near(top(520,95),6.755);near(top(636,204),6.935);
  near(top(698,321),6.832);near(top(735,321),6.832);
  assert.equal(top(420,300,parts.get(421816059)),undefined);
});

test('the penthouse roof gardens and the three glazed common court ovals remain separate',()=>{
  near(top(275,250),1.623);near(top(210,210),1.884);
  near(top(636,615),1.859);assert.ok(top(470,710)>1.9);
  for(const [x,y] of [[423,338],[394,449],[497,429]])near(top(x,y),.557);
  near(top(430,400),.525);
  assert.equal(top(789,412),undefined,'mid-block passage must stay open');
});

test('the four vertical balcony stacks extend out from the bowed curtain on each occupied level',()=>{
  const tower=parts.get(421816059);
  // Balcony chord midpoints come from the four breaks in the typical lower plan.
  const chords=[[[1150,137],[1171,111]],[[1225,539],[1252,549]],
                [[807,604],[784,630]],[[735,201],[705,192]]];
  const pitch=(4.38-.525)/23;
  for(const [[u,v],[w,z]] of chords){
    const x=452+((u+w)/2-698)*.578,y=56+((v+z)/2-86)*.564;
    const du=(w-u)*.578,dv=(z-v)*.564,len=Math.hypot(du,dv);
    function depth(h){
      const start=point(x+dv/len*18,y-du/len*18,h),end=point(x,y,h);
      ray.set(start,end.sub(start).normalize());return ray.intersectObject(tower)[0]?.distance;
    }
    for(const level of [0,6,13,19]){
      const floor=.525+pitch*level;
      assert.ok(depth(floor+.034)+.020<depth(floor+.107));
    }
  }
});

test('night windows lie on real glazing, with one indexed draw per owned part',()=>{
  assert.equal(addLuminaMainStreet({id:421816060},root,lights),false);
  assert.equal(addLuminaMainStreet({id:421816062},root,lights),false);
  assert.equal(root.children.length,4);
  assert.ok(lights.length>230 && lights.length<325);
  for(const w of lights){
    ray.set(new THREE.Vector3(w.x,w.y,w.z),new THREE.Vector3(-Math.sin(w.ry),0,-Math.cos(w.ry)));
    near(ray.intersectObject(root)[0]?.distance,.002);
  }
  assert.ok(root.children.every(m=>m.material===root.children[0].material && m.geometry.attributes.position.array.every(Number.isFinite)));
  assert.ok(root.children.reduce((t,m)=>t+m.geometry.index.count/3,0)<20500);
});
