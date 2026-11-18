import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {downtownBuilding} from '../app/downtown-buildings.ts';
import {mappedBuildings} from '../app/sf-map.ts';
import {bakeBlocks} from '../app/city-blocks.ts';
import data from '../public/data/downtown-roofs.json' with {type:'json'};

test('the surveyed main roof, raised outlines and actual floor count survive district batching',()=>{
  const b=mappedBuildings.find(b=>b.name==='First Market Tower'),[roof,steps]=data.roofs[b.id];
  const material=new THREE.MeshStandardMaterial(),parts=[];
  downtownBuilding((g,c,x,y,z)=>{const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.updateMatrixWorld();parts.push(m);return m;},b,b.h,false);
  assert.ok(steps.length>0);assert.equal(parts.length,1+steps.length);
  const primary=parts[0],bounds=new THREE.Box3().setFromObject(primary);
  assert.ok(Math.abs(bounds.max.y-roof)<1e-5);
  const [chunk]=bakeBlocks([primary],material),grid=chunk.geometry.getAttribute('facadeGrid');
  const floors=Array.from({length:grid.count},(_,i)=>grid.getY(i));
  assert.equal(Math.round(Math.max(...floors)),data.profiles[b.id][1]);
  assert.ok(parts.slice(1).every(p=>Math.abs(new THREE.Box3().setFromObject(p).min.y-roof)<1e-5));
});

test('tall mapped superstructures keep their base below them and inferred windows stop on roofs',()=>{
  const b=mappedBuildings.find(b=>b.name==='Hyatt Regency San Francisco'&&!b.parent);
  const parts=[];
  downtownBuilding((g,c,x,y,z)=>{const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial());m.position.set(x,y,z);parts.push(m);return m;},b,b.h,true,'#c5b69e');
  assert.equal(parts.length,1);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(parts[0]).max.y-b.h)<1e-5);
  const {normal,facadeGrid}=parts[0].geometry.attributes;
  for(let i=0;i<normal.count;i++)if(Math.abs(normal.getY(i))>.9)assert.equal(facadeGrid.getZ(i),-1);
});

test('sunlight reaches the measured lower terrace of Two Transamerica Center after batching',()=>{
  const b=mappedBuildings.find(b=>b.id===32859283),m=new THREE.MeshStandardMaterial(),parts=[];
  downtownBuilding((g,c,x,y,z)=>{const face=new THREE.Mesh(g,m);face.position.set(x,y,z);face.updateMatrixWorld();parts.push(face);return face;},b,b.h,false);
  const blocks=bakeBlocks(parts,m);blocks.forEach(o=>o.updateMatrixWorld());
  const roofAt=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,12,z),new THREE.Vector3(0,-1,0)).intersectObjects(blocks,false)[0]?.point.y;
  assert.ok(Math.abs(roofAt(24.5523,-37.3959)-4.455)<.002);
  assert.ok(Math.abs(roofAt(23.8892,-37.0997)-4.715)<.002);
});
