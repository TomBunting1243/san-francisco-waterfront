import * as THREE from 'three';
import {signalAspects} from './waterfront-signals.ts';
export {signalAspects} from './waterfront-signals.ts';
import {StreetAssembly} from './street-amenities.ts';

const width=768,height=656,minX=-56,minZ=-64,pitch=.12;
type Axis=0|1;
type Signal={x:number;z:number;y:number;heading:number;axis:Axis};
const fromSouth=-Math.PI/2+.13,fromNorth=Math.PI/2+.13,fromStreet=Math.PI;
// Intersection control is documented in SFMTA inventory objects 15277 and
// 15451. Poles are registered to the adjacent curb/refuges on the 2024 city
// ortho; each lens faces an approaching lane. The inventory gives each intersection, not individual pole coordinates.
export const waterfrontSignals:Signal[]=[
  {x:-11.47,z:-1.725,y:.044,heading:fromSouth,axis:0},
  {x:-13.585,z:-2.77,y:.045,heading:fromNorth,axis:0},
  {x:-11.62,z:-3.115,y:.0409,heading:fromStreet,axis:1},
  {x:13.825,z:-2.21,y:.0449,heading:fromSouth,axis:0},
  {x:11.13,z:-3.95,y:.045,heading:fromNorth,axis:0},
  {x:13.78,z:-3.89,y:.045,heading:fromStreet,axis:1},
];
function location(head:Signal,x:number,y:number,z:number){
  const s=Math.sin(head.heading),c=Math.cos(head.heading);
  return new THREE.Vector3(head.x+.06*(c*x+s*z),head.y+.06*y,head.z+.06*(-s*x+c*z));
}
const lensY=[4.56,4.19,3.82];
export function createSignalHousings(){
  const a=new StreetAssembly();
  for(const h of waterfrontSignals){
    const component=(u:number,y:number,v:number,w:number,d:number,t:number,color:string)=>{
      const p=location(h,u,y,v);const m=a.box(p.x,p.y,p.z,w*.06,d*.06,t*.06,color);
      m.rotation.y=h.heading;
    };
    component(0,.09,0,.29,.18,.29,'#747f77');
    const pole=a.add(new THREE.CylinderGeometry(.0052,.0069,.286,8),'#778880',h.x,h.y+.143,h.z);pole.castShadow=true;
    component(.24,4.19,.04,.49,.085,.11,'#53635d');
    component(.46,4.19,.06,.46,1.28,.16,'#65594b');
    component(.46,4.19,.155,.385,1.16,.042,'#343e3d');
    for(const y of lensY){
      component(.46,y+.151,.23,.31,.037,.17,'#424a43');
      for(const u of [.317,.603])component(u,y+.102,.23,.027,.10,.17,'#495247');
    }
  }
  return a.bake('SFMTA signal standards at Mission and Washington');
}

export function collectStreetGlobes(root:THREE.Object3D,promenade:number[]){
  const all=promenade.slice(),position=new THREE.Vector3();
  root.traverse(node=>{
    if(node.name==='Path of Gold globe'){node.getWorldPosition(position);all.push(position.x,position.y,position.z);}
  });
  return all;
}

export function createStreetField(globes:number[]){
  const pixels=new Uint8Array(width*height*4);
  const stamp=(x:number,y:number,z:number,r:number,channel:number,heading?:number)=>{
    const col=(x-minX)/pitch-.5,row=(z-minZ)/pitch-.5,bound=r/pitch;
    for(let j=Math.max(0,Math.ceil(row-bound));j<=Math.min(height-1,Math.floor(row+bound));j++){
      for(let i=Math.max(0,Math.ceil(col-bound));i<=Math.min(width-1,Math.floor(col+bound));i++){
        const dx=(i-col)*pitch,dz=(j-row)*pitch,d=Math.hypot(dx,dz)/r;
        if(d>=1)continue;
        const aim=heading===undefined?1:.45+.55*THREE.MathUtils.clamp(.5+(dx*Math.sin(heading)+dz*Math.cos(heading))/r,0,1);
        const weight=Math.round(255*(1-d*d)**3*aim),idx=(j*width+i)*4;
        if(pixels[idx+channel]>=weight)continue;
        pixels[idx+channel]=weight;
        if(channel===0)pixels[idx+3]=Math.round(255*THREE.MathUtils.clamp(y,0,1));
      }
    }
  };
  for(let i=0;i<globes.length;i+=3){
    const [x,y,z]=[globes[i],globes[i+1],globes[i+2]];
    stamp(x,y,z,Math.max(.38,Math.min(.88,y*1.62)),0);
  }
  for(const h of waterfrontSignals){
    const p=location(h,.46,4.19,.2);stamp(p.x,p.y,p.z,.42,1+h.axis,h.heading);
  }
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  return texture;
}

const colors=[new THREE.Color('#ff4938'),new THREE.Color('#ffc444'),new THREE.Color('#65d98e')];
const dark=['#4c332f','#484234','#304840'].map(c=>new THREE.Color(c));
function signalLenses(){
  const pos:number[]=[],indices:number[]=[],tints:number[]=[];
  for(const h of waterfrontSignals)for(const y of lensY){
    const base=pos.length/3;
    for(let j=0;j<=10;j++){
      const a=j*2*Math.PI/10,r=j===10?0:.144;
      pos.push(...location(h,.46+r*Math.cos(a),y+r*Math.sin(a),.185).toArray());tints.push(0,0,0);
    }
    for(let j=0;j<10;j++)indices.push(base+10,base+j,base+(j+1)%10);
  }
  const geo=new THREE.BufferGeometry();geo.setIndex(indices);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const color=new THREE.Float32BufferAttribute(tints,3).setUsage(THREE.DynamicDrawUsage);geo.setAttribute('color',color);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}));
  mesh.name='Operating SFMTA signal lenses';
  let previous=-1;
  function update(aspects:[number,number],enabled:boolean){
    const key=enabled?aspects[0]*3+aspects[1]:9;if(key===previous)return;previous=key;
    let offset=0;
    for(const h of waterfrontSignals)for(let i=0;i<3;i++){
      const c=enabled&&aspects[h.axis]===i?colors[i]:dark[i];
      for(let j=0;j<11;j++)color.setXYZ(offset++,c.r,c.g,c.b);
    }
    color.needsUpdate=true;
  }
  return {mesh,update};
}

type Shader=Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0];
const marker='uniform sampler2D waterfrontStreetField;';
const fragment=marker+`
uniform float waterfrontStreetNight;
uniform float waterfrontStreetWet;
uniform vec3 waterfrontMainSignal;
uniform vec3 waterfrontCrossSignal;
varying vec3 waterfrontLightPosition;
`;
const illumination=`
  if(waterfrontStreetNight>.001 && waterfrontLightPosition.y>-.09 && waterfrontLightPosition.y<1.15){
    vec2 streetUv=(waterfrontLightPosition.xz-vec2(-56.,-64.))/vec2(92.16,78.72);
    if(all(greaterThan(streetUv,vec2(0.))) && all(lessThan(streetUv,vec2(1.)))){
      vec4 field=texture2D(waterfrontStreetField,streetUv);
      float lampZ=1.-smoothstep(max(.08,field.a*.84),field.a+.28,waterfrontLightPosition.y);
      float signalZ=1.-smoothstep(.24,.45,waterfrontLightPosition.y);
      float normalY=inverseTransformDirection(normal,viewMatrix).y;
      float facing=smoothstep(-.72,-.05,normalY)*(.47+.53*max(normalY,0.));
      vec3 spill=vec3(.97,.65,.30)*field.r*lampZ*.82+
        (waterfrontMainSignal*field.g+waterfrontCrossSignal*field.b)*signalZ*.34;
      outgoingLight+=waterfrontStreetNight*facing*(.015+.85*diffuseColor.rgb)*spill;
      if(waterfrontStreetWet>.01 && normalY>.75){
        float grazing=1.-max(0.,dot(normal,normalize(vViewPosition)));
        outgoingLight+=waterfrontStreetNight*waterfrontStreetWet*spill*grazing*grazing*.08;
      }
    }
  }
`;

/** One field lookup for nearby opaque surfaces. The same shader evaluates
 * current instance/batch coordinates for moving coats, cars and the tram. */
export function createStreetIllumination(root:THREE.Group,globes:number[],water:THREE.Material){
  const field=createStreetField(globes),night={value:0},wet={value:0},main={value:new THREE.Color()},cross={value:new THREE.Color()};
  const lenses=signalLenses();root.add(lenses.mesh);
  const materials=new Set<THREE.MeshStandardMaterial>();
  root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])
    if(m instanceof THREE.MeshStandardMaterial&&!m.transparent&&m!==water&&m.colorWrite)materials.add(m);});
  const restore:Array<()=>void>=[];
  for(const mat of materials){
    const previous=mat.onBeforeCompile,cache=mat.customProgramCacheKey,key=cache.call(mat);
    mat.onBeforeCompile=(shader:Shader,renderer)=>{
      previous.call(mat,shader,renderer);
      Object.assign(shader.uniforms,{waterfrontStreetField:{value:field},waterfrontStreetNight:night,waterfrontStreetWet:wet,waterfrontMainSignal:main,waterfrontCrossSignal:cross});
      if(shader.fragmentShader.includes(marker)||!shader.vertexShader.includes('#include <project_vertex>')||!shader.fragmentShader.includes('#include <opaque_fragment>'))return;
      const hasWorldPosition=shader.fragmentShader.includes('varying vec3 harborPosition;');
      if(!hasWorldPosition)shader.vertexShader='varying vec3 waterfrontLightPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`
        #include <project_vertex>
        vec4 lightSpace=vec4(transformed,1.);
        #ifdef USE_BATCHING
          lightSpace=batchingMatrix*lightSpace;
        #endif
        #ifdef USE_INSTANCING
          lightSpace=instanceMatrix*lightSpace;
        #endif
        waterfrontLightPosition=(modelMatrix*lightSpace).xyz;
      `);
      const uniforms=hasWorldPosition?fragment.replace('varying vec3 waterfrontLightPosition;','#define waterfrontLightPosition harborPosition'):fragment;
      shader.fragmentShader=uniforms+shader.fragmentShader.replace('#include <opaque_fragment>',illumination+'\n#include <opaque_fragment>');
    };
    const installed=mat.onBeforeCompile;
    mat.customProgramCacheKey=()=>key+'|street-surface-light-v1';mat.needsUpdate=true;
    restore.push(()=>{if(mat.onBeforeCompile===installed){mat.onBeforeCompile=previous;mat.customProgramCacheKey=cache;mat.needsUpdate=true;}});

  }
  function update(elapsed:number,dusk:number,enabled=true,rain=0){
    const phase=signalAspects(elapsed);night.value=enabled?THREE.MathUtils.smoothstep(dusk,.12,.92):0;
    wet.value=rain;
    main.value.copy(colors[phase[0]]);cross.value.copy(colors[phase[1]]);lenses.update(phase,enabled);
  }
  update(0,0);
  return {update,dispose(){restore.forEach(reset=>reset());field.dispose();},lenses:lenses.mesh};
}
