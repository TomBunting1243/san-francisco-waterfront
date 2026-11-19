import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLandscape,createCityVignette} from '../app/landscape.ts';
import {createStreetField,createStreetIllumination,waterfrontSignals,signalAspects} from '../app/street-illumination.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';

const channelAt=(field,x,z,c=0)=>{
  const {width,data}=field.image;
  return data[(Math.floor((z+64)/.12)*width+Math.floor((x+56)/.12))*4+c];
};
const compile=mat=>{
  const lib=T.ShaderLib.standard,shader={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}};
  mat.onBeforeCompile(shader,{});return shader;
};
test('representative SFMTA heads stand on the surveyed curb; main and cross traffic clear to all red',()=>{
  const parts=[];addSurveyBlocks(g=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));parts.push(m);return m;});
  for(const head of waterfrontSignals){
    const hit=new T.Raycaster(new T.Vector3(head.x,.12,head.z),new T.Vector3(0,-1,0),0,.13).intersectObjects(parts)[0];
    assert.ok(hit&&Math.abs(hit.point.y-head.y)<.0003);
  }
  assert.deepEqual([0,32,36,38,58,62,64].map(signalAspects),[[2,0],[1,0],[0,0],[0,2],[0,1],[0,0],[2,0]]);
});
test('field derives from the scene globes, is local, and reaches the same shader on buildings, people and buses',()=>{
  const scene=createLandscape(),globes=scene.streetGlobes,field=createStreetField(globes);
  assert.ok(globes.length/3>140);
  const market=[];
  for(let i=0;i<globes.length;i+=3)if(globes[i+2]<-10)market.push(globes.slice(i,i+3));
  assert.ok(market.length>=60);
  for(const [x,,z] of market)assert.ok(channelAt(field,x,z)>235);
  assert.ok(channelAt(field,14,-35)===0);
  for(const h of waterfrontSignals)assert.ok(channelAt(field,h.x,h.z,h.axis+1)>110);
  const light=createStreetIllumination(scene.root,globes,scene.waterMaterial);
  const receiver=[scene.architectureChunks[0].material,scene.walkers.material,scene.transit.batch.material];
  for(const m of receiver){
    const shader=compile(m);
    assert.equal(shader.fragmentShader.match(/texture2D\(waterfrontStreetField/g).length,1);
    assert.ok(/batchingMatrix\*(lightSpace|harborWorld)/.test(shader.vertexShader)&&/instanceMatrix\*(lightSpace|harborWorld)/.test(shader.vertexShader));
    assert.ok(shader.fragmentShader.indexOf('outgoingLight+=waterfrontStreetNight')<shader.fragmentShader.indexOf('#include <opaque_fragment>'));
  }
  const u=compile(receiver[0]).uniforms,a=light.lenses.geometry.attributes.color;
  light.update(4,0);assert.equal(u.waterfrontStreetNight.value,0);
  assert.ok(a.getY(22)>a.getX(22)); // active green persists in daylight
  light.update(4,1);assert.equal(u.waterfrontStreetNight.value,1);const version=a.version;
  light.update(4,1);assert.equal(version,a.version); // paused frame
  light.update(39,1);assert.ok(a.getX(0)>a.getY(0));
  light.update(39,1,false);assert.equal(u.waterfrontStreetNight.value,0);assert.ok(a.getX(0)<.13);
  assert.ok(!compile(scene.waterMaterial).fragmentShader.includes('waterfrontStreetField'));
  const vignette=createCityVignette('plaza'),copy=createStreetIllumination(vignette.root,vignette.streetGlobes,vignette.waterMaterial);
  const v=compile(vignette.walkers.material);copy.update(39,.85);
  assert.ok(v.uniforms.waterfrontStreetNight.value>.9&&u.waterfrontStreetNight.value===0);
  assert.equal(compile(vignette.architectureChunks[0].material).fragmentShader.match(/texture2D\(waterfrontStreetField/g).length,1);
  console.log(globes.length/3,'globes;',market.length,'Path of Gold;',field.image.data.byteLength,'field bytes');
  light.dispose();copy.dispose();field.dispose();
});

test('ride headlamp updates a fixed material cone without changing scene lights or material programs',()=>{
  const group=new T.Group(),road=new T.MeshStandardMaterial(),water=new T.MeshStandardMaterial();
  group.add(new T.Mesh(new T.PlaneGeometry(1,1),road));
  const city=createStreetIllumination(group,[],water,true),shader=compile(road),u=shader.uniforms;
  const key=road.customProgramCacheKey(),version=road.version;
  const position=new T.Vector3(13,4,-3),direction=new T.Vector3(2,-.1,-8);
  assert.equal(u.cabLampIntensity.value,0);
  city.setCabLamp(position,direction,1.4);
  assert.deepEqual(u.cabLampPosition.value.toArray(),position.toArray());
  assert.ok(u.cabLampDirection.value.distanceTo(direction.clone().normalize())<1e-12);
  assert.equal(u.cabLampIntensity.value,1.4);
  position.set(0,0,0);assert.equal(u.cabLampPosition.value.x,13);
  city.setCabLamp(position,direction,0);assert.equal(u.cabLampIntensity.value,0);
  assert.equal(road.version,version);assert.equal(road.customProgramCacheKey(),key);
  assert.equal(group.getObjectsByProperty('isLight',true).length,0);
  const cone=shader.fragmentShader.match(/getSpotAttenuation\(([\d.]+),([\d.]+),dot\(ray,cabLampDirection\)\)/);
  assert.ok(Math.abs(Number(cone[1])-Math.cos(.35))<1e-9&&Math.abs(Number(cone[2])-Math.cos(.35*.22))<1e-9);
  assert.ok(shader.fragmentShader.includes('getDistanceAttenuation(distanceToCab,5.4,0.)'));
  assert.ok(shader.fragmentShader.includes('RE_Direct(cab,geometryPosition,geometryNormal'));
  city.dispose();
  const vignette=createStreetIllumination(group,[],water);
  assert.ok(!compile(road).fragmentShader.includes('cabLampIntensity'));
  vignette.dispose();
});
