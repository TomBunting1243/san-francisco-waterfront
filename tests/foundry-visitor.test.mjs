import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addFoundrySquare} from '../app/foundry-square.ts';
import {foundryVisitorPose,updateFoundryVisitor} from '../app/foundry-visitor.ts';
import {createPeople} from '../app/people.ts';

test('the 405 visitor walks the open grove aisle, turns, and lowers onto its measured granite seat',()=>{
  const plaza=new THREE.Group();
  addFoundrySquare({id:136104349},plaza,[]);
  const people=createPeople(5,1),slot=4;
  const seat=foundryVisitorPose(0),viewer=[seat.x+1,seat.z+2];
  people.setViewer(...viewer);
  const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,.15);
  function support(x,z){
    ray.ray.origin.set(x,.18,z);
    return ray.intersectObject(plaza,true)[0]?.point.y;
  }
  const matrix=new THREE.Matrix4();
  function part(name,index){
    people.group.getObjectByName(name).getMatrixAt(index,matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix);
  }
  let previous=seat,sat=false,leftSeat=false,reachedArcade=false,returned=false,turned=false;
  for(let i=0;i<=480;i++){
    const t=i/4,p=foundryVisitorPose(t);
    assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<.022);
    const angle=p.heading-previous.heading;
    assert.ok(Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<.8);
    if(Math.hypot(p.x-seat.x,p.z-seat.z)>.25)leftSeat=true;
    if(p.x<seat.x-.58&&p.z>seat.z+.95)reachedArcade=true;
    if(reachedArcade&&p.seated===1)returned=true;
    if(leftSeat&&p.pace===0&&Math.abs(angle)>.01)turned=true;
    updateFoundryVisitor(people,slot,t,14,...viewer);
    for(const j of [0,1]){
      const foot=part('Shoes',slot*2+j),y=support(foot.x,foot.z);
      assert.ok(y!==undefined&&Math.abs(y-.0462)<.00002,'paving under shoe at '+t+' '+y);
      assert.ok(foot.y>=y&&foot.y<y+.015);
    }
    if(p.seated===1){
      const h=support(p.x,p.z);
      assert.ok(Math.abs(h-.0702)<.00003,'granite top');
      assert.ok(Math.abs(part('Contour trousers',(slot+1)*2).y-h)<.004);
      sat=true;
    }
    previous=p;
  }
  assert.ok(sat&&reachedArcade&&turned&&returned);
  for(const [h,x,z] of [[22,...viewer],[10,seat.x+30,seat.z]]) {
    updateFoundryVisitor(people,slot,10,h,x,z);
    assert.ok(people.isHidden(slot));
  }
  updateFoundryVisitor(people,slot,0,14,...viewer);
  assert.equal(people.isHidden(slot),false);
});
