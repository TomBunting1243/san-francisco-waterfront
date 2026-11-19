import * as THREE from 'three';
import type {ApproachMesh} from './approach-road.ts';

export const kioskCampaignIds=['sf-welcome','discovery-kingdom','visit-oakland','uc-berkeley','dataworks-io','la-corneta','crossroads-cafe'] as const;
const printOrder:readonly string[]=[...kioskCampaignIds,'yahoo','coke','anthropic','spacex','palantir','civic'];
const columns=5,rows=3,width=264,height=680,gutter=8;
export function renderKioskCampaign(id:string,w:number,h:number,group:THREE.Group,mesh:ApproachMesh){
  const i=printOrder.indexOf(id);
  if(i<0)throw new Error('Unknown kiosk campaign '+id);
  const shape=new THREE.PlaneGeometry(w,h),uv=shape.getAttribute('uv');
  const cellW=width+2*gutter,cellH=height+2*gutter;
  const x=i%columns*cellW+gutter,y=Math.floor(i/columns)*cellH+gutter;
  for(let j=0;j<uv.count;j++){
    uv.setXY(j,(x+uv.getX(j)*width)/(cellW*columns),1-(y+(1-uv.getY(j))*height)/(cellH*rows));
  }
  shape.setAttribute('kioskPrint',uv);
  const face=mesh(shape,'#ffffff',0,0,0,group);
  face.name=id+' kiosk poster';
  return face;
}

let atlas:THREE.Texture|undefined;
export function kioskCampaignMaterial(){
  if(!atlas&&typeof document!=='undefined'){
    atlas=new THREE.TextureLoader().load('/kiosk-campaigns.webp',()=>window.dispatchEvent(new Event('waterfront-print-loaded')));
    atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;
  }
  return new THREE.MeshStandardMaterial({map:atlas??null,emissiveMap:atlas??null,emissive:'#555451',emissiveIntensity:.37,roughness:.82,vertexColors:true});
}
