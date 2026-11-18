import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {marketArchitecture} from '../app/market-architecture.ts';
import {mappedBuildings,polygonArea} from '../app/sf-map.ts';

const font=new FontLoader().parse(fontData);
const model=id=>marketArchitecture(mappedBuildings.find(b=>b.id===id),mappedBuildings,font);
const bounds=o=>new THREE.Box3().setFromObject(o,true);

test('Matson and PG&E share their cornice datum and retain different roof profiles',()=>{
  const matson=model(1279504249),utility=model(1279504251);
  const matsonWings=matson.root.getObjectByName('Setback L-shaped office wings');
  const utilityWings=utility.root.getObjectByName('Setback L-shaped office wings');
  assert.ok(Math.abs(bounds(matsonWings).max.y-bounds(utilityWings).max.y)<.001);
  assert.ok(Math.abs(bounds(matson.root).max.y-4.98)<.03);
  assert.ok(bounds(matson.root).max.y-bounds(utility.root).max.y>.6,'Only Matson has the tall lantern');
  const tile=matson.root.getObjectByName('Aquamarine glazed Mission-tile roof');
  for(let i=0;i<tile.geometry.attributes.normal.count;i++){
    assert.ok(tile.geometry.attributes.normal.getY(i)>0,'Tile roof is visible from above');
  }
  assert.ok(Math.abs(bounds(utility.root.getObjectByName('PG&E hipped tile roof')).max.y-4.235)<.003);
  assert.ok(matson.windows.length>400&&utility.windows.length>300);
});

test('101 Market has an open loggia ahead of eight individually receding granite terraces',()=>{
  const {root}=model(32612362);
  root.updateMatrixWorld(true);
  const beam=root.getObjectByName('Freestanding granite loggia beam');
  let prior=0;
  for(let i=0;i<8;i++){
    const tile=root.getObjectByName('Granite terrace '+(i+5));
    assert.ok(tile);
    const y=(bounds(tile).min.y+bounds(tile).max.y)/2;
    const ray=new THREE.Raycaster(new THREE.Vector3(-2,y,-19.25),new THREE.Vector3(-1,0,0));
    const hit=ray.intersectObject(tile)[0];
    assert.ok(hit&&hit.point.x<prior-.06,'Market front does not recede on storey '+(i+5));
    prior=hit.point.x;
  }
  const front=bounds(beam).max.x;
  assert.ok(front>bounds(root.getObjectByName('Federal Reserve ground complex')).max.x+.15);
  assert.ok(Math.abs(bounds(root).max.y-3.96)<.001);
});

test('matching OSM parts are consumed once and the modern towers keep their mapped bases',()=>{
  for(const id of [260291409,944098106,944098109,1279504252,1279504253,1279504256]){
    assert.deepEqual(model(id),{windows:[]},'Duplicate generic volume for mapped building part '+id);
  }
  assert.equal(model(260291405),undefined,'The distinct 77 Beale tower remains separately routed');
  const ca=model(32612471),front=model(148710877);
  assert.ok(Math.abs(bounds(ca.root).max.y-8.4)<.003);
  assert.equal(ca.root.getObjectByName('Market approach granite step').isMesh,true);
  const terraces=front.root.children.filter(o=>o.name==='Rounded office terraces');
  assert.equal(terraces.length,4);
  const outline=terraces.map(o=>o.geometry.parameters.shapes.extractPoints().shape.map(p=>[p.x,-p.y]));
  assert.ok(outline.every((p,i)=>!i||polygonArea(p)<polygonArea(outline[i-1])));
  assert.ok(Math.abs(bounds(front.root).max.y-10.26)<.012);
});
