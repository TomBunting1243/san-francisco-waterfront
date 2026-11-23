import * as THREE from 'three';
import paint from '../public/data/promenade-crossings.json' with {type:'json'};
import {streetPose} from './streets.ts';

export const promenadeCrossings=paint.crossings;
type Surface=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
export function addPromenadeCrossings(mesh:Surface){
  const tiles=new Map<number,number[]>();
  const tones=new Map<number,number[]>();
  for(const [leg,crossing] of promenadeCrossings.entries())for(const triangle of crossing){
    const [a,b,c]=triangle,tile=Math.floor(a[0]/12);
    let vertices=tiles.get(tile);if(!vertices)tiles.set(tile,vertices=[]);
    const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
    let colors=tones.get(tile);if(!colors)tones.set(tile,colors=[]);
    for(const [x,z,y] of up>=0?[a,b,c]:[a,c,b]){
      vertices.push(x,y,z);
      // Faded off-white thermoplastic. Broad variation survives minification;
      // the two interruptions visible in the aerial are cuts in the paint itself.
      const fade=leg<paint.marketStart?1:.943+.038*Math.sin(7*z+1.4*x)+.016*Math.sin(4*x-11*z);
      colors.push(fade,fade,fade);
    }
  }
  for(const [tile,vertices] of tiles){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    g.setAttribute('color',new THREE.Float32BufferAttribute(tones.get(tile)!,3));g.userData.paintVertices=true;
    g.userData.roadPaint='Waterfront crossings';
    const mark=mesh(g,'#e1ddcd',0,0,0);mark.userData.roadExposure=1;mark.name='Embarcadero crosswalk paint '+tile;
  }
}

// Scoring runs with each block's waterfront edge. The texture uses derivatives
// to let joints disappear smoothly before they become smaller than a pixel.
export function walkPanelCoordinates(g:THREE.BufferGeometry){
  const points=g.attributes.position,uv=[];
  const roadEdge=new Map<number,number>();
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i),station=Math.round(x*1000)/1000;
    let edge=roadEdge.get(station);
    if(edge===undefined){edge=streetPose(station,1).z;roadEdge.set(station,edge);}
    uv.push(x/.128,(z-edge)/.105);
  }
  g.setAttribute('walkPanel',new THREE.Float32BufferAttribute(uv,2));
}
export function applyWalkPanelJoints(mat:THREE.MeshStandardMaterial){
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 walkPanel; varying vec2 panelCoord;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npanelCoord=walkPanel;');
    shader.fragmentShader='varying vec2 panelCoord;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 pix=max(fwidth(panelCoord),vec2(.0001));
      vec2 distanceToJoint=abs(fract(panelCoord+.5)-.5);
      vec2 joint=(1.-smoothstep(vec2(.004),vec2(.008)+pix*.58,distanceToJoint))*clamp(.012/pix,0.,1.);
      float nearView=1.-smoothstep(.12,.56,max(pix.x,pix.y));
      vec2 cell=floor(panelCoord);
      float aggregate=fract(sin(dot(cell,vec2(61.73,27.17)))*1359.72);
      diffuseColor.rgb*=1.+nearView*((aggregate-.5)*.055-.44*max(joint.x,joint.y));`);
  };
  mat.customProgramCacheKey=()=>'scored-promenade-concrete-v1';
}
