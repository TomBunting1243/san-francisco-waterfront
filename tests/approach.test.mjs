import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import data from '../public/data/approach-soma.json' with {type:'json'};
import {shuffleBillboardAds,anthropicCopy,buildApproachBillboards,spaceXCopy,palantirCopy,palantirLines} from '../app/approach-billboards.ts';
import {approachDistance,approachGround,approachLengths,approachPose,buildApproachRoad} from '../app/approach-road.ts';
import sharp from 'sharp';
import {extraBillboardAds,renderBillboardEdition,billboardCaptions} from '../app/billboard-editions.ts';
import {billboardSites} from '../app/billboard-sites.ts';
import {bayReliefPosition} from '../app/bay-relief.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import {bridgeLayout} from '../app/bridge-layout.ts';

function addMesh(geometry,color,x,y,z,parent){
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color}));
  parent.add(mesh);mesh.position.set(x,y,z);return mesh;
}

test('the Skyway continues from both suspension decks past Sixth with supported flyovers',()=>{
  assert.equal(data.ramps.length,11);
  for(const [index,road] of [data.west,data.east].entries()){
    const east=index===1,span=east?bridgeLayout.lowerDeck+.058:bridgeLayout.upperDeck+.0755;
    const start=approachPose(east,0,0);
    assert.equal(start.x,bridgeLayout.origin[0]);assert.equal(start.z,bridgeLayout.origin[1]);
    assert.ok(Math.abs(start.y+.01375-span)<1e-6);
    const end=approachPose(east,approachLengths[index],0);
    assert.ok(end.z< -148&&end.y-approachGround(end.x,end.z)>.5);
    for(let distance=1;distance<approachLengths[index]-.5;distance+=.7){
      const a=approachPose(east,distance-.04,0),b=approachPose(east,distance+.04,0);
      assert.ok((Math.cos(a.heading)*(b.x-a.x)-Math.sin(a.heading)*(b.z-a.z))*(east?-1:1)>.04);
      assert.ok(Math.abs(a.y-b.y)<.02);
      assert.ok(approachDistance(a.x,a.z,road.points)<.13);
    }
  }
});

test('approach traffic updates in four batches and construction stays finite',()=>{
  const root=new THREE.Group();
  const update=buildApproachRoad(addMesh,root);
  const traffic=root.children[0].children.filter(o=>o instanceof THREE.InstancedMesh);
  assert.equal(traffic.length,4);
  const matrix=new THREE.Matrix4();
  traffic[0].getMatrixAt(0,matrix);
  const before=matrix.clone();
  update(3);
  traffic[0].getMatrixAt(0,matrix);
  assert.ok(!before.equals(matrix));
  assert.ok(traffic.every(o=>o.count===15&&o.instanceMatrix.array.every(Number.isFinite)));
  const piers=root.children[0].children.filter(o=>o.name==='Concrete pier');
  assert.ok(piers.length>100);
  assert.ok(piers.every(o=>o.scale.y>.09&&Number.isFinite(o.position.y)));
});

test('each display is installed at the recorded land site with its own bearing and grounded maintenance rack',()=>{
  const root=new THREE.Group(),font=new FontLoader().parse(fontData);
  const ads=shuffleBillboardAds(billboardSites.length,()=>.5);
  ads.splice(0,5,'yahoo','coke','anthropic','spacex','palantir');
  const group=buildApproachBillboards(addMesh,root,font,ads);
  assert.equal(group.children.length,billboardSites.length);
  assert.equal(group.children.filter(s=>s.userData.location.corridor==='I-80').length,4);
  for(const [i,billboard] of group.children.entries()){
    const site=billboardSites[i];
    assert.equal(billboard.name,site.name);
    assert.deepEqual(billboard.position.toArray(),[site.x,site.y,site.z]);
    assert.equal(billboard.rotation.y,site.yaw);
    assert.equal(billboard.userData.artwork,ads[i]);
    assert.ok(site.z<0&&site.y>site.footY);
    assert.ok(site.source.startsWith('https://'));
    if(site.corridor==='I-80'){
      assert.deepEqual([site.x,site.z],bayReliefPosition(site.longitude,site.latitude));
      assert.ok(site.z < -90);
    }else{
      assert.ok(site.x>-54&&site.x<28&&site.z<0);
    }
    if(site.mounting.includes('column')){
      assert.ok(billboard.getObjectByName('Kiosk poster frame'));
      assert.equal(!!billboard.getObjectByName('Cast-iron kiosk body'),site.mounting==='column');
    }else if(site.mounting==='wall')assert.ok(billboard.getObjectByName('Wall mounting plate'));
    else assert.ok(billboard.getObjectByName('Maintenance catwalk'));
    assert.equal(billboard.getObjectByName('Chord mounting shoe'),undefined);
  }
  const [yahoo,coke,anthropic,spacex,palantir]=['yahoo','coke','anthropic','spacex','palantir'].map(ad=>group.children.find(s=>s.userData.artwork===ad).getObjectByName('Printed artwork'));
  const vacancy=yahoo.getObjectByName('VACANCY');
  assert.ok(vacancy.userData.signLight[0]>vacancy.userData.signLight[1]);
  assert.ok(yahoo.children.some(mesh=>mesh.userData.signLight?.[1]>.8),'Yahoo chase bulbs include a bright green arrow');
  const cokeFaces=coke.children.filter(o=>o.type==='Group');
  assert.equal(cokeFaces.length,2);
  for(const face of cokeFaces)assert.ok(face.getObjectByName('Coca-Cola script').userData.signLight[0]>.8);
  assert.ok(anthropic.children.some(mesh=>mesh.userData.signLight?.[0]===.29));
  assert.equal(Math.abs(cokeFaces[0].rotation.y-cokeFaces[1].rotation.y),Math.PI);
  assert.equal(anthropicCopy,'Building an equitable future, one multi-trillion dollar IPO at a time');
  assert.ok(anthropic.getObjectByName('Building an equitable future,'));
  assert.ok(anthropic.getObjectByName('one multi-trillion dollar IPO at a time'));
  assert.ok(spacex.getObjectByName(spaceXCopy));
  assert.equal(palantirCopy,"Reliable. Dependable. You're Experiencing Compassionate Data Monitoring");
  for(const line of palantirLines)assert.ok(palantir.getObjectByName(line));
  const portrait=palantir.getObjectByName('Alex Karp portrait');
  assert.match(portrait.userData.credit,/Benamischarfstein.*CC BY-SA 4.0/);
  root.updateMatrixWorld(true);
  const baked=bakeBlocks([portrait],new THREE.MeshStandardMaterial({vertexColors:true}))[0];
  const pigments=baked.geometry.getAttribute('color');
  assert.ok(new Set(pigments.array).size>150);
  assert.ok(pigments.count>=48*48);
});

test('a page shares one set of posters and reshuffles each ordinary deck without replacement',()=>{
  const deckSize=5+extraBillboardAds.filter(ad=>ad!=='apple'&&ad!=='all-in').length;
  const first=shuffleBillboardAds(2*deckSize,()=>.5);
  assert.equal(new Set(first.slice(0,deckSize)).size,deckSize);
  assert.equal(new Set(first.slice(deckSize)).size,deckSize);
  const next=shuffleBillboardAds(2*deckSize,()=>.5,first);
  assert.ok(next.every((ad,i)=>ad!==first[i]));
  const font=new FontLoader().parse(fontData);
  const layouts=Array.from({length:2},()=>buildApproachBillboards(addMesh,new THREE.Group(),font).children.map(site=>site.userData.artwork));
  assert.deepEqual(layouts[0],layouts[1]);
});

test('the two rare editions are independent one-percent draws and each occupies at most one site',()=>{
  for(const [apple,allIn] of [[.009,.009],[.009,.01],[.01,.009],[.01,.01]]){
    const draws=[apple,allIn];
    const layout=shuffleBillboardAds(26,()=>draws.shift()??.5);
    assert.equal(layout.filter(ad=>ad==='apple').length,Number(apple<.01));
    assert.equal(layout.filter(ad=>ad==='all-in').length,Number(allIn<.01));
  }
});

test('reloading the module in the same tab keeps mounts fixed and changes every creative',async()=>{
  const saved=new Map(),font=new FontLoader().parse(fontData);
  const priorWindow=globalThis.window,priorRandom=Math.random;
  globalThis.window={sessionStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}};
  Math.random=()=>.5;
  try{
    const pages=[];
    for(const page of [1,2]){
      const fresh=await import('../app/approach-billboards.ts?reload='+page);
      pages.push(fresh.buildApproachBillboards(addMesh,new THREE.Group(),font).children);
    }
    assert.deepEqual(pages[0].map(s=>s.position.toArray()),pages[1].map(s=>s.position.toArray()));
    assert.ok(pages[0].every((s,i)=>s.userData.artwork!==pages[1][i].userData.artwork));
  }finally{
    Math.random=priorRandom;
    if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;
  }
});

test('road and kiosk layouts select different complete prints for every illustrated edition',async()=>{
  const texture=sharp(new URL('../public/billboard-editions.webp',import.meta.url).pathname.replaceAll('%20',' '));
  const meta=await texture.metadata();assert.deepEqual([meta.width,meta.height],[3180,1780]);
  const regions=new Set();
  for(const ad of extraBillboardAds)for(const portrait of [false,true]){
    const front=renderBillboardEdition(ad,portrait?.048:1.2,portrait?.121:.42,new THREE.Group(),addMesh,portrait);
    assert.equal(front.name,billboardCaptions[ad]);
    const uv=front.geometry.getAttribute('billboardPrint');
    const box=new THREE.Box2().setFromPoints(Array.from({length:4},(_,i)=>new THREE.Vector2(uv.getX(i),uv.getY(i))));
    const left=Math.round(box.min.x*meta.width),top=Math.round((1-box.max.y)*meta.height);
    const width=Math.round((box.max.x-box.min.x)*meta.width),height=Math.round((box.max.y-box.min.y)*meta.height);
    assert.deepEqual([width,height],[portrait?132:896,340]);
    const region=[left,top,width,height].join(',');assert.ok(!regions.has(region));regions.add(region);
    const swatch=await texture.clone().extract({left,top,width,height}).resize(40,32).raw().toBuffer();
    assert.ok(new Set(swatch).size>32,ad+' print must contain readable light/dark separation');
  }
});
