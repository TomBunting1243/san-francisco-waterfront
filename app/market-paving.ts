import {stationPavingCut} from './embarcadero-station-sites.ts';
import {ferryRefugePaving,marketAxis,medianGrade,medianPaving,medianSlab,westCityLanding,westMarketGround} from './curb-survey.ts';
import {frostBrickTriangles,frostWalkHeight} from './california-sidewalk.ts';
import * as THREE from 'three';

/** Market's pedestrian axis continues through two plazas, with a street crossing between them.
 * The city's Better Market Street survey describes alternating granite bands and herringbone brick. */
export function createMarketPaving(){
  const positions:number[]=[],surface:number[]=[],indices:number[]=[];
  function paint(t:number[][],grade:(x:number,z:number)=>number,field:'promenade'|'brick'|'island'='promenade',lift=.00035){
    const n=positions.length/3;
    const [a,b,c]=t;
    for(const [x,z] of t){
      positions.push(x,grade(x,z)+lift,z);
      if(field==='island')surface.push(x,z);
      else surface.push(field==='brick'?8+x:x-marketAxis(z),-z);
    }
    const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
    indices.push(n,n+(up>0?1:2),n+(up>0?2:1));
  }
  for(const t of frostBrickTriangles){
    for(const tri of stationPavingCut(t[0],t[1],t[2])??[t])paint(tri,frostWalkHeight,'brick');
  }
  for(const tri of medianPaving)paint(tri,medianGrade,'island');
  for(const tri of medianSlab)paint(tri,medianGrade,'island',0);
  // The Ferry refuge uses the physical curb aprons directly. Its low lips,
  // slopes and landing meet edge to edge without a second paving skin.
  for(const tri of ferryRefugePaving){
    const n=positions.length/3,[a,b,c]=tri;
    for(const [x,y,z] of tri){positions.push(x,y,z);surface.push(x,z-8);}
    const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    indices.push(n,n+(up>0?1:2),n+(up>0?2:1));
  }
  // First five rows meet the surveyed city landing. Their remaining
  // granite triangles share the exact boundary and elevations of the apron.
  for(const tri of [...westCityLanding.walk,...westCityLanding.remainder]){
    const n=positions.length/3,[a,b,c]=tri;
    for(const [x,y,z] of tri){positions.push(x,y,z);surface.push(x-marketAxis(z),-z);}
    const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    indices.push(n,n+(up>0?1:2),n+(up>0?2:1));
  }
  for(let i=5;i<32;i++){
    const z=-6.249-i*2.817/32,next=-6.249-(i+1)*2.817/32;
    const a=[marketAxis(z)-.92,z],b=[marketAxis(z)+.92,z],c=[marketAxis(next)-.92,next],d=[marketAxis(next)+.92,next];
    paint([a,b,c],westMarketGround);paint([b,d,c],westMarketGround);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(surface,2));geo.setIndex(indices);geo.computeVertexNormals();
  // The island slabs end at the physical curb shoulders. Retain the existing
  // material depth bias at the joins with the surrounding approach pavement.
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.93,polygonOffset:true,polygonOffsetUnits:1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 marketPaving;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nmarketPaving=uv;');
    shader.fragmentShader='varying vec2 marketPaving;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=marketPaving;
      // Signed UV charts keep individual cuts on their surveyed grade. SF's 2024
      // 8 cm ortho shows broad bands down the island, turned at the refuge.
      bool island=p.y<0.,refuge=p.y< -8.;
      if(refuge)p.y+=8.;
      float along=island&&!refuge?p.x-1.40:p.y;
      float period=island?(refuge?.128:.525):.257;
      float phase=along/period;
      float footprint=max(fwidth(phase),.00001);
      // Integrate a half-duty stone band over the pixel, including its wrap edge.
      vec2 bounds=phase+vec2(-.5,.5)*footprint;
      vec2 integral=.5*floor(bounds)+min(fract(bounds),.5);
      float lightBand=clamp((integral.y-integral.x)/footprint,0.,1.);
      if(!island)lightBand=1.-lightBand;
      vec3 granite=mix(vec3(.285,.293,.287),vec3(.50,.505,.48),lightBand);
      vec2 stone=vec2(island&&!refuge?p.y:p.x,along);
      vec2 size=vec2(island?.135:.16,period*.5);
      vec2 slab=fract(stone/size+vec2(.5*mod(floor(along/size.y),2.),0.));
      vec2 lineWidth=min(slab,1.-slab)*size;
      vec2 pixel=max(fwidth(stone),vec2(.0001));
      vec2 joint=(1.-smoothstep(vec2(.00025),vec2(.00075)+.5*pixel,lineWidth))
        *min(vec2(1.),vec2(.001)/pixel);
      granite*=1.-.13*max(joint.x,joint.y);
      if(island){
        diffuseColor.rgb=granite;
      }else{
        float border=abs(p.x)-.465;
        vec2 q=mat2(.7071,.7071,-.7071,.7071)*p/.0065,cell=floor(q),f=fract(q);
        float lane=mod(cell.x-cell.y,4.);
        vec2 brick=lane<2.?vec2((f.x+lane)*.5,f.y):vec2(f.x,(f.y+3.-lane)*.5);
        vec2 seams=min(brick,1.-brick);
        float lod=1.-smoothstep(.13,.90,max(fwidth(q.x),fwidth(q.y)));
        float grout=(1.-smoothstep(.015,.085,min(seams.x,seams.y)))*lod;
        // Each two-cell paver has one pigment. The broad kiln variation survives
        // at the car-stop scale; individual bricks and mortar fade below a pixel.
        vec2 brickOrigin=cell-(lane<2.?vec2(lane,0.):vec2(0.,3.-lane));
        vec3 hash=fract(vec3(brickOrigin.xyx)*vec3(.1031,.1073,.0973));
        hash+=dot(hash,hash.yzx+33.33);
        float fired=fract((hash.x+hash.y)*hash.z)-.5;
        float wash=sin(8.4*p.x+3.9*p.y+.75*sin(2.3*p.y))*sin(5.6*p.y-4.7*p.x);
        vec3 terracotta=vec3(.325,.192,.144)+vec3(.072,.043,.031)*fired*lod
          +vec3(.010,.006,.002)*wash;
        vec3 clay=mix(terracotta,vec3(.397,.309,.237),grout);
        diffuseColor.rgb=mix(granite,clay,smoothstep(-.006,.006,border));
      }`);
  };
  const mesh=new THREE.Mesh(geo,material);mesh.name='Market granite and herringbone promenade';mesh.receiveShadow=true;return mesh;
}
