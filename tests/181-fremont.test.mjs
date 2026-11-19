import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {harborBuilding} from '../app/harbor-architecture.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import {mappedBuildings} from '../app/sf-map.ts';
const b=mappedBuildings.find(b=>b.id===445566153);
const {root}=harborBuilding(b);
const mesh=root.children[0],geometry=mesh.geometry;
const positions=geometry.getAttribute('position'),colors=geometry.getAttribute('color');
const grade=.054;
function height(x,z){
  return new THREE.Raycaster(new THREE.Vector3(x,16,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0]?.point.y;
}
test('181 Fremont has a 210 m interior roof beneath the raked screen and the single Fremont/Transbay corner spire',()=>{
  geometry.computeBoundingBox();
  assert.ok(Math.abs(geometry.boundingBox.max.y-(grade+244.5*.06))<.00001);
  assert.ok(Math.abs(height(-25.15,-31.3)-(grade+210*.06))<.00001);
  assert.ok(height(-24.596,-31.875)>grade+244*.06);
  assert.equal(height(-26.3,-29.55),undefined,'reentrant garden side stays open');
  assert.equal(height(-26.1,-28.0),undefined,'199 Fremont remains a separate parcel');
  for(let i=0;i<positions.count;i++)if(positions.getY(i)>grade+229*.06){
    assert.ok(Math.hypot(positions.getX(i)+24.596,positions.getZ(i)+31.875)<.080);
  }
});
test('office megabraces meet at opposed floor 20 and 37 nodes on the north and west elevations',()=>{
  const steel=new THREE.Color('#a5afae');
  // Inspect only the actual office brace surfaces at each end of each stage.
  // Both north and west land near their shared corner at L20 and leave it at L37.
  const corner=new THREE.Vector2(...b.p[4]);
  for(const [h,near,far] of [[8.5,0,2],[79,2,0],[142,0,2]]){
    const xs=[],zs=[];
    for(let i=0;i<positions.count;i++){
      if(Math.abs(positions.getY(i)-(grade+h*.06))>.015||Math.abs(colors.getX(i)-steel.r)>.0001)continue;
      const x=positions.getX(i)-corner.x,z=positions.getZ(i)-corner.y;
      if(x*.988-z*.154>-.22)xs.push(Math.hypot(x,z));
      if(x*.154+z*.988<.23)zs.push(Math.hypot(x,z));
    }
    assert.ok(xs.length&&zs.length);
    for(const d of [Math.min(...xs),Math.min(...zs)]){
      if(near)assert.ok(d<.24,h+' shared north-west node');
      if(far)assert.ok(d>1.3,h+' separate ends');
    }
  }
});
test('one indexed opaque tower carries office and home glazing through the city’s filtered day/night facade batch',()=>{
  const [chunk]=bakeBlocks([mesh],new THREE.MeshStandardMaterial());
  const grid=chunk.geometry.getAttribute('facadeGrid'),normal=geometry.getAttribute('normal');
  const uses=new Set(),northAngles=new Set();
  assert.equal(root.children.length,1);
  assert.ok(geometry.index.count/3<3900);
  assert.equal(grid.count,positions.count);
  for(let i=0;i<grid.count;i++){
    if(grid.getZ(i)!==2)continue;
    uses.add(Math.floor(grid.getW(i)/128));
    if(normal.getX(i)>.85&&positions.getY(i)>2)northAngles.add(Math.round(normal.getZ(i)*100));
    assert.ok(grid.getY(i)>=0&&grid.getY(i)<=55);
  }
  assert.deepEqual([...uses].sort(),[1,2]);
  assert.ok(northAngles.size>=4,'the folded Transbay glazing has directional planar normals');
});

test('the aerial rooftop plant stands inside alternating glass and open crown bays',()=>{
  const at=(x,z)=> (height(x,z)-grade)/.06;
  assert.ok(Math.abs(at(-25.4,-31.1)-216.2)<.01,'central mechanical penthouse');
  assert.ok(at(-25.9,-30.7)>213.8,'paired fan deck rises above the service aisle');
  assert.ok(Math.abs(at(-25.8,-30.95)-210)<.01,'open aisle on the roof');
  const a=new THREE.Vector3(-24.206,0,-30.066),b=new THREE.Vector3(-24.596,0,-31.875);
  const front=new THREE.Vector3(-(b.z-a.z),0,b.x-a.x).normalize();
  const intersects=fraction=>{
    const p=a.clone().lerp(b,fraction).addScaledVector(front,.14);p.y=grade+217*.06;
    return new THREE.Raycaster(p,front.clone().negate(),0,.145).intersectObject(mesh).length>0;
  };
  // The north screen has 14 bays. Sample glass and open sky in the same bay.
  assert.equal(intersects(8.4/14),true);assert.equal(intersects(8.87/14),false);
});
test('the baked tapered mast reads against the background building in the saved orbit',()=>{
  const [chunk]=bakeBlocks([mesh],new THREE.MeshStandardMaterial());
  const camera=new THREE.PerspectiveCamera(60,1.6,.35,1800);
  camera.position.set(-30.78916712135224,18.02276191448933,-39.8020916301722);
  camera.lookAt(0,2.4,0);camera.setFocalLength(40);camera.updateMatrixWorld();
  const r=new THREE.Raycaster(),hitsAt=y=>{
    let width=0;
    for(let x=690;x<=736;x++){
      r.setFromCamera(new THREE.Vector2((x+.5)/720-1,1-(y+.5)/450),camera);
      const h=r.intersectObject(chunk)[0];
      if(h&&h.point.y>grade+227*.06&&h.distance<11.5)width++;
    }
    return width;
  };
  assert.ok(hitsAt(600)>=12,'broad lower aluminium faces continue into the corner rake');
  assert.ok(hitsAt(510)>=2&&hitsAt(510)<hitsAt(600),'the tip narrows above the housing');
});
