import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {mappedBuildings} from '../app/sf-map.ts';
import {waterfrontLandmark} from '../app/waterfront-landmarks.ts';

test('Audiffred mansard hips join the four mapped street walls to a contained roof crown',()=>{
  const b=mappedBuildings.find(b=>b.id===193054136);
  const {root}=waterfrontLandmark(b,new FontLoader().parse(fontData));
  const shell=root.getObjectByName('Audiffred slate mansard'),cap=root.getObjectByName('Audiffred inset roof crown');
  const ring=b.p.slice(0,-1),center=ring.reduce((c,[x,z])=>[c[0]+x/4,c[1]+z/4],[0,0]);
  const p=shell.geometry.attributes.position,normal=shell.geometry.attributes.normal;
  const top=Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i)));
  const highCorners=new Set();
  const key=(x,z)=>[x.toFixed(4),z.toFixed(4)].join(',');
  for(let i=0;i<p.count;i++){
    assert.ok(normal.getY(i)>.39&&normal.getY(i)<.43);
    if(Math.abs(p.getY(i)-top)<1e-5)highCorners.add(key(p.getX(i),p.getZ(i)));
  }
  assert.equal(highCorners.size,4);
  const crown=new Set();
  const verts=cap.geometry.attributes.position;
  for(let i=0;i<verts.count;i++){
    const x=verts.getX(i),z=verts.getZ(i);
    crown.add(key(x,z));
    for(let k=0;k<4;k++){
      const [a,b]=ring[k],[c,d]=ring[(k+1)%4],dx=c-a,dz=d-b;
      const interior=Math.sign(dx*(center[1]-b)-dz*(center[0]-a));
      const inset=interior*(dx*(z-b)-dz*(x-a))/Math.hypot(dx,dz);
      assert.ok(inset>.092,'slate slopes separate the cap from every facade');
    }
  }
  assert.deepEqual(crown,highCorners);
  assert.ok(Math.abs(cap.position.y-top)<1e-6);
  // Midway up each slope a ray hits that face, then the crown at the center.
  root.updateMatrixWorld(true);
  const down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
  for(let i=0;i<4;i++){
    const a=ring[i],b=ring[(i+1)%4];
    ray.set(new THREE.Vector3((a[0]+b[0])/2,2,(a[1]+b[1])/2),down);
    const hits=ray.intersectObjects([shell,cap]);assert.equal(hits[0]?.object,shell);
    assert.ok(hits[0].point.y> .69&&hits[0].point.y<top);
  }
  ray.set(new THREE.Vector3(center[0],2,center[1]),down);
  assert.equal(ray.intersectObjects([shell,cap])[0]?.object,cap);
});
