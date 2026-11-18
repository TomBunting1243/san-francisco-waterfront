import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {buildFerryTerminal,ferryConnections} from '../app/ferry-terminal.ts';
import {ferryPortal} from '../app/harbor-architecture.ts';

import {waterSurface} from '../app/water-surface.ts';

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
