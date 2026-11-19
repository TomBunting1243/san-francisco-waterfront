import {doradoDimensions,doradoWake} from './dorado-ferry.ts';
import {vessels} from './ferry-service.ts';
import {bridgeLayout} from './bridge-layout.ts';
import {bayLightPattern} from './bay-lights.ts';
import {shelterAtVertex,waterSurface,waveAmplitudes} from './water-surface.ts';
import {daySailerContact} from './sailing.ts';
import * as THREE from 'three';
import shoreCut from '../public/data/bay-shore-cut.json' with {type:'json'};
import surveyShore from '../public/data/survey-shore.json' with {type:'json'};
import {insideBuilding} from './building-character.ts';
import {center,mappedBuildings,sfMap} from './sf-map.ts';

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
  // Only triangles cut by the NOAA hard shoreline need replacement. Water
  // remains below pile-supported piers and inside both surveyed slip holes.
  const indices:number[]=[],original=sheet.index!;
  let start=0;
  for(const [first,count] of shoreCut.removed){
    for(let i=start*3;i<first*3;i++)indices.push(original.getX(i));
    start=first+count;
  }
  for(let i=start*3;i<original.count;i++)indices.push(original.getX(i));
  indices.push(...shoreCut.indices);
  const positions=new Float32Array((position.count+shoreCut.points.length)*3);
  positions.set(position.array);
  const normals=new Float32Array(positions.length);
  normals.set(sheet.attributes.normal.array);
  // A shoreline vertex inherits its three original corners' wave phases.
  // The same two oscillators can then deform the whole mesh without seams or
  // three extra wave evaluations on each cut vertex. Signed 16-bit phase
  // weights introduce less than two hundredths of a millimetre of height error.
  const phase=new Int16Array(positions.length/3*4),stride=columns+3;
  const dx=size/columns,dz=size/rows;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=-position.getY(i),gain=32767*shelterAtVertex(x,z);
    phase[4*i]=Math.round(gain*Math.sin(x*.47));
    phase[4*i+1]=Math.round(gain*Math.cos(x*.47));
    phase[4*i+2]=Math.round(gain*Math.cos(z*.64));
    phase[4*i+3]=Math.round(gain*Math.sin(z*.64));
  }
  for(const [i,[x,z]] of shoreCut.points.entries()){
    const vertex=position.count+i;
    positions[3*vertex]=x;positions[3*vertex+1]=-z;
    normals[3*vertex+2]=1;
    const gx=(x+size/2)/dx,gz=(z+size/2)/dz,col=Math.floor(gx),row=Math.floor(gz);
    const u=gx-col,v=gz-row,nw=(row+1)*stride+col+1,ne=nw+1,sw=nw+stride,se=sw+1;
    for(let k=0;k<4;k++){
      phase[4*vertex+k]=Math.round(u+v<=1
        ? (1-u-v)*phase[4*nw+k]+u*phase[4*ne+k]+v*phase[4*sw+k]
        : (u+v-1)*phase[4*se+k]+(1-v)*phase[4*ne+k]+(1-u)*phase[4*sw+k]);
    }
  }
  sheet.deleteAttribute('uv');
  sheet.setAttribute('bayWavePhase',new THREE.Int16BufferAttribute(phase,4,true));
  sheet.setAttribute('position',new THREE.BufferAttribute(positions,3));
  sheet.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  sheet.setIndex(indices);
  sheet.computeBoundingSphere();
  return sheet;
}

export function vignetteBaySurfaceGeometry(){
  const positions:number[]=[],normals:number[]=[];
  for(const [x,z] of shoreCut.flat.points){positions.push(x,-z,0);normals.push(0,0,1);}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setIndex(shoreCut.flat.indices);
  return g;
}

// Use the same measured visibility and horizon color on the wake and its hull.
export const marineDistanceFog = `
  #ifdef USE_FOG
    float clarity=smoothstep(95.,465.,fogFar);
    float range=mix(32.,765.,clarity);
    float distanceMist=1.-exp(-max(0.,length(vViewPosition)-8.)/range);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,bayHorizon,distanceMist);
  #endif`;

// The only water eligible for a hall reflection is open water east of the
// seawall. Rasterise the same fixed aprons and floating landings as the scene.
function ferryReflectionWater(){
  const width=256,height=192,pitch=.125,water=new Uint8Array(width*height).fill(255);
  const plans=[...surveyShore.decks,...sfMap.piers.filter(p=>p.closed).map(p=>[p.p])];
  for(const [outer,...holes] of plans){
    const xx=outer.map(p=>p[0]),zz=outer.map(p=>p[1]);
    const left=Math.max(0,Math.floor((Math.min(...xx)+16)/pitch)),right=Math.min(width-1,Math.floor((Math.max(...xx)+16)/pitch));
    const front=Math.max(0,Math.floor(Math.min(...zz)/pitch)),back=Math.min(height-1,Math.floor(Math.max(...zz)/pitch));
    for(let j=front;j<=back;j++)for(let i=left;i<=right;i++){
      const x=-16+(i+.5)*pitch,z=(j+.5)*pitch;
      if(insideBuilding(x,z,outer)&&!holes.some(h=>insideBuilding(x,z,h)))water[i+j*width]=0;
    }
  }
  const texture=new THREE.DataTexture(water,width,height,THREE.RedFormat);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

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
  const openWater=ferryReflectionWater();
  const profiles=new THREE.DataTexture(bytes,columns,3,THREE.RedFormat);
  profiles.minFilter=profiles.magFilter=THREE.LinearFilter;
  profiles.needsUpdate=true;
  const horizon={value:new THREE.Color('#e2dfcc')};
  const sunset={value:new THREE.Vector3()};
  const sun={value:new THREE.Vector4()};
  const wind={value:new THREE.Vector2(.188,.982)},chop={value:.5};
  material.addEventListener('dispose',()=>{profiles.dispose();openWater.dispose();});
  material.onBeforeCompile=shader=>{
    shader.uniforms.harborTime=time;shader.uniforms.bayLightTime=artClock;shader.uniforms.hullSize=hullSize;
    shader.uniforms.hullShadows={value:hulls};shader.uniforms.ferryWakes=ferryWakes;shader.uniforms.bayNight=night;
    shader.uniforms.shoreProfiles={value:profiles};shader.uniforms.ferryReflectionWater={value:openWater};
    shader.uniforms.sunsetGlitter=sunset;shader.uniforms.waterfrontSun=sun;
    shader.uniforms.bayWind=wind;shader.uniforms.bayChop=chop;
    shader.vertexShader=`uniform float harborTime; attribute vec4 bayWavePhase;
      varying vec2 baySurface; varying float bayElevation;
    `+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      baySurface=vec2(position.x,-position.y);
      transformed.z+=dot(bayWavePhase,vec4(
        ${waveAmplitudes.x}*cos(harborTime*.5),${waveAmplitudes.x}*sin(harborTime*.5),
        ${waveAmplitudes.z}*cos(harborTime*.65),${waveAmplitudes.z}*sin(harborTime*.65)));
      bayElevation=${waterSurface.level.toFixed(7)}+transformed.z;`);
    shader.fragmentShader=`
      uniform float harborTime;
      uniform sampler2D shoreProfiles;
      uniform sampler2D ferryReflectionWater;
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
      // Separate the sun track from the lit water pigment. One hash staggers the
      // start, length and brightness of each short reflected crest along the wind.
      vec3 solarGlitter=vec3(0.);
      float solarWeight=max(waterfrontSun.w,sunsetGlitter.z);
      if(solarWeight>.005){
        float across=dot(p,vec2(bayWind.y,-bayWind.x))*mix(1.45,2.45,bayChop)+lanes*.63+harborTime*.047;
        float seed=waveHash(vec2(floor(windPhase*.159155),floor(across)));
        float center=.29+.42*seed;
        float extent=.085+.12*fract(seed*11.37);
        float fw=max(.006,fwidth(across));
        float segment=1.-smoothstep(extent,extent+fw,abs(fract(across)-center));
        float crest=smoothstep(.67,.96,windCrest);
        float resolved=detail*(1.-smoothstep(.28,.75,fw+fwidth(windPhase)*.159155));
        float strokes=segment*crest*resolved*smoothstep(.27,.79,lanes+.26*(seed-.5));
        float sunPath=pow(max(0.,dot(mirrorRay,waterfrontSun.xyz)),56.)*waterfrontSun.w;
        vec2 toward=normalize(mirrorRay.xz+vec2(.00001));
        float lowSunPath=pow(max(0.,dot(toward,sunsetGlitter.xy)),32.)*sunsetGlitter.z;
        solarGlitter=(vec3(.28,.235,.157)*sunPath+vec3(.31,.124,.047)*lowSunPath)
          *(.045+.955*strokes)*(1.-bank*.82);
      }
      // Low, feathered contact beneath the vessels is evaluated at their current pose.
      for(int i=0;i<${hulls.length};i++) {
        vec4 hull=hullShadows[i];vec2 off=p-hull.xy;
        if(dot(off,off)>100.)continue;
        vec2 along=hull.zw, size=hullSize[i].xy;
        vec2 local=vec2(dot(off,along),dot(off,vec2(-along.y,along.x)))/size;
        float contact=.67+.33*smoothstep(.24,1.45,dot(local,local));
        diffuseColor.rgb*=contact;solarGlitter*=contact;
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
      // Reflect the illuminated east arcade and clock tower already in the
      // scene. The ripple shifts the source image, keeping its perspective.
      if(bayNight>.001 && p.y>1.64 && p.y<24. && abs(p.x)<16. && mirrorRay.z<-.035){
        vec2 waterUV=(p+vec2(16.,0.))/vec2(32.,24.);
        float openWater=texture2D(ferryReflectionWater,waterUV).r;
        if(openWater>.96){
          float spread=mix(.60,1.50,bayChop);
          float shoreTravel=(1.636-p.y)/mirrorRay.z;
          float crossShift=(.16*windCrest+.09*swell)*spread;
          vec2 arcadeHit=vec2(p.x+mirrorRay.x*shoreTravel+crossShift,bayElevation+mirrorRay.y*shoreTravel);
          float heightShift=ripple*spread*(.12+.014*shoreTravel);
          float arcadeY=arcadeHit.y+heightShift;
          // The elevation has 23 bays between its OSM wing ends. Their stone
          // piers reflect through the darker recesses of the glazed arcade.
          float bays=(arcadeHit.x+6.219)*23./12.101;
          float columns=1.-smoothstep(.035,.24,abs(fract(bays+.5)-.5));
          float hall=step(0.,bays)*step(bays,23.)*smoothstep(.18,.43,arcadeY)
            *(1.-smoothstep(.79,.98,arcadeY))*(.14+.86*columns);
          // Project against the vertical axis of the four-sided tower. These
          // are the modeled clock centre, 22-foot dial and upper lantern tiers.
          vec2 tower=vec2(-.1185,-1.2465);
          float t=dot(tower-p,mirrorRay.xz)/max(.01,dot(mirrorRay.xz,mirrorRay.xz));
          vec2 miss=p+t*mirrorRay.xz-tower;
          float side=dot(miss,normalize(vec2(-mirrorRay.z,mirrorRay.x)))+crossShift;
          float ty=bayElevation+mirrorRay.y*t+heightShift;
          float dial=1.-smoothstep(.16,.27,length(vec2(side,ty-2.035)));
          float shaft=(1.-smoothstep(.21,.39,abs(side)))*smoothstep(1.20,1.78,ty)*(1.-smoothstep(2.29,2.58,ty));
          float lantern=(1.-smoothstep(.08,.22,abs(side)))*smoothstep(2.48,2.83,ty)*(1.-smoothstep(3.47,3.75,ty));
          float hallBlocks=step(-6.219,arcadeHit.x)*step(arcadeHit.x,5.882)*(1.-smoothstep(.94,1.20,arcadeHit.y));
          float clock=(.46*dial+.15*shaft+.22*lantern)*step(0.,t)*(1.-hallBlocks);
          // Ignore reflected rays that hit a deck before rising above its edge.
          vec2 edgeUV=waterUV+mirrorRay.xz*(.12-bayElevation)/max(.025,mirrorRay.y)/vec2(32.,24.);
          float clear=smoothstep(.82,1.,texture2D(ferryReflectionWater,mix(waterUV,edgeUV,.55)).r)
                     *smoothstep(.82,1.,texture2D(ferryReflectionWater,edgeUV).r);
          float crests=smoothstep(.33,.82,.54+.30*windCrest+.21*swell+.23*(lanes-.5));
          float strokes=(.08+.92*crests)*detail*clear*bayNight;
          totalEmissiveRadiance+=strokes*(hall*vec3(.086,.042,.016)+clock*vec3(.35,.216,.102));
        }
      }
      diffuseColor.rgb*=mix(vec3(.85,.94,1.01),vec3(1.13,1.06,.93),windStrength);
      diffuseColor.rgb*=1.+ripple*mix(.009,.037,bayChop)*detail+(.06*lanes-.03);
      float feather=max(.035,.49*fwidth(windPhase));
      float glint=smoothstep(.875-feather,.98+feather,windCrest);
      glint*=smoothstep(.40,.71,lanes)*smoothstep(.32,.66,windStrength);
      glint*=.32+.68*smoothstep(-.5,.78,sin(crossPhase*.44+lanes));
      diffuseColor.rgb+=vec3(.058,.068,.064)*glint*detail*(1.-bayNight*.82)*mix(.52,1.48,bayChop);
    `).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      // A smooth bay plane can send the whole directional GGX lobe into the
      // camera. Roll off its peak before tone mapping, preserving its color.
      float specPeak=max(reflectedLight.directSpecular.r,max(reflectedLight.directSpecular.g,reflectedLight.directSpecular.b));
      reflectedLight.directSpecular/=1.+specPeak*7.5*solarWeight;
    `).replace('#include <opaque_fragment>',`
      float litPeak=max(outgoingLight.r,max(outgoingLight.g,outgoingLight.b));
      outgoingLight+=solarGlitter*(1.-smoothstep(.50,1.28,litPeak));
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'bay-shore-reflections-v9-'+hulls.length;
  return {ferryWakes,baySun:sun,baySunset:sunset,bayHorizon:horizon,bayWind:wind,bayChop:chop};
}
