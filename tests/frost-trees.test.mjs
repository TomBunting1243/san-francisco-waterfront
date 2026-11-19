import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import measured from '../public/data/frost-trees.json' with {type:'json'};
import records from '../public/data/market-street.json' with {type:'json'};
import {addSurveyedFrostTree} from '../app/frost-trees.ts';

function create(id,month){
  const row=records.trees.find(r=>r[0]===id),[x,z]=row[1],root=new THREE.Group();
  const make=(g,color,x,y,z)=>{
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color}));
    m.position.set(x,y,z);root.add(m);return m;
  };
  const handled=addSurveyedFrostTree(make,x,.049,z,id,row[2],row[3]*.0254*.03,month);
  root.updateMatrixWorld(true);return {root,x,z,handled};
}

test('the seven local crowns retain mapped trunks and fit the registered summer elevations and widths',()=>{
  for(const [key,{boundsM}] of Object.entries(measured)){
    const {root,x,z,handled}=create(Number(key),7);assert.equal(handled,true);
    assert.equal(root.children.length,2);
    const crown=root.children.find(p=>p.userData.plantCrown);
    const bounds=new THREE.Box3().setFromObject(crown);
    const sample=[bounds.min.x-x,bounds.max.x-x,bounds.min.z-z,bounds.max.z-z,bounds.min.y-.049,bounds.max.y-.049];
    sample.forEach((v,i)=>assert.ok(Math.abs(v/.06-boundsM[i])<.003));
    const trunk=new THREE.Raycaster(new THREE.Vector3(x+.04,.050,z),new THREE.Vector3(-1,0,0));
    assert.ok(trunk.intersectObject(root).length>0);
  }
  const other=create(13461,7);assert.equal(other.handled,false);assert.equal(other.root.children.length,0);
});

test('the surveyed London planes retain their winter branching and the evergreen magnolia retains foliage',()=>{
  const bare=create(13457,1),green=create(13455,1);
  assert.equal(bare.root.children.some(p=>p.userData.plantCrown),false);
  assert.equal(green.root.children.some(p=>p.userData.plantCrown),true);
  for(const part of [...bare.root.children,...green.root.children]){
    assert.ok(part.userData.plantAnchor);
    assert.ok(part.geometry.attributes.position.array.every(Number.isFinite));
  }
});
