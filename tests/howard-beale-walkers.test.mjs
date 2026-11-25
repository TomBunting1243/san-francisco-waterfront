import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {howardBealeAttendance,howardBealeWalkerCount,howardBealeWalkerPose} from '../app/howard-beale-walkers.ts';
import {driverPose} from '../app/driver-rides.ts';
import {waterfrontWalker,howardBealeWalkerStart,waterfrontCarCount,waterfrontCyclist,waterfrontCar} from '../app/waterfront-routes.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {howardOpenings} from '../app/301-howard-front.ts';
import curbs from '../public/data/curb-survey.json' with {type:'json'};
import trees from '../public/data/howard-trees.json' with {type:'json'};
import lamps from '../public/data/authored-street-lamps.json' with {type:'json'};

test('the Howard visitors and passersby keep both soles on rendered sidewalk and clear mapped obstacles',()=>{
  const root=new THREE.Group();
  addSurveyBlocks((g,c,x,y,z)=>{const m=new THREE.Mesh(g);m.position.set(x,y,z);root.add(m);return m;});
  root.updateMatrixWorld(true);
  const area=new THREE.Box3(new THREE.Vector3(-30,0,-30),new THREE.Vector3(-24,.2,-20));
  const local=root.children.filter(m=>new THREE.Box3().setFromObject(m).intersectsBox(area));
  const lightBuffer=Buffer.from(lamps.coordinates,'base64'),posts=[];
  for(let i=0;i<lightBuffer.length;i+=4)posts.push([lightBuffer.readInt16LE(i)/100,lightBuffer.readInt16LE(i+2)/100]);
  const obstacles=[...posts,...trees.trees.map(t=>t.slice(1,3))].filter(([x,z])=>x>-30&&x<-24&&z>-30&&z<-20);
  const bedEdges=curbs.bealeBeds.flatMap(([ring])=>ring.map(([x,z],i)=>{
    const [xx,zz]=ring[(i+1)%ring.length];
    return new THREE.Line3(new THREE.Vector3(x,0,z),new THREE.Vector3(xx,0,zz));
  }));
  const down=new THREE.Raycaster();down.ray.direction.set(0,-1,0);
  const walkerStart=howardBealeWalkerStart(),nearest=new THREE.Vector3();
  assert.equal(howardBealeWalkerStart('plaza'),-1);assert.equal(howardBealeWalkerStart('street'),-1);
  for(let i=0;i<howardBealeWalkerCount;i++)for(let t=-1;t<78;t+=.31){
    const p=howardBealeWalkerPose(t,i);assert.deepEqual(waterfrontWalker(t,walkerStart+i),p);
    const prev=howardBealeWalkerPose(t-.02,i);
    assert.ok(Math.hypot(p.x-prev.x,p.z-prev.z)<.0017);
    for(const o of obstacles)assert.ok(Math.hypot(o[0]-p.x,o[1]-p.z)>.06);
    const center=new THREE.Vector3(p.x,0,p.z);
    for(const edge of bedEdges)assert.ok(edge.closestPointToPoint(center,true,nearest).distanceTo(center)>.053);
    for(const offset of [-.021,.021]){
      down.ray.origin.set(p.x-Math.sin(p.heading)*offset,.095,p.z+Math.cos(p.heading)*offset);
      const top=down.intersectObjects(local,false)[0];
      assert.ok(top&&Math.abs(top.point.y-p.y)<.0004,`slot ${i}, t ${t}: surface ${top?.point.y}`);
    }
  }
});
test('301 Howard visitor stays outside the actual lobby and turns to face its doors during the pause',()=>{
  const [[x,z],[xx,zz]]=howardOpenings[0].edge,len=Math.hypot(xx-x,zz-z),tx=(xx-x)/len,tz=(zz-z)/len;
  const p=howardBealeWalkerPose(10,2);
  assert.ok(p.standing);
  assert.ok(Math.abs((p.x-x)*tx+(p.z-z)*tz-1.068)<.001);
  assert.ok(Math.abs((p.x-x)*(-tz)+(p.z-z)*tx-.08)<.001);
  assert.ok(Math.cos(p.heading)*tz-Math.sin(p.heading)*tx>.999);
});
test('modeled office and shop visits yield to a solitary public-sidewalk walker at night',()=>{
  for(const [h,count] of [[0,0],[6,1],[7,3],[8,4],[17,4],[18,3],[20,1],[22,1],[23,0],[8,4]])
    assert.equal(howardBealeAttendance(h),count);
});

test('both Howard sidewalks clear the turning driver and the moving waterfront traffic independently of walker phase',()=>{
  const visitors=[];
  for(let i=0;i<howardBealeWalkerCount;i++){
    for(let t=0;t<77;t+=.5)visitors.push(howardBealeWalkerPose(t,i));
  }
  for(let t=250;t<282;t+=.2){
    const {eye}=driverPose('bridge',t);
    for(const p of visitors)assert.ok(Math.hypot(p.x-eye.x,p.z-eye.z)>.21);
  }
  for(let t=0;t<90;t+=.75){
    for(let i=0;i<waterfrontCarCount()+3;i++){
      const car=i<3?waterfrontCyclist(t,i):waterfrontCar(t,i-3);
      if('active' in car&&!car.active)continue;
      for(const p of visitors)assert.ok(Math.hypot(p.x-car.x,p.z-car.z)>.26);
    }
  }
});

test('the flagged t266 forward view contains visitors on both sides of Howard',()=>{
  const t=266,{eye,look}=driverPose('bridge',t),forward=Math.atan2(look.z-eye.z,look.x-eye.x);
  const angles=Array.from({length:howardBealeWalkerCount},(_,i)=>{
    const p=waterfrontWalker(t,howardBealeWalkerStart()+i);
    const delta=Math.atan2(p.z-eye.z,p.x-eye.x)-forward;
    return Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI;
  });
  assert.ok(angles.some(a=>a>-25&&a<-5));
  assert.ok(angles.some(a=>a>5&&a<25));
});
