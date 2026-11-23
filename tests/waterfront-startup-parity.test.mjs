import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import survey from '../public/data/survey-blocks.json' with {type:'json'};
import {streetPose,streetPoses} from '../app/streets.ts';
import {addSurveyBlocks,addSurveyFront} from '../app/survey-blocks.ts';

test('station buckets reproduce the full road scan in both directions at stations, junctions and beyond the map',()=>{
  const segments=map.roads.filter(r=>r.name==='The Embarcadero')
    .flatMap(r=>r.p.slice(1).map((b,i)=>[r.p[i],b])).filter(([a,b])=>Math.abs(b[0]-a[0])>.01);
  const stations=new Set([-1000,1000,-Infinity,Infinity,NaN]);
  for(let i=0;i<=1600;i++)stations.add(-80+.1*i);
  for(const segment of segments)for(const [x] of segment){
    stations.add(x);stations.add(x-.000001);stations.add(x+.000001);
  }
  for(const x of stations){
    let matches=segments.filter(([a,b])=>x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]));
    if(!matches.length){
      const distance=([a,b])=>Math.min(Math.abs(x-a[0]),Math.abs(x-b[0]));
      matches=[segments.reduce((best,s)=>distance(s)<distance(best)?s:best)];
    }
    const values=matches.map(([a,b])=>{
      const t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));
      return {z:a[1]+(b[1]-a[1])*t,slope:(b[1]-a[1])/(b[0]-a[0])};
    }).sort((a,b)=>a.z-b.z);
    const expected=[-1,1].map(dir=>{
      const p=dir>0?values.at(-1):values[0];
      return {x,z:p.z,heading:-Math.atan(p.slope)+(dir>0?0:Math.PI)};
    });
    assert.deepEqual(streetPoses(x),expected);
    assert.deepEqual(streetPose(x,-1),expected[0]);
    assert.deepEqual(streetPose(x),expected[1]);
  }
});

test('every survey tile and courtyard frontage has the same normal bytes as Three',()=>{
  const meshes=[];
  const collect=geometry=>{
    const mesh=new THREE.Mesh(geometry);
    meshes.push(mesh);return mesh;
  };
  addSurveyBlocks(collect);
  for(const key of Object.keys(survey.fronts)){
    const building=map.buildings.find(b=>b.id===Number(key));
    assert.ok(building&&Number.isFinite(building.h));
    assert.ok(addSurveyFront(collect,building.id,building.h));
  }
  const tiles=meshes.filter(m=>m.name.startsWith('Surveyed streets and buildings')||
    m.name.startsWith('Promenade sidewalk slabs')||m.name==='Market Street beyond Montgomery'||
    m.name==='Northern Embarcadero street and pier approaches'||m.name==='Bayside Village and Brannan courtyard frontage');
  assert.ok(tiles.length>80);
  for(const {geometry:g,name} of tiles){
    const original=g.attributes.normal.array;
    g.deleteAttribute('normal');g.computeVertexNormals();
    const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
    assert.ok(bytes(original).equals(bytes(g.attributes.normal.array)),name);
  }
});
