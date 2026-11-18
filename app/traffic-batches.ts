import * as THREE from 'three';
import {bridgeLayout} from './bridge-layout.ts';
import {bridgeLaneCenters} from './bridge-deck.ts';
import {createStreetVehicle} from './street-vehicles.ts';

/** Pack colored rigid parts once; only their transforms and visibility change in the renderer. */
export function batchTraffic(poses:THREE.Group,material:THREE.Material,name:string){
  const parts:THREE.Mesh[]=[];
  poses.traverse(part=>{if(part instanceof THREE.Mesh)parts.push(part);});
  const geometries=[...new Set(parts.map(p=>p.geometry))];
  const batch=new THREE.BatchedMesh(parts.length,
    geometries.reduce((n,g)=>n+g.attributes.position.count,0),
    geometries.reduce((n,g)=>n+(g.index?.count??0),0),material);
  batch.name=name;batch.sortObjects=false;batch.receiveShadow=true;
  // The complete moving fleet has no fixed bounds. Three still frustum-culls each active part.
  batch.frustumCulled=false;
  batch.castShadow=parts.some(p=>p.castShadow);
  const geometryIds=new Map(geometries.map(g=>[g,batch.addGeometry(g)]));
  const instances=parts.map(part=>({part,id:batch.addInstance(geometryIds.get(part.geometry)!),previous:new THREE.Matrix4(),initialized:false}));
  function sync(){
    poses.updateMatrixWorld(true);
    for(const instance of instances){
      const {part,id,previous}=instance;
      let visible=true;
      for(let p:THREE.Object3D|null=part;p&&visible;p=p.parent)visible=p.visible;
      batch.setVisibleAt(id,visible);
      if(visible&&(!instance.initialized||!previous.equals(part.matrixWorld))){
        batch.setMatrixAt(id,part.matrixWorld);previous.copy(part.matrixWorld);instance.initialized=true;
      }
    }
  }
  sync();return {batch,sync};
}

export function createBridgeTraffic(material:THREE.MeshStandardMaterial){
  const poses=new THREE.Group(),models=Array.from({length:12},(_,i)=>createStreetVehicle(i,material,true));
  const cars=Array.from({length:22},(_,i)=>{
    const car=models[i%models.length].clone(),westbound=i%2===0;
    car.scale.setScalar(.25);
    car.position.set(bridgeLaneCenters[Math.floor(i/2)%bridgeLaneCenters.length],
      westbound?bridgeLayout.upperDeck+.063:bridgeLayout.lowerDeck+.044,i*8);
    car.rotation.y=westbound?Math.PI/2:-Math.PI/2;poses.add(car);return car;
  });
  const {batch,sync}=batchTraffic(poses,material,'Bay Bridge vehicles');
  function update(elapsed:number){
    for(const [i,car] of cars.entries()){
      const z=i*8+(i%2?1.1:-1.1)*elapsed;
      car.position.z=THREE.MathUtils.euclideanModulo(z,bridgeLayout.length);
    }
    sync();
  }
  update(0);return {cars,batch,update};
}
