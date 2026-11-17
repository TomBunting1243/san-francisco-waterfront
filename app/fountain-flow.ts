import * as THREE from 'three';

type Clock={value:number};
type Outlet={lip:THREE.Vector3;across:THREE.Vector3;travel:THREE.Vector3;width:number};
const outletCount=14;
export const fountainWaterName='Vaillancourt fountain water';

const noise=`
float hash(vec2 p) {
  p=fract(p*vec2(123.23,456.45));
  p+=dot(p,p+45.32);
  return fract(p.x*p.y);
}
float wash(vec2 p) {
  vec2 i=floor(p),f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
             mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);
}
`;
const output=`
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;
const curtainVertex=`
attribute vec4 streamData;
varying vec4 vStream;
void main() {
  vStream=streamData;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;
const curtainFragment=`
uniform float flowTime;
uniform float nightInk;
varying vec4 vStream;
${noise}
void main() {
  float x=vStream.x, y=vStream.y, seed=vStream.z, fall=vStream.w;
  // Drop clusters accelerate and lengthen as they emerge from the concrete lip.
  float t=flowTime*.86;
  float distanceDown=sqrt(y*fall+.032);
  vec2 f=vec2(x*5.2+seed, distanceDown*24.0-t*6.2);
  float shear=wash(vec2(x*2.1+seed,y*7.0-t*2.2));
  float swells=wash(f+vec2(shear*1.65,0.0));
  float streak=wash(vec2(x*18.0+swells*.9+seed*2.2,distanceDown*28.0-t*7.1));
  float droplets=wash(vec2(x*31.0+seed*3.2,distanceDown*95.0-t*14.7));
  float edges=1.0-smoothstep(.78+.15*shear,1.0,abs(x));
  float tongue=smoothstep(.25,.80,swells*.59+streak*.41);
  float glint=smoothstep(.45,.84,streak*.51+droplets*.49);
  float gathering=smoothstep(.84,1.0,y)*shear*.44;
  float alpha=edges*clamp(.10+tongue*.53+glint*.26+gathering, .04,.84);
  alpha*=mix(.78,1.0,smoothstep(.015,.22,y));
  vec3 green=vec3(.27,.45,.43);
  vec3 milk=vec3(.77,.85,.76);
  vec3 color=mix(green,milk,clamp(.37+tongue*.26+glint*.38,0.0,1.0));
  color=mix(color,color*vec3(.43,.59,.70),nightInk*.77);
  gl_FragColor=vec4(color,alpha);
  ${output}
}
`;
const poolVertex=`
varying vec2 vPool;
void main() {
  vPool=position.xz;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;
const poolFragment=`
uniform float flowTime;
uniform float nightInk;
uniform vec4 impacts[${outletCount}];
varying vec2 vPool;
${noise}
void main() {
  float t=flowTime*.72;
  float foam=0.0;
  float disturbed=0.0;
  for(int i=0;i<${outletCount};i++){
    vec4 impact=impacts[i];
    vec2 delta=vPool-impact.xy;
    float radius=length(delta*vec2(.86,1.17));
    float fringe=1.0-smoothstep(impact.z*.29,impact.z*1.42,radius);
    if(fringe<.002)continue;
    float billow=wash(vPool*51.0+vec2(float(i)*12.0,4.0)+vec2(-t*3.1,t*4.2));
    float spray=wash(vPool*157.0+vec2(t*8.3,-t*11.0)+float(i)*5.0);
    float surge=wash(vec2(radius*67.0-t*11.0,billow*3.0+float(i)*3.2));
    float heart=(1.0-smoothstep(.0,impact.z*.66,radius))*.55;
    float foamGrain=smoothstep(.30,.78,billow*.58+spray*.42);
    foam=max(foam,clamp(heart+foamGrain*fringe*(.66+.34*impact.w),0.0,1.0));
    disturbed=max(disturbed,fringe*surge*(.30+billow*.70));
  }
  float broad=wash(vPool*12.0+vec2(t*.23,-t*.36));
  float shimmer=wash((vPool+vec2(broad*.049,broad*.018))*vec2(102.0,55.0)+vec2(-t*2.1,t*3.6));
  float sparkle=smoothstep(.68,.91,shimmer)*(.25+.75*broad);
  vec3 base=mix(vec3(.12,.29,.30),vec3(.37,.54,.49),broad);
  vec3 air=vec3(.79,.85,.74);
  vec3 color=mix(base,air,clamp(foam*.90+disturbed*.26+sparkle*.34,0.0,1.0));
  color=mix(color,color*vec3(.31,.48,.61),nightInk*.76);
  gl_FragColor=vec4(color,clamp(.16+foam*.66+disturbed*.16+sparkle*.12,0.0,.93));
  ${output}
}
`;

/** One sheet group for all outlets, with a single plane for the basin's impact highlights. */
export function createFountainWater(outlets:Outlet[],outline:number[][],height:number,time:Clock,night:Clock){
  const root=new THREE.Group();
  root.name=fountainWaterName;
  const uniformClock={flowTime:time,nightInk:night};
  const xyz:number[]=[], stream:number[]=[], indices:number[]=[];
  const strikes:THREE.Vector4[]=[], ranges:{start:number;count:number}[]=[];
  for(const [i,{lip,travel,across,width}] of outlets.entries()){
    const drop=Math.max(.012,lip.y-height);
    const horizontalReach=.013+Math.sqrt(drop)*.069, seed=(i+1)*13.93;
    const sides=8, rows=Math.max(4,Math.ceil(drop*22));
    const start=xyz.length/3;
    for(let fan=0;fan<2;fan++){
      const axis=across.clone();
      if(fan)axis.multiplyScalar(.42).addScaledVector(travel,.82).normalize();
      const base=xyz.length/3;
      for(let j=0;j<=rows;j++){
        const y=j/rows, offset=horizontalReach*Math.sqrt(y), spread=width*(.90+y*.37)*(fan?.62:1);
        for(let k=0;k<=sides;k++){
          const x=k*2/sides-1;
          const crest=.92+Math.sin(seed+k*2.3+j*1.24)*.065+Math.sin(seed+j*.64)*.12;
          const tuck=.007*(1-y)*Math.sin(x*2.7+seed+y*9.0)+(fan?.006:0);
          const point=lip.clone().addScaledVector(travel,offset+tuck).addScaledVector(axis,x*spread*crest);
          point.y=lip.y-y*drop;
          xyz.push(point.x,point.y,point.z);stream.push(x,y,seed+fan*1.8,drop);
          if(k===sides||j===rows)continue;
          const a=base+j*(sides+1)+k,b=a+sides+1;
          indices.push(a,b,a+1,a+1,b,b+1);
        }
      }
    }
    ranges.push({start,count:xyz.length/3-start});
    strikes.push(new THREE.Vector4(lip.x+travel.x*horizontalReach,lip.z+travel.z*horizontalReach,
      .038+width*.9+Math.sqrt(drop)*.071,Math.min(1,drop+.38)));
  }
  while(strikes.length<outletCount)strikes.push(new THREE.Vector4(0,0,0,0));
  const falling=new THREE.BufferGeometry();
  falling.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  falling.setAttribute('streamData',new THREE.Float32BufferAttribute(stream,4));
  falling.setIndex(indices);
  const curtain=new THREE.Mesh(falling,new THREE.ShaderMaterial({vertexShader:curtainVertex,fragmentShader:curtainFragment,
    uniforms:uniformClock,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true}));
  curtain.name='Fountain spillways';
  curtain.userData.outlets=ranges;
  curtain.renderOrder=4;
  const contour=new THREE.Shape();
  outline.forEach(([x,z],i)=>i===0?contour.moveTo(x,-z):contour.lineTo(x,-z));
  contour.closePath();
  const surface=new THREE.ShapeGeometry(contour);
  surface.rotateX(-Math.PI/2);
  const pool=new THREE.Mesh(surface,new THREE.ShaderMaterial({vertexShader:poolVertex,fragmentShader:poolFragment,
    uniforms:{...uniformClock,impacts:{value:strikes}},transparent:true,depthWrite:false}));
  pool.name='Fountain basin foam and glints';
  pool.position.y=height+.0007;
  pool.renderOrder=3;
  root.add(pool,curtain);
  return root;
}

export function bindFountainWaterClock(mesh:THREE.Mesh,clock:Clock,night:Clock){
  const uniforms=(mesh.material as THREE.ShaderMaterial).uniforms;
  uniforms.flowTime=clock;uniforms.nightInk=night;
}
