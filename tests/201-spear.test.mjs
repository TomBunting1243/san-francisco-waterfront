import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {sfMap} from '../app/sf-map.ts';
import {add201Spear} from '../app/201-spear.ts';

const root=new THREE.Group(),lights=[];
const [podium,wing,tower]=[288645263,1550628439,1550628438].map(id=>sfMap.buildings.find(b=>b.id===id));
for(const b of [podium,wing,tower])assert.ok(add201Spear(b,root,lights));
root.updateMatrixWorld(true);
const down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
function top(x,z){ray.set(new THREE.Vector3(x,6,z),down);return ray.intersectObject(root)[0]?.point.y}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<.002,'expected '+expected+', got '+actual)}

test('201 Spear steps from the south terrace to the wing, main deck and surveyed rooftop enclosure',()=>{
  near(top(-29.32,-10.54),1.275);
  near(top(-28.80,-10.70),4.073);
  near(top(-27.82,-10.03),4.357);
  near(top(-27.48,-10.72),4.69);
  // The framed panels sit inside the chamfered enclosure at opposite ends.
  for(const offset of [-.68,.69]){
    near(top(-27.47+offset*.992+.012,-10.74-offset*.126+.045),4.731);
  }
  assert.equal(top(-29.9,-10.6),undefined);
});

test('the long tooth faces have recessed glass and masonry spandrels; short returns are uninterrupted brick',()=>{
  function setback(edge,y){
    const a=tower.p[edge],b=tower.p[edge+1],dx=b[0]-a[0],dz=b[1]-a[1];
    // Tower OSM ring is clockwise in x/z.
    const normal=new THREE.Vector3(-dz,0,dx).normalize();
    const wall=new THREE.Vector3((a[0]+b[0])/2,y,(a[1]+b[1])/2);
    ray.set(wall.clone().addScaledVector(normal,.03),normal.clone().negate());
    const hit=ray.intersectObject(root.children[2])[0];assert.ok(hit);
    return wall.sub(hit.point).dot(normal);
  }
  const pitch=(4.357-1.275)/13;
  for(const row of [0,2,7,12]){
    near(setback(23,1.275+(row+.5)*pitch),.010);
    near(setback(23,1.275+(row+.97)*pitch),0);
    near(setback(22,1.275+(row+.5)*pitch),0);
  }
  assert.ok(lights.length>45);
  for(const w of lights){
    ray.set(new THREE.Vector3(w.x,w.y,w.z),new THREE.Vector3(-Math.sin(w.ry),0,-Math.cos(w.ry)));
    near(ray.intersectObject(root)[0]?.distance,.002);
  }
});

test('Spear Street has a recessed storefront behind freestanding brick columns',()=>{
  const a=podium.p[61],b=podium.p[102],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const normal=new THREE.Vector3((b[1]-a[1])/len,0,-(b[0]-a[0])/len);
  function depth(t){
    const p=new THREE.Vector3(a[0]+t*(b[0]-a[0]),.15,a[1]+t*(b[1]-a[1]));
    ray.set(p.clone().addScaledVector(normal,.22),normal.clone().negate());
    return p.sub(ray.intersectObject(root.children[0])[0].point).dot(normal);
  }
  const pier=depth((3+.28)/8),storefront=depth(.5);
  assert.ok(storefront-pier>.08);
});

test('all three parts use one indexed mesh each and leave Rincon Center untouched',()=>{
  assert.equal(add201Spear({...podium,id:944891685},root,lights),false);
  assert.equal(root.children.length,3);
  let triangles=0;
  for(const mesh of root.children){
    const g=mesh.geometry;triangles+=g.index.count/3;
    assert.ok(g.attributes.position.array.every(Number.isFinite));
    assert.equal(g.attributes.position.count,g.attributes.color.count);
  }
  assert.ok(triangles<16000,triangles+' triangles');
});

test('the numbered Spear pier turns the Howard corner above recessed retail glass',()=>{
  const center=podium.p[102];
  function setback(edge,fromCorner,y){
    const [a,b]=edge.map(i=>podium.p[i]),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const tx=(b[0]-a[0])/length,tz=(b[1]-a[1])/length,sign=edge[0]===102?1:-1;
    const normal=new THREE.Vector3(tz,0,-tx);
    const p=new THREE.Vector3(center[0]+sign*fromCorner*tx,y,center[1]+sign*fromCorner*tz);
    ray.set(p.clone().addScaledVector(normal,.15),normal.clone().negate());
    const hit=ray.intersectObject(root.children[0])[0];
    assert.ok(hit);return p.sub(hit.point).dot(normal);
  }
  for(const edge of [[61,102],[102,122]]){
    near(setback(edge,.06,.14),0);
    near(setback(edge,.34,.13),.043);
    near(setback(edge,.34,.28),0);
  }
  const g=root.children[0].geometry,colors=g.getAttribute('color'),p=g.getAttribute('position');
  const number=new THREE.Color('#b1afa0'),digits=new THREE.Box3();
  for(let i=0;i<p.count;i++)if(Math.abs(colors.getX(i)-number.r)<1e-6&&Math.abs(colors.getY(i)-number.g)<1e-6&&Math.abs(colors.getZ(i)-number.b)<1e-6)
    digits.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
  assert.ok(digits.min.y>.245&&digits.max.y<.30);
  assert.ok(digits.max.x-digits.min.x>.06&&digits.max.x<center[0]);
});
