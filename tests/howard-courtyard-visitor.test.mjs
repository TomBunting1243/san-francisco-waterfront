import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {courtyardVisitorOpen,courtyardVisitorPose,updateCourtyardVisitor} from '../app/howard-courtyard-visitor.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {courtyardPoint} from '../app/howard-public-courtyard.ts';
import {createLandscape,createCityVignette} from '../app/landscape.ts';
import {waterfrontWalkerCount} from '../app/waterfront-routes.ts';
import {pacificClock} from '../app/harbor-timetable.ts';
import {createPeople} from '../app/people.ts';

test('San Francisco weekday access includes 08:00 and ends at 18:00, including both weekend days',()=>{
  for(const [iso,expected] of [
    ['2026-11-23T15:59:59Z',false],['2026-11-23T16:00:00Z',true],
    ['2026-11-28T01:59:59Z',true],['2026-11-28T02:00:00Z',false],
    ['2026-11-28T19:00:00Z',false],['2026-11-29T19:00:00Z',false],
    ['2026-07-13T15:00:00Z',true],
  ]){
    const p=pacificClock(new Date(iso));assert.equal(courtyardVisitorOpen(p.weekend,p.minutes),expected);
  }
});
test('visitor stays on real grade, clears planters, sits on the timber bench, and returns to the sidewalk',()=>{
  const all=[];
  addSurveyBlocks((g,c,x,y,z)=>{const m=new T.Mesh(g);m.position.set(x,y,z);m.updateMatrixWorld();g.computeBoundingBox();all.push(m);return m;});
  const mesh=all.find(m=>m.name==='120 Howard public courtyard');assert.ok(mesh);
  const ray=new T.Raycaster();ray.ray.direction.set(0,-1,0);
  const surface=(x,z)=>{
    ray.ray.origin.set(x,.25,z);return ray.intersectObjects(all.filter(m=>{const b=m.geometry.boundingBox;return b.min.x<=x&&b.max.x>=x&&b.min.z<=z&&b.max.z>=z;}),false)[0];
  };
  const people=createPeople(5,2),slot=4,matrix=new T.Matrix4();
  people.setViewer(-27,-16);
  const position=(name,i)=>{people.group.getObjectByName(name).getMatrixAt(i,matrix);return new T.Vector3().setFromMatrixPosition(matrix)};
  const [wx,,wz]=courtyardPoint(3.52,0),[nx,,nz]=courtyardPoint(3.52,1),length=Math.hypot(nx-wx,nz-wz);
  let entered=false,sat=false,returned=false;
  for(let t=0;t<=132;t+=.25){
    const p=courtyardVisitorPose(t),station=((p.x-wx)*(nx-wx)+(p.z-wz)*(nz-wz))/length**2;
    if(station>2)entered=true;
    if(sat&&station<0)returned=true;
    assert.ok(station>-.7&&station<46.4);
    assert.ok(Math.abs((p.x-wx)*(nz-wz)-(p.z-wz)*(nx-wx))<.000001);
    updateCourtyardVisitor(people,slot,t,true);
    for(let j=0;j<2;j++){
      const sole=position('Shoes',2*slot+j);
      const floor=surface(sole.x,sole.z);
      assert.ok(floor&&Math.abs(floor.point.y-.045)<.0003,'paving under foot '+t);
      assert.ok(sole.y>=floor.point.y-.001&&sole.y<floor.point.y+.016);
    }
    if(p.seated===1){
      sat=true;
      const support=surface(p.x,p.z);
      assert.equal(support.object,mesh);
      assert.ok(Math.abs(support.point.y-(.045+.487*.06))<.0001);
      const thigh=position('Contour trousers',2*(slot+2));
      assert.ok(Math.abs(thigh.y-support.point.y)<.005);
    }
  }
  assert.ok(entered&&sat&&returned);
});
test('city appends one hidden seat-capable slot and seeking restores the same pose without touching the earlier cast',()=>{
  const city=createLandscape(),slot=city.seatStart+city.pier14Visitors.length,people=city.people;
  assert.equal(city.walkerCount,waterfrontWalkerCount());
  assert.equal(city.courtyardSlot,slot);
  assert.equal(city.walkerHeads.count,slot+2);
  assert.equal(people.group.getObjectByName('Contour trousers').count,2*(slot+2+city.pier14Visitors.length+2));
  assert.ok(people.isHidden(slot));
  const poses=people.bodies.instanceMatrix.array.slice(0,slot*16);
  updateCourtyardVisitor(people,slot,32,true);assert.ok(!people.isHidden(slot));
  const sample=people.bodies.instanceMatrix.array.slice(slot*16);
  updateCourtyardVisitor(people,slot,75,true);updateCourtyardVisitor(people,slot,32,false);
  assert.ok(people.isHidden(slot));
  updateCourtyardVisitor(people,slot,32,true);
  assert.deepEqual(people.bodies.instanceMatrix.array.slice(slot*16),sample);
  assert.deepEqual(people.bodies.instanceMatrix.array.slice(0,slot*16),poses);
  for(const region of ['street','plaza']){
    const vignette=createCityVignette(region);
    assert.equal(vignette.courtyardSlot,-1);
    assert.equal(vignette.walkerHeads.count,vignette.seatStart+vignette.pier14Visitors.length);
  }
});
