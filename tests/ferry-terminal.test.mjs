import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {buildFerryTerminal,ferryConnections} from '../app/ferry-terminal.ts';
import {doradoBoardingFreeboard} from '../app/dorado-ferry.ts';
import {ferryPortal} from '../app/harbor-architecture.ts';

import {harborDatum,waterSurface,waterWaveHeight} from '../app/water-surface.ts';

const material=new THREE.MeshStandardMaterial();
function addMesh(geometry,color,x,y,z,parent){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}

test('all six ferry gangways physically meet the fixed apron and their own boarding deck',()=>{
  const root=new THREE.Group(),terminal=buildFerryTerminal(addMesh,root);
  const apron=terminal.getObjectByName('Surveyed fixed ferry apron');
  root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  for(const connection of ferryConnections){
    const {gate,from,to,landY,deckY,covered}=connection;
    const gangway=terminal.getObjectByName(covered?`Gate ${gate} articulated gangway`:`Gate ${gate} short boarding link`);
    const link=gangway.getObjectByName('Gangway walking surface');
    const dock=terminal.getObjectByName(covered?`Gate ${gate} floating pontoon`:`Gate ${gate} hydraulic landing`).getObjectByName('Boarding deck');
    const length=Math.hypot(to[0]-from[0],to[1]-from[1]);
    assert.ok(covered?length>1.79&&length<2.2:length<.23);
    for(let t=.03;t<1;t+=.061){
      ray.ray.origin.set(THREE.MathUtils.lerp(from[0],to[0],t),2,THREE.MathUtils.lerp(from[1],to[1],t));
      const hit=ray.intersectObject(link,false)[0];
      assert.ok(hit,gate+' missing gangway surface');
      assert.ok(Math.abs(hit.point.y-THREE.MathUtils.lerp(landY,deckY,t))<.0005);
    }
    const port=covered?-.012:-.030;
    ray.ray.origin.set(from[0]+(to[0]-from[0])*port/length,2,from[1]+(to[1]-from[1])*port/length);
    assert.ok(ray.intersectObject(apron,false)[0],gate+' gangway misses the fixed apron');
    ray.ray.origin.set(to[0],2,to[1]);
    assert.ok(Math.abs(ray.intersectObject(dock,false)[0]?.point.y-deckY)<1e-6,gate+' gangway misses its own landing');
  }
  const [c,d]=ferryConnections.filter(c=>!c.covered);
  assert.ok(Math.hypot(c.from[0]-d.from[0],c.from[1]-d.from[1])>3.3);
});

test('floating platforms reach the water and retain unobstructed entrance portals',()=>{
  const root=new THREE.Group(),terminal=buildFerryTerminal(addMesh,root),font=new FontLoader().parse(fontData);
  root.updateMatrixWorld(true);
  for(const connection of ferryConnections){
    const {gate,covered,landY,deckY}=connection;
    const portal=ferryPortal(connection,font);
    const bounds=new THREE.Box3().setFromObject(portal);
    assert.ok(bounds.getSize(new THREE.Vector3()).y<(covered?.45:.26),'Sign is in pedestrian scale');
    assert.ok(bounds.min.y>=landY-.001);
    const direction=new THREE.Vector3(connection.to[0]-connection.from[0],0,connection.to[1]-connection.from[1]).normalize();
    const entrance=new THREE.Vector3(connection.from[0],landY+.145,connection.from[1]).addScaledVector(direction,-.23);
    const routeRay=new THREE.Raycaster(entrance,direction,0,.47);
    assert.equal(routeRay.intersectObject(portal,true).length,0,gate+' the portal must leave the path clear');

    const landing=terminal.getObjectByName(covered?`Gate ${gate} floating pontoon`:`Gate ${gate} hydraulic landing`);
    const hull=landing.getObjectByName('Floating steel hull');
    const piles=landing.children.filter(o=>o.name==='Independent guide pile');
    if(covered){
      const hullBounds=new THREE.Box3().setFromObject(hull);
      assert.ok(hullBounds.min.y<waterSurface.level);
      assert.ok(hullBounds.max.y<deckY);
      const threshold=new THREE.Box3().setFromObject(landing.getObjectByName('Vessel boarding threshold'));
      assert.ok(Math.abs(threshold.max.y-(waterSurface.level+doradoBoardingFreeboard))<.001);
      assert.equal(piles.length,4);
      for(const pile of piles)assert.ok(pile.position.x<hullBounds.min.x||pile.position.x>hullBounds.max.x);
    }else{
      assert.equal(hull,undefined);
      assert.equal(piles.length,0);
    }
  }
});

test('the Golden Gate waiting shelter has a seamed gable on piers with a clear central aisle',()=>{
  const root=new THREE.Group(),terminal=buildFerryTerminal(addMesh,root);
  const shelter=terminal.getObjectByName('Golden Gate Ferry Terminal waiting shelter');
  const panels=shelter.getObjectsByProperty('name','Galvanized roof panel');
  const seams=shelter.getObjectsByProperty('name','Raised roof seam');
  const columns=shelter.getObjectsByProperty('name','Concrete shelter column');
  assert.equal(panels.length,64);
  assert.equal(seams.length,panels.length);
  assert.equal(shelter.getObjectsByProperty('name','Separate Golden Gate service canopy').length,2);
  for(const column of columns)assert.ok(Math.abs(column.position.y-column.scale.y/2-.096)<.00001);
  assert.equal(columns.length,12);
  root.updateMatrixWorld(true);
  const down=(x,z)=>new THREE.Raycaster(shelter.localToWorld(new THREE.Vector3(x,2,z)),new THREE.Vector3(0,-1,0));
  for(const z of [-1.33,-.59,.11,.73,1.33]){
    for(const side of [-1,1]){
      const slope=down(side*.12,z).intersectObjects(panels,false)[0];
      const low=down(side*.39,z).intersectObjects(panels,false)[0];
      assert.ok(slope&&low&&slope.point.y-low.point.y>.052);
    }
  }
  assert.equal(down(-.460,-.16).intersectObjects(shelter.children,true).length,0,'Main canopy and detached kiosks have an open gap');
  const along=new THREE.Raycaster(shelter.localToWorld(new THREE.Vector3(.103,.222,-1.81)),
    new THREE.Vector3(0,0,1).applyQuaternion(shelter.getWorldQuaternion(new THREE.Quaternion())),0,3.55);
  assert.equal(along.intersectObject(shelter,true).length,0,'Supports and screens leave the sheltered walkway open');
});


test('fixed apron piles reach the deck and through the bay without oversized or blocking guardrails',()=>{
  const root=new THREE.Group(),terminal=buildFerryTerminal(addMesh,root);
  root.updateMatrixWorld(true);
  const apron=terminal.getObjectByName('Surveyed fixed ferry apron');
  const piles=terminal.getObjectsByProperty('name','Continuous fixed concrete pile');
  assert.ok(piles.length>60);
  const caps=terminal.getObjectsByProperty('name','Pile-to-deck cap');
  const y=new THREE.Box3().setFromObject(apron).min.y;
  for(const [i,pile] of piles.entries()){
    const a=new THREE.Box3().setFromObject(pile),b=new THREE.Box3().setFromObject(caps[i]);
    assert.ok(a.min.y<waterSurface.level-.21&&a.max.y>=b.min.y);
    assert.ok(b.max.y>y);
  }
  const guard=terminal.getObjectByName('Fixed ferry apron edge guard');
  assert.ok(new THREE.Box3().setFromObject(guard).max.y<.179);
  for(const gate of ferryConnections){
    const [x,z]=gate.from;
    const toward=new THREE.Vector3(gate.to[0]-x,0,gate.to[1]-z).normalize();
    for(const height of [.026,.053,.077]){
      const start=new THREE.Vector3(x,gate.landY+height,z).addScaledVector(toward,-.21);
      const passage=new THREE.Raycaster(start,toward,0,.37);
      assert.equal(passage.intersectObject(guard,true).length,0,gate.gate+' guard crosses the boarding approach');
    }
  }
});

test('mean harbor level, floating decks and fixed-pier soffits use the surveyed freeboard',()=>{
  const metersPerUnit=1/.06;
  const apronFreeboard=(harborDatum.ferryApron-waterSurface.level)*metersPerUnit;
  assert.ok(Math.abs(apronFreeboard-(11.8*.3048-.951))<.001);
  assert.ok(harborDatum.pierDeck-harborDatum.pierSlabThickness>waterSurface.level+waterWaveHeight);
  for(const gate of ferryConnections.filter(gate=>gate.covered)){
    assert.ok(Math.abs(gate.deckY-waterSurface.level-harborDatum.ferryFloatFreeboard)<1e-9);
    const distance=Math.hypot(gate.from[0]-gate.to[0],gate.from[1]-gate.to[1]);
    assert.ok((gate.landY-gate.deckY)/distance<1/12);
  }
});

test('both passenger lanes have continuous foot support and body clearance from E gangway through the Pyxis doorway',async()=>{
  const {ferryPassengerPose}=await import('../app/ferry-passengers.ts');
  const {ferryPose}=await import('../app/motion.ts');
  const {createServiceFerry,updatePyxisBoardingDoor}=await import('../app/service-ferries.ts');
  const {createBoardingBrows}=await import('../app/ferry-terminal.ts');
  const root=new THREE.Group(),terminal=buildFerryTerminal(addMesh,root),ship=createServiceFerry(addMesh,0);
  const brows=createBoardingBrows(1),moored=ferryPose(23,0);
  ship.rotation.y=moored.heading;ship.position.set(moored.x,moored.y,moored.z);
  updatePyxisBoardingDoor(ship,1);brows.update(0,moored);root.add(ship,brows.mesh);root.updateMatrixWorld(true);
  const objects=[];
  for(const part of [terminal.getObjectByName('Surveyed fixed ferry apron'),terminal.getObjectByName('Gate E articulated gangway'),
    terminal.getObjectByName('Gate E floating pontoon'),ship,brows.mesh]){
    part.traverse(child=>{if(child.isMesh)objects.push({child,bounds:new THREE.Box3().setFromObject(child,true)});});
  }
  const down=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  const up=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,1,0),0,.114);
  const across=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(1,0,0),0,.034);
  for(let i=0;i<4;i++){
    let count=0;
    for(let time=-100;time<108;time+=.12){
      const p=ferryPassengerPose(time,i,moored);
      if(p.z<2.97||p.z>7.125)continue;
      count++;
      const near=objects.filter(({bounds:b})=>p.x>=b.min.x-.024&&p.x<=b.max.x+.024&&p.z>=b.min.z-.024&&p.z<=b.max.z+.024).map(o=>o.child);
      for(const h of [.031,.066,.104]){
        across.ray.origin.set(p.x-.017,p.y+h,p.z);across.ray.direction.set(1,0,0);
        assert.equal(across.intersectObjects(near,false).length,0,'side clearance at '+[p.x,p.z]);
        across.ray.origin.set(p.x,p.y+h,p.z-.017);across.ray.direction.set(0,0,1);
        const obstacle=across.intersectObjects(near,false)[0];
        assert.ok(!obstacle,'fore/aft clearance at '+[p.x,p.z]+' near '+obstacle?.object.position.toArray());
      }
      for(const [dx,dz] of [[0,0],[-.017,0],[.017,0],[0,-.017],[0,.017]]){
        up.ray.origin.set(p.x+dx,p.y+.010,p.z+dz);
        assert.equal(up.intersectObjects(near,false).length,0,'headroom at '+[p.x,p.z]);
        down.ray.origin.set(p.x+dx,p.y+.124,p.z+dz);
        const hit=down.intersectObjects(near,false)[0];
        const difference=(hit?.point.y??-Infinity)-p.y;
        assert.ok(difference<.010&&difference>-.011,
          'person '+i+' t='+time.toFixed(2)+' xz='+[p.x,p.z].map(q=>q.toFixed(4))+' height difference='+difference+' object='+hit?.object.name+' at '+hit?.object.position.toArray());
      }
    }
    assert.ok(count>400);
  }
});

test('gate portals, gangway stringers and curved canopy sheet ends have a single exposed face',()=>{
  const terminal=buildFerryTerminal(addMesh,new THREE.Group()),font=new FontLoader().parse(fontData);
  terminal.updateMatrixWorld(true);
  for(const entry of ferryConnections){
    const gangway=terminal.getObjectByName(entry.covered?`Gate ${entry.gate} articulated gangway`:`Gate ${entry.gate} short boarding link`);
    const deck=gangway.getObjectByName('Gangway walking surface'),stringers=gangway.getObjectsByProperty('name','Gangway side stringer');
    assert.equal(stringers.length,2);
    for(const s of stringers){
      const origin=gangway.localToWorld(new THREE.Vector3(s.position.x,.014,s.position.z*.81));
      const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0).applyQuaternion(gangway.quaternion)).intersectObjects([s,deck],false);
      assert.equal(hits[0].object,deck);assert.ok(hits[1].distance-hits[0].distance>.0029);
    }
    if(!entry.covered)continue;
    const portal=ferryPortal(entry,font),lintel=portal.getObjectByName('Portal lintel'),pediment=portal.getObjectByName('Portal pediment');
    portal.updateMatrixWorld(true);
    const frame=lintel.parent,eave=entry.gate==='B'?.342:.36;
    for(const side of [-1,1])for(const dy of [-.005,-.001]){
      const eye=frame.localToWorld(new THREE.Vector3(.033,eave+dy,side*.24));
      const hits=new THREE.Raycaster(eye,new THREE.Vector3(0,0,-side).applyQuaternion(frame.quaternion)).intersectObjects([lintel,pediment],false);
      assert.equal(hits.length,1);
      assert.equal(hits[0].object,dy<-.003?lintel:pediment);
    }
    const sheets=gangway.getObjectsByProperty('name','Rolled canopy sheet');
    assert.equal(sheets.length,8);
    // Cast just either side of each radial joint at the front cap's mid-thickness.
    for(let i=1;i<8;i++)for(const offset of [-.00045,.00045]){
      const q=Math.PI*i/8,x=-Math.cos(q)*entry.width*1.07/2+offset,y=.226+Math.sin(q)*.036;
      const eye=gangway.localToWorld(new THREE.Vector3(x,y,-.05));
      const hits=new THREE.Raycaster(eye,new THREE.Vector3(0,0,1).applyQuaternion(gangway.quaternion),0,.08).intersectObjects(sheets,false);
      assert.equal(hits.length,1,'Gate '+entry.gate+' roof joint '+i);
    }
  }
});

test('the four covered berths bounce light inside their roofs and onto their passenger paths',async()=>{
  const {bakeRigidChunk}=await import('../app/city-blocks.ts');
  const root=new THREE.Group(),terminal=buildFerryTerminal(addMesh,root);
  terminal.updateMatrixWorld(true);
  for(const {gate,covered} of ferryConnections){
    const span=terminal.getObjectByName('Gate '+gate+(covered?' articulated gangway':' short boarding link'));
    const path=span.getObjectByName('Gangway walking surface');
    if(!covered){assert.equal(path.userData.uplight,undefined);continue;}
    const pontoon=terminal.getObjectByName('Gate '+gate+' floating pontoon');
    for(const roof of [span,pontoon]){
      const panels=roof.getObjectsByProperty('name','Rolled canopy sheet');
      assert.equal(panels.length,8);
      const geo=bakeRigidChunk('canopy',panels,material).geometry,n=geo.getAttribute('normal'),light=geo.getAttribute('signLight');
      assert.ok(light,'Covered '+gate+' canopy requires an interior light bake');
      let inside=0,outside=0;
      for(let i=0;i<n.count;i++){
        if(n.getY(i)<-.85){assert.ok(light.getX(i)>.8);inside++;}
        if(n.getY(i)>.85){assert.equal(light.getX(i),0);outside++;}
      }
      assert.ok(inside>0&&outside>0);
    }
    for(const part of [path,...pontoon.getObjectsByProperty('name','Adjustable vessel boarding ramp')]){
      const geo=bakeRigidChunk('passenger path',[part],material).geometry;
      const n=geo.getAttribute('normal'),light=geo.getAttribute('signLight');
      const top=Array.from({length:n.count},(_,i)=>i).find(i=>n.getY(i)>.9);
      assert.ok(light.getX(top)>.2&&light.getX(top)<.4);
    }
    assert.equal(pontoon.getObjectByName('Floating steel hull').userData.uplight,undefined);
  }
});

test('at night the ferry dining frontages, approach, gangways and wet boarding thresholds receive local light',async()=>{
  const {ferryHall}=await import('../app/ferry-architecture.ts');
  const {createRememberedWaterfront}=await import('../app/remembered-waterfront.ts');
  const {collectFerryWalkPools}=await import('../app/ferry-walk-lights.ts');
  const {boardingStops}=await import('../app/ferry-terminal.ts');
  const {createStreetField}=await import('../app/street-illumination.ts');
  const font=new FontLoader().parse(fontData);
  const root=new THREE.Group();root.add(ferryHall(font).root,createRememberedWaterfront(font));
  const terminal=buildFerryTerminal(addMesh,root);
  const pools=collectFerryWalkPools(root),field=createStreetField([],pools),before=createStreetField([]);
  const texel=(texture,x,z,channel=0)=>texture.image.data[
    (Math.floor((z+64)/.12)*texture.image.width+Math.floor((x+56)/.12))*4+channel];
  const samples=[[4.84,1.549],[4.84,1.85],[2.41,1.76],[-3.94,1.755],[.52,1.91],
    [-6.2,2.63],[-9.71,1.77],[-12.8,1.98],[-2.21,4.33],[-1.96,7.21],[-9.88,3.51]];
  for(const {gate,from,to} of ferryConnections)samples.push(from,
    [(from[0]+to[0])/2,(from[1]+to[1])/2],boardingStops[gate]);
  for(const [x,z] of samples){
    assert.equal(texel(before,x,z),0);
    assert.ok(texel(field,x,z)>52,'locally lit surface at '+[x,z,texel(field,x,z)]);
  }
  for(const [x,y,z] of [[-2,.530,4.4],[-2.44,.535,4.4]]){
    assert.ok(y>texel(field,x,z,3)/255+.001,'metal roof above the local lens cutoff');
  }
  for(const shelter of terminal.getObjectsByProperty('name','South Basin waiting canopy')){
    const bounds=new THREE.Box3().setFromObject(shelter);
    assert.ok(bounds.min.x>-8.65||bounds.max.x< -10.69,'modern queue shelters clear remembered Pier 2');
    assert.ok(bounds.max.z<2.21,'shelter sits over fixed apron');
  }
  root.updateMatrixWorld(true);
  const entry=root.getObjectByName('The Slanted Door'),title=entry.children.filter(m=>m.name);
  assert.equal(root.getObjectByName('The Slanted Door promenade menu'),undefined);
  assert.deepEqual(title.map(m=>m.name),['THE','SLANTED','DOOR'].map(word=>'The Slanted Door '+word));
  for(const m of title){
    const bounds=new THREE.Box3().setFromObject(m);
    assert.ok(bounds.max.x-bounds.min.x<=.0241&&bounds.max.z-bounds.min.z<1e-5);
    assert.ok(bounds.min.x>4.17&&bounds.max.x<4.58&&bounds.min.z>1.41&&bounds.max.z<1.50);
    assert.equal(m.userData.signLight,undefined,'cream lettering printed on the door glass');
  }
  assert.equal(root.getObjectsByProperty('isLight',true).length,0);
  before.dispose();field.dispose();
});
