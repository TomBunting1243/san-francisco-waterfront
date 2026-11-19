// Run after import-promenade-lights.py or a ground survey update. Heights are
// local scene surface elevations at SFPUC inventory pins, in scene units.
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import fixtures from '../public/data/promenade-lights.json' with {type:'json'};
import {createLandscape} from '../app/landscape.ts';

const {root,architectureChunks}=createLandscape();
root.updateMatrixWorld(true);
const surfaces=[...architectureChunks];
root.traverse(node=>{
  if(node.isMesh&&node.parent?.name.endsWith(' elevation'))surfaces.push(node);
});
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
const grades={};
for(const [id,x,z] of [...fixtures.curb,...fixtures.inland]){
  ray.set(new THREE.Vector3(x,.14,z),down);ray.far=.30;
  const ground=ray.intersectObjects(surfaces,false).find(hit=>hit.face.normal.y>.60);
  if(!ground)throw new Error('No street support at SFPUC pole '+id);
  grades[id]=Number(ground.point.y.toFixed(5));
}
writeFileSync(new URL('../public/data/promenade-light-grades.json',import.meta.url),JSON.stringify(grades)+'\n');
