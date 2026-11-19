import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import lamps from '../public/data/promenade-lights.json' with {type:'json'};
import grades from '../public/data/promenade-light-grades.json' with {type:'json'};
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {sfMap} from '../app/sf-map.ts';
import {insideBuilding} from '../app/building-character.ts';
import {streetPose} from '../app/streets.ts';
import {buildPromenadeLighting} from '../app/promenade-lighting.ts';

const root=new THREE.Group(),halos=buildPromenadeLighting(root);
root.updateMatrixWorld(true);
test('the SFPUC fluted pole row follows the waterfront curb from the bridge through the Broadway stop',()=>{
  assert.equal(lamps.curb.length,77);
  assert.equal(new Set(lamps.curb.map(p=>p[0])).size,77);
  assert.ok(lamps.curb[0][1]<-53 && lamps.curb.at(-1)[1]>35.70);
  for(const [,x,z] of lamps.curb){
    const {z:road}=streetPose(x,1);
    assert.ok(z>road+.1&&z<road+1);
  }
  assert.equal(lamps.inland.length,69);
  assert.equal(new Set([...lamps.curb,...lamps.inland].map(p=>p[0])).size,146);
  for(const [,x,z] of lamps.inland){
    const road=streetPose(x,-1).z;
    assert.ok(z<road-.10&&z>road-1.0,'inland municipal pin outside southbound lanes');
  }
  const gaps=lamps.curb.slice(1).map((r,i)=>r[1]-lamps.curb[i][1]);
  assert.ok(Math.max(...gaps)>8,'round trolley supports must not become fluted street lights');
  assert.ok(Math.min(...gaps)<.85);
});
test('the Ferry frontage carries two separate lanterns above its branched ornamental standard',()=>{
  let k=0;
  for(const [i,[,, ,yaw,heads]] of lamps.curb.entries()){
    const mesh=root.children[i];mesh.geometry.computeBoundingBox();
    const box=mesh.geometry.boundingBox;
    assert.ok(Math.abs((box.max.y-box.min.y)/.06-(heads===1?5.55:7.15))<.001);
    if(heads===2){
      assert.ok(Math.abs(halos[k+1]-halos[k+4])<.00001);
      const du=halos[k]-halos[k+3],dv=halos[k+2]-halos[k+5];
      assert.ok(Math.abs(Math.hypot(du,dv)/.06-.74)<.001);
      assert.ok(Math.abs(du*Math.sin(yaw)+dv*Math.cos(yaw))<.0001);
    }
    k+=3*heads;
  }
  assert.equal(k/3,88);
});
test('aerial Pier 7 pairs stand on the timber deck and the night glows sit inside the glass',()=>{
  const pier=sfMap.piers.find(p=>p.name==='Pier 7');
  assert.equal(lamps.pier.length,29);
  for(const [z,x0,x1] of lamps.pier)for(const x of [x0,x1])assert.ok(insideBuilding(x,z,pier.p));
  let k=0;
  for(const mesh of root.children){
    const heads=mesh.name.startsWith('Twin')?2:1;
    if(mesh.name.startsWith('Pier 7')){
      mesh.geometry.computeBoundingBox();
      assert.ok(Math.abs(mesh.geometry.boundingBox.min.y-.060)<.00001);
      assert.ok(Math.abs(mesh.geometry.boundingBox.max.y-(.060+3.8*.06))<.00001);
    }
    for(let i=0;i<heads;i++,k+=3){
      const [x,y,z]=halos.slice(k,k+3);
      const ray=new THREE.Raycaster(new THREE.Vector3(x,y,z+.025),new THREE.Vector3(0,0,-1),0,.04);
      const h=ray.intersectObject(mesh)[0];
      assert.ok(h && h.distance<.024,'each halo must illuminate its matching physical lantern');
    }
  }
  assert.equal(k,halos.length);
  assert.equal(halos.length/3,225);
  const triangles=root.children.reduce((n,mesh)=>n+mesh.geometry.index.count/3,0);
  const original=root.children.filter((_,i)=>i<67||i>=lamps.curb.length+lamps.inland.length);
  assert.ok(original.reduce((n,mesh)=>n+mesh.geometry.index.count/3,0)<40000);
  const broadway=root.children.filter((_,i)=>i>=67&&i<77||i>=77+61&&i<77+69);
  assert.equal(broadway.length,18);
  assert.ok(broadway.every(m=>m.geometry.index.count/3<=280));
  assert.ok(triangles-broadway.reduce((n,m)=>n+m.geometry.index.count/3,0)<59000);
});

test('baked lantern glass emits on its actual faces while iron stays dark',()=>{
  for(const name of ['Single fluted promenade light','Twin Ferry promenade light','Pier 7 iron lantern']){
    const pole=root.children.find(o=>o.name===name);
    assert.ok(pole,name);
    const baked=bakeRigidChunk(name,[pole],pole.material);
    const emission=baked.geometry.getAttribute('signLight');
    let glass=0,iron=0;
    for(let i=0;i<emission.count;i++){
      if(emission.getX(i)>.8){glass++;assert.ok(emission.getY(i)>emission.getZ(i));}
      else if(emission.getX(i)===0)iron++;
    }
    assert.ok(glass>=18&&iron>glass,name);
    baked.geometry.dispose();
  }
});

test('both curb rows stand on their registered supporting surfaces, including both finished Rincon curb approaches',()=>{
  const poles=[...lamps.curb,...lamps.inland];
  assert.equal(Object.keys(grades).length,poles.length);
  for(const [i,[id]] of poles.entries()){
    const geometry=root.children[i].geometry;geometry.computeBoundingBox();
    assert.ok(Math.abs(geometry.boundingBox.min.y-grades[id])<.00001,id);
  }
  for(const id of [287051,282079,284944,281691,281690,281688,284943,281687,282992])assert.equal(grades[id],.045);
  assert.equal(grades[287068],.045);assert.equal(grades[287069],.031);
});
