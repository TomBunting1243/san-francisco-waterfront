import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {downtownBuilding} from '../app/downtown-buildings.ts';
import {mappedBuildings} from '../app/sf-map.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import observations from '../public/data/roof-finishes.json' with {type:'json'};
import lidar from '../public/data/downtown-roofs.json' with {type:'json'};

function colors(building,framed){
  const material=new THREE.MeshStandardMaterial(),parts=[];
  downtownBuilding((geometry,paint,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);mesh.updateMatrixWorld();parts.push(mesh);return mesh;
  },building,building.h,false,framed);
  const [baked]=bakeBlocks([parts[0]],material);
  const {normal,color}=baked.geometry.attributes;
  const roof=new Set(),wall=new Set();
  for(let i=0;i<normal.count;i++){
    const y=normal.getY(i),pigment='#'+new THREE.Color().fromBufferAttribute(color,i).getHexString();
    if(y>.99)roof.add(pigment);
    if(Math.abs(y)<.01)wall.add(pigment);
  }
  return {roof,wall};
}

test('distinct roof-interior observations survive district batching without repainting walls',()=>{
  for(const [id,finish] of [[32947729,'#cdcdcb'],[192305909,'#a2a5a2'],[24335195,'#c9c9c7']]){
    const b=mappedBuildings.find(b=>b.id===id);
    assert.equal(observations.finishes[id],finish);
    const result=colors(b);
    assert.deepEqual([...result.roof],[finish]);assert.ok(result.wall.size&&!result.wall.has(finish));
    assert.ok(!colors(b,'#85949a').roof.has(finish));
  }
});
test('archive observations cover only single compatible roofs; absent records retain the existing finish',()=>{
  assert.equal(observations.year,2022);
  assert.match(observations.source,/NAIP_2022\/ImageServer$/);
  const surveyed=mappedBuildings.filter(b=>observations.finishes[b.id]);
  assert.ok(surveyed.length>200);
  for(const b of surveyed){
    assert.ok(lidar.roofs[b.id]&&!b.part&&!b.minH);
    assert.match(observations.finishes[b.id],/^#[a-f0-9]{6}$/);
  }
  const b={id:-2,p:[[0,0],[1,0],[1,1],[0,1]],h:1,measured:false,glass:false};
  assert.deepEqual([...colors(b).roof],['#b1b5af']);
});
