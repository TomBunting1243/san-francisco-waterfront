import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import typeface from '../app/harbor-font.json' with {type:'json'};
import {backgroundFrontage} from '../app/background-frontages.ts';
import {sfMap} from '../app/sf-map.ts';
import {surveyedHeight} from '../app/survey-blocks.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {createLandscape} from '../app/landscape.ts';
import {boundWaterfrontFocus} from '../app/camera.ts';

const lot=sfMap.buildings.find(b=>b.id===193054137);
const [a,b]=lot.p.slice(2,4),width=Math.hypot(b[0]-a[0],b[1]-a[1]),yaw=Math.atan2(a[1]-b[1],b[0]-a[0]);
const north=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
function at(u,y,v){
  return new THREE.Vector3((a[0]+b[0])/2+u*Math.cos(yaw)+v*Math.sin(yaw),y,
    (a[1]+b[1])/2-u*Math.sin(yaw)+v*Math.cos(yaw));
}
test('Angler has real display openings, a revolving door and separately lit sconce glass after the city bake',()=>{
  const {root,windows}=backgroundFrontage(lot,surveyedHeight(lot.id),new FontLoader().parse(typeface));
  root.updateMatrixWorld(true);
  const parts=[];root.traverse(o=>{if(o.isMesh)parts.push(o);});
  const mesh=bakeRigidChunk('Actual restaurant front',parts,new THREE.MeshStandardMaterial({vertexColors:true}));
  const ray=new THREE.Raycaster(),direction=north.clone().negate();
  function first(x,y){ray.set(at(x,y,.60),direction);return ray.intersectObject(mesh)[0];}
  for(const side of [-1,1]){
    assert.ok(first(side*width*.303,.169).distance>1.10,'view extends 8 m into lounge');
    const sconce=first(side*.135+.0015,.223);
    const light=mesh.geometry.attributes.signLight;
    assert.ok(light.getX(sconce.face.a)>.6&&light.getY(sconce.face.a)>.3);
    function rgb(hit){
      const {a,b,c}=hit.face,position=mesh.geometry.attributes.position;
      const verts=[a,b,c].map(i=>new THREE.Vector3().fromBufferAttribute(position,i));
      const w=THREE.Triangle.getBarycoord(hit.point,...verts,new THREE.Vector3()).toArray();
      return ['getX','getY','getZ'].map(channel=>[a,b,c].reduce((sum,i,j)=>sum+w[j]*light[channel](i),0));
    }
    const [hot,amber]=rgb(first(side*.125,.224));
    const [cool]=rgb(first(side*.125,.095));
    assert.ok(hot>.20&&hot>amber*1.35&&hot>cool+.17,'warm falloff around each wall fixture');
    function fromAbove(x,z){ray.set(at(x,.123,z),new THREE.Vector3(0,-1,0));return ray.intersectObject(mesh)[0];}
    const table=rgb(fromAbove(side*(width*.303+.004),-.144));
    const floor=rgb(fromAbove(side*.25,-.226));
    const entry=rgb(fromAbove(0,-.035));
    assert.ok(table[0]>.26&&table[0]>table[1]*1.45,'pendants pick out wood tabletops');
    assert.ok(floor[0]>.25&&floor[0]>entry[0]*1.8,'light pools on floor behind the display window');

  }
  const hood=first(.045,.211),flatLeaf=first(-.064,.102);
  assert.ok(flatLeaf.distance-hood.distance>.032,'offset bronze cylinder projects past the flat leaf');
  assert.ok(windows.every(p=>p.y>.36),'no uniform night window screens across ground-floor views');
  assert.ok(mesh.geometry.index.count/3<4800);
});

test('the fixed waterfront observation at 800 mm sees all three Angler bays through the assembled scene',()=>{
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const focus=new THREE.Vector3(-16.673,2.4,.082);
  assert.deepEqual(boundWaterfrontFocus(focus.x,focus.z),{x:focus.x,z:focus.z});
  const eye=new THREE.Vector3(-9.962795,27.291597,46.034492);
  const camera=new THREE.PerspectiveCamera(50,1440/900,.35,800);camera.setFocalLength(20*40);
  camera.position.copy(eye);camera.lookAt(focus);camera.updateMatrixWorld(true);
  const meshBoxes=[];
  function place(mesh){meshBoxes.push([mesh,new THREE.Box3().setFromObject(mesh)]);}
  world.root.traverseVisible(o=>{if(o.isMesh&&!o.material.transparent&&!o.isInstancedMesh&&!o.isBatchedMesh)place(o);});
  for(const t of world.treeBatches)place(new THREE.Mesh(t.high,world.treeDraw.material));
  function hit(origin,through,extra){
    const direction=through.clone().sub(origin).normalize(),to=through.clone().addScaledVector(direction,extra);
    const bounds=new THREE.Box3().setFromPoints([origin,to]);
    return new THREE.Raycaster(origin,direction,0,origin.distanceTo(to)).intersectObjects(
      meshBoxes.filter(([,b])=>b.intersectsBox(bounds)).map(([o])=>o),false)[0];
  }
  for(const u of [-.252,0,.252]){
    const entry=at(u,.180,0),projected=entry.clone().project(camera);
    assert.ok(Math.abs(projected.x)<.6&&Math.abs(projected.y)<.45);
    const h=hit(eye,entry,.60);assert.ok(h);
    const behind=entry.clone().sub(h.point).dot(north);
    assert.ok(behind>.14&&behind<.35,'ray terminates on room furnishings or floor');
    if(u!==0){
      const glow=h.object.geometry.getAttribute('signLight');
      assert.ok(Math.max(...[h.face.a,h.face.b,h.face.c].map(i=>glow.getX(i)))>.24,'real orbit sees a lit interior receiving surface');
    }
  }
  for(const u of [-.25,0,.25])for(const v of [-.031,.008,.027,.043,.057]){
    const top=hit(at(u,.050,v),at(u,.039,v),0);
    assert.ok(top&&Math.abs(top.point.y-.045)<.0002,'continuous sill to measured sidewalk 277');
  }
});
