import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {mappedBuildings} from '../app/sf-map.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import {addHyattRegency} from '../app/hyatt-regency.ts';

function model(){
  const root=new THREE.Group(),windows=[];
  const ids=mappedBuildings.filter(b=>addHyattRegency(b,root,windows)).map(b=>b.id);
  root.updateMatrixWorld(true);
  return {group:root.children[0],windows,ids};
}
function fromFace(b,edge,u,y,offset){
  let [a,c]=b.p.slice(edge,edge+2);
  if(!THREE.ShapeUtils.isClockWise(b.p.map(v=>new THREE.Vector2(...v))))[a,c]=[c,a];
  const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);
  const normal=new THREE.Vector3(-dz/length,0,dx/length);
  const point=new THREE.Vector3(a[0]+dx*u,y,a[1]+dz*u).addScaledVector(normal,offset);
  return new THREE.Raycaster(point,normal.negate());
}

test('terraces have a recessed guest room, projecting solid balcony edge and a separate metal handrail',()=>{
  const {group,ids}=model();
  assert.equal(ids.length,20);
  assert.ok(!ids.includes(118480404),'The unrelated SoMa Hyatt keeps its own architecture');
  const surface=group.getObjectByName('Stepped bay balconies, room dividers and open guardrails');
  const step=mappedBuildings.find(b=>b.id===944095691);
  const cast=y=>fromFace(step,1,.444,y,.35).intersectObject(surface)[0].distance;
  const rail=cast(3.57+.081),gap=cast(3.57+.069),base=cast(3.57+.033);
  assert.ok(gap-rail>.085&&gap-base>.09);
  assert.ok(Math.abs(rail-base)<.012);
});

test('rooftop dining room sits inside two open cantilever squares, above the two street wings',()=>{
  const {group,windows}=model(),b=mappedBuildings.find(b=>b.id===944095688);
  const [a,c,d]=b.p,cx=(a[0]+d[0])/2,cz=(a[1]+d[1])/2;
  const alpha=Math.atan2(c[1]-a[1],c[0]-a[0]),cs=Math.cos(alpha),sn=Math.sin(alpha);
  const height=(u,v)=>new THREE.Raycaster(new THREE.Vector3(cx+u*cs-v*sn,8,cz+u*sn+v*cs),new THREE.Vector3(0,-1,0)).intersectObject(group)[0].point.y;
  assert.ok(Math.abs(height(0,0)-4.85)<.005);
  assert.ok(Math.abs(height(.77,.41)-4.98)<.005);
  assert.ok(height(.61,.61)<4.02,'Sky is visible between the circular roof and cantilever');
  const market=mappedBuildings.find(b=>b.id===944095689);
  const face=group.getObjectByName('Market and Drumm guest room elevations');
  assert.ok(fromFace(market,2,.42,2.26,.5).intersectObject(face).length);
  assert.ok(windows.length>170&&windows.length<300);
  let total=0;group.traverse(o=>{if(o.isMesh)total+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(total<18000);
});

test('Exterior rays retain slate rooms, concrete guards and raised nighttime panes after the city bake',()=>{
  const {group,windows}=model(),meshes=[];
  group.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const baked=bakeBlocks(meshes,new THREE.MeshStandardMaterial({vertexColors:true}));
  for(const [id,edge,u,y,color] of [
    [944095689,2,.42,2.26,'#5d6c6d'], // Southern Market Street guest rooms
    [944095691,1,.444,3.639,'#52666a'], // Harbor terrace glazing behind handrail
    [944095691,1,.444,3.603,'#bdb8a8'] // Projecting guard on the same bay
  ]){
    const ray=fromFace(mappedBuildings.find(b=>b.id===id),edge,u,y,.195);
    const hit=ray.intersectObjects(baked)[0];
    assert.ok(hit.face.normal.dot(ray.ray.direction)<-.999);
    const sampled=new THREE.Color().fromBufferAttribute(hit.object.geometry.attributes.color,hit.face.a);
    const expected=new THREE.Color(color);
    for(const c of ['r','g','b'])assert.ok(Math.abs(sampled[c]-expected[c])<=.5/255,'Wrong baked '+c+' channel on '+color);
  }
  // Ordinary rooms project their night glass 0.006 in front of the pane.
  // On the balconies it sits 0.009 out, still behind the projecting guard.
  for(const [width,offset] of [[.065,.006],[.071,.009]]){
    const pane=windows.find(p=>p.w===width),normal=new THREE.Vector3(Math.sin(pane.ry),0,Math.cos(pane.ry));
    const ray=new THREE.Raycaster(new THREE.Vector3(pane.x,pane.y,pane.z),normal.negate());
    const hit=ray.intersectObjects(baked)[0];
    assert.ok(Math.abs(hit.distance-offset)<.00001);
    assert.ok(hit.face.normal.dot(ray.ray.direction)<-.999);
  }
});

test('Market foyer and shop doors sit behind concrete while the Drumm porte cochere opens to the hotel lobby',()=>{
  const {group}=model(),site=mappedBuildings.find(b=>b.id===28319370);
  function frontage(a,b,u,y){
    const A=site.p[a],B=site.p[b],dx=B[0]-A[0],dz=B[1]-A[1];
    const n=new THREE.Vector3(-dz,0,dx).normalize();
    const origin=new THREE.Vector3(A[0]+dx*u,y,A[1]+dz*u).addScaledVector(n,.2);
    return new THREE.Raycaster(origin,n.negate()).intersectObject(group)[0];
  }
  function within(hit,depth,tolerance=.001){
    assert.ok(hit&&Math.abs(hit.distance-(.2+depth))<tolerance,'Survey facade depth '+depth);
  }
  within(frontage(1,3,2.5/14,.14),.092);       // Market foyer, behind piers
  within(frontage(1,3,7.5/14,.12),.139);       // inset individual tenant door
  within(frontage(28,29,2.5/11,.18),.545);     // two vehicle widths to the inner wall
  within(frontage(28,29,2.5/11,.319),-.004);   // perimeter beam above opening
  const through=frontage(29,0,.12,.15);        // drive is longitudinally clear
  assert.ok(!through||through.distance>3.5);
  within(frontage(29,0,.12,.40),-.004);        // sign above the drive
  within(frontage(29,0,.60,.16),-.002);        // solid axial pier beside it
});
