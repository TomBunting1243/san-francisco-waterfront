import {harborDatum,waterSurface} from './water-surface.ts';
import * as THREE from 'three';
import data from '../public/data/survey-shore.json' with {type:'json'};

type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type Polygon=number[][][];
type CoastalCell=[number,Polygon[],Polygon[]];
const masks=new Map(Object.entries(data.tidalVertices).map(([key,indices])=>[key,new Set(indices)]));
const cuts=new Map(Object.entries(data.coastalCells).map(([key,cells])=>[key,
  new Map((cells as CoastalCell[]).map(([index,lower,upper])=>[index,[lower,upper] as const]))]));

export function isTidalVertex(grid:string,index:number){
  return masks.get(grid)?.has(index)??false;
}
export function surveyedCoastalCells(grid:string){
  return cuts.get(grid);
}

function shape(rings:number[][][]){
  const ring=(points:number[][])=>points.map(([x,z])=>new THREE.Vector2(x,-z));
  const outline=new THREE.Shape(ring(rings[0]));
  outline.holes=rings.slice(1).map(hole=>new THREE.Path(ring(hole)));
  return outline;
}

export function addSurveyShore(mesh:Surface,bankHeight:(x:number,z:number)=>number){
  // The clipped relief owns the surface of the mainland. Only the vertical
  // bank face, coping and individually supported aprons are built here.
  const vertices:number[]=[];
  const bottom=waterSurface.level-.42;
  for(const [[ax,az],[bx,bz]] of data.bankEdges){
    const steps=Math.ceil(Math.hypot(bx-ax,bz-az)/.45);
    for(let i=0;i<steps;i++){
      const t=i/steps,u=(i+1)/steps;
      const a=[THREE.MathUtils.lerp(ax,bx,t),THREE.MathUtils.lerp(az,bz,t)];
      const b=[THREE.MathUtils.lerp(ax,bx,u),THREE.MathUtils.lerp(az,bz,u)];
      const y1=bankHeight(a[0],a[1]),y2=bankHeight(b[0],b[1]);
      vertices.push(a[0],bottom,a[1],b[0],bottom,b[1],b[0],y2,b[1],a[0],bottom,a[1],b[0],y2,b[1],a[0],y1,a[1]);
    }
  }
  const bank=new THREE.BufferGeometry();
  bank.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  bank.computeVertexNormals();
  mesh(bank,'#89958b',0,0,0).name='Surveyed mainland retaining faces';
  // Carry the OSM park paving down to its surveyed wall with the same finished
  // level used by the raised lawn and the accessible promenade.
  for(const rings of data.rincon){
    const geometry=new THREE.ExtrudeGeometry(shape(rings),{depth:.122,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    mesh(geometry,'#c2bfa8',0,-.012,0).name='Rincon Park terrace';
  }
  for(const rings of data.caps){
    const geometry=new THREE.ExtrudeGeometry(shape(rings),{depth:.034,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    mesh(geometry,'#c3c0ae',0,-.012,0).name='Surveyed seawall coping';
  }
  const deckUnderside=.04-harborDatum.pierSlabThickness;
  for(const rings of data.decks){
    const geometry=new THREE.ExtrudeGeometry(shape(rings),{depth:harborDatum.pierSlabThickness,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    mesh(geometry,'#b7b8a9',0,deckUnderside,0).name='Surveyed quay slab';
  }
  for(const [x,z] of data.piles){
    const top=deckUnderside;
    mesh(new THREE.CylinderGeometry(.063,.071,top-bottom,8),'#82958e',x,(bottom+top)/2,z).name='Surveyed quay support';
  }
}

// Choose the bay-facing edge for street furniture along the mainland.
export function seawallAt(x:number){
  let edge:{z:number;angle:number}|undefined;
  for(const [outer] of data.land){
    for(let j=0;j<outer.length;j++){
      const [ax,az]=outer[j],[bx,bz]=outer[(j+1)%outer.length];
      if(x<Math.min(ax,bx)||x>Math.max(ax,bx)||ax===bx)continue;
      const z=az+(x-ax)*(bz-az)/(bx-ax);
      if(!edge||z>edge.z)edge={z,angle:Math.atan((bz-az)/(bx-ax))};
    }
  }
  return edge;
}
