import * as THREE from 'three';

type WindowPosition={x:number;y:number;z:number};
const hash=(n:number)=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};

/** Stable room-sized patches, independent of array order, camera or animation time. */
export function windowGlow({x,y,z}:WindowPosition){
  const room=Math.floor(x/.42)*73+Math.floor(z/.42)*193+Math.floor(y/.25)*389;
  const occupied=hash(room),brightness=hash(room+17);
  if(occupied<.62)return 0;
  return occupied<.88?.20+brightness*.24:.55+brightness*.30;
}

/** Occupancy affects emitted light only; the daytime glazing remains unchanged. */
export function applyWindowLighting(material:THREE.MeshStandardMaterial,clock={value:0}){
  material.onBeforeCompile=shader=>{
    shader.uniforms.windowAirTime=clock;
    shader.vertexShader='uniform float windowAirTime; attribute float windowGlow; varying float roomGlow;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      roomGlow=windowGlow;
      #ifdef USE_INSTANCING
        if(roomGlow>.0){
          vec3 room=(modelMatrix*instanceMatrix[3]).xyz;
          float distanceFade=smoothstep(48.,135.,distance(room,cameraPosition));
          float phase=dot(room,vec3(.74,.39,.21));
          roomGlow*=1.+distanceFade*.048*sin(phase+.63*windowAirTime)*sin(.43*phase-.21*windowAirTime);
        }
      #endif
    `);
    shader.fragmentShader='varying float roomGlow;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=roomGlow;');
  };
  material.customProgramCacheKey=()=> 'waterfront-window-occupancy-v2';
}
