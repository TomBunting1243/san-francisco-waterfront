import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFerryMarket,ferryMarketSchedule} from '../app/ferry-market.ts';
import {buildFerryTerminal,ferryConnections,fixedFerryApron} from '../app/ferry-terminal.ts';
import {routes,routeWidth} from '../app/waterfront-routes.ts';

const at=iso=>new Date(iso);
function scene(market,iso,still=false){
  const rev=market.update(+at(iso),still);
  const [boxes,roofs,people]=market.root.children;
  const matrix=new THREE.Matrix4();
  function transforms(mesh){
    return Array.from({length:mesh.count},(_,i)=>{mesh.getMatrixAt(i,matrix);return matrix.elements.slice();});
  }
  return {rev,boxes:transforms(boxes),roofs:transforms(roofs),people:transforms(people)};
}
const section=(array,where)=>array.filter(m=>where==='rear'?m[14]>1:where==='artist'?m[14]<-6:m[14]>-3&&m[14]<-1);
const position=(matrix)=>matrix.slice(12,15);
const width=(matrix)=>Math.hypot(...matrix.slice(0,3));
test('the permanent waterfront market stays stocked through midnight, weekdays, holidays and changes to Pacific time',()=>{
  const market=createFerryMarket(),open=scene(market,'2026-11-21T20:00Z');
  for(const iso of ['2026-03-03T18:00Z','2026-03-10T17:00Z','2026-11-26T20:00Z','2026-12-24T20:00Z','2026-12-31T20:00Z','2026-11-21T08:00Z']){
    const schedule=ferryMarketSchedule(at(iso));
    assert.equal(schedule.front,1);assert.equal(schedule.rear,1);
    const sample=scene(market,iso);
    for(const key of ['roofs','boxes','people']){
      assert.deepEqual(sample[key].filter(m=>m[14]>-3),open[key].filter(m=>m[14]>-3));
    }
  }
  assert.equal(ferryMarketSchedule(at('2026-11-21T08:00Z')).artist,0);
  assert.equal(ferryMarketSchedule(at('2026-11-21T20:00Z')).artist,1);
});
test('fixed-plaza pitches wrap around the south end without obstructing the ferry loop, kiosks or gate approaches',()=>{
  const market=createFerryMarket(),s=scene(market,'2026-11-21T20:00Z');
  const rear=s.roofs.filter(m=>m[14]>2),south=s.roofs.filter(m=>m[12]<-6.2&&m[14]>-1.2&&m[14]<1.8);
  assert.equal(rear.length,27);assert.equal(south.length,7);
  assert.equal(section(s.roofs,'front').length,15);assert.equal(section(s.roofs,'artist').length,7);
  const root=new THREE.Group(),terminal=buildFerryTerminal((g,c,x,y,z,parent)=>{
    const mesh=new THREE.Mesh(g);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  },root);
  root.updateMatrixWorld(true);
  const shelter=terminal.getObjectByName('Golden Gate Ferry Terminal waiting shelter');
  const shelterBounds=new THREE.Box3().setFromObject(shelter);
  const boundary=fixedFerryApron.p.map(p=>new THREE.Vector2(...p));
  const shape=new THREE.Shape(boundary),geometry=new THREE.ShapeGeometry(shape);
  const deck=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(),foot=routes.ferry.getSpacedPoints(250);
  for(const m of rear){
    const [x,,z]=position(m);
    const roofBox=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...position(m)),new THREE.Vector3(width(m),.054,.19));
    assert.ok(!roofBox.intersectsBox(shelterBounds),'shelter/kiosk overlap at '+[x,z]);
    assert.ok(ferryConnections.every(c=>Math.hypot(x-c.from[0],z-c.from[1])>c.width/2+.19));
    for(const dx of [-.1,.1])for(const dz of [-.1,.1]){
      ray.set(new THREE.Vector3(x+dx,z+dz,1),new THREE.Vector3(0,0,-1));assert.ok(ray.intersectObject(deck).length);
    }
    assert.ok(Math.min(...foot.map(p=>Math.hypot(x-p.x,z-p.z)))>routeWidth.ferry/2+.1);
  }
  assert.ok(market.root.children.every(m=>m.isInstancedMesh&&m.visible&&m.count<=m.instanceMatrix.count&&Number.isFinite(m.boundingSphere.radius)));
  assert.ok(section(s.boxes,'artist').length>section(s.boxes,'front').length/14);
});
test('outdoor tables follow documented storefronts and leave the passenger routes and market aisles open',async()=>{
  const {ferryPatios}=await import('../app/ferry-patios.ts');
  const {ferryPassengerPose,ferryPassengerCount}=await import('../app/ferry-passengers.ts');
  const {ferryCycle}=await import('../app/ferry-service.ts');
  const {ferryPose}=await import('../app/motion.ts');
  const layout=ferryPatios();layout.updateMatrixWorld(true);
  const tables=layout.children.map(o=>new THREE.Box3().setFromObject(o)),counts=new Map();
  const mappedFrontages=new Map([['Arquet',[4.17,5.88]],['Hog Island Oyster Co.',[1.63,3.27]],
    ['Red Bay Coffee',[-4.26,-3.61]],["Gott's Roadside",[4.27,5.88]]]);
  for(const [i,table] of layout.children.entries()){
    const name=table.name.replace(' outdoor table',''),[lo,hi]=mappedFrontages.get(name);
    counts.set(name,(counts.get(name)??0)+1);
    assert.ok(tables[i].min.x>lo&&tables[i].max.x<hi);
    assert.ok(name==="Gott's Roadside"?tables[i].max.z< -1.70:tables[i].min.z>1.64&&tables[i].max.z<2.17);
    assert.ok(tables.slice(0,i).every(t=>!t.intersectsBox(tables[i])));
    assert.ok(ferryConnections.every(c=>Math.hypot(table.position.x-c.from[0],table.position.z-c.from[1])>.42));
  }
  assert.deepEqual(Object.fromEntries(counts),{'Arquet':12,'Hog Island Oyster Co.':5,'Red Bay Coffee':3,"Gott's Roadside":6});
  const market=createFerryMarket(),s=scene(market,'2026-11-21T20:00Z');
  const stallBounds=s.roofs.filter(m=>m[14]>-3).map(m=>{
    const [x,,z]=position(m);
    return new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,.12,z),
      new THREE.Vector3(Math.abs(m[0])+Math.abs(m[8]),.25,Math.abs(m[2])+Math.abs(m[10])+.06));
  });
  for(const pitch of stallBounds)assert.ok(tables.every(t=>!t.intersectsBox(pitch)),'vendor canopy over dining table');
  const obstacles=[...tables,...stallBounds];
  for(let t=0;t<2*ferryCycle;t+=.5)for(let i=0;i<ferryPassengerCount;i++){
    const p=ferryPassengerPose(t,i,ferryPose(t,0));
    assert.ok(obstacles.every(b=>Math.hypot(Math.max(0,b.min.x-p.x,p.x-b.max.x),Math.max(0,b.min.z-p.z,p.z-b.max.z))>.026),
      'passenger meets an outdoor table or market at '+[p.x,p.z]);
  }
});

test('seeking, reload and quiet-mode tableaux reconstruct deterministic geometry',()=>{
  const market=createFerryMarket(),target='2026-11-21T16:44:53Z',fresh=scene(createFerryMarket(),target);
  scene(market,'2026-11-21T19:45Z');scene(market,'2026-11-17T08:01Z');
  const seek=scene(market,target);
  for(const key of ['boxes','roofs','people'])assert.deepEqual(seek[key],fresh[key]);
  const quiet=scene(market,target,true),hold=scene(market,'2026-11-21T16:44:59Z',true);
  assert.deepEqual(quiet,hold);
  assert.notDeepEqual(scene(market,'2026-11-21T16:50:00Z',true).roofs,hold.roofs);
  const open=scene(market,'2026-11-17T18:00Z',true);
  assert.equal(scene(market,'2026-11-17T19:00Z',true).rev,open.rev);
});

test('front plaza tables carry bouquets, produce bins and Foodwise program materials at separate pitches',()=>{
  const market=createFerryMarket();
  market.update(+at('2026-11-21T20:00Z'));
  const [boxes,roofs,rounds]=market.root.children;
  function items(mesh,centerX,z=-1.84){
    const matrix=new THREE.Matrix4(),color=new THREE.Color(),parts=[];
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);mesh.getColorAt(i,color);
      const {elements:m}=matrix;
      if(Math.abs(m[12]-centerX)<.18&&Math.abs(m[14]-z)<.16)
        parts.push({x:m[12],y:m[13],w:width(m),h:Math.hypot(...m.slice(4,7)),color:color.getHexString()});
    }
    return parts;
  }
  assert.equal(items(roofs,1.94)[0].color,'408456','green information canopy');
  assert.equal(items(roofs,-2.70)[0].color,'da7731','orange tasting canopy');
  for(const x of [-2.70,1.94])
    assert.equal(items(boxes,x).filter(p=>p.color==='8d9a78').length,3,'maps or recipe cards');
  assert.equal(items(rounds,2.41).filter(p=>['c46678','dbb350','b15c48','a684ac'].includes(p.color)).length,12);
  assert.equal(items(boxes,2.88).filter(p=>p.color==='bd9a6a').length,3,'three slatted produce bins');
  const bins=items(boxes,2.88);
  const base=bins.find(p=>p.color==='a18260'&&Math.abs(p.w-.064)<.00001);
  for(const rim of bins.filter(p=>['b99970','bd9a6a'].includes(p.color))){
    assert.ok(Math.abs((rim.y-rim.h/2)-(base.y+base.h/2))<.00001,'crate slats meet the top of the box');
  }
  assert.equal(items(boxes,.713,-8.175).filter(p=>p.color==='465d63').length,3,'screen-printed shirts on the back rail');
  for(const mesh of [boxes,roofs,rounds]){
    const m=new THREE.Matrix4();mesh.geometry.computeBoundingBox();
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,m);
      if(m.elements[14]<-3||m.elements[14]>-1)continue;
      const b=mesh.geometry.boundingBox.clone().applyMatrix4(m);
      assert.ok(b.max.x< -1.7||b.min.x>1.7,'Clock tower approach remains clear');
    }
  }
});

test('the baked waterfront keeps populated farmers market batches in the opening camera frustum',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const {openingCamera,openingLens,openingYaw,orbitOffset}=await import('../app/camera.ts');
  const world=createLandscape(),market=world.ferryMarket;
  market.update(+at('2026-11-19T20:00Z'));
  world.root.updateMatrixWorld(true);
  assert.equal(world.root.getObjectByName(market.root.name),market.root);
  const {frontMarketShopperPose,frontMarketShopperCount}=await import('../app/market-shoppers.ts');
  const down=new THREE.Vector3(0,-1,0),floorRay=new THREE.Raycaster();
  for(let i=0;i<frontMarketShopperCount;i++){
    for(let t=0;t<=44;t+=1.75){
      const pose=frontMarketShopperPose(t,i);
      floorRay.set(new THREE.Vector3(pose.x,.19,pose.z),down);
      const chunks=world.architectureChunks.filter(m=>floorRay.ray.intersectsBox(m.geometry.boundingBox));
      const top=floorRay.intersectObjects(chunks,false)[0];
      assert.ok(top&&Math.abs(top.point.y-pose.y)<.001,'shoes meet the finished bayfront apron');
    }
  }
  const {ferryPatios}=await import('../app/ferry-patios.ts');
  for(const table of ferryPatios().children){
    const {x,y,z}=table.position;
    floorRay.set(new THREE.Vector3(x+.018,y+.001,z+.018),down);
    const chunks=world.architectureChunks.filter(m=>floorRay.ray.intersectsBox(m.geometry.boundingBox));
    const ground=floorRay.intersectObjects(chunks,false)[0];
    assert.ok(ground&&Math.abs(ground.point.y-y)<.001,'table on finished paving at '+[x,y,z,ground?.point.y]);
    floorRay.set(new THREE.Vector3(x,y+.15,z),down);
    const top=floorRay.intersectObjects(chunks,false)[0];
    assert.ok(top&&Math.abs(top.point.y-y-.046)<.001,'exposed dining top at '+[x,y,z,top?.point.y]);
  }
  const frame=new THREE.Matrix4(),roofs=market.root.children[1];
  for(let i=0;i<roofs.count;i++){
    roofs.getMatrixAt(i,frame);
    const [x,,z]=position(frame.elements);
    if(z<=2&&!(x<-6.2&&z>-1.2))continue;
    const floor=z>2?.096:.106;
    for(const dx of [-.088,.088])for(const dz of [-.088,.088]){
      floorRay.set(new THREE.Vector3(x+dx,floor+.22,z+dz),down);
      const chunks=world.architectureChunks.filter(m=>floorRay.ray.intersectsBox(m.geometry.boundingBox));
      const ground=floorRay.intersectObjects(chunks,false)[0];
      assert.ok(ground&&Math.abs(ground.point.y-floor)<.006,'new pitch meets open paving at '+[x+dx,z+dz,ground?.point.y]);
    }
  }
  const target=new THREE.Vector3(...openingCamera.target),matrix=new THREE.Matrix4(),frustum=new THREE.Frustum();
  for(const [w,h] of [[1440,950],[1920,1080],[390,844]]){
    const camera=new THREE.PerspectiveCamera(20,w/h,.35,1800),lens=openingLens(w,h);
    orbitOffset(lens,openingYaw(w,h),0,camera.position);
    camera.position.add(target);camera.lookAt(target);camera.setFocalLength(lens.focalLength);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const batch of market.root.children){
      assert.ok(batch.visible&&batch.layers.test(camera.layers)&&frustum.intersectsObject(batch));
      batch.geometry.computeBoundingBox();
      let frontInView=0;
      for(let i=0;i<batch.count;i++){
        batch.getMatrixAt(i,matrix);
        if(matrix.elements[14]<-3||matrix.elements[14]>-1)continue;
        if(frustum.intersectsBox(batch.geometry.boundingBox.clone().applyMatrix4(matrix)))frontInView++;
      }
      assert.ok(frontInView>=8,batch.name+' front instances inside the '+w+'px opening');
    }
    // Trace the colored face of the print itself. This also checks the awning,
    // both people, the palm line and the grade between the stall and the eye.
    const boxes=market.root.children[0],paint=new THREE.Color();
    let printVisible=false;
    for(let i=0;i<boxes.count;i++){
      boxes.getColorAt(i,paint);if(paint.getHexString()!=='5c8681')continue;
      boxes.getMatrixAt(i,matrix);
      const aim=new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(frustum.containsPoint(aim),'held print in '+w+'px opening');
      const ray=new THREE.Raycaster(camera.position,aim.sub(camera.position).normalize());
      const hit=ray.intersectObjects(market.root.children,false)[0];
      assert.ok(hit?.object===boxes&&hit.instanceId===i,'open sightline below canvas');
      ray.far=hit.distance-.001;
      const blockers=world.architectureChunks.filter(m=>ray.ray.intersectsBox(m.geometry.boundingBox));
      printVisible=!ray.intersectObjects(blockers,false).length;
    }
    assert.ok(printVisible,'visible Market Street print at '+w+'px');
    // A surveyed plaza furnishing can cover part of a tent. Rays must still
    // actually reach each program desk's canvas through the built architecture.
    const roofs=market.root.children[1];
    for(const x of [-2.70,1.94]){
      const exposed=[-.065,0,.065].some(dx=>{
        const aim=new THREE.Vector3(x+dx,.162,-1.86),direction=aim.sub(camera.position).normalize();
        const ray=new THREE.Raycaster(camera.position,direction),hit=ray.intersectObject(roofs)[0];
        if(!hit||Math.abs(hit.point.x-x)>.11)return false;
        ray.far=hit.distance-.001;
        const obstacles=world.architectureChunks.filter(m=>ray.ray.intersectsBox(m.geometry.boundingBox));
        return !ray.intersectObjects(obstacles,false).length;
      });
      assert.ok(exposed,'Program canopy at '+x+' occluded at '+w+'px');
    }
  }
});

test('four shoppers walk separate aisles and stop within reach of goods at both neighboring counters',async()=>{
  const {frontMarketShopperCount,frontMarketShopperPose:pose}=await import('../app/market-shoppers.ts');
  const pitches=new Map([[-4.88,'produce'],[-4.41,'flowers'],[-3.17,'produce'],[-2.70,'cards'],
    [1.94,'cards'],[2.41,'flowers'],[3.65,'produce'],[4.12,'flowers']]);
  const market=createFerryMarket(),matrix=new THREE.Matrix4(),obstacles=[];
  market.update(+at('2026-11-21T20:00Z'));
  for(const batch of market.root.children){
    batch.geometry.computeBoundingBox();
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,matrix);
      if(matrix.elements[14]<-3||matrix.elements[14]>-1)continue;
      const b=batch.geometry.boundingBox.clone().applyMatrix4(matrix);
      if(b.min.y<.145&&b.max.y>.031)obstacles.push(b);
    }
  }
  assert.equal(frontMarketShopperCount,4);
  const checked=new Set();
  let movingAtStart=0;
  for(let i=0;i<frontMarketShopperCount;i++){
    if(!pose(0,i).standing)movingAtStart++;
    let moving=0,standing=0;
    for(let time=-1;time<=46;time+=.125){
      const p=pose(time,i),next=pose(time+.125,i);
      const stride=Math.hypot(next.x-p.x,next.z-p.z);
      assert.ok(stride<=.013,'walking speed and continuity through cycle boundaries');
      const turn=next.heading-p.heading;
      assert.ok(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<.4,'continuous turn toward counter');
      assert.ok(obstacles.every(b=>Math.hypot(Math.max(0,b.min.x-p.x,p.x-b.max.x),
        Math.max(0,b.min.z-p.z,p.z-b.max.z))>.022),'body clearance from frames, tables, customers and vendors');
      for(let j=0;j<i;j++){
        const other=pose(time,j);
        assert.ok(Math.hypot(p.x-other.x,p.z-other.z)>1,'separate browsing aisles');
      }
      if(!p.standing){moving++;continue;}
      standing++;
      if(next.standing)assert.equal(stride,0);
      assert.equal(p.heading,Math.PI/2,'facing the counter');
      if(checked.has(p.x))continue;
      checked.add(p.x);
      const kind=pitches.get(p.x);assert.ok(kind);
      const eye=new THREE.Vector3(p.x,p.y+.101,p.z);
      const goods=kind==='flowers'?[p.x+.028,p.y+.099,-1.867]:
        kind==='cards'?[p.x-.007,p.y+.061,-1.875]:[p.x,p.y+.076,-1.871];
      const ray=new THREE.Raycaster(eye,new THREE.Vector3(...goods).sub(eye).normalize(),0,.11);
      const hit=ray.intersectObjects(market.root.children,false)[0];assert.ok(hit);
      const color=new THREE.Color();hit.object.getColorAt(hit.instanceId,color);
      const tones=kind==='flowers'?['c46678','dbb350','b15c48','a684ac']:
        kind==='cards'?['8d9a78']:['af5240','738852','cd9c53','9e6658'];
      assert.ok(tones.includes(color.getHexString()),'clear line of sight to '+kind+' at '+p.x);
    }
    assert.ok(standing>60&&moving>60);
  }
  assert.deepEqual(checked,new Set(pitches.keys()));
  assert.ok(movingAtStart>0&&movingAtStart<frontMarketShopperCount);
});

test('Market Street displays stand on the striped grade and keep both crossing parties clear',async()=>{
  const {westMarketGround}=await import('../app/curb-survey.ts');
  const {plazaCrossingCount,plazaCrossingPose}=await import('../app/plaza-walkers.ts');
  const {signalPeriod}=await import('../app/waterfront-signals.ts');
  const market=createFerryMarket(),matrix=new THREE.Matrix4(),objects=[];
  market.update(+at('2026-11-21T20:00Z'));
  let frameFeet=0;
  for(const batch of market.root.children){
    batch.geometry.computeBoundingBox();
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,matrix);const {elements:m}=matrix;
      if(m[14]<-7.15||m[14]>-6.4)continue;
      const b=batch.geometry.boundingBox.clone().applyMatrix4(matrix);
      objects.push(b);
      if(Math.abs(m[0]-.003)<1e-6&&m[5]>.1){
        assert.ok(Math.abs(b.min.y-westMarketGround(m[12],m[14])-.00035)<.0001);
        frameFeet++;
      }
    }
  }
  assert.equal(frameFeet,12,'eight awning posts and four clothes-rail uprights');
  for(let t=0;t<signalPeriod*2;t+=.125)for(let i=0;i<plazaCrossingCount;i++){
    const p=plazaCrossingPose(t,i);
    if(p.z< -7.25||p.z> -6.3)continue;
    assert.ok(objects.every(b=>Math.hypot(Math.max(0,b.min.x-p.x,p.x-b.max.x),
      Math.max(0,b.min.z-p.z,p.z-b.max.z))>.025),'crossing shoulder clearance');
  }
});
