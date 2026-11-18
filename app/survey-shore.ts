import * as THREE from 'three';
import data from '../public/data/survey-shore.json' with {type:'json'};

type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
const masks=new Map(Object.entries(data.submergedVertices).map(([key,indices])=>[key,new Set(indices)]));

export function replacesReliefVertex(grid:string,index:number){
  return masks.get(grid)?.has(index)??false;
}

function shape(rings:number[][][]){
  const ring=(points:number[][])=>points.map(([x,z])=>new THREE.Vector2(x,-z));
  const outline=new THREE.Shape(ring(rings[0]));
  outline.holes=rings.slice(1).map(hole=>new THREE.Path(ring(hole)));
  return outline;
}

export function addSurveyShore(mesh:Surface){
  for(const rings of data.land){
    const polygon=shape(rings);
    const upper=-.01,bottom=-1.10;
    const geometry=new THREE.ExtrudeGeometry(polygon,{depth:upper-bottom,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    const face=new THREE.Color('#89958b'),paving=new THREE.Color('#b9bba9');
    const normals=geometry.attributes.normal,colors=new Float32Array(normals.count*3);
    for(let i=0;i<normals.count;i++)(normals.getY(i)>.9?paving:face).toArray(colors,i*3);
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.userData.paintVertices=true;
    mesh(geometry,'#ffffff',0,bottom,0).name='Continuous mapped San Francisco shoreline';
  }
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
  for(const rings of data.decks){
    const geometry=new THREE.ExtrudeGeometry(shape(rings),{depth:.19,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    mesh(geometry,'#b7b8a9',0,-.15,0).name='Surveyed quay slab';
  }
  for(const [x,z] of data.piles){
    const bottom=-1.10,top=-.15;
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
