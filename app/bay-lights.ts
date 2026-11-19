import * as THREE from 'three';
import {bridgeLayout} from './bridge-layout.ts';

// Each column follows one physical suspender. The primary installation faces
// the northern waterfront. LED groups share a draw and a clock across spans.
export function addBayLightStrand(positions:number[],side:number,z:number,top:number){
  if(side<0)return;
  const base=bridgeLayout.upperDeck+.11;
  for(let y=base;y<top-.035;y+=.061)positions.push(side+.022,y,z);
}

export const bayLightPattern=`
  float bayLightLevelAt(float z,float h,float t){
    float tide=sin(.118*z-.33*t+.94*sin(.037*z+.083*t));
    float front=sin(.057*z+.157*t+.76*sin(h*.52-.122*t));
    float ripple=sin(z*.49+h*.94-.68*t+1.54*tide);
    float glint=sin(.92*z-1.18*h+1.06*t);
    return .025+(.14+.70*smoothstep(-.62,.86,tide+.30*ripple)+.13*smoothstep(.57,1.,glint))
      *smoothstep(-.93,.08,front+.15*ripple);
  }`;

export function createBayLights(positions:number[],clock={value:0}){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:'#f5f4ef',size:1.65,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.bayLightTime=clock;
    shader.vertexShader=bayLightPattern+'\nuniform float bayLightTime; varying float bayLightLevel;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      bayLightLevel=bayLightLevelAt(position.z,position.y-${bridgeLayout.upperDeck.toFixed(2)},bayLightTime);
    `);
    shader.fragmentShader='varying float bayLightLevel;\n'+shader.fragmentShader.replace('#include <map_particle_fragment>',`
      #include <map_particle_fragment>
      vec2 lamp=gl_PointCoord*2.-1.;
      diffuseColor.a*=bayLightLevel*(1.-smoothstep(.12,1.,dot(lamp,lamp)));
    `);
  };
  const lights=new THREE.Points(geometry,material);
  lights.name='The Bay Lights, north suspender plane';
  lights.visible=false;
  function update(dusk:number,elapsed:number){
    material.opacity=THREE.MathUtils.smoothstep(dusk,.035,.56)*.96;
    lights.visible=material.opacity>0;
    clock.value=elapsed;
  }
  return {lights,clock,update};
}
