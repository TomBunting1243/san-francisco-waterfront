import * as THREE from 'three';
import lamps from '../public/data/authored-street-lamps.json' with {type:'json'};

export const approachLampSpacing=2.9,approachLampStart=1.35;

// Only the explicitly tagged wearing surfaces sample this map. The existing
// waterfront atlas still owns fixtures, signals, railside structures and walks.
export function authoredStreetField(){
  const pitch=.48,originX=-125,originZ=-161,width=466,height=342;
  const data=new Uint8Array(width*height);
  const bytes=Uint8Array.from(atob(lamps.coordinates),c=>c.charCodeAt(0)),coords=new DataView(bytes.buffer);
  for(let i=0;i<coords.byteLength;i+=4){
    const cx=(coords.getInt16(i,true)/100-originX)/pitch-.5,cz=(coords.getInt16(i+2,true)/100-originZ)/pitch-.5;
    for(let z=Math.max(0,Math.ceil(cz-5));z<=Math.min(height-1,cz+5);z++){
      for(let x=Math.max(0,Math.ceil(cx-5));x<=Math.min(width-1,cx+5);x++){
        const distance2=((x-cx)**2+(z-cz)**2)*pitch*pitch;
        if(distance2>5.06)continue;
        const beam=(1-distance2/5.06)**2/(1+distance2*.85);
        data[z*width+x]=Math.max(data[z*width+x],Math.round(255*beam));
      }
    }
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RedFormat);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return {texture,bounds:new THREE.Vector4(originX,originZ,width*pitch,height*pitch)};
}
