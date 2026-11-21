import * as THREE from 'three';

// These tints identify dedicated lens faces in the packed daylight paint.
export const vesselLens={work:'#e2d5b8',port:'#a64b42',starboard:'#54836b',mast:'#e1e3d8',stern:'#d9dbcf'} as const;
const roleByTint=new Map<number,number>();
function registerRole(role:number,...colors:string[]){
  for(const color of colors)roleByTint.set(new THREE.Color(color).getHex(),role);
}
registerRole(1,'#29414a','#3e5860','#344850','#435860','#243941','#3d535a','#223941','#364e55',
  '#385c64','#597b80','#3e646b');
registerRole(3,vesselLens.work);
registerRole(4,vesselLens.port);
registerRole(5,vesselLens.starboard);
registerRole(6,vesselLens.mast);
registerRole(7,vesselLens.stern);
const securedPhases=new Set(['alongside','remote layover','berthed']);

const states=new WeakMap<THREE.Group,{value:number}>();
export function setVesselLightingPhase(group:THREE.Group,phase:string){
  const state=states.get(group);
  if(state)state.value=phase==='off service'?0:securedPhases.has(phase)?1:2;
}

/** Install after paint and lettering are packed; the sliding door keeps its original vertices. */
export function bindVesselLighting(group:THREE.Group,body:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>,
  night:{value:number},bridgeSill:number){
  const position=body.geometry.getAttribute('position'),colors=body.geometry.getAttribute('color');
  const roles=new Uint8Array(position.count),sample=new THREE.Color();
  let r=-1,g=-1,b=-1,role=0;
  for(let i=0;i<roles.length;i++){
    if(r!==colors.getX(i)||g!==colors.getY(i)||b!==colors.getZ(i)){
      r=colors.getX(i);g=colors.getY(i);b=colors.getZ(i);
      role=roleByTint.get(sample.setRGB(r,g,b).getHex())??0;
    }
    roles[i]=role===1&&position.getY(i)>bridgeSill?2:role;
  }
  body.geometry.setAttribute('vesselLamp',new THREE.Uint8BufferAttribute(roles,1));
  const state={value:1};states.set(group,state);
  const mat=body.material;
  mat.onBeforeCompile=shader=>{
    shader.uniforms.vesselNight=night;shader.uniforms.vesselState=state;
    shader.vertexShader='attribute float vesselLamp; varying vec3 shipEmission; uniform float vesselState;\n'+
      shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        shipEmission=vec3(0.);
        if(vesselLamp>.5 && vesselState>.5){
          if(vesselLamp<1.5){
            float bay=.85+.15*cos(position.x*17.);
            shipEmission=vec3(.86,.57,.26)*bay;
          }else if(vesselLamp<2.5){shipEmission=vec3(.25,.27,.22);}
          else if(vesselLamp<3.5){shipEmission=vec3(1.,.81,.50);}
          else if(vesselState>1.5){
            vec3 towardsEye=cameraPosition-(modelMatrix*vec4(position,1.)).xyz;
            vec2 sight=normalize(towardsEye.xz+vec2(.00001));
            float forward=dot(sight,normalize(modelMatrix[0].xz));
            float starboard=dot(sight,normalize(modelMatrix[2].xz));
            // Rule 21 sectors end 22.5 degrees abaft the beam.
            float foreSector=smoothstep(-.405,-.36,forward);
            if(vesselLamp<4.5)shipEmission=vec3(1.,.055,.024)*foreSector*(1.-smoothstep(0.,.04,starboard));
            else if(vesselLamp<5.5)shipEmission=vec3(.045,.92,.30)*foreSector*smoothstep(-.04,0.,starboard);
            else shipEmission=vec3(.98,.97,.83)*(vesselLamp<6.5?foreSector:1.-foreSector);
          }
        }`);
    shader.fragmentShader='varying vec3 shipEmission; uniform float vesselNight;\n'+shader.fragmentShader.replace(
      '#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=shipEmission*smoothstep(.12,.93,vesselNight);');
  };
  mat.customProgramCacheKey=()=>'vessel-night-v1';
}
