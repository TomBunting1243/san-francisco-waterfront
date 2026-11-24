import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {expressAlighter,expressBerth,howardShopLanding,expressServiceDate,howardCallAt,howardExpressPose} from '../app/howard-express.ts';
import {createPromenadeTransit} from '../app/promenade-transit.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {driverPose} from '../app/driver-rides.ts';
import {howardTurnStopLine,signalAspects} from '../app/waterfront-signals.ts';
import trees from '../public/data/howard-trees.json' with {type:'json'};

const C=.988686,S=.150004;
function pixel(x,z){return [300+200*(C*(x+25.894)-S*(z+12.65)),1400+200*(S*(x+25.894)+C*(z+12.65))];}
function xz(p){return [p.x,p.z];}
const service='2026-11-24';
test('three eastbound terminal calls use the two agency service calendars within the feed validity',()=>{
  for(const date of ['2026-08-31','2026-11-11',service,'2026-11-27','2026-12-24','2027-01-15'])assert.equal(expressServiceDate(date),true,date);
  for(const date of ['2026-08-28','2026-08-29','2026-09-07','2026-10-12','2026-11-26','2026-12-25','2027-01-01','2027-01-16'])assert.equal(expressServiceDate(date),false,date);
  assert.deepEqual([468,503,536].map(min=>howardCallAt(min*60)),[0,0,0]);
  assert.equal(howardCallAt(12*3600),undefined);
});

test('the full articulated footprint passes Spear under green and stands beyond the far walk on the south curb',()=>{
  for(let clock=0;clock<64;clock++){
    let first,last;
    for(let t=-100;t<1;t+=.25){
      const p=howardExpressPose(t,clock+t);
      const [u,v]=pixel(p.head.x,p.head.z);
      if(v>=1090&&v<=1200)assert.ok(u>260&&u<262);
      // Leading bumper and trailer tail, using actual section dimensions.
      const noseV=pixel(p.head.x+.368*Math.cos(p.head.yaw),p.head.z-.368*Math.sin(p.head.yaw))[1];
      const tailV=pixel(p.joint.x-.36*Math.cos(p.trailerYaw),p.joint.z+.36*Math.sin(p.trailerYaw))[1];
      if(noseV>1252&&first===undefined)first=t;
      if(tailV>1563&&last===undefined)last=t;
    }
    assert.ok(first!==undefined&&last!==undefined);
    assert.equal(signalAspects(clock+first)[1],2);
    assert.equal(signalAspects(clock+last)[1],2);
    const stop=howardExpressPose(10,clock+10);
    assert.deepEqual(xz(stop.head),[expressBerth.x,expressBerth.z]);
    assert.ok(pixel(stop.joint.x-.36*Math.cos(stop.trailerYaw),stop.joint.z+.36*Math.sin(stop.trailerYaw))[1]>1597);
  }
});
test('the express allocates one batch on demand, opens the curbside doors and places the rider on surveyed sidewalk',()=>{
  const scene=createPromenadeTransit(),seconds=468*60;
  const at=(t,date=service)=>scene.update(t,468,false,date,undefined,undefined,undefined,seconds+t,t);
  at(5,'2026-11-26');assert.equal(scene.express,undefined);
  at(5);const actor=scene.express,front=actor.poses.getObjectByName('30X front section');
  const rider=actor.poses.getObjectByName('Howard terminal alighting passenger');
  const surface=new THREE.Group(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  addSurveyBlocks((g,c,x,y,z)=>{const m=new THREE.Mesh(g,material);m.position.set(x,y,z);surface.add(m);return m;});
  surface.add(howardShopLanding());surface.updateMatrixWorld(true);
  function floor(x,z){
    return new THREE.Raycaster(new THREE.Vector3(x,.075,z),new THREE.Vector3(0,-1,0)).intersectObjects(surface.children)[0]?.point.y;
  }
  const sectionCount=actor.batch.instanceCount;
  assert.equal(scene.root.children.length,2);assert.ok(sectionCount>10&&sectionCount<35);
  at(0);actor.poses.updateMatrixWorld(true);
  const wheels=[[-3.59,1.24],[-3.59,-1.24],[3.69,1.24],[3.69,-1.24]].map(([x,z])=>front.localToWorld(new THREE.Vector3(x,0,z)));
  for(const w of wheels)assert.ok(Math.abs(floor(w.x,w.z)-w.y)<.0011);
  const ray=new THREE.Raycaster(front.localToWorld(new THREE.Vector3(4.59,1.65,2)),new THREE.Vector3(0,0,-1).applyQuaternion(front.quaternion));
  assert.ok(front.worldToLocal(ray.intersectObject(actor.batch)[0].point.clone()).z>1.19);
  at(8);assert.ok(front.worldToLocal(ray.intersectObject(actor.batch)[0].point.clone()).z<.5);
  assert.equal(actor.poses.getObjectByName('30X Spear + Howard destination').visible,true);
  for(const t of [2,3,5,7,10,12]){
    at(t);const [u,v]=pixel(rider.position.x,rider.position.z);
    if(t>=3){
      assert.ok(u<215&&v>=1570&&v<1820);
      assert.ok(Math.abs(rider.position.y-floor(rider.position.x,rider.position.z))<.001);
      for(const [,x,z] of trees.trees)assert.ok(Math.hypot(x-rider.position.x,z-rider.position.z)>.033);
    }
  }
  for(let t=3;t<40;t+=.25){
    const feet=expressAlighter(t);if(!feet)break;
    assert.ok(Math.abs(floor(feet.x,feet.z)-feet.y)<.0011,'unsupported passenger at '+t);
  }
  at(42);assert.equal(actor.poses.getObjectByName('Not in service destination').visible,true);
  assert.equal(rider.visible,false);
  at(400);assert.equal(actor.batch.visible,false);
  at(0);assert.equal(scene.express,actor);
});

test('the nonrevenue bus waits at the curbside stripe, takes the inland carriageway, and clears the touring car',()=>{
  const stop=howardExpressPose(60,60).head,bar=howardTurnStopLine;
  const noseX=stop.x+.37*Math.cos(stop.yaw),noseZ=stop.z-.37*Math.sin(stop.yaw);
  const gap=(bar.x-noseX)*bar.nx+(bar.z-noseZ)*bar.nz;
  assert.ok(gap>.035&&gap<.075,gap);
  assert.ok(howardExpressPose(151,151).head.x<-42&&howardExpressPose(367,367).head.z<-68);
  const drive=[];
  for(let t=267;t<371;t+=.5){
    const {eye,look}=driverPose('bridge',t),l=Math.hypot(look.x-eye.x,look.z-eye.z);
    const dx=(look.x-eye.x)/l,dz=(look.z-eye.z)/l;
    drive.push([t,eye.x-.0228*dz,eye.z+.0228*dx,dx,dz]);
  }
  for(let arrival=185;arrival<435;arrival+=.5)for(const [t,x,z,dx,dz] of drive){
    const {head,joint,trailerYaw}=howardExpressPose(t-arrival,t,true);
    for(const [cx,cz,yaw,fore,aft] of [[head.x,head.z,head.yaw,.365,-.35],[joint.x,joint.z,trailerYaw,0,-.36]]){
      const c=Math.cos(yaw),s=Math.sin(yaw);
      for(const off of [-.113,0,.113]){
        const rx=x+dx*off-cx,rz=z+dz*off-cz,along=rx*c-rz*s;
        if(along>=aft-.025&&along<=fore+.025)assert.ok(Math.abs(rx*s+rz*c)>.15,'coach overlaps the drive at '+t);
      }
    }
  }
});
