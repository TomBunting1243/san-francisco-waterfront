import {doradoDimensions,doradoWake} from './dorado-ferry.ts';
import {vessels} from './ferry-service.ts';
import {bridgeLayout} from './bridge-layout.ts';
import {bayLightPattern} from './bay-lights.ts';
import {pierThreeShelter,waterSurface,waveAmplitudes} from './water-surface.ts';
import {daySailerContact} from './sailing.ts';
import * as THREE from 'three';
import {center,mappedBuildings} from './sf-map.ts';

/** One extra row around the wave grid carries the water out to the horizon.
 * The interior vertices keep the spacing sampled by hulls and floating docks. */
export function baySurfaceGeometry(){
  const {size,columns,rows}=waterSurface;
  const sheet=new THREE.PlaneGeometry(size+2*size/columns,size+2*size/rows,columns+2,rows+2);
  const position=sheet.attributes.position,far=2000;
  for(let row=0;row<=rows+2;row++)for(let col=0;col<=columns+2;col++){
    const i=row*(columns+3)+col;
    if(col===0||col===columns+2)position.setX(i,col===0?-far:far);
    if(row===0||row===rows+2)position.setY(i,row===0?far:-far);
  }
  sheet.computeBoundingSphere();
  return sheet;
}

// Use the same measured visibility and horizon color on the wake and its hull.
export const marineDistanceFog = `
  #ifdef USE_FOG
    float clarity=smoothstep(95.,465.,fogFar);
    float range=mix(32.,765.,clarity);
    float distanceMist=1.-exp(-max(0.,length(vViewPosition)-8.)/range);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,bayHorizon,distanceMist);
  #endif`;

/** Three shallow skyline strips approximate shore reflections without drawing the city a second time. */
export function configureBayWater(material:THREE.MeshStandardMaterial, time:{value:number}, hulls:THREE.Vector4[],night:{value:number},artClock:{value:number}) {
  const ferryWakes={value:new Float32Array(hulls.length-2)};
  const contact=vessels.map(v=>{
    if(v.family==='dorado')return new THREE.Vector4(doradoDimensions.length/2,doradoWake.halfBeam,doradoWake.stern,doradoWake.hullOffset);
    const bow=v.length*.03,beam=v.beam*.03;
    const offset=v.family==='spaulding'?0:v.family==='prop'?.61:.63;
    return new THREE.Vector4(bow,beam,-bow,beam*offset);
  });
  const sailer=new THREE.Vector4(daySailerContact.halfLength,daySailerContact.halfBeam,0,0);
  const hullSize={value:[...contact.slice(0,hulls.length-2),sailer,sailer]};
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
  const sunset={value:new THREE.Vector3()};
  const sun={value:new THREE.Vector4()};
  const wind={value:new THREE.Vector2(.188,.982)},chop={value:.5};
  material.addEventListener('dispose',()=>profiles.dispose());
  material.onBeforeCompile=shader=>{
    shader.uniforms.harborTime=time;shader.uniforms.bayLightTime=artClock;shader.uniforms.hullSize=hullSize;
    shader.uniforms.hullShadows={value:hulls};shader.uniforms.ferryWakes=ferryWakes;shader.uniforms.bayNight=night;
    shader.uniforms.shoreProfiles={value:profiles};
    shader.uniforms.sunsetGlitter=sunset;shader.uniforms.waterfrontSun=sun;
    shader.uniforms.bayWind=wind;shader.uniforms.bayChop=chop;
    shader.vertexShader='uniform float harborTime; varying vec2 baySurface; varying float bayElevation;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      baySurface=vec2(position.x,-position.y);
      vec2 slip=abs(baySurface-vec2(${pierThreeShelter.x},${pierThreeShelter.z}));
      float amplitude=slip.x<${pierThreeShelter.halfX.toFixed(2)} && slip.y<${pierThreeShelter.halfZ} ? ${pierThreeShelter.strength} : 1.;
      transformed.z += amplitude*(sin(position.x*.47+harborTime*.5)*${waveAmplitudes.x} + cos(position.y*.64+harborTime*.65)*${waveAmplitudes.z});
      bayElevation=${waterSurface.level.toFixed(7)}+transformed.z;`);
    shader.fragmentShader=`
      uniform float harborTime;
      uniform sampler2D shoreProfiles;
      uniform vec3 sunsetGlitter;
      uniform vec4 waterfrontSun;
      uniform vec4 hullShadows[${hulls.length}];
      uniform vec4 hullSize[${hulls.length}];
      uniform float bayLightTime;
      ${bayLightPattern}
      uniform float ferryWakes[${hulls.length-2}];
      uniform float bayNight;
      uniform vec2 bayWind;
      uniform float bayChop;
      varying vec2 baySurface; varying float bayElevation;
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
        float reflectedY=ray.y*travel+bayElevation;
        return (1.-smoothstep(height-.58,height+.58,reflectedY))*smoothstep(.15,.5,height)
          *step(0.,travel)*step(abs(x),128.)*smoothstep(.01,.16,-ray.z);
      }
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=baySurface;
      float windStrength=windPatch(p*vec2(.19,.27)+vec2(harborTime*.021,0.));
      float lanes=windPatch(p*vec2(.43,1.15)-vec2(.015,.035)*harborTime);
      // Intersecting wind and tidal wavelets split crests into short strokes.
      float windPhase=dot(p,bayWind)*mix(9.,15.4,bayChop)+harborTime*mix(.58,1.78,bayChop)+windStrength*8.6+lanes*2.3;
      float crossPhase=dot(p,vec2(9.1,-5.4))-harborTime*.87+lanes*6.8;
      float ripple=.64*sin(windPhase)+.36*sin(crossPhase);
      float swell=sin(p.y*2.1-p.x*.71-harborTime*.65+windStrength*3.6);
      float detail=1.-smoothstep(.10,.8,fwidth(p.x)+fwidth(p.y));
      vec3 mirrorRay=normalize(vec3(p.x-cameraPosition.x,cameraPosition.y-bayElevation,p.y-cameraPosition.z));
      // Long wind streaks shear reflected outlines along the tide. Short
      // cross-waves disturb them without punching round holes in the reflection.
      float windCrest=sin(windPhase+crossPhase*.035+.32*sin(crossPhase));
      float wobble=(windCrest*.36+swell*.26)*detail*mix(.42,1.58,bayChop);
      float bank=max(reflectedBank(mirrorRay,-1.5,1./6.,wobble),max(
        reflectedBank(mirrorRay,-14.,.5,wobble*1.6),reflectedBank(mirrorRay,-39.,5./6.,wobble*2.1)));
      diffuseColor.rgb *= mix(vec3(1.),vec3(.63,.72,.76),bank*.76);
      if(waterfrontSun.w>.01){
        // Small crests catch a narrow band of daylight around the solar reflection.
        // It travels across the bay with the same vector that lights the buildings.
        float sunPath=pow(max(0.,dot(mirrorRay,waterfrontSun.xyz)),46.);
        float facets=smoothstep(.18,.86,ripple)*mix(.28,1.,detail);
        diffuseColor.rgb+=vec3(.49,.43,.29)*sunPath*facets*waterfrontSun.w*(1.-bank*.82);
      }
      if(sunsetGlitter.z>.005){
        vec2 toward=normalize(mirrorRay.xz+vec2(.00001));
        float align=max(0.,dot(toward,sunsetGlitter.xy));
        float path=pow(align,22.)*(.36+.64*smoothstep(-.48,.8,ripple));
        diffuseColor.rgb+=vec3(.51,.153,.044)*sunsetGlitter.z*path*(1.-bank*.82);
      }
      // Low, feathered contact beneath the vessels is evaluated at their current pose.
      for(int i=0;i<${hulls.length};i++) {
        vec4 hull=hullShadows[i];vec2 off=p-hull.xy;
        if(dot(off,off)>100.)continue;
        vec2 along=hull.zw, size=hullSize[i].xy;
        vec2 local=vec2(dot(off,along),dot(off,vec2(-along.y,along.x)))/size;
        diffuseColor.rgb *= .67+.33*smoothstep(.24,1.45,dot(local,local));
        if(i<${hulls.length-2}){
          float aft=hullSize[i].z-dot(off,along);
          float width=abs(dot(off,vec2(-along.y,along.x)));
          // Foam leaves each transom at its hull center. The two
          // wash lines open away from one another behind the boat.
          float spread=max(0.,aft);
          float wake=1.-smoothstep(.012,.055+spread*.038,abs(width-hullSize[i].w-spread*.20));
          float fade=smoothstep(-.025,.10,aft)*(1.-smoothstep(2.8,7.6,aft));
          diffuseColor.rgb+=vec3(.21,.23,.21)*wake*fade*ferryWakes[i]*(.6+.4*swell)*detail;
        }
      }
      // Intersect a broken reflection ray with the lit western suspender plane.
      // A single sample of its light field gives a silver stroke on a wavelet.
      if(bayNight>.035){
        const vec2 acrossBridge=vec2(${Math.cos(bridgeLayout.angle).toFixed(7)},${(-Math.sin(bridgeLayout.angle)).toFixed(7)});
        vec2 alongBridge=vec2(-acrossBridge.y,acrossBridge.x);
        vec2 offset=p-vec2(${bridgeLayout.origin.join(',')});
        float face=dot(mirrorRay.xz,acrossBridge);
        if(face<-.04){
          float travel=(.772-dot(offset,acrossBridge))/face;
          float z=dot(offset+mirrorRay.xz*travel,alongBridge);
          float h=bayElevation+mirrorRay.y*travel+wobble*1.8;
          if(travel>0.&&z>15.64&&z<${bridgeLayout.length}&&h>3.8&&h<10.){
            float station=z<100.31?z-15.64:z-100.31;
            float endDistance=min(station,(z<100.31?84.67:88.518)-station);
            float u=clamp((station-21.21)/42.25,0.,1.);
            float side=clamp(endDistance/21.21,0.,1.);
            float top=endDistance<21.21?mix(4.85,9.55,side)-6.6*side*(1.-side):9.55-18.8*u*(1.-u);
            float band=smoothstep(3.85,4.6,h)*(1.-smoothstep(top-.3,top+.28,h));
            float stroke=smoothstep(.24,.88,lanes*.50+ripple*.36+.27);
            diffuseColor.rgb+=vec3(.24,.255,.25)*bayNight*band*stroke*bayLightLevelAt(z,h-4.24,bayLightTime);
          }
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
      diffuseColor.rgb*=1.+ripple*mix(.009,.037,bayChop)*detail+(.06*lanes-.03);
      float feather=max(.035,.49*fwidth(windPhase));
      float glint=smoothstep(.875-feather,.98+feather,windCrest);
      glint*=smoothstep(.40,.71,lanes)*smoothstep(.32,.66,windStrength);
      glint*=.32+.68*smoothstep(-.5,.78,sin(crossPhase*.44+lanes));
      diffuseColor.rgb+=vec3(.058,.068,.064)*glint*detail*(1.-bayNight*.82)*mix(.52,1.48,bayChop);
    `);
  };
  material.customProgramCacheKey=()=> 'bay-shore-reflections-v7-'+hulls.length;
  return {ferryWakes,baySun:sun,baySunset:sunset,bayHorizon:horizon,bayWind:wind,bayChop:chop};
}
