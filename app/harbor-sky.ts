import * as THREE from 'three';

/** The low horizon stays luminous while the zenith deepens. The disc tracks the scene's solar light. */
export function createHarborSky() {
  const uniforms = {
    skyTint: {value: new THREE.Color()},
    coastalHorizon: {value: new THREE.Color()},
    sunTint: {value: new THREE.Color()},
    sunDirection: {value: new THREE.Vector3()},
    nightAmount: {value: 0},
    cloudCover: {value: 0},
    seaMist: {value: 0},
    afterglow: {value: 0},
    cloudDrift: {value: 0},
    rainAmount: {value: 0},
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
      uniform vec3 skyTint, sunTint, sunDirection, coastalHorizon;
      uniform float nightAmount, cloudCover, rainAmount, seaMist, afterglow, cloudDrift;
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
        vec3 zenith = skyTint;
        vec3 color = mix(zenith, coastalHorizon, horizon);
        vec2 sheet=dir.xz / max(.065,elevation+.055);
        sheet+=vec2(cloudDrift*.006,cloudDrift*.002);
        float cloud=noise(sheet*vec2(.72,1.65))*.65+noise(sheet*vec2(2.5,5.5))*.25+noise(sheet*9.)*.1;
        float rain=clamp(rainAmount,0.,1.);
        float cover=max(clamp(cloudCover,0.,1.),rain*.84);
        // A low, broken ceiling closes into a continuous deck before a rainy sky darkens.
        float coverage=smoothstep(.74-.79*cover,.92-.79*cover,cloud)*smoothstep(0.,.24,cover);
        float deck=smoothstep(.64,.97,cover);
        float opacity=mix(coverage,1.,deck);
        float solar=max(0.,dot(dir,sunDirection));
        float direct=(1.-opacity)*(1.-smoothstep(.64,.92,cover));
        color+=sunTint*daylight*direct*(pow(solar,30.)*.14+smoothstep(.99975,.9999,solar)*.82);
        float veil=smoothstep(.48,.76,cloud)*smoothstep(.01,.08,elevation)*(1.-smoothstep(.25,.55,elevation));
        color=mix(color,vec3(.97,.92,.82),veil*(.37*daylight+.012*nightAmount));
        float overhead=smoothstep(.015,.46,elevation);
        vec3 stratus=coastalHorizon*mix(1.,.83+(cloud-.5)*.32,overhead);
        stratus*=1.-rain*.25*overhead;
        // At the marine horizon distant cloud layers merge into a uniform silver-grey band.
        float distant=smoothstep(.18,.88,cover)*(1.-smoothstep(.012,.12,elevation));
        color=mix(color,stratus,max(opacity,distant));
        color=mix(color,coastalHorizon,distant);
        // Sea fog lies in long banks below a lighter deck. Its ridges soften into the horizon.
        float bank=noise(vec2(dir.x*5.6+dir.z*2.7+cloudDrift*.011,dir.y*17.-dir.z*2.4));
        float low=1.-smoothstep(.006,.155,elevation+(bank-.5)*.06);
        // The bank meets the same horizon seen on water and hills. Its relief
        // comes from available light, so night fog keeps the depth of the bay.
        vec3 silver=coastalHorizon*mix(.84,1.15,bank);
        color=mix(color,silver,seaMist*(.23+.71*low));
        // Toward the setting sun the underside of broken cloud catches salmon light.
        // The opposite horizon keeps a cooler belt of violet above the earth's shadow.
        float west=dot(normalize(dir.xz+vec2(.00001)),normalize(sunDirection.xz+vec2(.00001)))*.5+.5;
        float belt=exp(-abs(elevation-.082)*10.);
        vec3 blush=mix(vec3(.36,.235,.36),vec3(.95,.385,.168),pow(west,2.));
        float litEdge=smoothstep(.36,.68,cloud)*exp(-abs(elevation-.13)*5.);
        color=mix(color,blush,afterglow*belt*(.29+.33*west+.14*litEdge));
        color+=vec3(.56,.22,.051)*afterglow*pow(west,12.)*exp(-elevation*8.)*(1.-opacity*.80);
        color=mix(color,coastalHorizon,(1.-smoothstep(0.,.065,elevation))*max(seaMist,deck));
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(440,36,18),material);
  dome.frustumCulled = false;
  // Opaque geometry has already filled the depth buffer. Shade the expensive
  // cloud field only through gaps in its silhouette, before transparent layers.
  dome.renderOrder = 1000;
  return {dome, uniforms};
}
