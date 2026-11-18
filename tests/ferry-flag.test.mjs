import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {ferryClockTower} from '../app/ferry-clock-tower.ts';
import {createFerryFlag,ferryFlagFlutterRate,updateFerryFlag} from '../app/ferry-flag.ts';

const east={x:1,y:0},height=6*.3048*.06,fly=height*1.9;
function rowData(flag){
  const pos=flag.geometry.attributes.position,uv=flag.geometry.attributes.uv;
  const pins=[],upper=[],flyEdge=[];
  for(let i=0;i<uv.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(pos,i);
    if(uv.getX(i)===0)pins.push(p);
    if(uv.getX(i)===1)flyEdge.push(p);
    if(uv.getY(i)===1)upper.push(p);
  }
  return {pins,upper,flyEdge};
}
test('one double-sided indexed flag with US stripes and stars is attached below the actual pole tip',()=>{
  const {root,flag}=ferryClockTower(new FontLoader().parse(fontData));
  assert.deepEqual(root.children.filter(o=>o.userData.ferryFlag),[flag]);
  assert.equal(flag.parent,root);assert.equal(flag.material.side,THREE.DoubleSide);
  assert.ok(Math.abs(flag.position.y-(235*.3048*.06-.007))<1e-8);
  assert.ok(flag.geometry.index.count/3<300);
  const {data,width,height:h}=flag.material.map.image;
  function color(x,fromTop){const i=4*((h-1-fromTop)*width+x);return [...data.slice(i,i+3)].join(',');}
  const bands=Array.from({length:13},(_,i)=>color(width-1,Math.floor(h*(i+.5)/13)));
  assert.equal(new Set(bands).size,2);
  assert.ok(bands.every((band,i)=>band===bands[i%2]));
  const blue=color(1,1);assert.ok(!bands.includes(blue));
  const white=bands[1];
  // Count white connected components within the blue canton.
  const limitX=Math.floor(width*.4),limitY=Math.floor(h*7/13),visited=new Set();
  let stars=0;
  for(let y=0;y<limitY;y++)for(let x=0;x<limitX;x++){
    const start=y*limitX+x;if(visited.has(start)||color(x,y)!==white)continue;
    stars++;visited.add(start);const pending=[start];
    while(pending.length){
      const pixel=pending.pop(),px=pixel%limitX,py=Math.floor(pixel/limitX);
      for(const [sx,sy] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1],[px-1,py-1],[px+1,py-1],[px-1,py+1],[px+1,py+1]]){
        const key=sy*limitX+sx;
        if(sx<0||sx>=limitX||sy<0||sy>=limitY||visited.has(key)||color(sx,sy)!==white)continue;
        visited.add(key);pending.push(key);
      }
    }
  }
  assert.equal(stars,50);assert.equal(flag.material.map.generateMipmaps,true);
});
test('steady wind, rain and calm preserve the pinned hoist and cloth length using the original dynamic buffers',()=>{
  const flag=createFerryFlag(),g=flag.geometry,p=g.attributes.position,n=g.attributes.normal;
  const copy=createFerryFlag();
  assert.notEqual(copy.geometry,g);assert.notEqual(copy.material,flag.material);
  assert.equal(copy.material.map,flag.material.map);
  const initial=rowData(flag).pins,pa=p.array,na=n.array;
  function sample(phase,wind,wet,direction=east){
    updateFerryFlag(flag,phase,direction,wind,wet);
    const {pins,upper,flyEdge}=rowData(flag);
    assert.deepEqual(pins,initial);
    assert.ok(Math.abs(pins.at(-1).y+height)<1e-7);
    const length=upper.slice(1).reduce((sum,v,i)=>sum+v.distanceTo(upper[i]),0);
    assert.ok(Math.abs(length-fly)<1e-6);
    for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
    return flyEdge[0];
  }
  const calm=sample(0,0,0);
  assert.ok(calm.x<fly*.25&&calm.y<-fly*.9);
  assert.deepEqual(sample(9,0,0),calm);
  const dry=sample(1.1,16,0),wet=sample(1.1,16,1);
  assert.ok(dry.x>wet.x+.015&&wet.y<dry.y-.015);
  const storm=sample(1.1,55,1),moving=sample(1.45,55,1);
  assert.ok(storm.x>fly*.84&&moving.distanceTo(storm)>.002);
  const turned=sample(1.1,55,1,{x:0,y:2});
  assert.ok(Math.abs(turned.z-storm.x)<1e-6&&Math.abs(turned.x+storm.z)<1e-6);
  assert.deepEqual(sample(1.1,55,1),storm);
  assert.equal(g.attributes.position.array,pa);assert.equal(g.attributes.normal.array,na);
});

test('a wind report changes the next flutter rate without moving the accumulated phase',()=>{
  const flag=createFerryFlag(),wind=24,rate=ferryFlagFlutterRate(wind,.2);
  assert.equal(ferryFlagFlutterRate(0,1),0);
  assert.equal(ferryFlagFlutterRate(NaN,.2),0);
  assert.ok(ferryFlagFlutterRate(48,.2)>rate&&ferryFlagFlutterRate(wind,1)<rate);
  const phase=3600*rate;
  function pose(angle,kph){
    updateFerryFlag(flag,angle,east,kph,.2);
    return new Float32Array(flag.geometry.attributes.position.array);
  }
  const before=pose(phase,wind),after=pose(phase,wind+.001);
  const distance=(a,b)=>a.reduce((max,v,i)=>Math.max(max,Math.abs(v-b[i])),0);
  assert.ok(distance(before,after)<.00001,'Wind change must not rescale an hour of phase');
  assert.deepEqual(pose(phase,wind+.001),after,'Paused scene keeps the same cloth pose');
  const advanced=pose(phase+.06*ferryFlagFlutterRate(wind+.001,.2),wind+.001);
  assert.ok(distance(after,advanced)>.0001,'Resuming advances the existing wave');
});

test('the baked city retains its live flag, the plaza independently mounts a copy, and the street has none',async()=>{
  const {createLandscape,createCityVignette}=await import('../app/landscape.ts');
  const city=createLandscape(),plaza=createCityVignette('plaza'),street=createCityVignette('street');
  const flag=city.ferryFlag,copy=plaza.ferryFlag;
  assert.ok(flag&&copy);
  for(const [view,cloth] of [[city,flag],[plaza,copy]]){
    view.root.updateMatrixWorld(true);
    assert.deepEqual(view.root.getObjectsByProperty('name','Ferry Building wind flag'),[cloth]);
  }
  for(let i=0;i<16;i++)assert.ok(Math.abs(flag.matrixWorld.elements[i]-copy.matrixWorld.elements[i])<1e-8);
  assert.notEqual(flag.geometry,copy.geometry);assert.notEqual(flag.material,copy.material);
  const original=copy.geometry.attributes.position.array.slice();
  updateFerryFlag(flag,1.2,east,55,1);
  assert.notDeepEqual(flag.geometry.attributes.position.array,original);
  assert.deepEqual(copy.geometry.attributes.position.array,original);
  assert.equal(street.ferryFlag,undefined);
  assert.equal(street.root.getObjectsByProperty('name','Ferry Building wind flag').length,0);
});
