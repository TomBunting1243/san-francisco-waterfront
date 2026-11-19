import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {busPose,createPromenadeTransit} from '../app/promenade-transit.ts';

test('the coach approaches the mapped Steuart terminal along the lane, dwells and accelerates away',()=>{
  const stop=busPose(0),before=busPose(-2),later=busPose(31+2);
  assert.ok(before.x<stop.x&&later.x>stop.x);
  for(const t of [1,14,30])assert.deepEqual([busPose(t).x,busPose(t).z],[stop.x,stop.z]);
  for(const t of [-.01,.01,30.99,31.01]){
    const p=busPose(t);assert.ok(Math.hypot(p.x-stop.x,p.z-stop.z)<.0001);
  }
  assert.ok(Math.abs(later.yaw-stop.yaw)<.08&&Math.abs(before.yaw-stop.yaw)<.15);
});

test('passengers pass through actual open coach doors at the curb and travel between the sidewalk and vehicle',()=>{
  const scene=createPromenadeTransit(),coach=scene.poses.getObjectByName('2 Sutter coach 1');
  const waiting=scene.poses.getObjectByName('Boarding passenger'),leaving=scene.poses.getObjectByName('Alighting passenger');
  const batch=scene.root.children[0];assert.ok(batch.isBatchedMesh);assert.equal(scene.root.children.length,1);
  const allParts=[];scene.poses.traverse(o=>{if(o.isMesh)allParts.push(o);});
  const coachIds=new Set();coach.traverse(o=>{if(o.isMesh)coachIds.add(allParts.indexOf(o));});
  const set=t=>{scene.update(t);scene.root.updateMatrixWorld(true);};
  const ray=x=>{
    const emitter=coach.localToWorld(new THREE.Vector3(x,1.65,3));
    return new THREE.Raycaster(emitter,new THREE.Vector3(0,0,-1).applyQuaternion(coach.quaternion)).intersectObject(batch).filter(h=>coachIds.has(h.batchId)).map(h=>coach.worldToLocal(h.point.clone()).z);
  };
  set(0);assert.ok(ray(4.59)[0]<0&&ray(-1.93)[0]<0);
  assert.ok(waiting.visible&&leaving.visible);
  set(11);const wait=coach.worldToLocal(waiting.position.clone());assert.ok(wait.z>2.4);
  set(14.8);const boarding=coach.worldToLocal(waiting.position.clone());assert.ok(Math.abs(boarding.x-4.59)<.02&&boarding.z<1.25&&boarding.z>.8);
  set(23);assert.equal(waiting.visible,false);assert.equal(leaving.visible,false);assert.ok(ray(4.59)[0]>1);
  set(28);assert.ok(busPose(35).x>busPose(31).x);
  let meshes=0,triangles=0;scene.root.traverseVisible(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  assert.equal(meshes,1);assert.ok(triangles<20000);
  const sheltered=scene.poses.getObjectByName('Steuart and Mission sheltered terminal'),bare=scene.poses.getObjectByName('2 Sutter terminal at Steuart and Don Chee');
  assert.equal(sheltered.children.length,2);assert.equal(bare.children.length,1);assert.equal(bare.position.y,.045);
});

test('Market terminal rider reads the timetable, returns to the bench and sits with planted feet',()=>{
  const scene=createPromenadeTransit(),actor=scene.poses.getObjectByName('Market terminal timetable reader');
  const market=scene.poses.getObjectByName('Steuart and Market sheltered terminal');
  const canopy=market.getObjectByName('Muni shelter with wave roof, bench and information case');
  const pad=market.getObjectByName('Terminal sidewalk beneath the surveyed shelter');
  const shoes=[];actor.traverse(o=>{if(o.name==='Timetable reader shoe')shoes.push(o);});
  assert.equal(shoes.length,2);
  const at=t=>{scene.update(t);return actor.getWorldPosition(new THREE.Vector3());};
  const local=(point)=>canopy.worldToLocal(point.clone());
  const feet=()=>shoes.map(s=>s.getWorldPosition(new THREE.Vector3()));
  const read=at(5);
  assert.ok(local(read).distanceTo(new THREE.Vector3(1.58,0,.23))<.002);
  assert.deepEqual(at(10).toArray(),read.toArray());
  // At eye height the actual front of the information case is 0.72 m ahead.
  const forward=actor.getWorldDirection(new THREE.Vector3());
  const eye=read.clone().add(new THREE.Vector3(0,1.60*.06,0));
  const sight=new THREE.Raycaster(eye,forward,0,.05).intersectObject(canopy)[0];
  assert.ok(sight&&sight.distance/.06>.62&&sight.distance/.06<.80);
  assert.ok(at(14).distanceTo(read)>.065);
  at(17.1);const planted=feet();
  for(const t of [17.4,18.1,18.75,28,58,60.5,61.55]){
    at(t);feet().forEach((p,i)=>assert.ok(p.distanceTo(planted[i])<.0001));
  }
  at(30);
  const hip=actor.getObjectByName('Timetable reader thigh').getWorldPosition(new THREE.Vector3());
  const seat=new THREE.Raycaster(hip,new THREE.Vector3(0,-1,0),0,.012).intersectObject(canopy)[0];
  assert.ok(seat&&Math.abs(local(seat.point).y-.5875)<.001);
  assert.ok(hip.y-seat.point.y<.003);
  const parts=[];scene.poses.traverse(o=>{if(o.isMesh)parts.push(o);});
  const body=actor.getObjectByName('Painted passenger'),instance=parts.indexOf(body);
  const drawn=new THREE.Matrix4();scene.batch.getMatrixAt(instance,drawn);
  assert.ok(scene.batch.getVisibleAt(instance));
  assert.ok(drawn.elements.every((v,i)=>Math.abs(v-body.matrixWorld.elements[i])<.00001));
  at(30);const paused=new THREE.Matrix4();scene.batch.getMatrixAt(instance,paused);
  assert.deepEqual(paused.elements,drawn.elements);
  for(let t=0;t<=62;t+=.18){
    const p=at(t),floor=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,.014,0)),new THREE.Vector3(0,-1,0),0,.02).intersectObject(pad)[0];
    assert.ok(floor&&Math.abs(floor.point.y-p.y)<.0002);
    const q=local(p);assert.ok(q.x> -1.6&&q.x<1.64&&q.z<=.91);
    const r=at(t+.01);assert.ok(p.distanceTo(r)<.0015);
  }
  const fixed=at(33).toArray();assert.deepEqual(at(95).toArray(),fixed);
  assert.ok(at(61.999).distanceTo(at(.001))<.0001);
});

test('front boarding follows supported paving, passes the exiting rider and reaches the stowed ramp',async()=>{
  const {addSurveyBlocks}=await import('../app/survey-blocks.ts');
  const ground=[],mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  addSurveyBlocks(g=>{const m=new THREE.Mesh(g,mat);ground.push(m);return m;});
  const scene=createPromenadeTransit(),coach=scene.poses.getObjectByName('2 Sutter coach 1');
  const board=scene.poses.getObjectByName('Boarding passenger'),exit=scene.poses.getObjectByName('Alighting passenger');
  const pole=scene.poses.getObjectByName('2 Sutter terminal at Steuart and Don Chee');
  const down=new THREE.Vector3(0,-1,0);
  const surface=(point,meshes)=>new THREE.Raycaster(new THREE.Vector3(point.x,.12,point.z),down,0,.13).intersectObjects(meshes,false)[0]?.point.y;
  for(let phase=2.5;phase<22;phase+=.125){
    scene.update(phase-7);
    const local=coach.worldToLocal(board.position.clone());
    if(local.z>1.51){
      // Contact over a 16 cm shoe footprint also covers the narrow survey
      // tessellation seam where the curb return meets the sidewalk mesh.
      const paving=[-.08,0,.08].map(d=>surface(coach.localToWorld(local.clone().setZ(local.z+d)),ground));
      assert.ok(paving.some(y=>y>.0405&&Math.abs(board.position.y-y)<.0009),'feet supported by curb or sidewalk at '+phase);
    }
    if(exit.visible)assert.ok(board.position.distanceTo(exit.position)>.048,'passing clearance at '+phase);
    assert.ok(Math.hypot(board.position.x-pole.position.x,board.position.z-pole.position.z)>.020);
  }
  scene.update(14.98);
  const floor=surface(board.position,[coach.children[0]]);
  // Cast below the roof and window belt, directly onto the ramp.
  assert.ok(floor&&Math.abs(floor-board.position.y)<.0003);
  // Front and rear door edges stop within a single ordinary step of curb top.
  for(const along of [4.59,-1.93]){
    const at=z=>coach.localToWorld(new THREE.Vector3(along,0,z));
    assert.ok(surface(at(1.27),ground)<.033);
    assert.ok(surface(at(1.53),ground)>.0405);
  }
  const cableCar=scene.poses.getObjectByName('California Street cable car 49');
  const carParts=cableCar.getObjectsByProperty('isMesh',true);
  const newGeometry=new Set(carParts.map(p=>p.geometry));
  const carTriangles=[...newGeometry].reduce((n,g)=>n+g.index.count/3,0);
  const visitors=scene.poses.getObjectByName('Frost Plaza photo visitors').getObjectsByProperty('isMesh',true);
  const visitTriangles=[...new Set(visitors.map(p=>p.geometry))].reduce((n,g)=>n+g.index.count/3,0);
  assert.equal(visitors.length,7);assert.ok(visitTriangles<850);
  const diners=scene.poses.getObjectByName('Terrene patio diners').getObjectsByProperty('isMesh',true);
  const dinerTriangles=diners.reduce((n,o)=>n+o.geometry.index.count/3,0);
  assert.equal(diners.length,5);assert.ok(dinerTriangles<900);
  const reader=scene.poses.getObjectByName('Railway museum exhibit reader').getObjectsByProperty('isMesh',true);
  assert.equal(reader.length,3);
  const readerTris=[...new Set(reader.map(p=>p.geometry))].reduce((n,g)=>n+g.index.count/3,0);
  assert.ok(readerTris<300);
  const station=scene.poses.getObjectByName('Washington F-line station').getObjectsByProperty('isMesh',true);
  const stationTris=[...new Set(station.map(p=>p.geometry))].reduce((n,g)=>n+g.index.count/3,0);
  assert.equal(station.length,6);assert.ok(stationTris<3500);
  const ferryRider=scene.poses.getObjectByName('Ferry Building center-exit passenger').getObjectsByProperty('isMesh',true);
  const ferryTris=[...new Set(ferryRider.map(p=>p.geometry))].reduce((n,g)=>n+g.index.count/3,0);
  assert.equal(ferryRider.length,4);assert.ok(ferryTris<1000);
  assert.equal(scene.batch.instanceCount-carParts.length-visitors.length-diners.length-reader.length-station.length-ferryRider.length,69);
  assert.ok(scene.batch.geometry.index.count/3-carTriangles-visitTriangles-dinerTriangles-readerTris-stationTris-ferryTris<6200);
  assert.ok(carTriangles<4600);
});

test('California 49 dwells at Drumm, boards from the island and runs on the narrow gauge through the crossover',async()=>{
  const {createCaliforniaCar,californiaRailGeometry,cableRailHead,californiaIslandTop}=await import('../app/california-terminal.ts');
  const {default:track}=await import('../public/data/california-terminal.json',{with:{type:'json'}});
  const {default:street}=await import('../public/data/market-street.json',{with:{type:'json'}});
  const pictured=createCaliforniaCar(),{car}=pictured,rider=car.getObjectByName('California cable car running-board rider');
  const body=car.children[0],island=street.platforms.find(([id])=>id===773030143)[2];
  const rail=new THREE.Mesh(californiaRailGeometry(),new THREE.MeshBasicMaterial());
  const surface=(x,y,z,mesh)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0),0,.15).intersectObject(mesh)[0];
  function step(t,clock=720){pictured.update(t,clock);car.updateMatrixWorld(true);}
  function inside(p){
    let yes=false;
    for(let i=0,j=island.length-1;i<island.length;j=i++){
      const [ax,az]=island[j],[bx,bz]=island[i];
      if((az>p.z)!==(bz>p.z)&&p.x<(bx-ax)*(p.z-az)/(bz-az)+ax)yes=!yes;
    }
    return yes;
  }
  step(0);const berth=car.position.clone(),yaw=car.rotation.y;
  assert.ok(Math.hypot(berth.x-track.nodes[5150140443][0],berth.z-track.nodes[5150140443][1])<.001);
  assert.equal(car.scale.x,.06);const bounds=body.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(bounds.x-9.2202)<.001&&Math.abs(bounds.z-2.4384)<.002&&Math.abs(bounds.y-3.0988)<.001);
  for(const t of [0,3,8,9,10]){
    step(t);const foot=rider.getWorldPosition(new THREE.Vector3());assert.ok(inside(foot));
    if(t<=9)assert.ok(Math.abs(foot.y-californiaIslandTop)<.0001);
  }
  for(const t of [16,31,46,96]){
    step(t);const feet=rider.getWorldPosition(new THREE.Vector3()),top=surface(feet.x,feet.y+.0005,feet.z,body);
    assert.ok(top&&Math.abs(top.point.y-feet.y)<.0004,'running board contact at '+t);
    const hand=rider.getObjectByName('Left hand gripping the cable car rail');
    const grip=car.worldToLocal(hand.localToWorld(new THREE.Vector3(-.125,-.05,.201)));
    assert.ok(Math.abs(grip.x+3.8)<.002&&Math.abs(grip.z+.919)<.002&&grip.y>=.655&&grip.y<=1.62);
    for(const z of [-.5335,.5335]){
      const wheel=car.localToWorld(new THREE.Vector3(0,0,z));const head=surface(wheel.x,wheel.y+.02,wheel.z,rail);
      assert.ok(head&&Math.abs(head.point.y-cableRailHead(wheel.z))<.0005,'rail below tread at '+t);
    }
  }
  step(96);assert.ok(car.position.distanceTo(berth)>5);
  step(599.99);assert.ok(car.position.distanceTo(berth)<.001&&Math.abs(car.rotation.y-yaw)<.005);
  step(11,419);assert.equal(car.visible,false);step(11,420);assert.equal(car.visible,true);
  step(11,1260);assert.equal(car.visible,false);
});

test('car 49 lights only its saloon glass and leading dash lens in the existing transit draw',()=>{
  const scene=createPromenadeTransit(),batch=scene.batch;
  const position=batch.geometry.attributes.position,mask=batch.geometry.attributes.cableLight;
  const byKind=[[],[],[],[],[],[]];
  for(let i=0;i<mask.count;i++)if(mask.getX(i))byKind[mask.getX(i)].push(new THREE.Vector3().fromBufferAttribute(position,i));
  assert.ok(byKind[1].length>80);
  assert.ok(byKind[1].every(v=>Math.abs(v.x)<1.69&&v.y>1.28&&v.y<2.42));
  for(const [kind,sign] of [[2,1],[3,-1]]){
    assert.ok(byKind[kind].length>=12);
    assert.ok(byKind[kind].every(v=>Math.abs(v.x-sign*4.511)<.0001&&Math.hypot(v.y-.845,v.z)<.07301));
  }
  const compile=mat=>{
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    mat.onBeforeCompile(shader,{});return shader;
  };
  const shader=compile(batch.material);
  assert.equal(shader.uniforms.cableDusk.value,0);
  scene.setNight(.75);
  assert.equal(shader.uniforms.cableDusk.value,.75);
  scene.update(16,1259);assert.equal(shader.uniforms.cableHeadlamp.value,2);
  scene.update(598,1259);assert.equal(shader.uniforms.cableHeadlamp.value,3);
  scene.update(16,1260);assert.equal(batch.getVisibleAt(0),false);
  const copy=batch.material.clone();copy.onBeforeCompile=batch.material.onBeforeCompile;
  const vignette=createPromenadeTransit(copy);vignette.setNight(.2);
  const local=compile(vignette.batch.material);
  assert.equal(local.uniforms.cableDusk.value,.2);
  assert.equal(shader.uniforms.cableDusk.value,.75);
  assert.equal(local.vertexShader.split('attribute float cableLight;').length,2);
  assert.equal(scene.root.children.length,1);
});

test('only the Washington rider receives nearby canopy, doorway and saloon light inside the transit draw',async()=>{
  const {driverPose,washingtonRideArrival}=await import('../app/driver-rides.ts');
  const scene=createPromenadeTransit(),batch=scene.batch;
  const rider=scene.poses.getObjectByName('Washington front-door passenger'),parts=[],riderParts=new Set();
  scene.poses.traverse(p=>{if(p.isMesh&&!parts.includes(p.geometry))parts.push(p.geometry);});
  rider.traverse(p=>{if(p.isMesh)riderParts.add(p.geometry);});
  const tags=batch.geometry.attributes.cableLight;
  parts.forEach((geometry,id)=>{
    const r=batch.getGeometryRangeAt(id);
    for(let j=r.vertexStart;j<r.vertexStart+r.vertexCount;j++)assert.equal(tags.getX(j)===4,riderParts.has(geometry));
  });
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  batch.material.onBeforeCompile(shader,{});
  scene.setNight(1);
  const lamp=shader.uniforms.washingtonLamp.value;
  let previous=0;
  for(const t of [-4,1.6,3.2,4.68,10,25]){
    const car=driverPose('streetcar',washingtonRideArrival+t);
    scene.update(t,1320,false,undefined,t,car.body);
    assert.ok(lamp.w>=previous);previous=lamp.w;
    if(t===-4)assert.equal(lamp.w,.13);
    if(t>=4.68)assert.equal(lamp.w,1);
    if(t>=10){
      const camera=new THREE.PerspectiveCamera();
      camera.position.set(car.eye.x,car.eye.y,car.eye.z);camera.lookAt(car.look.x,car.look.y,car.look.z);
      const local=camera.worldToLocal(new THREE.Vector3(lamp.x,lamp.y,lamp.z)).divideScalar(.06);
      assert.ok(local.distanceTo(new THREE.Vector3(1.03,.896,2.74))<.002,'source is the lit globe above the occupied berth');
    }
  }
  assert.match(shader.fragmentShader,/dot\(normal,delta\*inversesqrt/);
  assert.match(shader.fragmentShader,/diffuseColor\.rgb\*vec3\(1\.,\.88,\.73\)\*received/);
  scene.setNight(0);assert.equal(shader.uniforms.cableDusk.value,0);
  assert.equal(scene.root.children.length,1);
});

test('only the alighting passenger receives the center exit lamp, which fades away on the platform',async()=>{
  const {driverPose,museumLegDuration}=await import('../app/driver-rides.ts');
  const scene=createPromenadeTransit(),actor=scene.poses.getObjectByName('Ferry Building center-exit passenger');
  const all=new Set(),parts=new Set();
  scene.poses.traverse(p=>{if(p.isMesh)all.add(p.geometry);});
  actor.traverse(p=>{if(p.isMesh)parts.add(p.geometry);});
  const mask=scene.batch.geometry.attributes.cableLight;
  [...all].forEach((geometry,id)=>{
    const range=scene.batch.getGeometryRangeAt(id);
    for(let i=range.vertexStart;i<range.vertexStart+range.vertexCount;i++)assert.equal(mask.getX(i)===5,parts.has(geometry));
  });
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  scene.batch.material.onBeforeCompile(shader,{});
  const lamp=shader.uniforms.exitLamp.value;
  let previous=1;
  for(const t of [-5,1,3.1,3.5,4.5,5.08,9]){
    const car=driverPose('streetcar',museumLegDuration+t);
    scene.update(t+100,1320,false,undefined,-100,car.body,t);
    assert.ok(actor.visible&&lamp.w<=previous);previous=lamp.w;
    if(t<1.5){
      assert.equal(lamp.w,1);
      const cab=new THREE.PerspectiveCamera();cab.position.copy(car.eye);cab.lookAt(car.look.x,car.look.y,car.look.z);
      const local=cab.worldToLocal(new THREE.Vector3(lamp.x,lamp.y,lamp.z)).divideScalar(.06);
      assert.ok(local.distanceTo(new THREE.Vector3(1.03,.896,7.54))<.002);
    }
    if(t>=5.08)assert.equal(lamp.w,0);
  }
});

test('the friends compose the cable-car picture then meet to review it without stepping off Frost Plaza',async()=>{
  const {frostPlazaPhoto}=await import('../app/frost-plaza.ts');
  const {frostPlazaSurface}=await import('../app/california-sidewalk.ts');
  const transit=createPromenadeTransit(),subject=transit.poses.getObjectByName('Visitor posing in the heart');
  const friend=transit.poses.getObjectByName('Friend taking the picture');
  const hands=friend.getObjectByName('Hands holding a landscape camera phone');
  transit.update(2);const original=subject.position.clone(),angle=hands.rotation.x;
  assert.ok(Math.abs(subject.rotation.y-frostPlazaPhoto.pose.yaw)<.001);
  assert.ok(subject.position.distanceTo(friend.position)>.24);
  const view=friend.getWorldDirection(new THREE.Vector3());
  assert.ok(view.dot(subject.position.clone().sub(friend.position).normalize())>.999);
  let previous=original;
  for(let t=0;t<=32;t+=.25){
    transit.update(t);const pos=subject.position;
    assert.ok(Math.abs(pos.y-frostPlazaSurface(pos.x,pos.z))<.0001);
    assert.ok(pos.distanceTo(previous)<.022&&pos.distanceTo(friend.position)>.04);
    previous=pos.clone();
  }
  assert.ok(original.distanceTo(subject.position)<1e-6);
  transit.update(15);assert.ok(subject.position.distanceTo(friend.position)<.055);
  assert.ok(hands.rotation.x-angle>.7);assert.equal(transit.root.children.length,1);assert.ok(transit.root.children[0].isBatchedMesh);
});

test('Terrene seats its guests facing the same table during opening hours in fair weather',async()=>{
  const {patioFurniture}=await import('../app/hotel-terraces.ts');
  const scene=createPromenadeTransit(),diners=scene.poses.getObjectByName('Terrene patio diners');
  const arm=diners.getObjectByName('Hand holding a tumbler');
  for(const [minute,rain,visible] of [[419,false,false],[420,false,true],[1319,false,true],[1320,false,false],[705,true,false],[705,false,true]]){
    scene.update(1,minute,rain);assert.equal(diners.visible,visible);
  }
  const friends=diners.children;
  for(const fig of friends){
    const facing=new THREE.Vector3(0,0,1).applyQuaternion(fig.quaternion);
    assert.ok(facing.dot(fig.position.clone().negate().normalize())>.999);
    assert.equal(Math.abs(fig.position.z),patioFurniture.chairOffset);
  }
  const glass=new THREE.Vector3(-.092,.087,.260);
  const height=()=>glass.clone().applyQuaternion(arm.quaternion).add(arm.position).y;
  const resting=height();
  scene.update(6,735,false);assert.ok(resting>.74&&height()>resting+.15);
  scene.update(12,735,false);assert.equal(height(),resting);
});

test('the museum visitor strolls the unobstructed exhibition aisle during Pacific opening hours',async()=>{
  const {addMuseumGallery}=await import('../app/museum-gallery.ts');
  const room=new THREE.Group();addMuseumGallery(room);room.updateMatrixWorld(true);
  const transit=createPromenadeTransit(),frame=transit.poses.getObjectByName('Railway museum exhibit reader');
  const person=frame.children[0],body=person.getObjectByName('Painted passenger');
  const instance=transit.poses.getObjectsByProperty('isMesh',true).indexOf(body);
  for(const [date,minute,open] of [['2026-11-15',720,true],['2026-11-16',810,false],['2026-11-17',719,false],['2026-11-17',720,true],['2026-11-17',1019,true],['2026-11-17',1020,false]]){
    transit.update(0,minute,false,date);assert.equal(transit.batch.getVisibleAt(instance),open);
  }
  const tuesday='2026-11-17',ray=new THREE.Raycaster(),floor=room.getObjectByName('Museum room and pendant shades');
  let previous;
  for(let t=0;t<=38;t+=.25){
    transit.update(t,810,false,tuesday);
    const foot=person.getWorldPosition(new THREE.Vector3()),down=new THREE.Vector3(0,-1,0);
    ray.set(foot.clone().addScaledVector(down,-.025),down);
    const hit=ray.intersectObject(room)[0];
    assert.equal(hit.object,floor);assert.ok(Math.abs(hit.point.y-foot.y)<.00015);
    assert.ok(!previous||previous.distanceTo(foot)<.019);previous=foot;
  }
  transit.update(13,810,false,tuesday);const reading=body.matrixWorld.toArray();
  transit.update(18,810,false,tuesday);assert.deepEqual(body.matrixWorld.toArray(),reading);
  const eye=person.localToWorld(new THREE.Vector3(0,1.49,0));
  ray.set(eye,person.getWorldDirection(new THREE.Vector3()));
  assert.ok(ray.intersectObject(room)[0].distance>.10);
  const matrix=new THREE.Matrix4();transit.batch.getMatrixAt(instance,matrix);
  assert.ok(reading.every((n,i)=>Math.abs(n-matrix.elements[i])<.000001));
});
