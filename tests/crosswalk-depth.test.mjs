import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {createMarketPaving} from '../app/market-paving.ts';
import {createLandscape} from '../app/landscape.ts';
import data from '../public/data/promenade-crossings.json' with {type:'json'};

test('the baked Howard Street crossing clears the asphalt and gutter depth at the 20× waterfront review pose',t=>{
  const {architectureChunks}=createLandscape();
  const target=new THREE.Vector3(-24,2.4,.8),camera=new THREE.PerspectiveCamera(20,16/9,.35,1800);
  camera.position.set(-24,43.078352,34.289128);
  camera.lookAt(target);camera.setFocalLength(800);camera.updateMatrixWorld(true);
  const downward=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
  const pigment=h=>new THREE.Color().fromBufferAttribute(h.object.geometry.getAttribute('color'),h.face.a).getHexString();
  // Restrict raycasting to batches whose actual bounds meet this one junction.
  const area=new THREE.Box3(new THREE.Vector3(-27,.025,-5),new THREE.Vector3(-21,.04,1));
  const candidates=architectureChunks.filter(chunk=>chunk.geometry.boundingBox.intersectsBox(area));
  const substrates=new Set();let tied=0,samples=0;
  const legs=data.crossings.filter(triangles=>triangles.every(tri=>tri.every(([x])=>x>=-27&&x<=-21)));
  assert.equal(legs.length,5);
  for(const triangles of legs)for(const tri of triangles){
    const p=new THREE.Vector3();
    for(const [x,z,y] of tri)p.add(new THREE.Vector3(x,y,z));
    p.multiplyScalar(1/3);ray.set(new THREE.Vector3(p.x,.08,p.z),downward);
    const hits=ray.intersectObjects(candidates,false);
    const pi=hits.findIndex(h=>pigment(h)==='e1ddcd');assert.ok(pi>=0);
    const [paint,base]=hits.slice(pi);
    assert.equal(pigment(paint),'e1ddcd');substrates.add(pigment(base));
    assert.ok(Math.abs(paint.point.y-base.point.y-.00024)<.000012,'surveyed four-millimetre separation');
    const toward=p.clone().sub(camera.position).normalize();
    const depthBin=y=>Math.round((p.clone().addScaledVector(toward,(y-p.y)/toward.y).project(camera).z*.5+.5)*0xffffff);
    const front=depthBin(paint.point.y),back=depthBin(base.point.y);
    if(front===back)tied++;
    const m=paint.object.material;
    assert.equal(base.object.material.polygonOffset,false,'street and gutter are ordinary opaque surfaces');
    assert.equal(m.transparent,false);assert.equal(m.depthTest,true);
    assert.ok(m.polygonOffset&&m.polygonOffsetFactor===0&&front+m.polygonOffsetUnits<=back-2,
      'the final draw material must separate the paint even when both surfaces occupy the same depth bin');
    for(const above of hits.slice(0,pi))assert.ok(depthBin(above.point.y)<front+m.polygonOffsetUnits,'rails above the marking still occlude it');
    samples++;
  }
  assert.deepEqual([...substrates].sort(),['899692','92928a']);
  assert.ok(samples>75&&tied>0);
  t.diagnostic(tied+' of '+samples+' baselines quantize to the same 24-bit depth at this pose');
});

test('the northern plaza return terminates the zebra on the gutter and leaves the raised tip bare',()=>{
  const meshes=[createMarketPaving()];
  addSurveyBlocks(g=>{const m=new THREE.Mesh(g);meshes.push(m);return m;});
  const bounds=new THREE.Box3(new THREE.Vector3(6.1,.02,-4.4),new THREE.Vector3(6.71,.08,-3.90));
  const local=meshes.filter(m=>{m.geometry.computeBoundingBox();return m.geometry.boundingBox.intersectsBox(bounds);});
  const surfaces=local.filter(m=>!m.geometry.userData.roadPaint);
  const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0));
  ray.ray.origin.set(6.234447956,.13,-4.075659275);
  const tip=ray.intersectObjects(local,false);
  assert.ok(tip[0].point.y>.036&&!tip.some(h=>h.object.geometry.userData.roadPaint));
  let asphalt=false,gutter=false;
  for(const tri of data.crossings[23])for(const w of [[.87,.07,.06],[.07,.87,.06],[.07,.06,.87]]){
    const [x,z,y]=[0,1,2].map(j=>tri.reduce((v,p,i)=>v+p[j]*w[i],0));
    ray.ray.origin.set(x,.13,z);
    const h=ray.intersectObjects(surfaces,false)[0];
    assert.ok(h&&Math.abs(y-h.point.y-.00024)<.00003);
    asphalt||=h.object.name.startsWith('Surveyed streets');
    gutter||=h.object.name.startsWith('Surveyed curb')&&h.point.y<.03201;
  }
  assert.ok(asphalt&&gutter);
});
