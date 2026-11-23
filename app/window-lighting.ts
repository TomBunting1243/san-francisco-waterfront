import * as THREE from 'three';

type WindowPosition={x:number;y:number;z:number;nightMinimum?:number};
const hash=(n:number)=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};

/** Stable room-sized patches, independent of array order, camera or animation time. */
export function windowGlow({x,y,z,nightMinimum}:WindowPosition){
  const room=Math.floor(x/.42)*73+Math.floor(z/.42)*193+Math.floor(y/.25)*389;
  const occupied=hash(room),brightness=hash(room+17);
  const ordinary=occupied<.62?0:occupied<.88?.20+brightness*.24:.55+brightness*.30;
  // The fraction preserves the original room at all hours. The integer carries
  // an optional photographed night minimum through both instance upload paths.
  return nightMinimum===undefined?ordinary:2+Math.round(nightMinimum*100)+ordinary;
}

/** Occupancy affects emitted light only; the daytime glazing remains unchanged. */
export function applyWindowLighting(material:THREE.MeshStandardMaterial,clock={value:0},share={value:.30},night={value:0}){
  material.onBeforeCompile=shader=>{
    shader.uniforms.windowAirTime=clock;
    shader.uniforms.roomShare=share;
    shader.uniforms.roomNight=night;
    shader.vertexShader='uniform float windowAirTime,roomShare,roomNight; varying vec2 aperturePoint;\n#ifndef USE_INSTANCING_INDIRECT\nattribute float windowGlow;\n#endif\nvarying float roomGlow; varying float roomTint;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      roomGlow=windowGlow; roomTint=0.;
      float fixedNight=0.;
      if(roomGlow>=2.){
        fixedNight=(floor(roomGlow)-2.)*.01;
        roomGlow=fract(roomGlow);
      }
      #ifdef USE_INSTANCING
        if(roomGlow>.0){
          vec3 room=(modelMatrix*instanceMatrix[3]).xyz;
          vec3 suite=floor(room/vec3(.42,.25,.42));
          float priority=fract(sin(dot(suite,vec3(12.9898,17.76,31.75)))*43758.5453);
          roomGlow*=smoothstep(-.012,.012,roomShare/.38-priority)*smoothstep(0.,.005,roomShare);
          vec2 block=floor(room.xz/.84)+vec2(floor(room.y/.50),0.);
          roomTint=step(.72,fract(sin(dot(block,vec2(127.1,311.7)))*43758.5453));
          float distanceFade=smoothstep(48.,135.,distance(room,cameraPosition));
          float phase=dot(room,vec3(.74,.39,.21));
          roomGlow*=1.+distanceFade*.048*sin(phase+.63*windowAirTime)*sin(.43*phase-.21*windowAirTime);
        }
      #endif
      if(fixedNight>0.){
        float minimumGlow=fixedNight*smoothstep(.12,.88,roomNight);
        if(minimumGlow>roomGlow){roomGlow=minimumGlow;roomTint=0.;}
      }
      // This quad is already depth-tested and oriented to its own opening.
      // Only an occupied night room exposes a thin strip of jamb and sill.
      if(roomGlow>0.&&roomNight>0.){
        float exposure=smoothstep(0.,.22,roomNight)*smoothstep(0.,.04,roomGlow);
        transformed.x+=sign(position.x)*.033*exposure;
        transformed.y+=(position.y<0.?-.054:.022)*exposure;
      }
      aperturePoint=transformed.xy;
    `);
    shader.fragmentShader='varying vec2 aperturePoint; varying float roomGlow; varying float roomTint;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      #include <emissivemap_fragment>
      totalEmissiveRadiance*=roomGlow*mix(vec3(1.,.552,.184),vec3(.738,.815,1.),roomTint);
      vec2 outside=abs(aperturePoint)-.5;
      if(roomGlow>0.&&max(outside.x,outside.y)>0.){
        // A return sees only part of its room. The lower sill catches more
        // light than the lintel; radiance falls away from the glass.
        vec2 reach=vec2(.033,aperturePoint.y<0.?.054:.022);
        float falloff=1.-smoothstep(0.,1.,length(max(outside,vec2(0.))/reach));
        float returnLight=mix(.09,.24,step(aperturePoint.y,-.5));
        totalEmissiveRadiance*=returnLight*(.16+.84*falloff);
        diffuseColor.rgb*=.28;
      }
    `);
  };
  material.customProgramCacheKey=()=> 'waterfront-window-occupancy-v5';
}
