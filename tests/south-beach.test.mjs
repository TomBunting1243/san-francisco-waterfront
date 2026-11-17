import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {createSouthBeach,southBeach} from '../app/south-beach.ts';
import {createLandscape} from '../app/landscape.ts';
import {sfMap} from '../app/sf-map.ts';
import {waterHeight,waterSurface} from '../app/water-surface.ts';

test('South Beach source retains the shared coast vertex and distinct map features',()=>{
  assert.ok(southBeach.projectionMaxError<.003);
  assert.deepEqual(southBeach.shoreline.at(-1),sfMap.coasts.find(line=>line[0][0]<-99)[0]);
  const existing=new Set(sfMap.buildings.map(b=>b.id));
  assert.ok(southBeach.buildings.length>70);
  assert.ok(southBeach.buildings.every(b=>!existing.has(b.id)));
  assert.ok(southBeach.docks.length>170);
  assert.equal(southBeach.docks.filter(d=>/^Dock [A-G]$/.test(d.name)).length,7);
  for(const p of [southBeach.features.pier38,southBeach.features.pier40,southBeach.features.stadium,southBeach.features.field]){
    assert.deepEqual(p[0],p.at(-1));
  }
});

test('Oracle Park retains an open playing field and the seven floating South Beach piers',()=>{
  const {root,windows}=createSouthBeach(new FontLoader().parse(fontData));
  root.updateMatrixWorld(true);
  for(const name of ['Oracle Park','Willie Mays Gate','WILLIE MAYS GATE','ORACLE PARK',"LEVI'S LANDING",'PIER 38','PIER 40','South Beach Marina']){
    assert.ok(root.getObjectByName(name),name);
  }
  assert.ok(windows.length>500);
  const stadium=root.getObjectByName('Oracle Park');
  const ray=new THREE.Raycaster(new THREE.Vector3(-105,5,-49.2),new THREE.Vector3(0,-1,0));
  const field=ray.intersectObject(stadium,true)[0];
  assert.ok(field.point.y>.085&&field.point.y<.11);
});

test('the batched marina fleet follows real crests and troughs with cruiser-scale freeboard',()=>{
  const waterTime={value:0};
  const {root,updateMarina}=createSouthBeach(new FontLoader().parse(fontData),waterTime);
  const fleet=root.getObjectsByProperty('name','Moored sailboat fleet');
  assert.equal(fleet.length,3);
  assert.equal(fleet.reduce((count,batch)=>count+batch.count,0),56);
  const pose=new THREE.Matrix4(),midpoint=new THREE.Vector3(),size=new THREE.Vector3(),vertex=new THREE.Vector3();
  const fingers=southBeach.docks.filter(dock=>dock.id!==780006769).flatMap(dock=>dock.p.slice(1).map((b,i)=>{
    const [x,z]=dock.p[i],dx=b[0]-x,dz=b[1]-z;
    return {x,z,dx,dz,lengthSquared:dx*dx+dz*dz,halfWidth:dock.name||dock.p.length>3?.095:.0305};
  }));
  function dockClearance(px,pz,dock){
    const {x,z,dx,dz,lengthSquared,halfWidth}=dock;
    const t=THREE.MathUtils.clamp(((px-x)*dx+(pz-z)*dz)/(lengthSquared||1),0,1);
    return Math.hypot(px-x-t*dx,pz-z-t*dz)-halfWidth;
  }
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,3);
  let highestWater=-1,lowestWater=0;
  for(const batch of fleet){
    assert.ok(batch instanceof THREE.InstancedMesh);
    const hull=batch.geometry.boundingBox;
    const hullMesh=new THREE.Mesh(batch.geometry,batch.material);
    const vertices=batch.geometry.getAttribute('position');
    const width=hull.getSize(new THREE.Vector3()).x;
    // Hit the deck beside the coachroof, away from the centerline mast.
    ray.ray.origin.set(width*.442,1.2,-.05);
    const deck=ray.intersectObject(hullMesh,false)[0]?.point.y;
    assert.ok(deck>.10&&deck<.13);
    const anchors=Array.from({length:batch.count},(_,n)=>{
      batch.getMatrixAt(n,pose);
      midpoint.setFromMatrixPosition(pose);
      size.setFromMatrixScale(pose);
      const {x,z}=midpoint,length=size.z;
      for(let i=0;i<vertices.count;i++){
        if(vertices.getY(i)<.09||vertices.getY(i)>.178)continue;
        vertex.fromBufferAttribute(vertices,i).applyMatrix4(pose);
        assert.ok(fingers.every(dock=>dockClearance(vertex.x,vertex.z,dock)>.015),
          'The yacht and its rail must fit beside the mapped timber berths');
      }
      let low={t:0,y:Infinity},high={t:0,y:-Infinity};
      for(let t=0;t<=40*Math.PI;t+=.15){
        const y=waterHeight(x,z,t);
        if(y<low.y)low={t,y};
        if(y>high.y)high={t,y};
      }
      return {length,low,high,x,z};
    });
    for(const [n,{length,low,high,x,z}] of anchors.entries()){
      highestWater=Math.max(highestWater,high.y);
      lowestWater=Math.min(lowestWater,low.y);
      assert.ok(width>=.30&&width<=.35,'Beam should match a small yacht hull');
      assert.ok(length>.33&&length<.63,'The vessel fits its berth at model scale');
      for(const phase of [low,high]){
        waterTime.value=phase.t;
        updateMarina();
        batch.getMatrixAt(n,pose);
        midpoint.setFromMatrixPosition(pose);
        assert.ok(Math.abs(midpoint.x-x)<.0001&&Math.abs(midpoint.z-z)<.0001);
        assert.ok(Math.abs(midpoint.y-phase.y)<.00001);
        const freeboard=midpoint.y+deck*length-phase.y;
        assert.ok(freeboard>.039&&freeboard<.080,'The hull stays visibly above the moving waterline');
        assert.ok(midpoint.y+hull.min.y*length<phase.y-.04,'The keel stays immersed');
      }
    }
  }
  assert.ok(highestWater>waterSurface.level+.12&&lowestWater<waterSurface.level-.12);
});

test('the continuous city surface supports the wharf and stadium while leaving Cove and marina water open',()=>{
  const world=createLandscape();
  world.root.updateMatrixWorld(true);
  assert.equal(world.root.getObjectsByProperty('name','South Beach to China Basin').length,1);
  const fleet=world.root.getObjectsByProperty('name','Moored sailboat fleet');
  assert.equal(fleet.length,3);
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  world.waterTime.value=8.9;
  world.updateMarina();
  for(const batch of fleet){
    assert.ok(batch instanceof THREE.InstancedMesh&&batch.frustumCulled);
    assert.ok(!world.architectureChunks.includes(batch));
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,matrix);
      point.setFromMatrixPosition(matrix);
      assert.ok(Math.abs(point.y-waterHeight(point.x,point.z,world.waterTime.value))<.00001);
      assert.ok(batch.boundingSphere.containsPoint(point));
    }
  }
  world.waterTime.value=0;
  world.updateMarina();

  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,10);
  const hit=(x,z)=>{
    ray.ray.origin.set(x,5,z);
    return ray.intersectObjects(world.architectureChunks,false)[0]?.point.y;
  };
  assert.ok(hit(-80.2,-21)>.08,'Brannan Street Wharf decking');
  assert.ok(hit(-105,-49.2)>.08,'Oracle Park field');
  assert.ok(hit(-101.7,-58.1)>.04,'Willie Mays Plaza');
  assert.equal(hit(...southBeach.points.cove),undefined,'McCovey Cove');
  assert.equal(hit(-106,-29),undefined,'open South Beach Harbor');
  assert.equal(hit(-114.4,-68),undefined,'inland channel at Mission Creek');
});
