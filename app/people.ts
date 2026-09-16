import * as THREE from 'three';

/** A small cast of expressive, toy-like pedestrians, drawn in seven instanced batches. */
export function createPeople(count=22){
  const group=new THREE.Group();
  const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.88});
  function batch(geo:THREE.BufferGeometry,color:string,n=count){const m=new THREE.InstancedMesh(geo,mat(color),n);m.castShadow=true;m.frustumCulled=false;group.add(m);return m;}
  const bodies=batch(new THREE.CapsuleGeometry(.068,.12,4,9),'#ffffff');
  const heads=batch(new THREE.SphereGeometry(.088,12,9),'#ffffff');
  const hair=batch(new THREE.SphereGeometry(.09,10,7,0,Math.PI*2,0,Math.PI*.52),'#ffffff');
  const eyes=batch(new THREE.SphereGeometry(.010,6,5),'#34413e',count*2);
  const noses=batch(new THREE.SphereGeometry(.021,7,5),'#ffffff');
  const arms=batch(new THREE.CapsuleGeometry(.022,.095,3,7),'#ffffff',count*2);
  const shoes=batch(new THREE.SphereGeometry(.028,8,6),'#f5e6c6',count*2);
  const coats=['#d4684b','#e2b54e','#548a99','#8d7fa8','#638565','#d99a92'];
  const skins=['#efc3a2','#c99570','#8b5b43','#d8a07a','#f2d4b2'];
  for(let i=0;i<count;i++){
    bodies.setColorAt(i,new THREE.Color(coats[i%coats.length]));heads.setColorAt(i,new THREE.Color(skins[i%skins.length]));noses.setColorAt(i,new THREE.Color(skins[i%skins.length]));hair.setColorAt(i,new THREE.Color(['#4a3934','#b77645','#e0bf79','#494944'][i%4]));
    for(let side=0;side<2;side++)arms.setColorAt(i*2+side,new THREE.Color(coats[i%coats.length]));
  }
  const dummy=new THREE.Object3D();
  function update(i:number,x:number,z:number,t:number,direction:number,ground=0,wave=0,standing=false){
    const phase=t*(3.5+(i%4)*.25)+i*2.1,bob=Math.abs(Math.sin(phase))*(standing?.003:.015),heading=direction>0?Math.PI/2:-Math.PI/2;
    const size=.92+(i%4)*.055;
    function pose(m:THREE.InstancedMesh,index:number,dx:number,y:number,dz:number,sx=1,sy=1,sz=1,roll=0){
      dummy.position.set(x+(Math.cos(heading)*dx+Math.sin(heading)*dz)*size,(y+bob)*size+ground,z+(-Math.sin(heading)*dx+Math.cos(heading)*dz)*size);
      dummy.rotation.set(0,heading,roll);dummy.scale.set(sx*size,sy*size,sz*size);dummy.updateMatrix();m.setMatrixAt(index,dummy.matrix);
    }
    pose(bodies,i,0,.225,0,1,1,1,Math.sin(phase)*.035);
    pose(heads,i,0,.407,0,1,1.05,1);pose(hair,i,0,.411,0);
    pose(noses,i,0,.4,.085,1,.8,1);
    for(let side=0;side<2;side++){
      const sign=side?1:-1,swing=standing?0:Math.sin(phase)*sign;
      pose(eyes,i*2+side,sign*.031,.42,.077);
      pose(arms,i*2+side,sign*.084,.226+(side===1?wave*.075:0),swing*.023,1,1,1,-sign*.12+swing*.3+(side===1?wave*(1.95+Math.sin(t*6)*.25):0));
      pose(shoes,i*2+side,sign*.037,.086+Math.max(0,swing)*.025,swing*.045,1,.7,1.7);
    }
  }
  function flush(){for(const mesh of [bodies,heads,hair,eyes,noses,arms,shoes])mesh.instanceMatrix.needsUpdate=true;}
  return {group,bodies,heads,update,flush};
}
