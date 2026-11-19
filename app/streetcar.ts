import {streetcarTrack} from './streets.ts';
import * as THREE from 'three';
import {bakeRigidChunk} from './city-blocks.ts';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {addPccBody} from './pcc-body.ts';
export {setPccFrontDoor,setPccExitDoor} from './pcc-entrance.ts';

import {pccDimensions,pccTruckHalfSpacing,pccAxleHalfSpacing} from './pcc-layout.ts';
export {pccDimensions} from './pcc-layout.ts';
/** Code-native PCC miniature, based on Muni 1051's green-and-cream bodywork. */
export function createStreetcar(){
  const group=new THREE.Group();group.name='Muni PCC streetcar';group.scale.set(pccDimensions.length/3.629,pccDimensions.height/1.0675,pccDimensions.width/.8835);
  const colors={green:'#31735c',cream:'#e9dfb8',glass:'#3e5e64',rubber:'#283737',metal:'#9baba6',dark:'#354a43'};
  const materials=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:key==='glass'?.3:.68,metalness:key==='metal'?.5:.08})]));
  const glazing=materials.glass;glazing.emissive.set('#e6c583');
  const lamp=new THREE.MeshStandardMaterial({color:'#fff1c8',emissive:'#ffd799',emissiveIntensity:1.5,roughness:.4});
  function part(geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  function box(w:number,h:number,d:number,x:number,y:number,z:number,mat=materials.cream,r=.015){return part(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);}
  function rod(a:number[],b:number[],r:number,mat=materials.dark){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);const m=part(new THREE.CylinderGeometry(r,r,delta.length(),6),mat,...from.clone().add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  addPccBody(group,glazing,lamp);
  const wheelCenter=(streetcarTrack.gauge+streetcarTrack.railHead)/(2*group.scale.z);
  const radius=.335*.06/group.scale.y;
  for(const x of [-pccTruckHalfSpacing,pccTruckHalfSpacing]){
    box(.69,.14,.49,x,.19,0,materials.dark).userData.truck=x;
    // Only the center bearing reaches up into the fixed girder; the frame
    // and both axles remain free to swivel and pitch beneath it.
    const bearing=part(new THREE.CylinderGeometry(.034,.034,.058,12),materials.dark,x,.284,0);
    bearing.name='Truck center bearing';bearing.scale.x=group.scale.z/group.scale.x;bearing.userData.truck=x;
    for(const dx of [-pccAxleHalfSpacing,pccAxleHalfSpacing])for(const z of [-wheelCenter,wheelCenter]){
      const wheel=part(new THREE.CylinderGeometry(radius,radius,.058,18),materials.rubber,x+dx,radius,z);wheel.rotation.x=Math.PI/2;wheel.scale.x=group.scale.y/group.scale.x;wheel.name='Wheel tread';wheel.userData.truck=x;
      const hub=part(new THREE.CylinderGeometry(radius*.66,radius*.66,.060,12),materials.dark,x+dx,radius,z);hub.rotation.x=Math.PI/2;hub.scale.x=group.scale.y/group.scale.x;hub.userData.truck=x;
    }
  }
  for(const side of [-1,1])rod([1.838,.576,side*.045],[1.78,.665,side*.142],.004,materials.dark);
  const headlight=part(new THREE.CylinderGeometry(.063,.063,.03,16),materials.metal,1.831,.379,0);headlight.rotation.z=Math.PI/2;
  const lens=part(new THREE.CircleGeometry(.044,16),lamp,1.850,.379,0);lens.rotation.y=Math.PI/2;
  const retriever=part(new THREE.CylinderGeometry(.068,.068,.021,16),materials.dark,1.824,.503,0);retriever.rotation.z=Math.PI/2;
  box(.205,.035,.19,.10,1.042,0,materials.dark);
  const wire=streetcarTrack.wireRise/group.scale.y;
  rod([.1,1.07,0],[-1.05,wire-.018,0],.013);rod([.1,1.07,.02],[-.24,1.36,.02],.021,materials.metal);
  box(.085,.023,.07,-1.05,wire-.0115,0,materials.dark).name='Trolley contact shoe';
  return {group,glazing,lamp};
}

const truckBatchName='PCC swivel trucks';
type TruckPose={x:number;y:number;z:number;heading:number;pitch:number};
type CarPose={x:number;y:number;z:number;heading:number;pitch:number;front:TruckPose;rear:TruckPose};
const instanceTransform=new THREE.Matrix4(),inverseScale=new THREE.Matrix4(),pitchMatrix=new THREE.Matrix4();
export function setStreetcarTrucks(group:THREE.Group,ride?:CarPose){
  const trucks=group.getObjectByName(truckBatchName) as THREE.InstancedMesh|undefined;
  if(!trucks||(!ride&&trucks.userData.atRest))return;
  inverseScale.makeScale(1/group.scale.x,1/group.scale.y,1/group.scale.z);
  for(let i=0;i<2;i++){
    if(ride){
      const p=i?ride.front:ride.rear,c=Math.cos(ride.heading),s=Math.sin(ride.heading);
      const dx=p.x-ride.x,dz=p.z-ride.z;
      instanceTransform.makeRotationY(p.heading-ride.heading).multiply(pitchMatrix.makeRotationZ(p.pitch));
      instanceTransform.setPosition(dx*c-dz*s,p.y-ride.y,dx*s+dz*c);
      instanceTransform.premultiply(pitchMatrix.makeRotationZ(-ride.pitch));
    }else instanceTransform.makeTranslation((i?1:-1)*pccTruckHalfSpacing*group.scale.x,0,0);
    trucks.setMatrixAt(i,instanceTransform.premultiply(inverseScale));
  }
  trucks.instanceMatrix.needsUpdate=true;trucks.userData.atRest=!ride;
}
/** The two identical trucks replace the original single rubber-tread draw.
 * Bake the steel frame, hubs and treads together in real scene units before
 * undoing the body's non-uniform miniature scale at each kingpin. */
export function bakeStreetcarTrucks(group:THREE.Group){
  const parts=group.children.filter((o):o is THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>=>o instanceof THREE.Mesh&&o.userData.truck!==undefined);
  const front=parts.filter(o=>o.userData.truck>0);
  const basis=new THREE.Matrix4().makeScale(group.scale.x,group.scale.y,group.scale.z);
  basis.multiply(new THREE.Matrix4().makeTranslation(-pccTruckHalfSpacing,0,0));
  for(const part of front){part.updateMatrix();part.matrixWorld.multiplyMatrices(basis,part.matrix);}
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.08});
  const source=bakeRigidChunk(truckBatchName,front,material);
  for(const part of parts){part.removeFromParent();part.geometry.dispose();}
  const trucks=new THREE.InstancedMesh(source.geometry,material,2);trucks.name=truckBatchName;
  trucks.frustumCulled=false;trucks.receiveShadow=true;
  return trucks;
}


/** Keep the folded leaves and bogies articulated. The three rigid batches
 * retain their vertex indices and one material each for paint, glass and lamps. */
export function bakePccBody(group:THREE.Group,glazing:THREE.MeshStandardMaterial,lamp:THREE.MeshStandardMaterial){
  const trucks=bakeStreetcarTrucks(group);
  const parts=group.children.filter((o):o is THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>=>
    o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh));
  const paint=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.76,metalness:.06});
  for(const part of parts){part.updateMatrix();part.matrixWorld.copy(part.matrix);}
  for(const [name,material,list] of [
    ['PCC formed and painted body',paint,parts.filter(p=>p.material!==glazing&&p.material!==lamp)],
    ['PCC passenger lights and destination',glazing,parts.filter(p=>p.material===glazing)],
    ['PCC marker and headlamp lenses',lamp,parts.filter(p=>p.material===lamp)]
  ] as const){const mesh=bakeRigidChunk(name,list,material);mesh.receiveShadow=true;group.add(mesh);}
  for(const part of parts){part.removeFromParent();part.geometry.dispose();}
  for(const material of [glazing,lamp]){material.vertexColors=true;material.color.set(0xffffff);}
  group.add(trucks);setStreetcarTrucks(group);
}
