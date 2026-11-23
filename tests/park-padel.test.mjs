import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {embarcaderoPlaza,plazaStandingHeight} from '../app/embarcadero-plaza.ts';
import {padelScreenName} from '../app/park-padel.ts';
import {createLandscape,createCityVignette,rememberLandscape} from '../app/landscape.ts';

const plaza=embarcaderoPlaza(),courts=plaza.children.filter(o=>o.name.startsWith('Park Padel ·'));
const coords=(position,i)=>new THREE.Vector3().fromBufferAttribute(position,i);
const close=(a,b,t=.00002)=>assert.ok(Math.abs(a-b)<t,`${a} expected ${b}`);

test('three level 20 × 10 m courts stand on the sloping brick at their surveyed and photographically registered locations',()=>{
  assert.equal(courts.length,3);
  const measurements=[[3.2375,-8.1563,146.1],[4.1688,-9.125,101.6],[3.5275,-9.5149,101.6]];
  for(const [i,court] of courts.entries()){
    const pos=court.getObjectByName('Supported turf and skirt').geometry.attributes.position;
    const [a,b,c,d]=[0,1,2,3].map(j=>coords(pos,j)),axis=d.clone().sub(a);
    close(a.distanceTo(b)/.06,10);close(axis.length()/.06,20);
    const center=a.clone().lerp(c,.5),[x,z,bearing]=measurements[i];close(center.x,x,.0001);close(center.z,z,.0001);
    close((Math.atan2(-.03552029735*axis.x+.04836012986*axis.z,.04836012986*axis.x+.03552029735*axis.z)*180/Math.PI+180)%180,bearing,.08);
    for(const p of [a,b,c,d])close(p.y,a.y);
    const stripHeight=(v)=>plazaStandingHeight(plaza,v.x,v.z);
    for(let face=0;face<4;face++){
      const lo=coords(pos,6+4*face),hi=coords(pos,7+4*face);
      for(const t of [0,.25,.5,.75,1]){
        const bottom=lo.clone().lerp(hi,t),land=stripHeight(bottom);
        close(bottom.y,land,.0005);assert.ok(a.y-land>.01);
      }
    }
    const paint=court.getObjectByName('Padel service lines').geometry.attributes.position;
    assert.equal(paint.count,12);
    for(let row=0;row<2;row++){
      const p=coords(paint,row*4),q=coords(paint,row*4+2),middle=p.clone().lerp(q,.5);
      close(Math.abs(middle.sub(center).dot(axis.clone().normalize()))/.06,6.95);
      close(p.distanceTo(coords(paint,row*4+3))/.06,.05);
    }
    close(coords(paint,8).distanceTo(coords(paint,11))/.06,14.3);
  }
});

test('transparent glass returns, upper wire, playable side entrances and low sagging nets survive both camera paths',()=>{
  const screen=plaza.getObjectByName(padelScreenName);
  const kind=screen.geometry.attributes.panelType,uv=screen.geometry.attributes.uv;
  for(const n of [0,1,2])assert.ok(kind.array.includes(n));
  const localGeometry=screen.geometry.attributes.position;
  const down=new THREE.Vector3(0,-1,0);
  for(const court of courts){
    const pos=court.getObjectByName('Supported turf and skirt').geometry.attributes.position;
    const a=coords(pos,0),b=coords(pos,1),d=coords(pos,3),center=b.clone().lerp(d,.5);
    const long=d.clone().sub(a).normalize(),across=b.clone().sub(a).normalize();
    const from=(x,y,z)=>center.clone().addScaledVector(long,x*.06).addScaledVector(across,z*.06).addScaledVector(down,-y*.06);
    const hits=(x,y,z,dir,range)=>new THREE.Raycaster(from(x,y,z),dir,0,range*.06).intersectObject(screen);
    assert.equal(kind.getX(hits(9,2,0,long,2)[0].face.a),0);
    assert.equal(kind.getX(hits(9,3.6,0,long,2)[0].face.a),1);
    assert.equal(hits(.60,1,4,across,2).length,0);
    assert.equal(kind.getX(hits(3,1,4,across,2)[0].face.a),1);
    assert.equal(kind.getX(hits(-.1,.84,0,long,.2)[0].face.a),2);
    assert.equal(hits(-.1,.905,0,long,.2).length,0);
    assert.equal(kind.getX(hits(-.1,.905,4.9,long,.2)[0].face.a),2);
  }
  assert.equal(uv.count,localGeometry.count);
  const city=rememberLandscape(createLandscape()),vignette=createCityVignette('plaza');
  for(const world of [city,vignette]){
    const [mesh]=world.root.getObjectsByProperty('name',padelScreenName);
    assert.ok(mesh.isMesh&&mesh.material.transparent&&!mesh.material.depthWrite);
    assert.equal(mesh.geometry.attributes.panelType.count,kind.count);
  }
});
