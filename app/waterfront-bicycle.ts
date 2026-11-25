import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type Point=[number,number,number];
type Parts=THREE.BufferGeometry[];
const up=new THREE.Vector3(0,1,0),tire='#333631',steel='#90978c';
const palettes=[
  ['#be734c','#986e50','#faf0d4'],['#477b80','#77523e','#b4c4ba'],
  ['#ae5949','#c0926a','#d1b886'],['#527160','#a27454','#e8c175'],['#586883','#805c48','#e0d4c2'],
];
function add(parts:Parts,g:THREE.BufferGeometry,ink:string){
  const paint=new THREE.Color(ink),color=new Float32Array(g.getAttribute('position').count*3);
  for(let j=0;j<color.length;j+=3)paint.toArray(color,j);
  g.setAttribute('color',new THREE.BufferAttribute(color,3));
  g.deleteAttribute('uv');parts.push(g);
}
function bar(parts:Parts,a:Point,b:Point,r:number,ink:string,top=r){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const g=new THREE.CylinderGeometry(top,r,delta.length(),5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()));
  start.lerp(end,.5);add(parts,g.translate(start.x,start.y,start.z),ink);
}
function oval(parts:Parts,at:Point,size:Point,ink:string){
  add(parts,new THREE.SphereGeometry(1,8,6).scale(...size).translate(...at),ink);
}
function join(parts:Parts){
  const g=mergeGeometries(parts);
  if(!g)throw Error('Bicycle geometry could not be joined');
  parts.forEach(part=>part.dispose());return g;
}
function driveTrain(angle:number){
  const parts:Parts=[];
  for(const side of [-1,1]){
    const a=angle+(side<0?Math.PI:0);
    const hip:Point=[-.14,.83,side*.075];
    const ankle:Point=[.01+.112*Math.cos(a),.40+.112*Math.sin(a),side*.10];
    const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],span=Math.hypot(dx,dy);
    const bend=Math.sqrt(Math.max(0,.302**2-span**2/4));
    const knee:Point=[(hip[0]+ankle[0])/2-dy/span*bend,(hip[1]+ankle[1])/2+dx/span*bend,hip[2]];
    bar(parts,hip,knee,.074,'#394651',.051);bar(parts,knee,ankle,.047,'#44515b',.032);
    oval(parts,[ankle[0]+.025,ankle[1]-.012,ankle[2]],[.084,.037,.041],'#413e35');
    bar(parts,[.01,.365,side*.038],[ankle[0]+.025,ankle[1]-.051,side*.084],.012,steel);
  }
  return join(parts);
}
export function createWaterfrontBicycle(index:number,material:THREE.MeshStandardMaterial){
  const parts:Parts=[],[jersey,skin,helmet]=palettes[index%palettes.length];
  for(const x of [-.4,.4]){
    add(parts,new THREE.TorusGeometry(.25,.025,6,24).translate(x,.3,0),tire);
    add(parts,new THREE.TorusGeometry(.229,.009,4,18).translate(x,.3,0),steel);
    for(let j=0;j<3;j++){
      const h=j*Math.PI/3,dx=.22*Math.cos(h),dy=.22*Math.sin(h);
      bar(parts,[x-dx,.3-dy,0],[x+dx,.3+dy,0],.0055,'#77847e');
    }
  }
  const chain:Point=[.01,.365,0],seat:Point=[-.14,.67,0],head:Point=[.30,.68,0];
  bar(parts,seat,chain,.026,jersey);bar(parts,chain,head,.027,jersey);
  bar(parts,head,seat,.024,jersey);
  for(const side of [-1,1]){
    const rear:Point=[-.4,.30,side*.036],front:Point=[.4,.3,side*.036];
    bar(parts,rear,seat,.014,jersey);bar(parts,chain,rear,.015,jersey);bar(parts,head,front,.017,jersey);
  }
  bar(parts,seat,[-.16,.77,0],.018,steel);oval(parts,[-.14,.772,0],[.098,.031,.074],tire);
  bar(parts,head,[.255,.86,0],.018,steel);bar(parts,[.255,.86,-.14],[.255,.86,.14],.016,tire);
  oval(parts,[.33,.76,0],[.025,.024,.024],'#f1dab2');
  oval(parts,[-.245,.733,0],[.018,.019,.026],'#bf5845');
  bar(parts,[-.15,.83,0],[.021,1.12,0],.104,jersey,.119);
  bar(parts,[.011,1.09,0],[.084,1.19,0],.055,skin);
  oval(parts,[.097,1.23,0],[.092,.119,.09],skin);
  oval(parts,[.094,1.30,0],[.111,.070,.100],helmet);
  for(const side of [-1,1]){
    const shoulder:Point=[.012,1.09,side*.102],elbow:Point=[.11,.942,side*.13],hand:Point=[.25,.866,side*.126];
    bar(parts,shoulder,elbow,.05,jersey,.036);bar(parts,elbow,hand,.033,skin,.027);
  }
  const frame=new THREE.Mesh(join(parts),material);
  const legs=driveTrain(0),positions=[],normals=[];
  for(let i=0;i<8;i++){
    const pose=driveTrain(i*Math.PI/4);
    positions.push(pose.getAttribute('position'));normals.push(pose.getAttribute('normal'));pose.dispose();
  }
  legs.morphAttributes.position=positions;legs.morphAttributes.normal=normals;
  const pedaling=new THREE.Mesh(legs,material);
  const rider=new THREE.Group();rider.name='Waterfront cyclist';rider.add(frame,pedaling);
  for(const part of [frame,pedaling]){part.castShadow=true;part.receiveShadow=true;}
  pedalBicycle(rider,index*2);return rider;
}
export function pedalBicycle(rider:THREE.Group,radians:number){
  const weights=(rider.children[1] as THREE.Mesh).morphTargetInfluences!;
  const phase=(radians/(Math.PI*2)%1+1)%1*weights.length;
  const first=Math.floor(phase),blend=phase-first;
  weights.fill(0);weights[first]=1-blend;weights[(first+1)%weights.length]=blend;
}

export function bicycleContacts(riders:THREE.Group[]){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  // A broad, faint frame shadow and two smaller tire contacts. Transparent
  // vertices reveal the underlying asphalt, green paint and evening lamplight.
  function ellipse(x:number,rx:number,rz:number,opacity:number){
    const start=positions.length/3,segments=12;
    positions.push(x,.033,0);colors.push(.025,.032,.030,opacity);
    for(const [radius,alpha] of [[.48,opacity*.65],[1,0]]){
      for(let i=0;i<segments;i++){
        const a=-2*Math.PI*i/segments;
        positions.push(x+rx*radius*Math.cos(a),.033,rz*radius*Math.sin(a));
        colors.push(.025,.032,.030,alpha);
      }
    }
    for(let i=0;i<segments;i++){
      const a=start+1+i,b=start+1+(i+1)%segments;
      indices.push(start,a,b,a,a+segments,b+segments,a,b+segments,b);
    }
  }
  ellipse(0,.67,.24,.20);
  for(const x of [-.4,.4])ellipse(x,.15,.071,.58);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  geometry.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false});
  const mesh=new THREE.InstancedMesh(geometry,material,riders.length);
  mesh.name='Bicycle tire contact';mesh.frustumCulled=false;mesh.visible=riders.length>0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const update=()=>{
    riders.forEach((rider,i)=>{rider.updateMatrix();mesh.setMatrixAt(i,rider.matrix);});
    mesh.instanceMatrix.needsUpdate=true;
  };
  update();return {mesh,update};
}
