import * as THREE from 'three';
import survey from '../public/data/fremont-markings.json' with {type:'json'};
import {setPackedNormals} from './packed-normals.ts';

type Surface=(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
const pigment:Record<string,string>={white:'#dedbd0',green:'#749580',yellow:'#ddbd64'};

export function addFremontMarkings(mesh:Surface){
  for(const {ink,vertices,indices} of survey.batches){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
    geometry.setIndex(indices);setPackedNormals(geometry);
    geometry.userData.roadPaint='SoMa approaches';
    const patch=mesh(geometry,pigment[ink],0,0,0);
    patch.userData.roadExposure=1;
    patch.name='Fremont and Howard pavement · '+ink;
  }
}
