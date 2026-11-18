import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import typeface from '../app/harbor-font.json' with {type:'json'};
import {mooredVessel} from '../app/moored-vessels.ts';
import {sfMap} from '../app/sf-map.ts';
import {harborDatum,waterSurface,waterHeight,shelterAtVertex} from '../app/water-surface.ts';
const font=new FontLoader().parse(typeface);
const vector=(x,y,z)=>new THREE.Vector3(x,y,z);
function boat(id){
  const result=mooredVessel(sfMap.buildings.find(b=>b.id===id),font);
  result.root.updateMatrixWorld();return result;
}
function widthAt(ship,height){
  const hull=ship.getObjectsByProperty('name','Raked hull strake'),p=ship.localToWorld(vector(2,height,0));
  const towards=vector(-1,0,0).applyQuaternion(ship.quaternion);
  const hit=new THREE.Raycaster(p,towards).intersectObjects(hull)[0];
  assert.ok(hit);return ship.worldToLocal(hit.point).x*2;
}

test('the low freeboards clear the sheltered water and both physical hull skins flare above their keels',()=>{
  for(const id of [281243360,281243626]){
    const {root,windows}=boat(id),belle=id===281243626,deck=root.getObjectByName('Main deck');
    const bounds=new THREE.Box3().setFromObject(deck,true);
    const skin=new THREE.Box3();
    for(const m of root.getObjectsByProperty('name','Raked hull strake'))skin.expandByObject(m,true);
    assert.ok(widthAt(root,-.075)<widthAt(root,.05)-.06);
    assert.ok(widthAt(root,.06)>(belle?1.00:.79));
    assert.ok(windows.length>120&&windows.every(p=>Number.isFinite(p.ry)&&Math.abs(p.x-root.position.x)<1));
    for(let t=0;t<260;t+=.7){
      for(const z of [skin.min.z,(skin.max.z+skin.min.z)/2,skin.max.z]){
        const surface=waterHeight(root.position.x,z,t);
        assert.ok(skin.min.y<surface-.095);
        assert.ok(bounds.max.y>surface+.045);
      }
    }
    const ramp=root.getObjectByName('Pier 3 boarding gangway');
    const {depth}=ramp.geometry.parameters;
    const ends=[-1,1].map(i=>ramp.localToWorld(vector(0,0,i*depth/2)));
    assert.ok(ends.some(p=>Math.abs(p.y-harborDatum.pierDeck)<.001&&p.x>19.4&&p.x<19.6));
    const shipEnd=waterSurface.level+(belle?harborDatum.pierThreeFreeboard:.108+.215+.015);
    assert.ok(ends.some(p=>Math.abs(p.y-shipEnd)<.001));
  }
  assert.equal(shelterAtVertex(23.3333,12.727),.22);
  assert.equal(shelterAtVertex(35,12.727),1);
  assert.equal(shelterAtVertex(23.3333,25.455),1);
});

test('the Belle sternwheel turns across the open well, opposite the ramps, while Santa Rosa has two wheelhouses',()=>{
  const {root:belle}=boat(281243626),{root:rosa}=boat(281243360);
  assert.equal(belle.getObjectsByProperty('name','Raised bow ramp').length,2);
  const axle=belle.getObjectByName('Transverse paddle axle');
  const axis=vector(0,1,0).applyQuaternion(axle.quaternion);
  assert.ok(Math.abs(axis.x)>.999&&axle.position.z>2);
  const above=belle.localToWorld(vector(0,1,axle.position.z));
  assert.equal(new THREE.Raycaster(above,vector(0,-1,0)).intersectObject(belle.getObjectByName('Main deck')).length,0);
  assert.equal(belle.getObjectsByProperty('name','Paddle float').length,12);
  assert.equal(belle.getObjectsByProperty('name','Sundeck canopy').length,2);
  assert.ok(belle.getObjectByName('Float deck'));
  assert.equal(rosa.getObjectsByProperty('name','Wheelhouse').length,2);
  assert.ok(rosa.getObjectByName('Single oval funnel'));
  assert.equal(rosa.getObjectsByProperty('name','Ventilator cowl').length,8);
  assert.equal(rosa.getObjectsByProperty('name','Paddle float').length,0);
  assert.ok(Math.abs(belle.position.y-waterSurface.level)<1e-6);
});

test('the normal landscape contains a single low boarding float beside Belle',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const {architectureChunks,pierSupports}=createLandscape();
  const x=19.91,z=10.25;
  const hits=new THREE.Raycaster(vector(x,1,z),vector(0,-1,0)).intersectObjects(architectureChunks);
  assert.ok(hits.some(h=>Math.abs(h.point.y-(waterSurface.level+harborDatum.pierThreeFreeboard))<.001));
  assert.ok(!hits.some(h=>h.point.y>harborDatum.pierDeck-.005),'The former fixed apron must not cover the float');
  assert.ok(!pierSupports.some(p=>p.x>19.70&&p.x<20.22&&p.z>8.73&&p.z<10.71));
});
