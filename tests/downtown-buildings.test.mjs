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

test('recorded use fits alongside the original daylight seed without changing wall styles or packing',()=>{
  const cases=[[37058253,1],[32610816,1],[28319289,2],[32947711,3],[32862740,0]];
  for(const [id,category] of cases){
    const b=mappedBuildings.find(b=>b.id===id),parts=[],material=new THREE.MeshStandardMaterial();
    downtownBuilding((g,c,x,y,z)=>{const m=new THREE.Mesh(g,material);m.position.set(x,y,z);parts.push(m);return m;},b,b.h,false);
    const [chunk]=bakeBlocks(parts.filter(p=>p.geometry.hasAttribute('facadeGrid')),material);
    const grid=chunk.geometry.getAttribute('facadeGrid');assert.equal(grid.itemSize,4);
    let walls=0;
    for(let i=0;i<grid.count;i++){
      if(grid.getZ(i)<0)continue;
      walls++;
      assert.equal(Math.floor(grid.getW(i)/128),category);
      assert.equal(grid.getW(i)%128,id%89);
    }
    assert.ok(walls);
  }
});

test('the full city and both vignette shaders follow independent local clocks across midnight and dawn',async()=>{
  const {createLandscape,createCityVignette}=await import('../app/landscape.ts');
  const full=createLandscape(),street=createCityVignette('street'),plaza=createCityVignette('plaza');
  function uniforms(scene){
    const mesh=scene.architectureChunks.find(m=>m.geometry.hasAttribute('facadeGrid'));
    const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
    mesh.material.onBeforeCompile(shader,{});
    assert.ok(shader.fragmentShader.includes('totalEmissiveRadiance+=roomEmission;'));
    assert.ok(shader.fragmentShader.includes('if(roomShare>.0001)'));
    assert.ok(shader.fragmentShader.includes('RE_Direct_Gouache'));
    assert.ok(shader.fragmentShader.includes('clamp(harborPosition.y/13.'));
    const panes={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
    scene.windowMaterial.onBeforeCompile(panes,{});
    assert.equal(panes.uniforms.glassSky,scene.glassSky);
    assert.equal(shader.uniforms.glassSky,scene.glassSky);
    assert.ok(panes.fragmentShader.includes('diffuseColor.rgb*=glassSky'));
    return shader.uniforms;
  }
  const f=uniforms(full),s=uniforms(street),p=uniforms(plaza);
  assert.notEqual(f.glassSky,s.glassSky);assert.notEqual(s.glassSky,p.glassSky);
  full.setFacadeClock(20,45,.92,.40);street.setFacadeClock(2,0,1);plaza.setFacadeClock(12,0,0);
  assert.deepEqual([f.roomShare.value,s.roomShare.value,p.roomShare.value],[.40,.30,0]);
  assert.deepEqual([f.roomQuiet.value,s.roomQuiet.value,p.roomQuiet.value],[0,1,0]);
  assert.deepEqual([f.roomNight.value,s.roomNight.value,p.roomNight.value],[.92,1,0]);
  full.setFacadeClock(23,59,.96);const midnight=f.roomQuiet.value;
  full.setFacadeClock(0,0,.98);assert.ok(Math.abs(f.roomQuiet.value-midnight)<.01);
  full.setFacadeClock(0,0,1);assert.equal(f.roomNight.value,1);
  full.setFacadeClock(6,30,.3);assert.equal(f.roomQuiet.value,.5);
  full.setFacadeClock(8,0,0);assert.equal(f.roomQuiet.value,0);
  assert.equal(s.roomQuiet.value,1);assert.equal(p.roomQuiet.value,0);
});
