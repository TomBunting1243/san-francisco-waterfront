import * as THREE from 'three';

// A tile of overlapping, folded leaflets. Red stores opacity-weighted pigment,
// green and blue its two local slopes. Mipmaps average the marks as the tree recedes.
export function leafReliefTile(){
  const size=128,paint=new Float32Array(size*size).fill(.46);
  const coverageMask=new Float32Array(size*size);
  let state=514923;
  function random(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}
  function index(x:number,y:number){return ((y+size)%size)*size+(x+size)%size;}
  function leaflet(cx:number,cy:number,angle:number,length:number,width:number,light:number){
    const cos=Math.cos(angle),sin=Math.sin(angle),reach=Math.ceil(length+2);
    for(let y=Math.floor(cy)-reach;y<=cy+reach;y++)for(let x=Math.floor(cx)-reach;x<=cx+reach;x++){
      const dx=x-cx,dy=y-cy,along=(dx*cos+dy*sin)/length;
      if(Math.abs(along)>=1)continue;
      const cross=(-dx*sin+dy*cos)/width,edge=1-along*along-Math.abs(cross);
      if(edge<=0)continue;
      const coverage=Math.min(1,edge*width),fold=.085*(1-Math.abs(cross))+(cross>0?.055:-.045);
      const i=index(x,y);
      paint[i]+=(light+fold-paint[i])*coverage;
      coverageMask[i]=Math.max(coverageMask[i],coverage);
    }
  }
  for(let i=0;i<109;i++){
    const x=random()*size,y=random()*size,angle=random()*Math.PI*2,light=.16+random()*.43;
    for(let j=0;j<3;j++)for(const side of [-1,1]){
      const turn=angle+side*(.56+random()*.46);
      const along=j*2.7,dx=x+Math.cos(angle)*along,dy=y+Math.sin(angle)*along;
      leaflet(dx+Math.cos(turn)*2.5,dy+Math.sin(turn)*2.5,turn,3+random()*2.8,1.2+random()*1.1,light+j*.022);
    }
  }
  const bytes=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=index(x,y),j=i*4;
    bytes[j]=Math.round(255*paint[i]);
    bytes[j+1]=Math.round(128+120*(paint[index(x+1,y)]-paint[index(x-1,y)]));
    bytes[j+2]=Math.round(128+120*(paint[index(x,y+1)]-paint[index(x,y-1)]));bytes[j+3]=Math.round(255*coverageMask[i]);
  }
  const tile=new THREE.DataTexture(bytes,size,size);
  tile.wrapS=tile.wrapT=THREE.RepeatWrapping;tile.generateMipmaps=true;
  tile.minFilter=THREE.LinearMipmapLinearFilter;tile.magFilter=THREE.LinearFilter;tile.anisotropy=4;tile.needsUpdate=true;
  return tile;
}

// One repeated 3D swatch supplies the hollows between sprays at every viewing angle.
// Each texel stores density and its gradient so lighting requires a single lookup.
function sprayVolume(){
  const size=32,count=size**3,field=new Float32Array(count),rgba=new Uint8Array(count*4);
  const index=(x:number,y:number,z:number)=>((z+size)%size*size+(y+size)%size)*size+(x+size)%size;
  let state=94271;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(const [step,weight] of [[8,.57],[4,.31],[2,.12]]){
    const n=size/step,grid=Float32Array.from({length:n**3},random);
    const sample=(x:number,y:number,z:number)=>grid[(z%n*n+y%n)*n+x%n];
    const fade=(t:number)=>t*t*(3-2*t);
    for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const a=Math.floor(x/step),b=Math.floor(y/step),c=Math.floor(z/step);
      const u=fade(x%step/step),v=fade(y%step/step),w=fade(z%step/step);
      let density=0;
      for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++)
        density+=sample(a+i,b+j,c+k)*(i?u:1-u)*(j?v:1-v)*(k?w:1-w);
      field[index(x,y,z)]+=weight*density;
    }
  }
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=4*index(x,y,z);
    rgba[i]=field[i/4]*255;
    const slope=(v:number)=>Math.round(255*THREE.MathUtils.clamp(.5+v*1.7,0,1));
    rgba[i+1]=slope(field[index(x+1,y,z)]-field[index(x-1,y,z)]);
    rgba[i+2]=slope(field[index(x,y+1,z)]-field[index(x,y-1,z)]);
    rgba[i+3]=slope(field[index(x,y,z+1)]-field[index(x,y,z-1)]);
  }
  const texture=new THREE.Data3DTexture(rgba,size,size,size);
  texture.format=THREE.RGBAFormat;texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;
  texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}

export function createCanopyMaterial(base:THREE.MeshStandardMaterial,sun:{value:THREE.Vector3}){
  const material=base.clone(),tile=leafReliefTile(),sprays=sprayVolume();
  material.alphaToCoverage=true;
  material.addEventListener('dispose',()=>{tile.dispose();sprays.dispose();});
  material.onBeforeCompile=shader=>{
    shader.uniforms.leafPigment={value:tile};shader.uniforms.sprayField={value:sprays};shader.uniforms.leafSun=sun;
    shader.vertexShader='attribute float foliageMask; varying float leafWeight; varying vec3 leafPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nleafPosition=position;leafWeight=foliageMask;');
    shader.fragmentShader='uniform highp sampler3D sprayField; uniform sampler2D leafPigment; uniform vec3 leafSun; varying float leafWeight; varying vec3 leafPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 spraySlope=vec3(0.);
      if(leafWeight>.1){
        vec4 layer=texture(sprayField,leafPosition*4.2);
        float density=layer.r-.50;
        spraySlope=(layer.gba-.5)*step(.8,leafWeight);
        vec3 orientation=abs(inverseTransformDirection(normalize(vNormal),viewMatrix));
        vec2 chart=orientation.y>max(orientation.x,orientation.z)?leafPosition.xz:
          (orientation.x>orientation.z?leafPosition.zy:leafPosition.xy);
        vec4 mark=texture2D(leafPigment,chart*8.7);
        float fiber=mark.r-.46;
        float fold=dot(mark.gb-vec2(.5),leafSun.xz);
        float strength=leafWeight>.8?1.:.28;
        diffuseColor.rgb*=1.+(density*.98+fiber*.65+fold*.55)*strength;
        diffuseColor.rgb*=mix(vec3(.90,1.01,1.06),vec3(1.12,1.02,.94),smoothstep(-.19,.23,density)*strength);
        // Thin the contour only where the drawn leaflets remain at least a pixel across.
        // Coverage is fixed to the crown and filtered by MSAA. The distant skyline stays solid.
        float footprint=max(length(dFdx(chart)),length(dFdy(chart)))*8.7*128.;
        float visibleLeaves=1.-smoothstep(1.8,4.5,footprint);
        float edge=1.-smoothstep(.045,.39,abs(dot(normalize(vNormal),normalize(vViewPosition))));
        float veil=edge*visibleLeaves*step(.8,leafWeight)*.68;
        diffuseColor.a=mix(1.,smoothstep(.13,.65,mark.a+density*.85),veil);
        if(diffuseColor.a<.015)discard;
        diffuseColor.rgb+=vec3(.018,.014,.002)*max(0.,fiber+fold)*strength;
      }`).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      normal=normalize(normal-mat3(viewMatrix)*spraySlope*.86);`).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      #if NUM_HEMI_LIGHTS > 0
        if(leafWeight>.1){
          // Light also passes through a leaf. Let the hemisphere illuminate the undersides
          // of twig fans without spending another light or shadow sample on the crown.
          float lower=1.-smoothstep(-.48,.69,inverseTransformDirection(normal,viewMatrix).y);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*hemisphereLights[0].skyColor*
            vec3(.13,.16,.095)*lower*leafWeight;
        }
      #endif`);
  };
  material.customProgramCacheKey=()=>'waterfront-leaf-relief-v2';
  return material;
}
