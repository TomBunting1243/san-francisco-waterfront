import * as THREE from 'three';
import {authoredStreetField,approachLampStart,approachLampSpacing} from './authored-road-light.ts';
import {bridgeLayout} from './bridge-layout.ts';
import type {FerryWalkPool} from './ferry-walk-lights.ts';
import {terraceFloodAim} from './plaza-street-lights.ts';
import {addMarketPedestrianHousings,appendMarketPedestrianFaces,marketPedestrianHeads} from './market-crossing-signals.ts';
import {addChestnutStandards,chestnutVehicleHeads} from './chestnut-signals.ts';
import {addHowardJunctionStandards,howardVehicleHeads} from './howard-junction-signals.ts';
import {addSpearStandards,spearVehicleHeads} from './spear-signals.ts';
import {signalAspects} from './waterfront-signals.ts';
export {signalAspects} from './waterfront-signals.ts';
import {StreetAssembly} from './street-amenities.ts';

const width=784,coreRows=672,minX=-56,minZ=-64,pitch=.12;
// A narrow extra band in the existing sampler covers the outlying junction.
// Padding separates the two neighborhoods under bilinear filtering.
const northX=78,northZ=-6.5,northRows=42,height=coreRows+2+northRows;
type Axis=0|1;
type MarketMount={offset:number;rise:number;shared:boolean;arm?:boolean};
type Signal={x:number;z:number;y:number;heading:number;axis:Axis;mount?:MarketMount;surveyed?:boolean;section?:'ball'|'left'|'rightYield'};
const fromSouth=-Math.PI/2+.13,fromNorth=Math.PI/2+.13,fromStreet=Math.PI;
// SFMTA 9323000 (NB) and 9323500 (SB) are separate midblock controls.
// Their inventory points identify cabinets, not mounting positions. The shared
// curb standards follow the 2024 city ortho and the side / mast arrangement
// follows the Planning field photo (2014-001363COA, PDF p.26) and the 2026
// Hyatt view by Dllu. Arm reaches and heights are scaled from the photos.
// https://commons.wikimedia.org/wiki/File:Ferry_Building_San_Francisco_from_Hyatt_Regency_with_R-Evolution_and_Bay_Bridge_2026_dllu.jpg
function marketHead(index:number,heading:number,offset:number,arm=false):Signal{
  const {x,y,z}=marketPedestrianHeads[index];
  return {x,y,z,heading,axis:0,mount:{offset,rise:arm?1.38:-.47,shared:true,arm}};
}
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
  ...chestnutVehicleHeads,...spearVehicleHeads,
  marketHead(0,-Math.PI/2,.88),marketHead(1,-Math.PI/2,-.44),
  marketHead(3,-Math.PI/2,-4.9,true),
  marketHead(4,Math.PI/2,-.44),marketHead(5,Math.PI/2,.44),
  // Separate bowed Market-side mast beyond the west crossing, city ortho
  // pixel ~145,649 in the registered crossing crop. Base seated on the final mapped paved surface.
  {x:-1.902,z:-6.098,y:.031,heading:Math.PI/2+.04,axis:0,
    mount:{offset:-5.1,rise:1.38,shared:false,arm:true}},
  ...howardVehicleHeads.filter(h=>h.section!=='rightYield'),
];
// The two permissive arrows have no steady-color spill in the shared RGB
// field. Their flashing amber faces join the same draw as the steady lamps.
const displayedSignals:Signal[]=[...waterfrontSignals,...howardVehicleHeads.filter(h=>h.section==='rightYield')];
function location(head:Signal,x:number,y:number,z:number){
  const s=Math.sin(head.heading),c=Math.cos(head.heading);
  return new THREE.Vector3(head.x+.06*(c*x+s*z),head.y+.06*y,head.z+.06*(-s*x+c*z));
}
const lensY=[4.56,4.19,3.82];
function facePoint(h:Signal,x:number,y:number,z:number){
  return location(h,x+(h.mount?.offset??.46)-.46,y+(h.mount?.rise??0),z);
}
export function signalLensCenter(h:Signal,aspect=1){return facePoint(h,.46,lensY[aspect],.185);}
export function createSignalHousings(){
  const a=new StreetAssembly();
  for(const h of displayedSignals){
    const component=(u:number,y:number,v:number,w:number,d:number,t:number,color:string)=>{
      const p=facePoint(h,u,y,v);const m=a.box(p.x,p.y,p.z,w*.06,d*.06,t*.06,color);
      m.rotation.y=h.heading;
    };
    if(h.mount&&!h.surveyed){
      const {offset,rise,arm,shared}=h.mount;
      const start=shared ? .191 : 0,top=(arm?4.3:4.19+rise)*.06;
      const ink='#426673';
      a.add(new THREE.CylinderGeometry(.0035,shared ? .0035 : .0062,top-start,9),ink,h.x,h.y+(start+top)/2,h.z);
      const strut=(p:THREE.Vector3,q:THREE.Vector3,r:number,t:number)=>{
        const d=q.clone().sub(p),mid=p.clone().lerp(q,.5);
        const rod=a.add(new THREE.CylinderGeometry(t,r,d.length(),8),ink,mid.x,mid.y,mid.z);
        rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
      };
      if(arm){
        const tip=location(h,offset,4.19+rise+.47,0);
        const arc=new THREE.QuadraticBezierCurve3(location(h,0,4.2,0),location(h,offset*.39,6.15,0),tip);
        for(let k=0;k<5;k++)strut(arc.getPoint(k/5),arc.getPoint((k+1)/5),.0040-.00033*k,.00367-.00033*k);
      }else strut(location(h,0,4.19+rise,0),location(h,offset,4.19+rise,.01),.0024,.0024);
    }else if(!h.surveyed){
      component(0,.09,0,.29,.18,.29,'#747f77');
      const pole=a.add(new THREE.CylinderGeometry(.0052,.0069,.286,8),'#778880',h.x,h.y+.143,h.z);pole.castShadow=true;
      component(.24,4.19,.04,.49,.085,.11,'#53635d');
    }
    component(.46,4.19,.06,.46,1.28,.16,'#65594b');
    component(.46,4.19,.155,.385,1.16,.042,'#343e3d');
    for(const y of lensY){
      component(.46,y+.151,.23,.31,.037,.17,'#424a43');
      for(const u of [.317,.603])component(u,y+.102,.23,.027,.10,.17,'#495247');
    }
  }
  addHowardJunctionStandards(a);
  addChestnutStandards(a);
  addSpearStandards(a);
  addMarketPedestrianHousings(a);
  return a.bake('SFMTA signal standards at Howard, Mission, Market, Washington, Chestnut and Spear');
}

export function collectStreetGlobes(root:THREE.Object3D,promenade:number[]){
  const all=promenade.slice(),position=new THREE.Vector3();
  root.traverse(node=>{
    if(node.name==='Path of Gold globe'||node.name==='Ferry forecourt globe'){node.getWorldPosition(position);all.push(position.x,position.y,position.z);}
  });
  return all;
}

export function createStreetField(globes:number[],ferryPools:readonly FerryWalkPool[]=[],shelterPools:readonly FerryWalkPool[]=[]){
  const pixels=new Uint8Array(width*height*4);
  const stamp=(x:number,y:number,z:number,r:number,channel:number,heading?:number,plaza=false,strength=1)=>{
    const north=x>=northX;
    const first=north?coreRows+2:0,last=north?height-1:coreRows-1;
    const col=(x-(north?northX:minX))/pitch-.5,row=first+(z-(north?northZ:minZ))/pitch-.5,bound=r/pitch;
    for(let j=Math.max(first,Math.ceil(row-bound));j<=Math.min(last,Math.floor(row+bound));j++){
      for(let i=Math.max(0,Math.ceil(col-bound));i<=Math.min(width-1,Math.floor(col+bound));i++){
        const dx=(i-col)*pitch,dz=(j-row)*pitch,d=Math.hypot(dx,dz)/r;
        if(d>=1)continue;
        const aim=heading===undefined?1:.45+.55*THREE.MathUtils.clamp(.5+(dx*Math.sin(heading)+dz*Math.cos(heading))/r,0,1);
        const idx=(j*width+i)*4;
        if(plaza){
          // Blend the contributions from adjacent heads into the existing
          // single texture. A soft shoulder preserves the pedestrian-scale
          // pool between standards without lighting the whole neighborhood.
          const shoulder=Math.max(0,d*r-.085)/(r*.29);
          const edge=1-THREE.MathUtils.smoothstep(d,.57,1);
          const beam=heading===undefined||d*r<.09?1:.08+.92*THREE.MathUtils.smoothstep((dx*Math.sin(heading)+dz*Math.cos(heading))/(d*r),-.6,.8);
          const weight=strength*beam*edge/(1+shoulder*shoulder);
          const intensity=idx+channel,sourceHeight=idx+(channel===2?1:3);
          const old=pixels[intensity],add=Math.round((255-old)*weight);
          if(!add)continue;
          pixels[intensity]=old+add;
          pixels[sourceHeight]=Math.round((pixels[sourceHeight]*old+255*Math.min(1,Math.max(0,y))*add)/(old+add));
        }else{
          const pool=Math.min(1,(1-d)/(1-.085/r));
          const weight=Math.round(255*(channel===0?pool**2.2:(1-d*d)**3)*aim);
          if(weight<=pixels[idx+channel])continue;
          pixels[idx+channel]=weight;
          if(channel===0)pixels[idx+3]=Math.round(255*THREE.MathUtils.clamp(y,0,1));
        }
      }
    }
  };
  for(let i=0;i<globes.length;i+=3){
    const [x,y,z]=[globes[i],globes[i+1],globes[i+2]];
    // The Ferry/Market boulevard, public plazas, and adjacent park streets.
    // Beyond the Mission/Washington frontage keep the established pool profile.
    const plaza=x>=-13&&x<=15&&z< -1.65&&z>=-16;
    stamp(x,y,z,plaza?Math.min(3.7,y*6.1):Math.min(1.2,y*3.25),0,plaza?terraceFloodAim(x,y,z):undefined,plaza);
  }
  for(const {x,y,z,radius,strength} of ferryPools)stamp(x,y,z,radius,0,undefined,true,strength);
  for(const h of waterfrontSignals){
    const p=signalLensCenter(h);stamp(p.x,p.y,p.z,.42,1+h.axis,h.heading);
  }
  // Steuart's shelter pads are outside the signal footprints. Reuse their two
  // empty channels locally: this preserves the boulevard spill above the roof
  // and lets the white shelter lamps cut off separately at their own height.
  for(const {x,y,z,radius,strength} of shelterPools)stamp(x,y,z,radius,2,undefined,true,strength);
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  return texture;
}

const colors=[new THREE.Color('#ff4938'),new THREE.Color('#ffc444'),new THREE.Color('#65d98e')];
const dark=['#4c332f','#484234','#304840'].map(c=>new THREE.Color(c));
function signalLenses(){
  const pos:number[]=[],indices:number[]=[],tints:number[]=[];
  const sections:{head:Signal;aspect:number;start:number;end:number}[]=[];
  for(const h of displayedSignals)for(const [i,y] of lensY.entries()){
    const base=pos.length/3;
    const arrow=h.section==='left'||(h.section==='rightYield'&&i===2);
    if(arrow){
      const sign=h.section==='left'?-1:1;
      const shape=[[.145,0],[.019,.115],[.019,.044],[-.139,.044],[-.139,-.044],[.019,-.044],[.019,-.115]]
        .map(([x,v])=>new THREE.Vector2(sign*x,v));
      for(const p of shape){pos.push(...facePoint(h,.46+p.x,y+p.y,.185).toArray());tints.push(0,0,0);}
      for(const tri of THREE.ShapeUtils.triangulateShape(shape,[]))indices.push(...tri.map(k=>base+k));
    }else{
      for(let j=0;j<=10;j++){
        const a=j*2*Math.PI/10,r=j===10?0:.144;
        pos.push(...facePoint(h,.46+r*Math.cos(a),y+r*Math.sin(a),.185).toArray());tints.push(0,0,0);
      }
      for(let j=0;j<10;j++)indices.push(base+10,base+j,base+(j+1)%10);
    }
    sections.push({head:h,aspect:i,start:base,end:pos.length/3});
  }
  const updatePedestrians=appendMarketPedestrianFaces(pos,indices,tints);
  const geo=new THREE.BufferGeometry();geo.setIndex(indices);geo.index!.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const color=new THREE.Float32BufferAttribute(tints,3).setUsage(THREE.DynamicDrawUsage);geo.setAttribute('color',color);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}));
  mesh.name='Operating SFMTA signal lenses';
  let previous=-1;
  function update(aspects:[number,number],enabled:boolean,elapsed:number){
    updatePedestrians(geo.index!,elapsed,enabled);
    const rightFlash=aspects[1]===2&&THREE.MathUtils.euclideanModulo(elapsed,1)<.5;
    const key=enabled?2*(aspects[0]*3+aspects[1])+Number(rightFlash):18;
    if(key===previous)return;
    const flashOnly=(key>>1)===(previous>>1);previous=key;
    if(!flashOnly){
      color.clearUpdateRanges();color.addUpdateRange(0,sections[sections.length-1].end*3);
    }
    for(const {head,aspect,start,end} of sections){
      const permissive=head.section==='rightYield'&&aspect===2;
      if(flashOnly&&!permissive)continue;
      const lit=enabled&&aspects[head.axis]===aspect&&(!permissive||rightFlash);
      const c=(lit?colors:dark)[permissive?1:aspect];
      for(let j=start;j<end;j++)color.setXYZ(j,c.r,c.g,c.b);
      if(flashOnly&&!color.updateRanges.some(r=>r.start<=start*3&&r.start+r.count>=end*3))
        color.addUpdateRange(start*3,(end-start)*3);
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
    bool north=waterfrontLightPosition.x>=${northX.toFixed(1)};
    vec2 fieldPoint=waterfrontLightPosition.xz-(north?vec2(${northX.toFixed(1)},${northZ.toFixed(1)}):vec2(-56.,-64.));
    if(all(greaterThan(fieldPoint,vec2(0.))) && fieldPoint.x<${(width*pitch).toFixed(2)} && fieldPoint.y<(north?${(northRows*pitch).toFixed(2)}:${(coreRows*pitch).toFixed(2)})){
      vec2 streetUv=(fieldPoint+vec2(0.,north?${((coreRows+2)*pitch).toFixed(2)}:0.))/vec2(${(width*pitch).toFixed(2)},${(height*pitch).toFixed(2)});
      vec4 field=texture2D(waterfrontStreetField,streetUv);
      float lampZ=1.-smoothstep(max(.08,field.a*.84),field.a+.28,waterfrontLightPosition.y);
      // Shielded waterfront luminaires illuminate the walk beneath the lens.
      // Keep the corrugated top sheets of the waiting sheds and floats in shadow.
      if(waterfrontLightPosition.z>1.41 && waterfrontLightPosition.x>-16. && waterfrontLightPosition.x<6.7)
        lampZ=1.-smoothstep(max(.01,field.a-.045),field.a+.001,waterfrontLightPosition.y);
      float signalZ=1.-smoothstep(.24,.45,waterfrontLightPosition.y);
      float normalY=inverseTransformDirection(normal,viewMatrix).y;
      float facing=smoothstep(-.72,-.05,normalY)*(.47+.53*max(normalY,0.));
      vec3 shelterSpill=vec3(0.);
      if(waterfrontLightPosition.z> -9.4 && waterfrontLightPosition.z< -8.0 &&
         waterfrontLightPosition.x> -13.1 && waterfrontLightPosition.x< -2.4){
        float belowRoof=1.-smoothstep(field.g-.045,field.g+.001,waterfrontLightPosition.y);
        shelterSpill=vec3(.90,.85,.73)*field.b*belowRoof;
        field.gb=vec2(0.);
      }
      vec3 spill=shelterSpill+vec3(1.,.4564,.1119)*field.r*lampZ*.82+
        (waterfrontMainSignal*field.g+waterfrontCrossSignal*field.b)*signalZ*.34;
      outgoingLight+=waterfrontStreetNight*facing*(.015+.85*diffuseColor.rgb)*spill;
      if(waterfrontStreetWet>.01 && normalY>.75){
        float grazing=1.-max(0.,dot(normal,normalize(vViewPosition)));
        outgoingLight+=waterfrontStreetNight*waterfrontStreetWet*spill*grazing*grazing*.08;
      }
    }
  }
`;

// One road-only attribute survives the rigid bake. 1/2 identify municipal
// pavement and alleys, 3/4 the west bridge levels; approach values above
// 100 encode distance along the actual curved carriageway at .02-unit steps.
const roadIllumination=`
  if(waterfrontStreetNight>.001 && civilRoad>.5){
    float flux=0.;
    if(civilRoad<2.5){
      vec2 uv=(waterfrontLightPosition.xz-measuredRoadBounds.xy)/measuredRoadBounds.zw;
      float measured=all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))?texture2D(measuredRoadField,uv).r:0.;
      flux=civilRoad<1.5?.14+.65*measured:.065+.42*measured;
    }else if(civilRoad<4.5){
      vec2 offset=waterfrontLightPosition.xz-vec2(${bridgeLayout.origin.join(',')});
      float along=dot(offset,vec2(${Math.sin(bridgeLayout.angle)},${Math.cos(bridgeLayout.angle)}));
      float across=dot(offset,vec2(${Math.cos(bridgeLayout.angle)},${-Math.sin(bridgeLayout.angle)}));
      float index=floor((along-1.2)/2.45+.5);
      float dz=along-(1.2+2.45*index),dx=across-mix(-.47,.47,mod(index,2.));
      flux=civilRoad<3.5?.23+.58/(1.+2.*dz*dz+2.*dx*dx):.21+.26/(1.+2.*dz*dz);
    }else if(civilRoad>=99.){
      float station=(civilRoad-100.)/50.;
      float delta=(fract((station-${approachLampStart})/${approachLampSpacing}+.5)-.5)*${approachLampSpacing};
      flux=.21+.46/(1.+2.2*delta*delta);
    }
    // The same SFPUC pole may already have a detailed fixture. Only make
    // up the difference below that source, never add a second pool over it.
    outgoingLight+=waterfrontStreetNight*(.035+.86*diffuseColor.rgb)*vec3(1.,.73,.45)*max(0.,flux-existingRoadLamp);
  }
`;

// Match the cab's 5.4-unit, .35-radian spotlight with 78% penumbra
// and zero decay. Evaluate the same Three material response without changing
// the scene's light count when a driver enters or leaves a ride.
const cabColor=new THREE.Color('#fff0cf');
const cabUniforms='uniform vec3 cabLampPosition; uniform vec3 cabLampDirection; uniform float cabLampIntensity;\n';
const cabIllumination=`
  if(cabLampIntensity>.08){
    vec3 lampToSurface=waterfrontLightPosition-cabLampPosition;
    float distance2=dot(lampToSurface,lampToSurface);
    if(distance2<5.4*5.4 && distance2>.0000001){
      float distanceToCab=sqrt(distance2);
      vec3 ray=lampToSurface/distanceToCab;
      float cone=getSpotAttenuation(${Math.cos(.35).toFixed(9)},${Math.cos(.35*(1-.78)).toFixed(9)},dot(ray,cabLampDirection));
      if(cone>0.){
        IncidentLight cab;
        cab.visible=true;
        cab.direction=-(mat3(viewMatrix)*ray);
        cab.color=vec3(${cabColor.toArray().map(v=>v.toFixed(8)).join(',')})*cabLampIntensity*cone*getDistanceAttenuation(distanceToCab,5.4,0.);
        RE_Direct(cab,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
      }
    }
  }
`;

/** One field lookup for nearby opaque surfaces. The same shader evaluates
 * current instance/batch coordinates for moving coats, cars and the tram. */
export function createStreetIllumination(root:THREE.Group,globes:number[],water:THREE.Material,enableRides=false){
  const field=createStreetField(globes,root.userData.ferryWalkPools,root.userData.shelterPools),night={value:0},wet={value:0},main={value:new THREE.Color()},cross={value:new THREE.Color()};
  const cabPosition={value:new THREE.Vector3()},cabDirection={value:new THREE.Vector3(0,0,-1)},cabIntensity={value:0};
  const lenses=signalLenses();root.add(lenses.mesh);
  const materials=new Set<THREE.MeshStandardMaterial>(),roadMaterials=new Set<THREE.Material>();
  root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])
    if(m instanceof THREE.MeshStandardMaterial&&!m.transparent&&m!==water&&m.colorWrite){materials.add(m);if(o.geometry.hasAttribute('roadExposure'))roadMaterials.add(m);}});
  const roads=roadMaterials.size?authoredStreetField():undefined;
  const restore:Array<()=>void>=[];
  for(const mat of materials){
    const previous=mat.onBeforeCompile,cache=mat.customProgramCacheKey,key=cache.call(mat);
    mat.onBeforeCompile=(shader:Shader,renderer)=>{
      previous.call(mat,shader,renderer);
      Object.assign(shader.uniforms,{waterfrontStreetField:{value:field},waterfrontStreetNight:night,waterfrontStreetWet:wet,waterfrontMainSignal:main,waterfrontCrossSignal:cross});
      if(!shader.fragmentShader.includes(marker)&&(!shader.vertexShader.includes('#include <project_vertex>')||!shader.fragmentShader.includes('#include <opaque_fragment>')))return;
      if(enableRides||shader.fragmentShader.includes(cabUniforms)){
        Object.assign(shader.uniforms,{cabLampPosition:cabPosition,cabLampDirection:cabDirection,cabLampIntensity:cabIntensity});
      }
      if(enableRides&&!shader.fragmentShader.includes(cabUniforms)){
        shader.fragmentShader=cabUniforms+shader.fragmentShader.replace('#include <lights_fragment_begin>',
          '#include <lights_fragment_begin>\n'+cabIllumination);
      }
      if(shader.fragmentShader.includes(marker))return;
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
      let surfaceLight=illumination;
      if(roads&&roadMaterials.has(mat)){
        shader.uniforms.measuredRoadBounds={value:roads.bounds};shader.uniforms.measuredRoadField={value:roads.texture};
        shader.vertexShader='attribute float roadExposure; varying float civilRoad;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncivilRoad=roadExposure;');
        shader.fragmentShader='varying float civilRoad; uniform vec4 measuredRoadBounds; uniform sampler2D measuredRoadField;\n'+shader.fragmentShader;
        surfaceLight='float existingRoadLamp=0.;\n'+illumination.replace('vec3 spill=shelterSpill','existingRoadLamp=field.r*lampZ*.82;\n      vec3 spill=shelterSpill')+roadIllumination;
      }
      shader.fragmentShader=uniforms+shader.fragmentShader.replace('#include <opaque_fragment>',surfaceLight+'\n#include <opaque_fragment>');
    };
    const installed=mat.onBeforeCompile;
    mat.customProgramCacheKey=()=>key+(roadMaterials.has(mat)?'|authored-road-v1':'')+(enableRides?'|street-surface-cab-v1':'|street-surface-light-v1');mat.needsUpdate=true;
    restore.push(()=>{if(mat.onBeforeCompile===installed){mat.onBeforeCompile=previous;mat.customProgramCacheKey=cache;mat.needsUpdate=true;}});

  }
  function update(elapsed:number,dusk:number,enabled=true,rain=0){
    const phase=signalAspects(elapsed);night.value=enabled?THREE.MathUtils.smoothstep(dusk,.12,.92):0;
    wet.value=rain;
    main.value.copy(colors[phase[0]]);cross.value.copy(colors[phase[1]]);lenses.update(phase,enabled,elapsed);
  }
  update(0,0);
  function setCabLamp(position:THREE.Vector3,direction:THREE.Vector3,intensity:number){
    if(!enableRides)return;
    cabIntensity.value=intensity;
    if(intensity>.08){cabPosition.value.copy(position);cabDirection.value.copy(direction).normalize();}
  }
  return {update,setCabLamp,dispose(){restore.forEach(reset=>reset());field.dispose();roads?.texture.dispose();},lenses:lenses.mesh};
}
