import * as THREE from 'three';
import {center,mappedBuildings} from './sf-map.ts';

/** Three shallow skyline strips approximate shore reflections without drawing the city a second time. */
export function configureBayWater(material:THREE.MeshStandardMaterial, time:{value:number}) {
  const columns=512, bytes=new Uint8Array(columns*3), span=256;
  for(const building of mappedBuildings) {
    const [,z]=center(building.p);
    const band=z> -7?0:z> -26?1:2;
    const xs=building.p.map(p=>p[0]);
    const left=Math.max(0,Math.floor((Math.min(...xs)/span+.5)*columns));
    const right=Math.min(columns,Math.ceil((Math.max(...xs)/span+.5)*columns));
    const height=Math.round(Math.min(32,building.h)*255/32);
    for(let x=left;x<right;x++){
      const i=band*columns+x;
      bytes[i]=Math.max(bytes[i],height);
    }
  }
  const profiles=new THREE.DataTexture(bytes,columns,3,THREE.RedFormat);
  profiles.minFilter=profiles.magFilter=THREE.LinearFilter;
  profiles.needsUpdate=true;
  const horizon={value:new THREE.Color('#e2dfcc')};
  material.addEventListener('dispose',()=>profiles.dispose());
  material.onBeforeCompile=shader=>{
    shader.uniforms.harborTime=time;
    shader.uniforms.shoreProfiles={value:profiles};
    shader.uniforms.bayHorizon=horizon;
    shader.vertexShader='uniform float harborTime; varying vec2 baySurface;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.z += sin(position.x*.47+harborTime*.5)*.08 + cos(position.y*.64+harborTime*.65)*.06;
      baySurface=vec2(position.x,-position.y);`);
    shader.fragmentShader=`
      uniform float harborTime;
      uniform sampler2D shoreProfiles;
      uniform vec3 bayHorizon;
      varying vec2 baySurface;
      float reflectedBank(vec3 ray, float shoreZ, float row, float wobble) {
        float travel=(shoreZ-baySurface.y)/min(ray.z,-.001);
        float x=baySurface.x+ray.x*travel+wobble;
        float height=texture2D(shoreProfiles,vec2(x/256.+.5,row)).r*32.;
        float reflectedY=ray.y*travel-.7;
        return (1.-smoothstep(height-.25,height+.25,reflectedY))*smoothstep(.15,.5,height)
          *step(0.,travel)*step(abs(x),128.)*smoothstep(.01,.16,-ray.z);
      }
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=baySurface;
      float ripple=sin(p.y*6.7+p.x*1.4+harborTime*1.1+sin(p.x*.88+p.y*.41)*1.8);
      float swell=sin(p.y*2.1-p.x*.71-harborTime*.65);
      float detail=1.-smoothstep(.10,.8,fwidth(p.x)+fwidth(p.y));
      vec3 mirrorRay=normalize(vec3(p.x-cameraPosition.x,cameraPosition.y+.7,p.y-cameraPosition.z));
      float wobble=(ripple*.74+swell*.55)*detail;
      float bank=max(reflectedBank(mirrorRay,-1.5,1./6.,wobble),max(
        reflectedBank(mirrorRay,-14.,.5,wobble*1.6),reflectedBank(mirrorRay,-39.,5./6.,wobble*2.1)));
      diffuseColor.rgb *= mix(vec3(1.),vec3(.63,.72,.76),bank*.76);
      diffuseColor.rgb *= 1.+(.045*ripple+.035*swell)*detail;
      float glint=smoothstep(.88,.995,ripple)*smoothstep(.2,.9,swell);
      diffuseColor.rgb += vec3(.065,.068,.054)*glint*detail*(.14+dot(diffuseColor.rgb,vec3(.3,.55,.15)));
    `).replace('#include <fog_fragment>',`#include <fog_fragment>
      float distanceMist=smoothstep(38.,420.,length(vViewPosition));
      gl_FragColor.rgb=mix(gl_FragColor.rgb,bayHorizon,distanceMist*.97);`);
  };
  material.customProgramCacheKey=()=> 'bay-shore-reflections-v1';
  return horizon;
}
