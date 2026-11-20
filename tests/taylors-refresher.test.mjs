import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {taylorDiners,taylorPicnic} from '../app/taylors-refresher.ts';
import {ferryPatios} from '../app/ferry-patios.ts';
import {ferryHall} from '../app/ferry-architecture.ts';

test('Taylor’s red EAT is visible through the northwest arch and placed over the interior counter',()=>{
  const hall=ferryHall(new FontLoader().parse(fontData)).root;
  hall.updateMatrixWorld(true);
  const counter=hall.getObjectByName("Taylor's indoor service counter"),model=counter.children[0];
  const {position,signLight}=model.geometry.attributes;
  const ink=new THREE.Box3(),point=new THREE.Vector3(),eye=new THREE.Vector3(),ray=new THREE.Raycaster();
  let exposed=0,points=0;
  for(let i=0;i<position.count;i++){
    if(signLight.getX(i)<.70||signLight.getY(i)>.1)continue;
    point.fromBufferAttribute(position,i);model.localToWorld(point);ink.expandByPoint(point);
    eye.copy(point);eye.z=taylorPicnic.zs[0];
    ray.set(eye,new THREE.Vector3(0,0,1));
    const hit=ray.intersectObject(hall,true)[0];
    if(hit?.object===model&&Math.abs(hit.point.z-point.z)<.0005)exposed++;
    points++;
  }
  assert.ok(points>12&&exposed>points*.5,'indoor lettering is visible from the picnic patio');
  assert.ok(ink.min.x>5.35&&ink.max.x<5.60&&ink.min.z> -1.05&&ink.max.z<-.90);
  assert.ok(ink.min.y>.21&&ink.max.x-ink.min.x<.13,'counter-scale lettering');
});

test('patio diners stay seated at real benches and lift burgers or tumblers from their own tray to their face',()=>{
  const {root,actors,update}=taylorDiners(),patios=ferryPatios();
  const tables=patios.children.filter(m=>m.name===taylorPicnic.name+' outdoor table');
  assert.equal(tables.length,6);assert.equal(actors.length,4);
  patios.updateMatrixWorld(true);
  const down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster(),p=new THREE.Vector3();
  const trays=root.children.filter(m=>m.name==='Paper-lined burger tray');
  for(const [i,{figure,face,forearm}] of actors.entries()){
    const at=figure.position;
    ray.set(new THREE.Vector3(at.x,at.y+.040,at.z),down);
    const seat=ray.intersectObjects(tables)[0];
    assert.ok(Math.abs(seat.point.y-(at.y+.028))<.001);
    root.updateMatrixWorld(true);
    // The underside of each upper leg bears on the real seat surface.
    for(const side of [-1,1]){
      const origin=figure.localToWorld(new THREE.Vector3(side*.084,.4,.12));
      ray.set(origin,new THREE.Vector3(0,1,0));
      const underside=ray.intersectObject(figure.children[0])[0];
      ray.set(new THREE.Vector3(origin.x,at.y+.040,origin.z),down);
      const wood=ray.intersectObjects(tables)[0];
      assert.ok(underside&&wood&&Math.abs(underside.point.y-wood.point.y)<.0003);
    }
    const bounds=new THREE.Box3().setFromObject(figure);
    assert.ok(Math.abs(bounds.min.y-at.y)<.0003,'shoe soles touch the café finish');
    const seatedHeight=(bounds.max.y-at.y)/.06,seatToCrown=(bounds.max.y-seat.point.y)/.06;
    assert.ok(seatedHeight>1.30&&seatedHeight<1.39&&seatToCrown>.84&&seatToCrown<.94);
    const tray=trays[i].position;ray.set(new THREE.Vector3(tray.x,tray.y+.01,tray.z),down);
    assert.ok(Math.abs(ray.intersectObjects(tables)[0].point.y-tray.y)<.001);
    assert.ok(at.x>4.30&&at.x<5.85&&at.z> -1.51&&at.z< -1.38);
    const held=new THREE.Vector3(-.092,i%2===0?.116:.13,.337);
    update(-i*4.7,false);root.updateMatrixWorld(true);
    p.copy(held);forearm.localToWorld(p);
    assert.ok(p.distanceTo(tray)<.018,'food within hand reach of tray');
    const rest=p.clone();
    update(5.7-i*4.7,false);root.updateMatrixWorld(true);
    p.copy(held);forearm.localToWorld(p);
    const mouth=face.localToWorld(new THREE.Vector3(0,-.025,.090));
    assert.ok(p.y>rest.y+.007&&p.distanceTo(mouth)<.010,'diner brings order to mouth');
  }
  update(6,true);assert.equal(root.visible,false);
});


test('north café tables stand on the actual hall-level paving beside the public arcade',()=>{
  const hall=ferryHall(new FontLoader().parse(fontData)).root;
  hall.updateMatrixWorld(true);
  const patio=hall.getObjectByName('North café paving and south approach');
  const arcade=hall.getObjectByName('Recessed arcade paving'),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const pavingAt=(x,z)=>{ray.set(new THREE.Vector3(x,.16,z),down);return ray.intersectObject(patio)[0]?.point.y;};
  for(const x of taylorPicnic.xs)for(const z of taylorPicnic.zs){
    for(const side of [-1,1])for(const end of [-1,1])
      assert.ok(Math.abs(pavingAt(x+end*.063,z+side*.051)-taylorPicnic.ground)<1e-6);
    assert.ok(-1.260-(z+.050)>.109,'continuous 1.82 m or wider aisle behind the benches');
  }
  assert.ok(arcade);
  assert.ok(Math.abs(pavingAt(5.48,-1.261)-taylorPicnic.ground)<1e-6);
  for(const z of [-1.28,-1.269,-1.249,-1.23,-1.21]){
    ray.set(new THREE.Vector3(5.444,.16,z),down);
    assert.ok(Math.abs(ray.intersectObject(hall,true)[0].point.y-taylorPicnic.ground)<1e-6,'no raised stone moulding across the café entrance');
  }
  assert.ok((pavingAt(4.29,-1.48)-pavingAt(3.45,-1.48))/.84<1/12,'south end grade transition');
});
