import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createLandscape} from '../app/landscape.ts';
import {setVesselLightingPhase} from '../app/vessel-lighting.ts';

test('the finished hulls carry passenger, bridge, work and directional navigation lights through their operating phases',()=>{
  const world=createLandscape();
  const fireboat=world.fireboat;
  for(const group of [...world.ferries,fireboat.root]){
    const bodies=[];
    group.traverse(o=>{
      assert.ok(!(o instanceof THREE.Light));
      if(o.geometry?.hasAttribute('vesselLamp'))bodies.push(o);
    });
    assert.equal(bodies.length,1,group.name+' packed lit body');
    const body=bodies[0],roles=body.geometry.getAttribute('vesselLamp'),position=body.geometry.getAttribute('position');
    assert.deepEqual([...new Set(roles.array)].sort(),[0,1,2,3,4,5,6,7],group.name);
    for(let i=0;i<roles.count;i++){
      if(roles.getX(i)===4)assert.ok(position.getZ(i)<0,group.name+' red to port');
      if(roles.getX(i)===5)assert.ok(position.getZ(i)>0,group.name+' green to starboard');
    }
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    body.material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.vesselNight,world.nightInk);
    assert.match(shader.fragmentShader,/totalEmissiveRadiance\+=shipEmission/);
    if(group===fireboat.root){
      for(const [t,state] of [[0,1],[15,2],[50,2],[90,2],[110,1]]){
        fireboat.update(t,.043);assert.equal(shader.uniforms.vesselState.value,state);
      }
    }else{
      for(const [phase,state] of [['arriving',2],['alongside',1],['backing',2],['turning',2],['departing',2],['remote layover',1],['off service',0]]){
        setVesselLightingPhase(group,phase);assert.equal(shader.uniforms.vesselState.value,state);
      }
    }
  }
});
