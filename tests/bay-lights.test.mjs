import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,ShaderLib,Vector4} from 'three';
import {configureBayWater} from '../app/bay-water.ts';
import {createBayLights,addBayLightStrand} from '../app/bay-lights.ts';

test('the installation follows the outer face of each north suspender from road to cable',()=>{
  const positions=[];
  addBayLightStrand(positions,-.75,45,8);
  assert.equal(positions.length,0);
  addBayLightStrand(positions,.75,45,8);
  assert.ok(positions.length>100);
  for(let i=0;i<positions.length;i+=3){
    assert.ok(positions[i]>.75&&positions[i]<.78);
    assert.equal(positions[i+2],45);
    assert.ok(positions[i+1]>4.24&&positions[i+1]<8);
  }
});
test('one night draw has a pausable shader clock and drops out of the daytime render',()=>{
  const {lights,update}=createBayLights([.772,7.1,45]);
  const shader={...ShaderLib.points,uniforms:{}};
  lights.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/diffuseColor\.a\*=bayLightLevel/);
  assert.equal(lights.visible,false);
  update(.5,8.25);
  assert.ok(lights.visible&&lights.material.opacity>.5);
  assert.equal(shader.uniforms.bayLightTime.value,8.25);
  update(1,8.25);assert.equal(shader.uniforms.bayLightTime.value,8.25);
  update(1,9.5);assert.equal(shader.uniforms.bayLightTime.value,9.5);
  update(0,12);assert.equal(lights.visible,false);assert.equal(lights.material.opacity,0);
});

test('Ferry Building night reflections follow lit architectural features and skip the terminal decks',()=>{
  const material=new MeshStandardMaterial(),night={value:0};
  configureBayWater(material,{value:0},Array.from({length:5},()=>new Vector4()),night,{value:0});
  const shader={...ShaderLib.standard,uniforms:{}};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.bayNight,night);
  const {width,height,data}=shader.uniforms.ferryReflectionWater.value.image;
  const water=(x,z)=>data[Math.floor(z*height/24)*width+Math.floor((x+16)*width/32)];
  for(const [x,z] of [[-3.7,6.2],[6.22,5.52],[-4.13,9.58]])assert.equal(water(x,z),0,'under wharf or float');
  for(const [x,z] of [[3.6,5],[-4,13],[1,4]])assert.equal(water(x,z),255,'open water');
  assert.match(shader.fragmentShader,/if\(bayNight>\.001 && p.y>1\.64/);
  assert.match(shader.fragmentShader,/ty-2\.035/);
  assert.match(shader.fragmentShader,/23\.\/12\.101/);
  assert.ok(shader.fragmentShader.includes('totalEmissiveRadiance+=strokes'));
  material.dispose();
});
