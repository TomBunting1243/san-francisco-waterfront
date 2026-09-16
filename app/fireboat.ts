import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {waterHeight} from './water-surface.ts';

export const fireboatCycle=120;
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const dock={x:-42.9,z:5.3},display={x:-32,z:17},heading=-Math.atan2(display.z-dock.z,display.x-dock.x);
/** Repeating harbor salute: depart, rotate with monitors running, then return to berth. */
export function fireboatPose(elapsed:number){
  const t=((elapsed%fireboatCycle)+fireboatCycle)%fireboatCycle;
  let travel=0,angle=heading,spray=0,phase='berthed';
  if(t>=8&&t<30){travel=smooth((t-8)/22);phase='departing';}
  else if(t>=30&&t<74){travel=1;spray=smooth((t-30)/5)*(1-smooth((t-67)/7));angle=heading+Math.PI*2*smooth((t-35)/32)+Math.PI*smooth((t-67)/7);phase='display';}
  else if(t>=74&&t<100){travel=1-smooth((t-74)/26);angle=heading+Math.PI*3;phase='returning';}
  else if(t>=100){angle=heading+Math.PI*3+Math.PI*smooth((t-100)/8);}
  const speed=t>=8&&t<30?6*((t-8)/22)*(1-(t-8)/22)/22:t>=74&&t<100?6*((t-74)/26)*(1-(t-74)/26)/26:0;
  const x=dock.x+(display.x-dock.x)*travel,z=dock.z+(display.z-dock.z)*travel;
  return {x,z,y:waterHeight(x,z,elapsed)-.01+Math.sin(elapsed*1.7)*.008,heading:angle,spray,speed:speed*Math.hypot(display.x-dock.x,display.z-dock.z),phase};
}

export function createFireboat(){
  const root=new THREE.Group(),vessel=new THREE.Group();root.name='St Francis inspired fireboat';root.add(vessel);
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const material=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.67}));return materials.get(color)!;};
  const add=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(g,material(c));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;vessel.add(mesh);return mesh;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  const pole=(a:THREE.Vector3,b:THREE.Vector3,r:number,c:string)=>{const delta=b.clone().sub(a);const m=add(new THREE.CylinderGeometry(r,r,delta.length(),6),c,0,0,0);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
  // Blunt working stern, pointed bow, red hull and cream wheelhouse.
  const outline=new THREE.Shape();outline.moveTo(-1.15,-.40);outline.lineTo(.72,-.4);outline.quadraticCurveTo(1.08,-.34,1.35,0);outline.quadraticCurveTo(1.08,.34,.72,.4);outline.lineTo(-1.15,.40);outline.closePath();
  const hull=new THREE.ExtrudeGeometry(outline,{depth:.32,bevelEnabled:true,bevelThickness:.04,bevelSize:.03,bevelSegments:1,steps:1});hull.rotateX(-Math.PI/2);add(hull,'#b84f3c',0,-.13,0);
  box(2.19,.055,.87,-.10,.23,0,'#354e52');box(1.95,.04,.73,-.15,.27,0,'#bdb8a0');
  box(1.16,.36,.65,-.10,.46,0,'#eee7ce');box(.94,.29,.58,.04,.765,0,'#f4eddc');box(1.15,.055,.74,.01,.94,0,'#ae4c3b');
  for(const side of [-1,1]){
    for(let x=-.38;x<.49;x+=.19)box(.15,.17,.019,x,.795,side*.298,'#385c64');
    for(let x=-.55;x<.5;x+=.24)box(.18,.15,.022,x,.48,side*.334,'#597b80');
    box(.98,.03,.022,-.03,.64,side*.336,'#b34f3c');
    for(let x=-1.02;x<1.04;x+=.22)pole(new THREE.Vector3(x,.28,side*.40),new THREE.Vector3(x,.46,side*.40),.009,'#e7deca');
    pole(new THREE.Vector3(-1.06,.45,side*.4),new THREE.Vector3(.96,.45,side*.4),.009,'#e7deca');
    for(const x of [-1,-.72,.77]){const tire=add(new THREE.TorusGeometry(.069,.025,5,10),'#304647',x,.14,side*.46);tire.rotation.y=0;}
    const buoy=add(new THREE.TorusGeometry(.075,.02,5,12),'#d36c43',-.55,.54,side*.355);buoy.rotation.y=0;
  }
  for(const x of [-.455,.535])box(.018,.18,.53,x,.79,0,'#3e646b');
  box(.03,.38,.03,-.07,1.12,0,'#d8dfd1');pole(new THREE.Vector3(-.3,1.24,0),new THREE.Vector3(.16,1.24,0),.014,'#d7dfd2');
  add(new THREE.SphereGeometry(.032,7,5),'#c3573f',-.07,1.34,0);box(.12,.17,.12,-.55,.76,.16,'#465d5f');
  const monitors=[{x:.76,y:.40,z:0,angle:0,reach:4.9,peak:2.6},{x:.16,y:1.01,z:0,angle:.35,reach:5.4,peak:3.5},{x:-.69,y:.49,z:.26,angle:1.65,reach:4.5,peak:2.8},{x:-.69,y:.49,z:-.26,angle:-1.65,reach:4.5,peak:2.8},{x:-.92,y:.45,z:0,angle:Math.PI,reach:4.2,peak:2.5}];
  for(const m of monitors){box(.07,.10,.07,m.x,m.y-.04,m.z,'#b84f3c');pole(new THREE.Vector3(m.x,m.y,m.z),new THREE.Vector3(m.x+Math.cos(m.angle)*.12,m.y+.06,m.z+Math.sin(m.angle)*.12),.032,'#c4533f');}
  // Batch the boat itself once; animated spray uses fixed instanced buffers.
  vessel.updateMatrixWorld(true);const groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
  vessel.traverse(o=>{if(o instanceof THREE.Mesh){const g=o.geometry.clone().applyMatrix4(o.matrix);const list=groups.get(o.material as THREE.Material)||[];list.push(g);groups.set(o.material as THREE.Material,list);o.geometry.dispose();}});vessel.clear();
  for(const [mat,geos]of groups){const geometry=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g));if(!geometry)throw new Error('Fireboat merge failed');const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;vessel.add(m);geos.forEach(g=>g.dispose());}
  const water=new THREE.MeshBasicMaterial({color:'#d8eeee',transparent:true,opacity:.72,depthWrite:false});
  const mist=new THREE.MeshBasicMaterial({color:'#f2faf5',transparent:true,opacity:.52,depthWrite:false});
  const spray=new THREE.Group();root.add(spray);
  const segments=24,dropsPerJet=18,jets=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5,1),water,monitors.length*segments),droplets=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mist,monitors.length*dropsPerJet),splashes=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.02,4,20),mist,monitors.length*3);
  // Small bounded system: conservative local bounds avoid stale animated instance culling.
  for(const m of [jets,droplets,splashes]){m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1.5,0),8);spray.add(m);}
  const wake=new THREE.Mesh(new THREE.RingGeometry(.38,.44,24),mist);wake.rotation.x=-Math.PI/2;root.add(wake);
  const dummy=new THREE.Object3D(),a=new THREE.Vector3(),b=new THREE.Vector3(),delta=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const landingHeights=new Float32Array(monitors.length);
  function jetPoint(index:number,t:number,strength:number,time:number,out:THREE.Vector3){const m=monitors[index],angle=m.angle+Math.sin(time*.28+index)*.055;return out.set(m.x+Math.cos(angle)*m.reach*t*strength,m.y*(1-t)+landingHeights[index]*t+4*m.peak*strength*t*(1-t),m.z+Math.sin(angle)*m.reach*t*strength);}
  function update(time:number){
    const pose=fireboatPose(time);root.position.set(pose.x,pose.y,pose.z);root.rotation.y=pose.heading;vessel.rotation.z=Math.sin(time*1.1)*.012;
    spray.visible=pose.spray>.001;wake.visible=pose.speed>.025;
    wake.position.set(-1.25,waterHeight(pose.x-1.25*Math.cos(pose.heading),pose.z+1.25*Math.sin(pose.heading),time)-pose.y+.025,0);wake.scale.set(1+pose.speed*.6,.72,1);wake.rotation.z=Math.sin(time*.8)*.08;
    if(!spray.visible)return pose;
    for(let j=0;j<monitors.length;j++){
      jetPoint(j,1,pose.spray,time,a);const wx=pose.x+a.x*Math.cos(pose.heading)+a.z*Math.sin(pose.heading),wz=pose.z-a.x*Math.sin(pose.heading)+a.z*Math.cos(pose.heading);landingHeights[j]=waterHeight(wx,wz,time)-pose.y+.025;
      for(let i=0;i<segments;i++){jetPoint(j,i/segments,pose.spray,time,a);jetPoint(j,(i+1)/segments,pose.spray,time,b);delta.subVectors(b,a);const length=delta.length();dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,delta.normalize());const radius=(.026+.022*i/segments)*pose.spray;dummy.scale.set(radius,length*1.025,radius);dummy.updateMatrix();jets.setMatrixAt(j*segments+i,dummy.matrix);}
      for(let i=0;i<dropsPerJet;i++){const t=((time*.48+i/dropsPerJet+j*.17)%1);jetPoint(j,t,pose.spray,time,a);const scatter=t*t*.17*pose.spray;dummy.position.set(a.x+Math.sin(i*5+j)*scatter,a.y+Math.sin(i*13+j)*scatter,a.z+Math.cos(i*8+j)*scatter);dummy.quaternion.identity();const r=(.011+t*.026)*pose.spray;dummy.scale.set(r,r*1.6,r);dummy.updateMatrix();droplets.setMatrixAt(j*dropsPerJet+i,dummy.matrix);}
      jetPoint(j,1,pose.spray,time,a);for(let k=0;k<3;k++){const p=(time*.7+k/3)%1;const wx=pose.x+a.x*Math.cos(pose.heading)+a.z*Math.sin(pose.heading),wz=pose.z-a.x*Math.sin(pose.heading)+a.z*Math.cos(pose.heading);dummy.position.set(a.x,waterHeight(wx,wz,time)-pose.y+.03,a.z);dummy.rotation.set(-Math.PI/2,0,0);const r=(.09+p*.36)*pose.spray;dummy.scale.set(r,r,1-p*.8);dummy.updateMatrix();splashes.setMatrixAt(j*3+k,dummy.matrix);}
    }
    jets.instanceMatrix.needsUpdate=true;droplets.instanceMatrix.needsUpdate=true;splashes.instanceMatrix.needsUpdate=true;
    return pose;
  }
  update(0);
  return {root,update};
}
