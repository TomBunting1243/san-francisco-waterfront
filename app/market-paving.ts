import {marketAxis,medianGrade,medianPaving,westMarketGround} from './curb-survey.ts';
import * as THREE from 'three';

/** Market's pedestrian axis continues through two plazas, with a street crossing between them.
 * The city's Better Market Street survey describes alternating granite bands and herringbone brick. */
export function createMarketPaving(){
  const positions:number[]=[],surface:number[]=[],indices:number[]=[];
  function paint(t:number[][],grade:(x:number,z:number)=>number){
    const n=positions.length/3;
    const [a,b,c]=t;
    for(const [x,z] of t){positions.push(x,grade(x,z)+.00035,z);surface.push(x-marketAxis(z),-z);}
    const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
    indices.push(n,n+(up>0?1:2),n+(up>0?2:1));
  }
  for(const tri of medianPaving)paint(tri,medianGrade);
  for(let i=0;i<32;i++){
    const z=-6.249-i*2.817/32,next=-6.249-(i+1)*2.817/32;
    const a=[marketAxis(z)-.92,z],b=[marketAxis(z)+.92,z],c=[marketAxis(next)-.92,next],d=[marketAxis(next)+.92,next];
    paint([a,b,c],westMarketGround);paint([b,d,c],westMarketGround);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(surface,2));geo.setIndex(indices);geo.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.93});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 marketPaving;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nmarketPaving=uv;');
    shader.fragmentShader='varying vec2 marketPaving;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=marketPaving;
      float border=abs(p.x)-.465;
      float lightBand=smoothstep(.46,.54,fract(p.y/.257));
      vec3 granite=mix(vec3(.285,.293,.287),vec3(.50,.505,.48),lightBand);
      vec2 slab=fract(vec2(p.x/.16+floor(p.y/.1285)*.5,p.y/.1285));
      vec2 lineWidth=min(slab,1.-slab)*vec2(.16,.1285);
      float joint=1.-smoothstep(.0004,.0009+fwidth(p.x),min(lineWidth.x,lineWidth.y));
      granite*=1.-joint*.15;
      vec2 q=mat2(.7071,.7071,-.7071,.7071)*p/.0065,cell=floor(q),f=fract(q);
      float lane=mod(cell.x-cell.y,4.);
      vec2 brick=lane<2.?vec2((f.x+lane)*.5,f.y):vec2(f.x,(f.y+3.-lane)*.5);
      vec2 seams=min(brick,1.-brick);
      float lod=1.-smoothstep(.13,.90,max(fwidth(q.x),fwidth(q.y)));
      float grout=(1.-smoothstep(.015,.085,min(seams.x,seams.y)))*lod;
      vec3 clay=mix(vec3(.325,.192,.144),vec3(.397,.309,.237),grout);
      diffuseColor.rgb=mix(granite,clay,smoothstep(-.006,.006,border));`);
  };
  const mesh=new THREE.Mesh(geo,material);mesh.name='Market granite and herringbone promenade';mesh.receiveShadow=true;return mesh;
}
