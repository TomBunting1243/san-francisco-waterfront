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
  // Local -Z is San Francisco. The inner (left) lane is fastest on each deck.
  // Equal speed within a lane preserves its headways, including through the loop.
  const westSpeeds=[1.34,1.22,.98,.84,1.10],eastSpeeds=[.88,.99,1.08,1.19,1.29];
  const phases=[.19,.58,.37,.85,.07];
  // Phase the outer exit lane around the driver’s YBI launch and wrap point.
  const fleet:{car:THREE.Group;phase:number;speed:number;length:number}[]=[];
  for(const westbound of [true,false]){
    const count=westbound?14:6;
    // Upper-deck asphalt continues to the YBI tunnel portal, 8.6 units past the span.
    const length=bridgeLayout.length+(westbound?8.6:0),spacing=length/count;
    for(const [lane,x] of bridgeLaneCenters.entries()){
      const speed=westbound?-westSpeeds[lane]:eastSpeeds[lane];
      for(let row=0;row<count;row++){
        const car=models[fleet.length%models.length].clone();
        car.scale.setScalar(.25);
        car.position.set(x,westbound?bridgeLayout.upperDeck+.063:bridgeLayout.lowerDeck+.044,0);
        car.rotation.y=westbound?Math.PI/2:-Math.PI/2;
        poses.add(car);
        // At launch the driver is .95 short of the wrap. Exactly bisect
        // two outer-lane vehicles; all three then travel at 1.10.
        const phase=westbound&&lane===4?(row+.5)*spacing-.95:
          (row+phases[lane]+.09*Math.sin(row*2.4+lane))*spacing;
        fleet.push({car,phase,speed,length});
      }
    }
  }
  const cars=fleet.map(vehicle=>vehicle.car);
  const {batch,sync}=batchTraffic(poses,material,'Bay Bridge vehicles');
  function update(elapsed:number){
    for(const {car,phase,speed,length} of fleet){
      car.position.z=THREE.MathUtils.euclideanModulo(phase+speed*elapsed,length);
    }
    sync();
  }
  update(0);return {cars,batch,update};
}
