import * as THREE from 'three';
import {createStreetVehicle} from './street-vehicles.ts';
import {waterfrontCar,waterfrontCarCount,waterfrontRoadRange} from './waterfront-routes.ts';

export function createWaterfrontTraffic(paint:THREE.MeshStandardMaterial,region?:'street'|'plaza',shared?:THREE.InstancedMesh[]){
  const count=waterfrontCarCount(region),types=12;
  const root=new THREE.Group();root.name='Moving Embarcadero traffic';
  const traffic=Array.from({length:types},(_,i)=>{
    const source=shared?.[i]??createStreetVehicle(i,paint).children[0] as THREE.Mesh;
    const n=Math.ceil((count-i)/types);
    const batch=new THREE.InstancedMesh(source.geometry,paint,n);
    batch.name='Embarcadero road traffic '+(i+1);
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if(shared)batch.userData.sharedGeometry=true;
    // Every batch circulates throughout this view's road. Constant bounds
    // prevent cars disappearing when their initial positions leave the frustum.
    const [first,last]=waterfrontRoadRange(region);
    batch.boundingSphere=new THREE.Sphere(new THREE.Vector3((first+last)/2,.1,-8),(last-first)/2+15);
    batch.receiveShadow=true;root.add(batch);
    return batch;
  });
  const pose=new THREE.Object3D();
  function update(elapsed:number){
    for(let i=0;i<count;i++){
      const p=waterfrontCar(elapsed,i,region);
      pose.scale.setScalar(p.active ? .25 : 0);
      pose.position.set(p.x,p.y,p.z);pose.rotation.y=p.heading;pose.updateMatrix();
      traffic[i%types].setMatrixAt(Math.floor(i/types),pose.matrix);
    }
    for(const batch of traffic)batch.instanceMatrix.needsUpdate=true;
  }
  update(0);
  return {traffic,root,update};
}
