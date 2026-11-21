import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import lamps from '../public/data/promenade-lights.json' with {type:'json'};
import grades from '../public/data/promenade-light-grades.json' with {type:'json'};
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {sfMap} from '../app/sf-map.ts';
import {insideBuilding} from '../app/building-character.ts';
import {northWaterfrontGrade,streetPose} from '../app/streets.ts';
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
    const centerGrade=grades[lamps.curb[i][0]];
    assert.ok(Math.abs((box.max.y-centerGrade)/.06-(heads===1?5.55:7.15))<.001);
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
  const legacyCount=lamps.curb.length+lamps.inland.length+lamps.pier.length*2;
  const historicRows=root.children.slice(0,legacyCount);
  for(const mesh of historicRows){
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
  assert.equal(k/3,225);
  const triangles=historicRows.reduce((n,mesh)=>n+mesh.geometry.index.count/3,0);
  const original=historicRows.filter((_,i)=>i<67||i>=lamps.curb.length+lamps.inland.length);
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
  for(const [i,[id,x]] of poles.entries()){
    const geometry=root.children[i].geometry;geometry.computeBoundingBox();
    if(id===282128||id===284096){
      const pos=geometry.attributes.position;
      for(let corner=0;corner<8;corner++){
        assert.ok(Math.abs(pos.getY(corner)-northWaterfrontGrade(pos.getX(corner)))<.00001,'cast foot at '+id);
      }
      assert.ok(geometry.boundingBox.min.y<northWaterfrontGrade(x)-.0002);
    }else assert.ok(Math.abs(geometry.boundingBox.min.y-grades[id])<.00001,id);
  }
  for(const id of [287051,282079,284944,281691,281690,281688,284943,281687,282992])assert.equal(grades[id],.045);
  assert.equal(grades[287068],.045);assert.equal(grades[287069],.031);
});

test('HALS plaza flags, black fountain lanterns, curb acorns and park-road standards emit at their physical heads',()=>{
  const added=root.children.slice(146+58).filter(m=>!m.name.startsWith('Rincon'));
  assert.equal(added.length,21);
  assert.equal(halos.length/3,225+42+12);
  let first=225,triangles=0;
  for(const mesh of added){
    const count=mesh.name.startsWith('Plaza traction')?2:mesh.name.startsWith('Park approach')?1:3;
    triangles+=mesh.geometry.index.count/3;
    const pos=mesh.geometry.attributes.position,emission=mesh.geometry.attributes.signLight;
    const glass=[];
    for(let i=0;i<pos.count;i++)if(emission.getX(i)>.86){
      glass.push(new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));
    }
    for(let i=0;i<count;i++){
      const center=new THREE.Vector3().fromArray(halos,3*first++);
      assert.ok(glass.some(p=>p.distanceTo(center)<.028),mesh.name);
    }
    mesh.geometry.computeBoundingBox();
    const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    if(mesh.name.startsWith('Terrace'))assert.ok(Math.abs(box.min.y-.163)<.00001&&box.max.y-box.min.y>.91&&box.max.y-box.min.y<1.28);
    if(mesh.name.startsWith('Fountain walk'))assert.ok(Math.abs(box.min.y-.142)<.00001);
  }
  assert.equal(first,267);
  assert.ok(triangles<7000,triangles);
});

test('the twelve SFPUC Rincon street fixtures sit on finished surfaces and light their own streets',async()=>{
  const {addSurveyBlocks}=await import('../app/survey-blocks.ts');
  const {createStreetField}=await import('../app/street-illumination.ts');
  const streets=new THREE.Group(),surface=new THREE.MeshBasicMaterial();
  addSurveyBlocks((geometry,_color,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,surface);mesh.position.set(x,y,z);streets.add(mesh);return mesh;
  });
  streets.updateMatrixWorld(true);
  const sampled=new Map([
    [283133,[-25.5965,-5.6721,'Steuart']],[283134,[-27.074,-6.3699,'Steuart']],
    [284262,[-25.0696,-4.2232,'Howard']],[284263,[-23.9811,-4.9346,'Howard']],
    [284265,[-24.3683,-7.1484,'Howard']],[295606,[-36.101,-7.8235,'Folsom']],
    [296274,[-22.0811,-7.1682,'Steuart']],[300397,[-35.751,-5.4246,'Folsom']],
    [300628,[-15.9369,-6.9039,'Steuart']],[300630,[-19.97,-6.3008,'Steuart']],
    [300631,[-17.8927,-7.7952,'Steuart']],[300632,[-23.826,-5.7328,'Steuart']],
  ]);
  const fixtures=root.children.filter(o=>o.name.startsWith('Rincon'));
  assert.equal(fixtures.length,sampled.size);
  const emitters=halos.slice(-fixtures.length*3),field=createStreetField(emitters);
  const value=(x,z)=>field.image.data[4*(Math.floor((z+64)/.12)*field.image.width+Math.floor((x+56)/.12))];
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.28);
  for(const [i,fixture] of fixtures.entries()){
    const id=Number(fixture.name.split(' ').at(-1)),[x,z,street]=sampled.get(id);
    sampled.delete(id);
    const head=new THREE.Vector3().fromArray(emitters,i*3);
    ray.ray.origin.set(x,.14,z);
    const hit=ray.intersectObject(streets).find(h=>h.face.normal.y>.6);
    const bounds=new THREE.Box3().setFromObject(fixture);
    assert.ok(hit&&Math.abs(bounds.min.y-hit.point.y)<.00002,'grade '+id);
    const foot=new THREE.Vector3(x,hit.point.y,z);
    const fluted=id===283133||id===283134;
    assert.equal(fixture.name.includes('fluted'),fluted);
    if(fluted){
      assert.ok(Math.hypot(head.x-x,head.z-z)<.0001);
    }else{
      // Compare the overhang to the nearest point on that named road.
      let nearest,distance=Infinity;
      for(const road of sfMap.roads.filter(r=>r.name===street+' Street')){
        for(let k=1;k<road.p.length;k++){
          const at=p=>new THREE.Vector3(p[0],foot.y,p[1]);
          const point=new THREE.Line3(at(road.p[k-1]),at(road.p[k])).closestPointToPoint(foot,true,new THREE.Vector3());
          if(point.distanceTo(foot)<distance){distance=point.distanceTo(foot);nearest=point;}
        }
      }
      const headPlan=new THREE.Vector3(head.x,foot.y,head.z);
      assert.ok(headPlan.distanceTo(nearest)<distance-.12,'roadward mast arm '+id);
      assert.ok(value(nearest.x,nearest.z)>32,'receiving lane '+id);
    }
    const pos=fixture.geometry.attributes.position,light=fixture.geometry.attributes.signLight;
    assert.ok(Array.from({length:pos.count},(_,j)=>j).some(j=>light.getX(j)>.86&&
      new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(fixture.matrixWorld).distanceTo(head)<.027));
    assert.ok(value(head.x,head.z)>195);
  }
  assert.equal(sampled.size,0);
  assert.equal(value(-29,-10),0);
  field.dispose();
});
