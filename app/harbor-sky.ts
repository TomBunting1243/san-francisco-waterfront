import * as THREE from 'three';

/** The low horizon stays luminous while the zenith deepens. The disc tracks the scene's solar light. */
export function createHarborSky() {
  const uniforms = {
    skyTint: {value: new THREE.Color()},
    sunTint: {value: new THREE.Color()},
    sunDirection: {value: new THREE.Vector3()},
    nightAmount: {value: 0},
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `
      varying vec3 skyDirection;
      uniform vec3 skyTint, sunTint, sunDirection;
      uniform float nightAmount;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 cell=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(cell),hash(cell+vec2(1,0)),f.x),mix(hash(cell+vec2(0,1)),hash(cell+1.),f.x),f.y);
      }
      void main() {
        vec3 dir = normalize(skyDirection);
        float elevation = max(0., dir.y);
        float daylight = 1. - nightAmount;
        float horizon = exp(-elevation * 8.);
        vec3 zenith = skyTint * vec3(.62,.83,1.);
        vec3 mist = mix(skyTint, vec3(.93,.85,.70), daylight * .53);
        vec3 color = mix(zenith, mist, horizon);
        color+=vec3(.023,.013,.009)*nightAmount*pow(horizon,2.5);
        float solar = max(0., dot(dir, sunDirection));
        color += sunTint * daylight * (pow(solar, 30.)*.14 + smoothstep(.99975,.9999,solar)*.82);
        vec2 sheet=dir.xz / max(.065,elevation+.055);
        float cloud=noise(sheet*vec2(.72,1.65))*.65+noise(sheet*vec2(2.5,5.5))*.25+noise(sheet*9.)*.1;
        float veil=smoothstep(.48,.76,cloud)*smoothstep(.01,.08,elevation)*(1.-smoothstep(.25,.55,elevation));
        color=mix(color,vec3(.97,.92,.82),veil*(.37*daylight+.012*nightAmount));
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(440,36,18),material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return {dome, uniforms};
}
