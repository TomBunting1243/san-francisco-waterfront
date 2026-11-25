import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addTownHall} from '../app/town-hall.ts';

const at=(u,v,h)=>new T.Vector3(-27.880726+.00908125*u+.05931031*v,.054+.06*h,-31.426779+.05930954*u-.00907626*v);
function model(){
  const group=new T.Group(),windows=[];
  assert.equal(addTownHall({id:192883914},group,windows),true);
  group.updateMatrixWorld(true);
  return {group,mesh:group.children[0],windows};
}
const down=new T.Vector3(0,-1,0);
test('three-storey Marine Electric roof and localized rear equipment follow the city footprint and laser heights',()=>{
  const {mesh}=model();
  for(const [u,v,h] of [[1,3,14.97],[29,8,14.97],[12,8,17.17],[23,7,19.05],[8,0,15.39]]){
    const hit=new T.Raycaster(at(u,v,25),down).intersectObject(mesh)[0];
    assert.ok(hit&&Math.abs(hit.point.y-at(u,v,h).y)<.0001,[u,v,h]);
  }
  assert.equal(new T.Raycaster(at(-1.5,4,25),down).intersectObject(mesh).length,0);
});
test('seven Howard and two Fremont factory bays have recessed sash between structural piers on each upper floor',()=>{
  const {mesh}=model(),length=213/7,depth=72/7;
  for(const [start,end,count,width] of [[(s,h)=>at(s,-2,h),(s,h)=>at(s,0,h),7,length],[(s,h)=>at(-2,depth-s,h),(s,h)=>at(0,depth-s,h),2,depth]]){
    for(const h of [6.15,11.04]){
      const pitch=(width-1)/count;
      const distance=s=>new T.Raycaster(start(s,h),end(s,h).sub(start(s,h)).normalize()).intersectObject(mesh)[0]?.distance;
      for(let i=0;i<count;i++){
        assert.ok(Math.abs(distance(.5+(i+.4)*pitch)-.06*2.22)<.0002);
        assert.ok(Math.abs(distance(.94+i*pitch)-.06*2)<.0002);
      }
    }
  }
});
test('night panes meet recessed glazing on both street faces; adjacent buildings retain ownership',()=>{
  const {group,mesh,windows}=model();
  assert.ok(windows.length>=36&&windows.length<100);
  assert.equal(new Set(windows.map(p=>Math.round(p.ry*100))).size,2);
  for(const p of windows){
    const outward=new T.Vector3(Math.sin(p.ry),0,Math.cos(p.ry));
    const front=new T.Vector3(p.x,p.y,p.z).addScaledVector(outward,.003);
    const hit=new T.Raycaster(front,outward.negate(),0,.008).intersectObject(mesh)[0];
    assert.ok(hit&&Math.abs(hit.distance-.00408)<.0001);
  }
  for(const id of [192883913,445566153])assert.equal(addTownHall({id},group,windows),false);
  assert.equal(group.children.length,1);
  assert.ok(mesh.geometry.index.count/3<2400);
});
test('photographed pier washes stay on masonry between the recessed Howard bays',()=>{
  const {mesh}=model(),attribute=mesh.geometry.getAttribute('signLight');
  function light(s,height){
    const origin=at(s,-2,height),inward=at(s,0,height).sub(origin).normalize();
    const hit=new T.Raycaster(origin,inward).intersectObject(mesh)[0];
    const p=new T.Vector3(),geometry=mesh.geometry,triangle=new T.Triangle();
    for(const [corner,index] of [['a',hit.face.a],['b',hit.face.b],['c',hit.face.c]])
      triangle[corner].fromBufferAttribute(geometry.attributes.position,index);
    triangle.getBarycoord(hit.point,p);
    return p.x*attribute.getX(hit.face.a)+p.y*attribute.getX(hit.face.b)+p.z*attribute.getX(hit.face.c);
  }
  const mid=.5+(213/7-1)/7;
  assert.ok(light(mid,9.34)>.60);
  assert.ok(light(mid,7.5)<.15);
  assert.ok(light(mid+.43,9.34)<.25);
  assert.equal(light(mid+1.5,10.25),0);
});

test('the Fremont canopy spans its two bays and mitres into just the first Howard awning',()=>{
  const {mesh}=model(),reach=1.38,crest=4.29,hem=3.85;
  function cloth(u,v,expected){
    const hits=new T.Raycaster(at(u,v,8),down,0,.40).intersectObject(mesh);
    if(expected===null){assert.equal(hits.length,0,'open air at '+[u,v]);return;}
    assert.equal(hits.length,1,'one exposed upper surface at '+[u,v]);
    assert.ok(Math.abs(hits[0].point.y-at(u,v,expected).y)<.0012,[u,v,expected]);
  }
  for(const v of [.05,2.4,4.95,5.2,7.7,10.22]){
    for(const d of [.16,1.32])cloth(-d,v,crest+(hem-crest)*d/reach);
    cloth(-1.49,v,null);
  }
  for(const [u,v] of [[-.6,-.36],[-.36,-.6],[1.62,-1.31]])cloth(u,v,crest+(hem-crest)*Math.max(-u,-v)/reach);
  cloth(4.70,-.64,null);
});

test('Fremont has a slender capital over its center support and transom light on either side',()=>{
  const {mesh}=model(),middle=(72/7)/2;
  function front(v,h){
    const start=at(-2,v,h),dir=at(0,v,h).sub(start).normalize();
    return new T.Raycaster(start,dir).intersectObject(mesh)[0];
  }
  assert.ok(front(middle,3.45).distance+.004<front(middle,2).distance);
  for(const v of [middle-.32,middle+.32]){
    const transom=front(v,2.96),base=front(v,.42);
    assert.ok(Math.abs(transom.distance-.06*2.13)<.0003);
    const wash=mesh.geometry.getAttribute('signLight');
    assert.ok(wash.getX(transom.face.a)>.1);
    assert.equal(wash.getX(base.face.a),0);
  }
});
