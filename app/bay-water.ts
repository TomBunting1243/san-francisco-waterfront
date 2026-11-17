import * as THREE from 'three';
import {center,mappedBuildings} from './sf-map.ts';

/** Three shallow skyline strips approximate shore reflections without drawing the city a second time. */
export function configureBayWater(material:THREE.MeshStandardMaterial, time:{value:number}, hulls:THREE.Vector3[],night:{value:number}) {
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
    shader.uniforms.hullShadows={value:hulls};shader.uniforms.bayNight=night;
    shader.uniforms.shoreProfiles={value:profiles};
    shader.uniforms.bayHorizon=horizon;
    shader.vertexShader='uniform float harborTime; varying vec2 baySurface;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.z += sin(position.x*.47+harborTime*.5)*.08 + cos(position.y*.64+harborTime*.65)*.06;
      baySurface=vec2(position.x,-position.y);`);
    shader.fragmentShader=`
      uniform float harborTime;
      uniform sampler2D shoreProfiles;
      uniform vec3 bayHorizon;
      uniform vec3 hullShadows[4];
      uniform float bayNight;
      varying vec2 baySurface;
      float waveHash(vec2 tile){
        vec3 q=fract(vec3(tile.xyx)*vec3(.1031,.1030,.0973));
        q+=dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float windPatch(vec2 p){
        vec2 cell=floor(p), f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(waveHash(cell),waveHash(cell+vec2(1.,0.)),f.x),
                   mix(waveHash(cell+vec2(0.,1.)),waveHash(cell+1.),f.x),f.y);
      }
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
      float windStrength=windPatch(p*vec2(.19,.27)+vec2(harborTime*.021,0.));
      float lanes=windPatch(p*vec2(.43,1.15)-vec2(.015,.035)*harborTime);
      float ripple=sin(p.y*12.+p.x*2.3+harborTime*1.18+windStrength*8.6+lanes*2.3);
      float swell=sin(p.y*2.1-p.x*.71-harborTime*.65+windStrength*3.6);
      float detail=1.-smoothstep(.10,.8,fwidth(p.x)+fwidth(p.y));
      vec3 mirrorRay=normalize(vec3(p.x-cameraPosition.x,cameraPosition.y+.7,p.y-cameraPosition.z));
      float wobble=(ripple*.74+swell*.55)*detail;
      float bank=max(reflectedBank(mirrorRay,-1.5,1./6.,wobble),max(
        reflectedBank(mirrorRay,-14.,.5,wobble*1.6),reflectedBank(mirrorRay,-39.,5./6.,wobble*2.1)));
      diffuseColor.rgb *= mix(vec3(1.),vec3(.63,.72,.76),bank*.76);
      // Low, feathered contact beneath the vessels is evaluated at their current pose.
      for(int i=0;i<4;i++) {
        vec3 hull=hullShadows[i];vec2 off=p-hull.xy;
        vec2 along=vec2(cos(hull.z),-sin(hull.z));
        vec2 size=i<2?vec2(1.34,.41):vec2(.88,.30);
        vec2 local=vec2(dot(off,along),dot(off,vec2(-along.y,along.x)))/size;
        diffuseColor.rgb *= .67+.33*smoothstep(.24,1.45,dot(local,local));
        if(i<2){
          float aft=-dot(off,along);
          float width=abs(dot(off,vec2(-along.y,along.x)));
          float wake=1.-smoothstep(.0,.23+aft*.035,abs(width-.20-aft*.20));
          float fade=smoothstep(.9,2.2,aft)*(1.-smoothstep(3.5,9.,aft));
          diffuseColor.rgb+=vec3(.21,.23,.21)*wake*fade*(.6+.4*swell)*detail;
        }
      }
      // Glints lie between the viewer and actual lantern positions. The virtual image
      // of each bulb is below the bay plane; a broken reflection widens around it.
      if(bayNight>.001 && dot(p,p)<900.) {
        float lights=0.;
        for(int i=0;i<6;i++){
          vec2 lamp=vec2(-6.+float(i)*2.4,1.98);
          vec2 eye=cameraPosition.xz-lamp;
          vec2 toward=eye/max(.001,length(eye));
          vec2 across=vec2(-toward.y,toward.x);
          float depthFraction=1.80/max(1.82,cameraPosition.y+2.50);
          vec2 reflection=lamp+eye*depthFraction;
          vec2 delta=p-reflection;
          float along=dot(delta,toward), lateral=dot(delta,across);
          float trail=.52+.032*length(eye);
          float width=.065+.04*abs(along)+.025*windStrength;
          float blade=lateral+(lanes-.5)*width*.95;
          float glow=exp(-blade*blade/(width*width)-along*along/(trail*trail));
          float chop=windPatch(p*vec2(7.,22.)+vec2(harborTime*.06,-harborTime*.13));
          lights+=glow*(.17+.83*smoothstep(.41,.79,chop));
        }
        diffuseColor.rgb+=bayNight*vec3(.56,.29,.105)*min(1.,lights)*detail;
      }
      diffuseColor.rgb*=mix(vec3(.85,.94,1.01),vec3(1.13,1.06,.93),windStrength);
      diffuseColor.rgb*=1.+ripple*.023*detail+(.06*lanes-.03);
      float glint=smoothstep(.68,.99,ripple)*smoothstep(.48,.73,lanes)*smoothstep(.28,.66,windStrength);
      diffuseColor.rgb+=vec3(.075,.087,.08)*glint*detail*(1.-bayNight*.82);
    `).replace('#include <fog_fragment>',`#include <fog_fragment>
      float distanceMist=smoothstep(38.,420.,length(vViewPosition));
      gl_FragColor.rgb=mix(gl_FragColor.rgb,bayHorizon,distanceMist*.97);`);
  };
  material.customProgramCacheKey=()=> 'bay-shore-reflections-v2';
  return horizon;
}
