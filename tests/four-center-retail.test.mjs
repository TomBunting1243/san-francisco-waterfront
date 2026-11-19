import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createEmbarcaderoCenter,centerLobby,centerPromenade} from '../app/embarcadero-center.ts';
import {waterfrontLandscape} from '../app/waterfront-gardens.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {fourCenterDiningFloor as floor} from '../app/four-center-retail.ts';
import {createLandscape} from '../app/landscape.ts';
import {streetcarPose} from '../app/streets.ts';

const {root}=createEmbarcaderoCenter(waterfrontLandscape.areas,waterfrontLandscape.paths,[]);
root.updateMatrixWorld(true);
const frontage=root.getObjectByName('Four Embarcadero Center plaza frontage');
const entry=frontage.getObjectByName('Osha Thai · street-level plaza entrance');
const room=frontage.getObjectByName('Osha dining room · olive panels, banquette and marble tables');
const patio=frontage.getObjectByName('Osha street patio · woven chairs and bougainvillea');
const cafe=frontage.getObjectByName('Four Center adjacent plaza cafe parasols');
const lamps=frontage.getObjectByName('Osha chandelier glass');

test('both shore approaches see into R-4110 through the real-scale glazing while the patio entrance stays open',()=>{
  const tram=streetcarPose(3);
  for(const eye of [new THREE.Vector3(0,.176,0),new THREE.Vector3(tram.x,tram.y+.155,tram.z)]){
    let roomHits=0;
    // Project the opening from each observer and test all Four Center floors,
    // projecting piers and patio furniture. Trees elsewhere are season-dependent.
    for(let i=0;i<19;i++)for(let j=0;j<11;j++){
      const target=entry.localToWorld(new THREE.Vector3((i-9)*.038,floor+.026+j*.013,0));
      const ray=new THREE.Raycaster(eye,target.clone().sub(eye).normalize());
      const hit=ray.intersectObject(root)[0];
      if(hit?.object===room&&hit.point.distanceTo(target)>.08)roomHits++;
    }
    assert.ok(roomHits>=8,'exposed interior samples: '+roomHits);
    // Sample physical chandelier faces; observers can see different drops.
    const g=lamps.geometry,positions=g.attributes.position,v=new THREE.Vector3();
    let visibleGlass=false;
    for(let i=0;i<g.index.count&&!visibleGlass;i+=3){
      if(new THREE.Color().fromBufferAttribute(g.attributes.color,g.index.getX(i)).getHex()!==0xf4ddaa)continue;
      const mid=new THREE.Vector3();
      for(let j=0;j<3;j++)mid.add(v.fromBufferAttribute(positions,g.index.getX(i+j)));
      lamps.localToWorld(mid.multiplyScalar(1/3));
      visibleGlass=new THREE.Raycaster(eye,mid.sub(eye).normalize()).intersectObject(root)[0]?.object===lamps;
    }
    assert.ok(visibleGlass,'direct sightline to chandelier glass');
  }
  for(const u of [-.055,0,.055]){
    const origin=entry.localToWorld(new THREE.Vector3(u,floor+.045,.60));
    const direction=new THREE.Vector3(0,0,-1).transformDirection(entry.matrixWorld);
    assert.equal(new THREE.Raycaster(origin,direction,0,.60).intersectObject(patio).length,0);
  }
});

test('aerial table positions are open to the sky and the lobby and promenade terraces stand behind them',()=>{
  const down=new THREE.Vector3(0,-1,0);
  for(const [x,z] of [[4.211,-11.385],[3.551,-11.264],[3.177,-11.222],[2.824,-11.183],[2.687,-11.152],[2.58,-11.15]]){
    const hits=new THREE.Raycaster(new THREE.Vector3(x,2,z),down).intersectObject(root);
    assert.ok(hits[0].point.y<centerLobby,'covered street terrace at '+x+','+z);
    assert.ok(hits.some(h=>h.object.name==='Four Center dining apron to plaza allée'&&Math.abs(h.point.y-floor)<.0001));
  }
  const upperRay=new THREE.Raycaster(entry.localToWorld(new THREE.Vector3(.38,1.5,-.45)),down);
  const hits=upperRay.intersectObject(root);
  for(const grade of [centerLobby,centerPromenade])assert.ok(hits.some(h=>Math.abs(h.point.y-grade)<.0001));
  assert.ok(new THREE.Box3().setFromObject(cafe).max.y<floor+.28);
});

test('only the indoor light sources emit at dusk and the painted room fits a single rigid batch',()=>{
  const parts=[room,patio,cafe,lamps];
  const chunk=bakeRigidChunk('plaza restaurant',parts,new THREE.MeshStandardMaterial());
  const sign=chunk.geometry.attributes.signLight;
  const firstLamp=sign.count-lamps.geometry.attributes.position.count;
  for(let i=0;i<sign.count;i++)assert.equal(sign.getX(i)>0,i>=firstLamp);
  assert.ok(sign.getX(firstLamp)>sign.getY(firstLamp)&&sign.getY(firstLamp)>sign.getZ(firstLamp));
  assert.ok(chunk.geometry.index.count/3<11000);
});

test('assembled city exposes the Osha seats and tables above the measured allée approach',()=>{
  const world=createLandscape();
  world.root.updateMatrixWorld(true);
  const meshes=[];
  world.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const down=new THREE.Vector3(0,-1,0);
  const point=(u,h,d)=>entry.localToWorld(new THREE.Vector3(u,h,d));
  const first=(p,dir,far)=>new THREE.Raycaster(p,dir,0,far).intersectObjects(meshes,false)[0];
  const at=(u,d,start)=>first(point(u,start,d),down,.3)?.point.y;
  const approach=[.05,.215,.27,.335,.40,.48,.54,.62,.80].map(d=>at(0,d,.21));
  const expected=[.1822,.1822,.1775,.1720,.1691,.1656,.1630,.1630,.1630];
  for(let i=0;i<approach.length;i++)assert.ok(Math.abs(approach[i]-expected[i])<.0002,'assembled walking grade '+i);
  const eye=new THREE.Vector3(3.133,.267,-10.7555);
  for(const u of [-.30,-.16,.16,.30]){
    const top=at(u,.115,.31),seat=at(u,.163,.31);
    assert.ok(Math.abs(top-.2272)<.0001&&Math.abs(seat-.2102)<.0001,'visible tabletop and chair seat at '+u);
    assert.ok(Math.abs(at(u+.015,.115,.19)-.1822)<.0001,'support beneath table');
    const target=point(u,top,.115);
    const visible=first(eye,target.clone().sub(eye).normalize(),2);
    assert.ok(visible,'standing view reaches the dining terrace');
    const viewed=entry.worldToLocal(visible.point.clone());
    assert.ok(Math.abs(viewed.x-u)<.029&&Math.abs(viewed.z-.115)<.025&&
      viewed.y>=top-.0001&&viewed.y<=top+.0012,'first hit is the tabletop or its place setting');
  }
});

test('the entrance vine uses fine flat bracts and leaves within the previous rigid furniture budget',()=>{
  const {index,attributes}=patio.geometry,bracts=new Set([0xac4b68,0xbb637d,0x95445d,0xc07786]);
  const color=new THREE.Color(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  let bractCount=0,stems=0;
  for(let i=0;i<index.count;i+=3){
    const pigment=color.fromBufferAttribute(attributes.color,index.getX(i)).getHex();
    if(pigment===0x755f48)stems++;
    if(!bracts.has(pigment))continue;
    a.fromBufferAttribute(attributes.position,index.getX(i));
    b.fromBufferAttribute(attributes.position,index.getX(i+1));
    c.fromBufferAttribute(attributes.position,index.getX(i+2));
    assert.ok(Math.max(a.distanceTo(b),a.distanceTo(c),b.distanceTo(c))<.0053);
    assert.ok(Math.max(a.z,b.z,c.z)-Math.min(a.z,b.z,c.z)<.0013);
    bractCount++;
  }
  assert.ok(bractCount>65&&stems>60);
  assert.ok(index.count/3<=2124&&room.geometry.index.count/3<=5100);
});
