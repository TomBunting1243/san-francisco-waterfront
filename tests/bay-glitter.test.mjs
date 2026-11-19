import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {configureBayWater} from '../app/bay-water.ts';

function program(){
  const material=new T.MeshStandardMaterial();
  const state=configureBayWater(material,{value:0},Array.from({length:5},()=>new T.Vector4()),{value:0},{value:0});
  const shader={...T.ShaderLib.standard,uniforms:{...T.ShaderLib.standard.uniforms}};
  material.onBeforeCompile(shader);
  return {state,shader};
}

test('water keeps the reflected sun apart from its lit pigment and reserves highlight headroom',()=>{
  const {shader,state}=program(),f=shader.fragmentShader;
  for(const [key,uniform] of [['waterfrontSun','baySun'],['sunsetGlitter','baySunset'],['bayWind','bayWind'],['bayChop','bayChop']])
    assert.equal(shader.uniforms[key],state[uniform]);
  const lightsEnd=f.indexOf('#include <lights_fragment_end>');
  const specular=f.indexOf('reflectedLight.directSpecular/=');
  const outgoing=f.indexOf('vec3 outgoingLight');
  const glitter=f.indexOf('outgoingLight+=solarGlitter');
  const tone=f.indexOf('#include <tonemapping_fragment>');
  assert.ok(lightsEnd>0&&lightsEnd<specular&&specular<outgoing&&outgoing<glitter&&glitter<tone);
  const gain=Number(f.match(/directSpecular\/=1\.\+specPeak\*([\d.]+)\*solarWeight/)[1]);
  const peak=(x,daylight)=>x/(1+x*gain*daylight);
  assert.equal(peak(4,0),4);
  assert.ok(peak(20,1)<.14);
  assert.ok(peak(.05,1)>.034);
  assert.match(f,/solarGlitter\*=contact/);
  assert.match(f,/solarGlitter\*\(1\.-smoothstep\(\.50,1\.28,litPeak\)\)/);
});

test('daylight strokes break up along wind crests and average away below one pixel',()=>{
  const {shader}=program();
  const daylight=shader.fragmentShader.split('float solarWeight=')[1].split('// Low, feathered contact')[0];
  assert.match(daylight,/waveHash\(vec2\(floor\(windPhase/);
  assert.match(daylight,/segment\*crest\*resolved/);
  assert.match(daylight,/fwidth\(across\)/);
  assert.equal(daylight.match(/texture2D\(/g)?.length??0,0);
  assert.equal(daylight.match(/waveHash\(/g)?.length,1);
});
