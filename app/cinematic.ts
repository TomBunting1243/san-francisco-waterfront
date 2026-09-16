import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

/** A broad sharp band keeps the architecture readable; only its edges fall out of focus. */
export function createCinematicView(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const render = new RenderPass(scene, camera);
  const soften = (shader: typeof HorizontalTiltShiftShader | typeof VerticalTiltShiftShader) => new ShaderPass({
    ...shader,
    fragmentShader: shader.fragmentShader.replace('abs( r - vUv.y )', 'smoothstep(0.24, 0.60, abs(r - vUv.y))'),
  });
  const horizontal = soften(HorizontalTiltShiftShader), vertical = soften(VerticalTiltShiftShader);
  horizontal.uniforms.r.value = vertical.uniforms.r.value = .43;
  const output = new OutputPass();
  composer.addPass(render); composer.addPass(horizontal); composer.addPass(vertical); composer.addPass(output);
  let previousQuality=-1;
  return {
    setQuality(level:number){if(level===previousQuality)return;previousQuality=level;composer.renderTarget1.dispose();composer.renderTarget2.dispose();horizontal.enabled=vertical.enabled=level>0;composer.renderTarget1.samples=composer.renderTarget2.samples=level===2?4:level===1?2:0;},
    resize(width: number, height: number) {
      composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(width, height);
      horizontal.uniforms.h.value = .65 / width;
      vertical.uniforms.v.value = .65 / height;
    },
    render() { composer.render(); },
    dispose() { horizontal.dispose(); vertical.dispose(); output.dispose(); render.dispose(); composer.dispose(); },
  };
}
