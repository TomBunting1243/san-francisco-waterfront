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
  assert.equal(scene.batch.instanceCount-carParts.length,69);
  assert.ok(scene.batch.geometry.index.count/3-carTriangles<6200);
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
  const byKind=[[],[],[],[]];
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
