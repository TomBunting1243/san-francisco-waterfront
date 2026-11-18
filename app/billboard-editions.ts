import * as THREE from 'three';
import type {ApproachMesh} from './approach-road.ts';

export const extraBillboardAds=['meta','salesforce','microsoft','levis','a16z','apple','google','uber','all-in','datawalk','agentbridge','pencilnoodle','dashview','tbpn','y-combinator'] as const;
export type ExtraBillboardAd=typeof extraBillboardAds[number];
export const billboardCaptions:Record<ExtraBillboardAd,string>={
  meta:'Alluring. Attractive. Always Recording.',
  salesforce:"We don't know what we do either!",
  microsoft:'Home of Copilot!',
  levis:'Proud Mayors of San Francisco',
  a16z:'We are evil and we hate you. Please be nice to us :)',
  apple:'“Not hiring Tom Bunting after six interviews was the biggest mistake we made” — Steve Jobs (parody)',
  google:'Gemini Pro Bard+ with AI Ultra: Experience the new Gemini 4.5 Carbon Dioxide model, exclusively on the new Antigravity G-Suite for Business and Consumers',
  uber:'Oh, not so evil now, huh?',
  'all-in':'All-In Podcast-Branded Whippets',
  datawalk:'The AI powered solution for individual mobility',
  agentbridge:"The stack connecting your agent's context to their agent's context.",
  pencilnoodle:'Agentic intelligence for the classroom, war room, and bathroom',
  dashview:'One dashboard, infinite AI',
  tbpn:"Don't think too hard about it",
  'y-combinator':'14 and have an AI app? Join our child army',
};
export function renderBillboardEdition(id:string,w:number,h:number,group:THREE.Group,mesh:ApproachMesh,portrait=false){
  const index=extraBillboardAds.indexOf(id as ExtraBillboardAd);
  if(index<0)throw new Error('Unknown billboard artwork '+id);
  if(!portrait){
    // The mounted print is the cabinet's front surface. A full metal face
    // directly beneath it competes for the same depth samples at long lenses.
    const cabinet=new THREE.BoxGeometry(w+.009,h+.008,.044);
    const index=cabinet.index!,front=cabinet.groups.find(g=>g.materialIndex===4)!;
    cabinet.setIndex(Array.from(index.array).filter((_,i)=>i<front.start||i>=front.start+front.count));
    cabinet.clearGroups();
    mesh(cabinet,'#4a514d',0,0,0,group).name='Print cabinet sides and rear';
    const rect=(shape:THREE.Path,halfW:number,halfH:number)=>{
      shape.moveTo(-halfW,-halfH);shape.lineTo(halfW,-halfH);shape.lineTo(halfW,halfH);shape.lineTo(-halfW,halfH);shape.closePath();
    };
    const rim=new THREE.Shape(),opening=new THREE.Path();
    rect(rim,(w+.009)/2,(h+.008)/2);rect(opening,w/2,h/2);rim.holes.push(opening);
    mesh(new THREE.ShapeGeometry(rim),'#4a514d',0,0,.022,group).name='Cabinet perimeter lip';
  }
  const art=new THREE.PlaneGeometry(w,h);
  const uv=art.getAttribute('uv');
  // Eight edge-replicated pixels around each panel keep the neighboring ad
  // out of its mip levels. The atlas is shared by all mounts and vignettes.
  const left=(portrait?2736:0)+(index%3)*(portrait?148:912)+8;
  for(let i=0;i<uv.count;i++){
    uv.setXY(i,(left+uv.getX(i)*(portrait?132:896))/3180,1-(Math.floor(index/3)*356+8+(1-uv.getY(i))*340)/1780);
  }
  art.setAttribute('billboardPrint',uv);
  const front=mesh(art,'#ffffff',0,0,portrait?.0004:.022,group);
  front.name=billboardCaptions[id as ExtraBillboardAd];
  return front;
}

let printAtlas:THREE.Texture|undefined;
export function billboardPrintMaterial(){
  if(!printAtlas&&typeof document!=='undefined'){
    printAtlas=new THREE.TextureLoader().load('/billboard-editions.webp',()=>{
      window.dispatchEvent(new Event('waterfront-print-loaded'));
    });
    printAtlas.colorSpace=THREE.SRGBColorSpace;printAtlas.anisotropy=4;
  }
  return new THREE.MeshStandardMaterial({map:printAtlas??null,emissiveMap:printAtlas??null,emissive:'#555451',emissiveIntensity:.37,roughness:.82,vertexColors:true});
}
