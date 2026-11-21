import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {createRememberedWaterfront} from '../app/remembered-waterfront.ts';
import {mappedBuildings} from '../app/sf-map.ts';
import {hasShorelineFacade,shorelineFacade} from '../app/shoreline-facades.ts';
import {architectureProfile} from '../app/reference-architecture.ts';

import {hillsPlant as plant,hillsBuildings,hillsSign,hillsPalomino,terraceDoors} from '../app/hills-plaza.ts';

function rayFrom(g,x,y){
  return new THREE.Raycaster(g.localToWorld(new THREE.Vector3(x,y,1)),
    new THREE.Vector3(0,0,-1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion())));
}

test('a Hills Bros. bay has real masonry depth and the Hills Plaza arcade is open through',()=>{
  const {root,windows}=shorelineFacade(plant,[],'#a7806a');
  root.updateMatrixWorld(true);
  const front=root.children[1],wall=front.getObjectByName('Punched masonry facade');
  const opening=front.children.find(m=>m.name==='Recessed sash glazing');
  opening.geometry.computeBoundingBox();
  const x=opening.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
  const ray=rayFrom(front,x,.27);
  assert.equal(ray.intersectObject(wall).length,0);
  const hit=ray.intersectObject(opening)[0];
  assert.ok(hit && front.worldToLocal(hit.point).z<-.07);
  assert.ok(rayFrom(front,-Math.hypot(2.5,.375)/2+.02,.27).intersectObject(wall).length>0);
  const arcade=root.getObjectByName('Open Hills Plaza promenade arcade');
  const masonry=arcade.getObjectByName('Open arcade brickwork');
  assert.equal(rayFrom(arcade,-.332,.30).intersectObject(masonry).length,0);
  assert.ok(rayFrom(arcade,0,.30).intersectObject(masonry).length>0);
  assert.ok(windows.length>100);
});

test('the two Infinity street buildings replace their own mass without taking a documented neighboring frontage',()=>{
  const candidates=mappedBuildings.filter(b=>!b.part&&hasShorelineFacade(b));
  assert.deepEqual(candidates.map(b=>b.id).sort((a,b)=>a-b),[191861045,421816058]);
  assert.ok(candidates.every(b=>!architectureProfile(b)));
  const west=shorelineFacade(candidates.find(b=>b.id===421816058),[],'#a2afa4');
  assert.equal(west.root.name,'333 Main Street');
  assert.ok(west.root.getObjectsByProperty('name','Recessed sash glazing').length>100);
});

test('the six-storey plant, 345 Spear atrium and former restaurant face the open Hills passage',async()=>{
  const {insideBuilding}=await import('../app/building-character.ts');
  const {hillsCourt,hillsAtrium}=await import('../app/hills-plaza.ts');
  const office=hillsBuildings.find(b=>b.id===-345);
  assert.ok(hillsBuildings.every(hasShorelineFacade));
  assert.ok(insideBuilding(...hillsSign.point,plant.p));
  assert.ok(!insideBuilding(...hillsSign.point,office.p));
  const restaurant=createRememberedWaterfront(new FontLoader().parse(fontData)).getObjectByName('Palomino');
  restaurant.updateMatrixWorld(true);
  const seats=restaurant.getObjectsByProperty('name','Palomino dining set');
  assert.equal(seats.length,8);
  const courtModel=shorelineFacade(plant,hillsBuildings,'#a9806b').root;
  courtModel.updateMatrixWorld(true);
  const floor=courtModel.getObjectByName('Hills Plaza public passage');
  for(const set of seats){
    const p=set.getWorldPosition(new THREE.Vector3());
    assert.ok(insideBuilding(p.x,p.z,hillsCourt));
    assert.ok(hillsBuildings.every(b=>!insideBuilding(p.x,p.z,b.p)));
    const support=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,.02,0)),new THREE.Vector3(0,-1,0)).intersectObject(floor)[0];
    assert.ok(support&&Math.abs(support.point.y-p.y)<.00001,'chairs and tables stand on the terrace');
    const tabletop=new THREE.Box3().setFromObject(set.children[0]);
    assert.ok((tabletop.max.y-p.y)/.06>.72&&(tabletop.max.y-p.y)/.06<.82);
  }
  const model=shorelineFacade(office,hillsBuildings,'#aa8874').root;
  model.updateMatrixWorld(true);
  const doors=model.getObjectsByProperty('name','Palomino terrace doorway');
  assert.equal(doors.length,terraceDoors.length);
  for(const face of doors){
    const wall=face.getObjectByName('Punched masonry facade');
    const panes=face.getObjectsByProperty('name','Recessed sash glazing');
    const terrace=panes.filter(m=>{m.geometry.computeBoundingBox();return m.geometry.boundingBox.min.y<.30;});
    assert.equal(terrace.length,3);
    for(const pane of terrace){
      const {min,max}=pane.geometry.boundingBox;
      for(const u of [.1,.5,.9])for(const y of [.169,.209,.254]){
        const ray=rayFrom(face,min.x+(max.x-min.x)*u,y);
        assert.equal(ray.intersectObject(wall).length,0,'masonry cuts across the terrace glass');
      }
    }
  }
  assert.equal(hillsPalomino.y,.129);
  const roofs=model.getObjectByName('Roof deck'),atrium=model.getObjectByName('Sheltered 345 Spear atrium');
  const [x,z]=hillsAtrium.slice(0,-1).reduce(([X,Z],[a,b])=>[X+a/4,Z+b/4],[0,0]);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0));
  model.updateMatrixWorld(true);assert.equal(ray.intersectObject(roofs).length,0);
  assert.ok(Math.abs(ray.intersectObject(atrium)[0].point.y-.463)<.00001);
  const body=shorelineFacade(plant,hillsBuildings,'#a9806b').root;
  const front=body.children[1];front.updateMatrixWorld(true);
  const rows=new Set(front.getObjectsByProperty('name','Recessed sash glazing').map(m=>{
    m.geometry.computeBoundingBox();return m.geometry.boundingBox.min.y.toFixed(3);
  }));
  assert.equal(rows.size,6);
  const gravel=body.getObjectByName('Gravel roof behind the brick parapet');
  for(let i=0;i<gravel.geometry.attributes.normal.count;i++)assert.ok(gravel.geometry.attributes.normal.getY(i)>.999);
});

test('Folsom Metro rails descend inside a physical cut while the outside Muni tracks remain at street grade',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const {trackAt,trackCenterlines,streetcarTrack}=await import('../app/streets.ts');
  const {default:records}=await import('../public/data/folsom-portal.json',{with:{type:'json'}});
  const w=createLandscape();w.root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  function vertical(x,z,eye=.80){
    ray.set(new THREE.Vector3(x,eye,z),down);
    return ray.intersectObject(w.root,true).map(h=>h.point.y);
  }
  const cuts=records.sections[1],deck=[];
  for(const i of [1,5,10,14]){
    const [a,b]=cuts[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    const bed=vertical(x,z)[0];
    deck.push(bed);
    for(const center of [a,b]){
      const width=Math.hypot(a[0]-b[0],a[1]-b[1]);
      for(const sign of [-1,1]){
        const n=sign*(streetcarTrack.gauge+streetcarTrack.railHead)/2/width;
        const steel=vertical(center[0]+n*(a[0]-b[0]),center[1]+n*(a[1]-b[1]));
        assert.ok(steel.some(y=>Math.abs(y-bed-.008)<.00025),'both gauge faces survive in the baked city');
      }
    }
    for(const track of trackCenterlines){
      const outer=trackAt(x,track),offset=(streetcarTrack.gauge+streetcarTrack.railHead)/2;
      const steel=vertical(x+Math.sin(outer.heading)*offset,outer.z+Math.cos(outer.heading)*offset);
      assert.ok(steel.some(y=>Math.abs(y-streetcarTrack.railTop)<.0002));
    }
  }
  assert.ok(deck.every((v,i)=>!i||v<deck[i-1]-.03),'the trench is open to the measured running grade');
  assert.ok(deck[0]>.032&&deck[0]<.044&&deck.at(-1)<-.22);
  const roof=vertical(-26.88,-2.711),below=vertical(-26.88,-2.711,0);
  assert.ok(Math.abs(roof[0]-.095)<.00001);
  assert.ok(below[0]<-.30,'a rail vehicle has headroom inside the short covered throat');
});
