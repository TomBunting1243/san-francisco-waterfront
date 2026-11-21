import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createLandscape} from '../app/landscape.ts';
import {firehouseFloat} from '../app/fireboat-station.ts';
import {fireboatCycle,fireboatPose} from '../app/fireboat.ts';
import {harborDatum,waterSurface} from '../app/water-surface.ts';

test('the surveyed historic firehouse, overlook, ramps and floating station meet the rendered shore at each tide',()=>{
  const world=createLandscape();
  world.root.updateMatrixWorld(true);
  const local=world.architectureChunks.filter(mesh=>{
    const b=mesh.geometry.boundingBox;
    return b.max.x>=-47&&b.min.x<=-43&&b.max.z>=-.8&&b.min.z<=5;
  });
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  function top(x,z,above=1.5){
    ray.ray.origin.set(x,above,z);
    return ray.intersectObjects(local,false)[0]?.point.y??-Infinity;
  }
  const foot=.3048*.06,deck=waterSurface.level+5*foot;
  const corners=firehouseFloat.p;
  assert.ok(Math.abs(Math.hypot(corners[0][0]-corners[1][0],corners[0][1]-corners[1][1])/foot-173)<1);
  assert.ok(Math.abs(Math.hypot(corners[1][0]-corners[2][0],corners[1][1]-corners[2][1])/foot-96)<1);
  const historicRoof=top(-44.45,.20),roof=top(-45.36,3.50),pile=top(-44.813,4.811);
  assert.ok(historicRoof>.54&&historicRoof<.60,'landmark roof over the registered 1915 footprint');
  assert.ok(roof>.6&&roof<.95,'two-storey mapped floating house');
  assert.ok(pile>.30&&pile<.35,'top of the fixed guide');
  const panes=world.tidalPanes.filter(({i})=>{
    const a=world.windowMesh.instanceMatrix.array;
    return a[i*16+12]<-44&&a[i*16+12]>-46.5&&a[i*16+14]>1.8;
  });
  assert.ok(panes.length>5);
  for(const tide of [-.075,0,.085,0]){
    world.updateTide(tide);
    assert.ok(Math.abs(top(-44.45,.20)-historicRoof)<.0001);
    assert.ok(Math.abs(top(-45.36,3.50)-roof-tide)<.0001);
    assert.ok(Math.abs(top(-45.81,2.08)-deck-tide)<.0003,'exposed deck travels with the shell');
    assert.ok(Math.abs(top(-46.12,-.50)-harborDatum.pierDeck)<.001,'fixed public overlook');
    assert.ok(Math.abs(top(-44.813,4.811)-pile)<.0001,'guide pile stays fixed');
    for(const p of panes)assert.ok(Math.abs(world.windowMesh.instanceMatrix.array[p.i*16+13]-p.y-tide)<.0001);
    // Probe walking height at both hinges and along the middle of each span.
    for(const [ax,az,bx,bz] of [[-45.77,-.24,-45.60,1.76],[-44.65,.755,-44.85,1.83]]){
      for(const t of [.006,.06,.18,.36,.53,.75,.94,.994]){
        const expected=harborDatum.pierDeck*(1-t)+(deck+tide)*t;
        const x=ax+(bx-ax)*t,z=az+(bz-az)*t;
        assert.ok(Math.abs(top(x,z,expected+.025)-expected)<.005,'continuous ramp at '+[t,tide,x,z]);
      }
    }
  }
});

test('the floating footprint stays clear of the harbor boat through its entire visible cycle',()=>{
  for(let t=0;t<fireboatCycle;t+=.25){
    const p=fireboatPose(t);
    for(let i=0;i<4;i++){
      const [x,z]=firehouseFloat.p[i],[bx,bz]=firehouseFloat.p[i+1],dx=bx-x,dz=bz-z;
      const a=Math.max(0,Math.min(1,((p.x-x)*dx+(p.z-z)*dz)/(dx*dx+dz*dz)));
      assert.ok(Math.hypot(p.x-x-a*dx,p.z-z-a*dz)>1.35,'boat hull clears the float');
    }
  }
});
