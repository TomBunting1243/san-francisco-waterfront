import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../app/harbor-font.json' with {type:'json'};
import {ferryClockTower,setFerryClockTime} from '../app/ferry-clock-tower.ts';
import {ferryHall} from '../app/ferry-architecture.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';

const font=new FontLoader().parse(fontData);
const foot=.3048*.06;
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} differs from ${b}`);

test('the historic entry, shaft and four inner dials retain distinct baked light at night',()=>{
  const hall=ferryHall(font),tower=ferryClockTower(font);
  tower.root.position.set(hall.towerX,0,hall.towerZ);hall.root.add(tower.root);hall.root.updateMatrixWorld(true);
  const columns=hall.root.getObjectsByProperty('name','Portico engaged column');
  assert.equal(columns.length,8);
  const type=new THREE.MeshStandardMaterial();
  const lights=bakeRigidChunk('Stone entry columns',columns,type).geometry.getAttribute('signLight');
  const samples=Array.from({length:lights.count},(_,i)=>lights.getX(i));
  assert.ok(Math.max(...samples)>.55&&Math.min(...samples)<.25,'Light rakes the curved faces of the paired columns');
  const dials=tower.root.getObjectsByProperty('name','Inner illuminated clock dial');
  assert.equal(dials.length,4);
  const warm=bakeRigidChunk('Backlit dials',dials,type).geometry.getAttribute('signLight');
  assert.ok(warm.getX(0)>.7&&warm.getX(0)>warm.getY(0)&&warm.getZ(0)<.6);
  const crown=tower.root.getObjectByName('Twenty-two foot clock dial');
  const at=new THREE.Vector3(hall.towerX+.28,2.71,hall.towerZ);
  assert.ok(crown.userData.uplight(at,new THREE.Vector3(-1,0,0))>crown.userData.uplight(at,new THREE.Vector3(1,0,0)));
});

test('Four 22-foot dials and their measured hands share fixed spindles through time changes',()=>{
  const {root,hands}=ferryClockTower(font);root.updateMatrixWorld(true);
  const faces=root.getObjectsByProperty('name','Twenty-two foot clock dial');
  assert.equal(faces.length,4);assert.equal(hands.length,4);
  for(const [h,m] of [[0,0],[3,15],[17,32],[23,59]]){
    setFerryClockTime(hands,h,m);root.updateMatrixWorld(true);
    for(const [i,{minute,hour}] of hands.entries()){
      const face=faces[i],normal=new THREE.Vector3(0,0,1).transformDirection(face.matrixWorld);
      near(normal.dot(new THREE.Vector3(Math.sin(i*Math.PI/2),0,Math.cos(i*Math.PI/2))),1);
      near(face.geometry.parameters.radius*2,22*foot);
      for(const [hand,length,t] of [[minute,11*foot,m*Math.PI/30],[hour,7.5*foot,(h%12+m/60)*Math.PI/6]]){
        hand.geometry.computeBoundingBox();near(hand.geometry.boundingBox.max.y,length);
        const pivot=face.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
        near(pivot.x,0);near(pivot.y,0);assert.ok(pivot.z>0);
        const tip=face.worldToLocal(hand.localToWorld(new THREE.Vector3(0,length,0)));
        near(tip.x,Math.sin(t)*length);near(tip.y,Math.cos(t)*length);
      }
    }
  }
});

test('Both square colonnades and both round lanterns have open sightlines through the tower',()=>{
  const {root}=ferryClockTower(font);root.updateMatrixWorld(true);
  const ray=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(root,true);
  assert.ok(ray(0,2.20).length>0,'Opaque shaft below belfry');
  for(const y of [2.69,3.15,3.38,3.58])assert.equal(ray(.012,y).length,0,'Solid obstruction at '+y);
  for(const y of [2.534,2.875,3.266,3.50])assert.ok(ray(.012,y).length>0,'Missing dividing cornice at '+y);
  near(new THREE.Box3().setFromObject(root,true).max.y,235*foot);
});

test('both ends of the Ferry hall have one roof surface and a closed eave on all six pitches',()=>{
  const {root}=ferryHall(font);
  root.updateMatrixWorld(true);
  const roof=root.getObjectByName('Ferry hall joined roof and portico');
  const gables=root.getObjectsByProperty('name','Ferry Hall end gable');
  assert.equal(gables.length,6);
  const towardGround=new THREE.Vector3(0,-1,0);
  const towardSky=new THREE.Vector3(0,1,0);
  for(const coping of root.getObjectsByProperty('name','Long arcade coping')){
    const box=new THREE.Box3().setFromObject(coping),bay=coping.parent.name==='Ferry Plaza elevation';
    const inner=bay?box.min.z:box.max.z;
    // The metal ends at the inward cheek of the coping on both long walls.
    const sample=z=>new THREE.Raycaster(new THREE.Vector3(2.12,1.4,z),towardGround,0,.55).intersectObject(roof);
    const edge=sample(inner+(bay?-.001:.001))[0];
    assert.ok(edge&&edge.point.y>box.min.y&&edge.point.y<box.max.y);
    assert.equal(sample(inner+(bay?.001:-.001)).length,0);
  }
  for(const gable of gables){
    const center=gable.parent.getWorldPosition(new THREE.Vector3());
    const side=Math.sign(center.x);
    const fromEnd=new THREE.Vector3(-side,0,0);
    const bounds=new THREE.Box3().setFromObject(gable);
    for(const fraction of [.13,.24,.76,.88]){
      const z=THREE.MathUtils.lerp(bounds.min.z,bounds.max.z,fraction);
      const x=center.x-side*.016;
      const at=(x,y,d,far)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),d,0,far);
      const surface=at(x,1.4,towardGround,.55).intersectObject(roof)[0];
      assert.ok(surface,'weather skin reaches the end wall');
      const height=surface.point.y;
      const hits=at(x,height+.003,towardGround,.006).intersectObjects([roof,gable]);
      assert.equal(hits.length,1,'stone and metal compete on the end pitch at '+[x,z]);
      const overhang=center.x+side*.012;
      const under=at(overhang,height-.030,towardSky,.030).intersectObject(roof)[0];
      assert.ok(under&&height-under.point.y>.005,'overhang has a distinct underside');
      assert.ok(at(center.x+side*.070,(height+under.point.y)/2,fromEnd,.085).intersectObject(roof).length,'exposed eave edge is closed');
      assert.ok(at(center.x+side*.070,under.point.y-.003,fromEnd,.080).intersectObject(gable).length,'masonry reaches the underside');
    }
  }
});

test('the baked Ferry roof closes the portico, fits the clock shaft and carries both sign racks',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const world=createLandscape(),hall=ferryHall(font);
  const parts=world.architectureChunks,skin=hall.root.getObjectByName('Ferry hall joined roof and portico');
  hall.root.updateMatrixWorld(true);
  const down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
  const vertical=(x,z,start=1.4)=>new THREE.Raycaster(new THREE.Vector3(x,start,z),down,0,.58).intersectObjects(parts,false);
  const skinAt=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,1.4,z),down,0,.55).intersectObject(skin);
  // The assembled portico used to expose the floor at .103 and contained
  // no weather skin. Both shoulders now meet the shaft on all four sides.
  for(const dx of [-1,-.68,.68,1])near(vertical(hall.towerX+dx,-1.52)[0].point.y,.998);
  const soffit=new THREE.Raycaster(new THREE.Vector3(hall.towerX+.67,.855,-1.52),up,0,.15).intersectObjects(parts,false)[0];
  near(soffit.point.y,.976);
  for(const [dx,dz] of [[-.33,0],[.33,0],[0,-.33],[0,.33]]){
    const x=hall.towerX+dx,z=hall.towerZ+dz;
    const hits=skinAt(x,z);assert.equal(hits.length,1);
    near(vertical(x,z,1.07)[0].point.y,hits[0].point.y);
    assert.equal(skinAt(hall.towerX+dx*.94,hall.towerZ+dz*.94).length,0);
  }
  const torso=new THREE.Vector3(hall.towerX,1.08,hall.towerZ);
  for(const dir of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]){
    const origin=torso.clone().addScaledVector(new THREE.Vector3(...dir),.38);
    const hit=new THREE.Raycaster(origin,new THREE.Vector3(...dir).negate(),0,.08).intersectObjects(parts,false)[0];
    assert.ok(hit&&Math.abs(hit.distance-.056)<.002,'solid clock shaft above roof');
  }
  // The two grades at the nave valley are joined by a flashing face.
  const flashing=new THREE.Raycaster(new THREE.Vector3(-2.12,.921,.359),new THREE.Vector3(0,0,-1),0,.10)
    .intersectObjects(parts,false)[0];
  near(flashing.point.z,.305);
  for(const z of [-.183,-.177,.302,.308,.662,.668,1.143,1.147,1.400,1.406]){
    const hits=vertical(-2.125,z).filter(h=>h.point.y>.88);
    assert.equal(hits.length,1,'one exposed roof surface at '+z);
  }
  const shoes=hall.root.getObjectsByProperty('name','Sign rack roof shoe');
  assert.ok(shoes.length>12);
  for(const shoe of shoes){
    const p=shoe.getWorldPosition(new THREE.Vector3());
    const roofHit=skinAt(p.x,p.z)[0];assert.ok(roofHit);
    near(p.y-roofHit.point.y,.003);
    const from=roofHit.point.clone().addScaledVector(up,.06);
    const hits=new THREE.Raycaster(from,down,0,.07).intersectObjects(parts,false);
    assert.ok(hits.some(h=>Math.abs(h.point.y-roofHit.point.y)<.00002));
  }
});

test('print focus follows the actual projecting clock, cornices, lantern and flag across opening and orbit views',async()=>{
  const {towerPrintFocus}=await import('../app/harbor-print.ts');
  const hall=ferryHall(font),{root}=ferryClockTower(font);
  root.position.set(hall.towerX,0,hall.towerZ);root.updateMatrixWorld(true);
  const tower=towerPrintFocus(new THREE.Vector3(hall.towerX,2.035,hall.towerZ));
  const target=new THREE.Vector3(0,.83,0),point=new THREE.Vector3();
  const protectedAt=(u,v)=>tower.bounds.some(r=>u>=r.x&&v>=r.y&&u<=r.z&&v<=r.w);
  for(const [aspect,yaw,lens] of [[1.6,3.145,21.5],[390/844,3.10,18],[1.6,2.42,21.5]]){
    const camera=new THREE.PerspectiveCamera(20,aspect,.35,1800);
    camera.setFocalLength(lens);camera.position.set(9.6*Math.sin(yaw),1.13,9.6*Math.cos(yaw)).add(target);
    camera.lookAt(target);camera.updateMatrixWorld();tower.update(camera);
    root.traverse(part=>{
      if(!part.isMesh)return;
      const pos=part.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        point.fromBufferAttribute(pos,i).applyMatrix4(part.matrixWorld).project(camera);
        assert.ok(protectedAt(point.x*.5+.5,point.y*.5+.5),'unprotected tower vertex on '+part.name);
      }
    });
    assert.ok(!protectedAt(.17,.88)&&!protectedAt(.81,.73),'unrelated skyline remains eligible for the wash');
    camera.rotateY(Math.PI);camera.updateMatrixWorld();tower.update(camera);
    assert.ok(tower.bounds.every(r=>r.z<0),'a tower behind the viewer creates no focus rectangle on screen');
  }
});

test('pitched views through both west arcades see one finish from the shop floor through the eaves',()=>{
  const {root}=ferryHall(font),street=root.getObjectByName('Embarcadero arcade and portico');
  root.updateMatrixWorld(true);
  const parts=[];
  root.traverse(m=>{if(m.isMesh)parts.push([m,new THREE.Box3().setFromObject(m)]);});
  const frontage=street.position.z;
  const bays=street.children.filter(o=>o.name==='Pierced arcade panel');
  assert.equal(bays.length,30);
  for(const slope of [.38,.90]){
    let floorViews=0;
    const dir=new THREE.Vector3(.13,-slope,1).normalize(),ray=new THREE.Raycaster();
    for(const bay of bays)for(const y of [.147,.24,.44,.61,.919]){
      const opening=bay.getWorldPosition(new THREE.Vector3());
      opening.set(opening.x+.0067,y,frontage);
      ray.set(opening.clone().addScaledVector(dir,-.73),dir);
      const candidates=parts.filter(([,box])=>ray.ray.intersectsBox(box)).map(([m])=>m);
      const hits=ray.intersectObjects(candidates),first=hits[0];
      assert.ok(first,'missing surface behind '+opening.toArray());
      const owners=new Set(hits.filter(h=>h.distance<first.distance+.000012).map(h=>h.object));
      assert.equal(owners.size,1,'competing surfaces at '+first.point.toArray());
      if(Math.abs(first.point.y-.103)<.00001){
        floorViews++;
        assert.equal(first.object.name,'Recessed arcade paving');
      }
    }
    assert.ok(floorViews>=24,'rays must reach the floor beyond the arches at each pitch');
  }
});

test('night glass, neon and stone retain their own colors in the baked Ferry Building',()=>{
  const hall=ferryHall(font),tower=ferryClockTower(font),mat=new THREE.MeshStandardMaterial();
  tower.root.position.set(hall.towerX,0,hall.towerZ);hall.root.add(tower.root);hall.root.updateMatrixWorld(true);
  const shaft=tower.root.children.find(mesh=>mesh.isMesh&&mesh.scale.y===1.6);
  const baked=part=>bakeRigidChunk('night sample',[part],mat).geometry.getAttribute('signLight');
  const flood=baked(shaft);
  assert.ok(flood.getZ(0)>flood.getX(0)*.90,'neutral roof flood preserves the blue channel in the limestone');
  const ring=baked(tower.root.getObjectByName('Twenty-two foot clock dial'));
  assert.ok(ring.getX(0)>2.7*ring.getZ(0),'backlit chapter ring reads gold against the cooler shaft');
  const rooms=hall.root.getObjectsByProperty('name','East round-headed sash');
  const occupied=rooms.filter(o=>o.userData.signLight);
  assert.ok(occupied.length>3&&occupied.length<rooms.length/2);
  const interior=baked(hall.root.getObjectByName('Recessed west glazing and shop interiors'));
  const peaks=Array.from({length:interior.count},(_,i)=>interior.getX(i));
  assert.ok(Math.max(...peaks)>.28&&Math.min(...peaks)<.02,'light originates behind darker shop and door frames');
  for(const label of ['PORT OF','SAN FRANCISCO']){
    const letters=hall.root.getObjectByName(label),neon=baked(letters),normal=letters.geometry.getAttribute('normal');
    const bay=Array.from({length:normal.count},(_,i)=>i).find(i=>normal.getZ(i)>.99);
    const city=Array.from({length:normal.count},(_,i)=>i).find(i=>normal.getZ(i)<-.99);
    assert.ok(neon.getX(bay)>.9&&neon.getY(bay)<.15&&neon.getX(city)<neon.getX(bay)*.4);
  }
});
