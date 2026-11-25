import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {add215Fremont,fremontGuardGlassName} from '../app/215-fremont.ts';
function point(s,t,h){
  const u=206+t*7,v=311+s*7;
  return new T.Vector3(-27.00800104+.0012973094*u-.0084729829*v,.045+h*.06,-33.37263659+.0084728164*u+.0012965840*v);
}
function model(){
  const root=new T.Group(),panes=[];assert.equal(add215Fremont({id:192883909},root,panes),true);
  root.updateMatrixWorld(true);return {root,panes,mesh:root.children[0]};
}
const sample=(mesh,from,to)=>new T.Raycaster(from,to.clone().sub(from).normalize()).intersectObject(mesh)[0];
test('Fremont shop glass and lobby stand behind a seven-bay open colonnade on the surveyed outer wall',()=>{
  const {mesh}=model();
  for(const s of [3,9,15,21,27,33,39]){
    const o=point(s,-6,2.35),hit=sample(mesh,o,point(s,0,2.35));
    assert.ok(hit&&Math.abs(hit.distance-8.7*.06)<.0002,String(s));
  }
  for(const s of [6.1,12.2,18.3,24.4,30.5,36.6]){
    const o=point(s,-6,1.7),hit=sample(mesh,o,point(s,0,1.7));
    assert.ok(hit&&Math.abs(hit.distance-6.03*.06)<.0002);
  }
  const floor=sample(mesh,point(15,1,1.7),point(15,1,0));
  const soffit=sample(mesh,point(15,1,1.7),point(15,1,6));
  assert.ok(Math.abs(floor.point.y-point(15,1,.75*(36.6-15)/(36.6-7.75)).y)<.0001&&floor.face.normal.y>.99);
  assert.ok(Math.abs(soffit.point.y-point(15,1,4.12).y)<.0001&&soffit.face.normal.y<-.99);
});
test('public corner roof terrace steps up to the eighth floor with rear services outside the street frontage',()=>{
  const {mesh}=model();
  for(const [s,t,h] of [[1,5,29.18],[10,5,33.78],[42,28,37.7],[48,60,29.18]]){
    const hit=sample(mesh,point(s,t,45),point(s,t,0));
    assert.ok(hit&&hit.face.normal.y>.99&&Math.abs(hit.point.y-point(s,t,h).y)<.0001,[s,t,h]);
  }
  assert.equal(sample(mesh,point(-.5,1,45),point(-.5,1,0)),undefined);
  assert.equal(sample(mesh,point(10,-.5,45),point(10,-.5,0)),undefined);
});
test('one replacement owns the correct OSM parcel and registers emitting glass only on the street elevations',()=>{
  const {root,mesh,panes}=model();
  assert.equal(add215Fremont({id:192883917},root,panes),false);
  assert.equal(root.children.length,2);assert.equal(root.children[1].name,fremontGuardGlassName);assert.ok(mesh.geometry.index.count/3<2700&&panes.length>15);
  for(const p of panes){
    const n=new T.Vector3(Math.sin(p.ry),0,Math.cos(p.ry)),pt=new T.Vector3(p.x,p.y,p.z);
    const hit=sample(mesh,pt.clone().addScaledVector(n,.001),pt.clone().addScaledVector(n,-.005));
    assert.ok(hit&&hit.distance<.003);
  }
});

test('the t251 passenger sees the office ceiling bands behind the sash and diagonal steel, above a muted corner arcade',async()=>{
  const {driverPose}=await import('../app/driver-rides.ts');
  const {root,mesh,panes}=model(),rooms=mesh.getObjectByName('215 Fremont / occupied office glazing');
  const eye=new T.Vector3().copy(driverPose('bridge',251).eye),hit=(s,t,h)=>sample(root,eye,point(s,t,h));
  assert.ok(rooms.geometry.hasAttribute('facadeGrid')&&!mesh.geometry.hasAttribute('facadeGrid'));
  const g=rooms.geometry,grid=g.attributes.facadeGrid;
  assert.ok(grid.count<1500&&grid.count===g.attributes.position.count);
  assert.ok(mesh.geometry.index.count/3+g.index.count/3<3280);
  const office=hit(2.85,.12,7.88);
  assert.equal(office.object,rooms);
  assert.ok(office.point.distanceTo(point(2.85,.12,7.88))<.00001);
  const fascia=hit(4.7,0,4.58);
  assert.equal(fascia.object,rooms);
  assert.ok(grid.getX(fascia.face.a)<.045);
  const pier=hit(.13,.03,1.6);assert.equal(pier.object,mesh);
  const straight=(s,h)=>sample(root,point(s,-1,h),point(s,1,h));
  const sill=4.70+.44,head=4.70+4.08-.12,mid=sill+(head-sill)*.70;
  // Positives on either side of the physical curtain-wall transom. The metal
  // remains in front, both here and on the exterior diagonal at midspan.
  assert.equal(straight(1.50,mid-.16).object,rooms);
  assert.equal(straight(1.50,mid+.0325).object,mesh);
  assert.equal(straight(1.50,mid+.15).object,rooms);
  assert.equal(straight(3.05,(head+sill)/2).object,mesh);
  assert.equal(straight(2.85,1.75).object,mesh);
  assert.equal(straight(2.85,4.55).object,rooms);
  assert.equal(straight(20,4.55).object,mesh);
  assert.equal(straight(3.05+3*6.10,26.8).object,mesh,'dark upper run');
  assert.equal(panes.length,31,'existing occupancy retained');
});

test('only the photographed office receiver uses a dusk-to-late schedule in the existing façade shader',async()=>{
  const {createFacadeClock,applyDowntownGlazing}=await import('../app/downtown-buildings.ts');
  const {bakeRigidChunk}=await import('../app/city-blocks.ts');
  const {mesh}=model(),rooms=mesh.children[0],clock=createFacadeClock(),mat=new T.MeshStandardMaterial();
  applyDowntownGlazing(mat,clock);
  const g=bakeRigidChunk('occupied offices',[rooms],mat).geometry;
  const grid=g.attributes.facadeGrid;
  assert.deepEqual(grid.array,rooms.geometry.attributes.facadeGrid.array);
  const colors=new Set(),lateLevels=new Set();
  for(let i=0;i<grid.count;i++){
    assert.equal(grid.getZ(i),-3);
    if(grid.getX(i)>.095){lateLevels.add(grid.getY(i).toFixed(3));colors.add(grid.getW(i).toFixed(2));}
  }
  assert.equal(colors.size,2);assert.equal(lateLevels.size,3);
  const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
  mat.onBeforeCompile(shader,{});
  const branch=shader.fragmentShader.split('if(buildingGrid.z== -3.){')[1].split('}else if(buildingGrid.z< -1.5)')[0];
  assert.ok(!branch.includes('diffuseColor')&&branch.includes('roomEmission=')&&branch.includes('smoothstep(.02,.58,roomNight)'));
  assert.ok(branch.includes('smoothstep(.045,.44,roomQuiet)')&&branch.includes('mix(1.,buildingGrid.y,late)*clamp(roomShare/.37,0.,1.)'));
  assert.equal(shader.uniforms.roomQuiet,clock.quiet);assert.equal(shader.uniforms.roomNight,clock.night);
  const scale=(h,m,night,share,retained)=>{
    clock.setFacadeClock(h,m,night,share);
    return T.MathUtils.lerp(1,retained,T.MathUtils.smoothstep(clock.quiet.value,.045,.44))*
      T.MathUtils.clamp(clock.litShare.value/.37,0,1)*T.MathUtils.smoothstep(clock.night.value,.02,.58);
  };
  assert.equal(scale(12,0,0,0,.55),0);
  assert.equal(scale(18,30,.75,.40,.55),1);
  assert.ok(scale(22,30,1,.30,.55)<.56&&scale(22,30,1,.30,.035)<.23);
  assert.ok(scale(0,15,1,.30,.035)<.04);
  mat.dispose();g.dispose();
});


test('215 has a longitudinal stair inside the first pier, a raised porch and see-through framed guards',()=>{
  const {root,mesh}=model(),guard=root.getObjectByName(fremontGuardGlassName);
  assert.ok(guard.material.transparent&&!guard.material.depthWrite&&guard.material.opacity<.25);
  assert.equal(guard.geometry.index.count/3,10);
  const floor=s=>sample(mesh,point(s,1.35,2.5),point(s,1.35,-1));
  for(const [s,h] of [[5,0],[6.2,.15],[6.5,.30],[6.9,.45],[7.2,.60],[7.55,.75],[36.9,0]]){
    const hit=floor(s);assert.ok(hit&&Math.abs(hit.point.y-point(s,1.35,h).y)<1e-5,[s,h]);
  }
  const through=(subject,s,h)=>sample(subject,point(s,-1,h),point(s,3,h));
  for(const [s,h] of [[8,.50],[14,.45],[20,.25]]){
    const base=through(mesh,s,h);assert.ok(base.point.distanceTo(point(s,.16,h))<1e-4);
    assert.equal(through(root,s,h+.65).object,guard);
    assert.ok(through(mesh,s,h+.65).point.distanceTo(point(s,2.7,h+.65))<1e-4);
  }
  assert.equal(through(guard,39,1),undefined);
  assert.ok(through(mesh,39,.3).point.distanceTo(point(39,2.7,.3))<1e-4);
  const threshold=33.55,h=(floor(threshold).point.y-.045)/.06;
  assert.ok(h>0&&h<.1);
  const door=sample(mesh,point(threshold,1.5,h+.04),point(threshold,3,h+.04));
  assert.ok(door.point.distanceTo(point(threshold,2.7,h+.04))<1e-4);
});
