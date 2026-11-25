import * as THREE from 'three';

export const transitScreenName='Salesforce Transit Center perforated metal awning';
type XY=[number,number];
let sheet:THREE.DataTexture|undefined;
// Intersections of five line grids give the thick and thin rhombs of a
// Penrose tiling. Scale each opening about its centre for 37% open area.
// Bake a small panel once. Mipmapping averages both metal and openings.
function penroseSheet(){
  if(sheet)return sheet;
  const size=128,pixels=new Uint8Array(size*size).fill(248),pitch=14;
  const dirs:XY[]=Array.from({length:5},(_,i)=>[Math.cos(i*2*Math.PI/5),Math.sin(i*2*Math.PI/5)]);
  const phase=[.13,.29,.07,-.19,-.30];
  for(let i=0;i<5;i++)for(let j=i+1;j<5;j++){
    const [a,b]=dirs[i],[c,d]=dirs[j],det=a*d-b*c;
    for(let k=-5;k<=5;k++)for(let l=-5;l<=5;l++){
      const u=k-phase[i],v=l-phase[j],x=(d*u-b*v)/det,y=(a*v-c*u)/det;
      let cx=.5*(a+c),cy=.5*(b+d);
      dirs.forEach(([nx,ny],n)=>{
        const index=n===i?k:n===j?l:Math.ceil(nx*x+ny*y+phase[n]);
        cx+=index*nx;cy+=index*ny;
      });
      cx=size/2+cx*pitch;cy=size/2+cy*pitch;
      const half=Math.sqrt(.37)/2,rx=(Math.abs(a)+Math.abs(c))*pitch*half,ry=(Math.abs(b)+Math.abs(d))*pitch*half;
      for(let row=Math.max(0,Math.floor(cy-ry));row<Math.min(size,Math.ceil(cy+ry));row++){
        for(let col=Math.max(0,Math.floor(cx-rx));col<Math.min(size,Math.ceil(cx+rx));col++){
          const dx=(col+.5-cx)/pitch,dy=(row+.5-cy)/pitch;
          if(Math.abs((d*dx-c*dy)/det)<half&&Math.abs((a*dy-b*dx)/det)<half)pixels[row*size+col]=84;
        }
      }
    }
  }
  // RGBA keeps RGB colour sampling consistent across WebGL and test renderers.
  const rgba=new Uint8Array(size*size*4);
  pixels.forEach((v,i)=>rgba.set([v,v,v,255],4*i));
  sheet=new THREE.DataTexture(rgba,size,size);
  sheet.colorSpace=THREE.SRGBColorSpace;sheet.wrapS=sheet.wrapT=THREE.MirroredRepeatWrapping;
  sheet.minFilter=THREE.LinearMipmapLinearFilter;sheet.magFilter=THREE.LinearFilter;
  sheet.generateMipmaps=true;sheet.anisotropy=4;sheet.needsUpdate=true;
  return sheet;
}
export function transitScreenMaterial(night:{value:number}){
  const map=penroseSheet();
  const mat=new THREE.MeshStandardMaterial({map,vertexColors:true,color:'#f8f7f0',roughness:.64,metalness:.10,side:THREE.DoubleSide});
  mat.onBeforeCompile=s=>{
    s.uniforms.stationNight=night;
    s.vertexShader='varying vec2 stationUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nstationUv=uv;');
    s.fragmentShader='varying vec2 stationUv; uniform float stationNight;\n'+s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float interior=.69+.31*cos(stationUv.x*2.8);
      float cutoff=.55+.45*sin(clamp(stationUv.y/2.7,0.,1.)*3.14159);
      totalEmissiveRadiance+=vec3(.124,.120,.101)*stationNight*interior*cutoff*(.38+.62*sampledDiffuseColor.rgb);
    `);
  };
  mat.customProgramCacheKey=()=>'transit-center-penrose-screen-1';
  return mat;
}
