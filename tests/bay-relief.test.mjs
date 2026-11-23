import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { bayReliefElevation, bayReliefGround, bayReliefPosition, bayReliefStages, createBayRelief } from '../app/bay-relief.ts';
import { reliefCover } from '../app/relief-cover.ts';
import survey from '../public/data/bay-relief.json' with {type:'json'};
import { bridgeLayout, bridgePoint } from '../app/bridge-layout.ts';
import { waterSurface } from '../app/water-surface.ts';

const relief = createBayRelief();
relief.root.updateMatrixWorld(true);

test('yielding each terrain checkpoint preserves every geometry buffer and scene transform',()=>{
  const stages=bayReliefStages(()=>true);
  let step=stages.next(),count=0;
  while(!step.done){assert.equal(step.value,undefined);count++;step=stages.next();}
  const gridStages=survey.grids.reduce((n,g)=>n+Math.ceil(g.cols*g.rows/1024)+Math.ceil((g.rows-1)/4),0);
  assert.equal(count,gridStages+Math.ceil(survey.buildings.length/64)+2*Math.ceil(survey.paths.length/32));
  const baseline=[],staged=[];
  relief.root.traverse(o=>baseline.push(o));
  step.value.root.traverse(o=>staged.push(o));
  assert.equal(staged.length,baseline.length);
  for(const [i,a] of baseline.entries()){
    const b=staged[i];
    assert.equal(b.name,a.name);
    assert.equal(b.children.length,a.children.length);
    assert.equal(b.type,a.type);
    assert.deepEqual(b.position.toArray(),a.position.toArray());
    assert.deepEqual(b.quaternion.toArray(),a.quaternion.toArray());
    assert.deepEqual(b.scale.toArray(),a.scale.toArray());
    if(!a.geometry)continue;
    assert.deepEqual(b.geometry.boundingBox,a.geometry.boundingBox);
    assert.deepEqual(b.geometry.boundingSphere,a.geometry.boundingSphere);
    assert.deepEqual(b.geometry.drawRange,a.geometry.drawRange);
    assert.deepEqual(b.geometry.groups,a.geometry.groups);
    assert.deepEqual(b.geometry.index?.array,a.geometry.index?.array);
    assert.deepEqual(Object.keys(b.geometry.attributes),Object.keys(a.geometry.attributes));
    for(const [name,attribute] of Object.entries(a.geometry.attributes)){
      const other=b.geometry.attributes[name];
      assert.equal(other.itemSize,attribute.itemSize);
      assert.equal(other.normalized,attribute.normalized);
      assert.deepEqual(other.array,attribute.array);
    }
  }
});

test('Bay relief shares the downtown and Bay Bridge survey scale', () => {
  assert.deepEqual(bayReliefPosition(-122.39348, 37.79554), [0, 0]);
  const coit = bayReliefPosition(-122.405833, 37.802397);
  const bernal = bayReliefPosition(-122.415804, 37.742986);
  const treasure = bayReliefPosition(-122.371, 37.825);
  const oakland = bayReliefPosition(-122.2727, 37.8044);
  assert.ok(coit[0] > 75 && coit[1] < -25, 'Coit Tower lies northwest of the Ferry Building');
  assert.ok(bernal[0] < -200 && bernal[1] < -300, 'Bernal Hill lies south of downtown');
  assert.ok(treasure[0] > 80 && treasure[1] > 200, 'Treasure Island lies northeast across the Bay');
  assert.ok(oakland[0] < -300 && oakland[1] > 500, 'Downtown Oakland lies east across the Bay');

  const base = bridgePoint(0, bridgeLayout.length);
  const approach = bridgePoint(0, bridgeLayout.length + 12);
  assert.ok(bayReliefGround(base.x, base.z) < bridgeLayout.lowerDeck, 'Bridge landfall needs an abutment');
  assert.ok(bayReliefGround(approach.x, approach.z) > bridgeLayout.upperDeck, 'The terrain rises above the road at the tunnel');
});

test('Mapzen height samples and OpenStreetMap coast produce the mapped landforms', () => {
  for (const [name, lon, lat, low, high] of [
    ['Telegraph Hill', -122.405833, 37.802397, 85, 94],
    ['Bernal Hill', -122.415804, 37.742986, 128, 145],
    ['Yerba Buena Island ridge', -122.365431, 37.809814, 92, 106],
    ['Treasure Island', -122.371, 37.825, 1, 6],
    ['East Bay hills', -122.23, 37.88, 425, 525],
  ]) {
    const elevation = bayReliefElevation(lon, lat);
    assert.ok(elevation >= low && elevation <= high, name + ' elevation: ' + elevation);
    const [x,z] = bayReliefPosition(lon,lat);
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0,-1,0));
    const surfaces = relief.root.children.filter(child => child.name.includes('elevation') || child.name === 'OpenStreetMap island shoreline');
    const top = ray.intersectObjects(surfaces, true)[0]?.point.y;
    assert.ok(Math.abs(top - bayReliefGround(x,z)) < .08, name + ' matches visible ground');
    assert.ok(top > waterSurface.level, name + ' remains above the water');
  }
  const [x,z] = bayReliefPosition(-122.383, 37.813);
  assert.ok(bayReliefGround(x,z) < waterSurface.level - .14, 'Open water stays under the lowest ripple');
  const tower = relief.root.getObjectByName('Coit Tower');
  const bounds = new THREE.Box3().setFromObject(tower);
  assert.ok(Math.abs(bounds.max.y - tower.position.y - 64 * .06) < .01);

  const skyline = new THREE.Box3().setFromObject(relief.root.getObjectByName('Downtown Oakland skyline'), true);
  assert.ok(skyline.min.z > 500, 'Oakland buildings stay across the Bay');
  assert.ok(skyline.max.y > 7 && skyline.max.y < 9, 'Oakland high rises retain their tagged scale');
});

test('hill footpaths meet the paved carriageways without sharing their colored road surface',()=>{
  const streets=relief.root.getObjectByName('Mapped hill streets and park paths');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  for(const [x,z] of [[94.3226157,189.6145768],[-.2810026,165.3579957],[57.5135372,180.1857826]]){
    ray.ray.origin.set(x,10,z);
    const hits=ray.intersectObject(streets,true);
    assert.ok(hits.length);
    const colors=hits.map(h=>new THREE.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a).getHexString());
    assert.deepEqual([...new Set(colors)],['838c88']);
  }
});

test('Airplane descends southeast on the Oakland runway 12 approach', () => {
  const plane = relief.root.getObjectByName('Distant passenger airplane');
  const paint = plane.children[0].material;
  relief.update(0, 0, .25);
  assert.equal(plane.visible, false, 'The opening frame and still posters start clear');
  relief.update(18.5, 0, .25);
  assert.equal(plane.visible, true);
  assert.ok(paint.opacity > 0 && paint.opacity < .15, 'The start of the visible leg feathers in');

  relief.update(26, 0, .25);
  const first = plane.position.clone();
  assert.equal(paint.opacity, 1);
  assert.ok(first.x < -80 && first.x > -90 && first.z > 150 && first.z < 153, 'Crossing the Bay south of Yerba Buena');
  assert.ok(bayReliefGround(first.x, first.z) < waterSurface.level);
  relief.update(30, 0, .25);
  const second = plane.position.clone();
  const travel = second.clone().sub(first);
  const horizontal = Math.hypot(travel.x, travel.z);
  const east = -.592 * travel.x + .806 * travel.z;
  const north = .806 * travel.x + .592 * travel.z;
  assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(east, north)) - 130) < .1, 'True course follows the FAA runway bearing');
  assert.ok(Math.abs(-THREE.MathUtils.radToDeg(Math.atan2(travel.y, horizontal)) - 2.75) < .01, 'Aircraft follows a descending glide path');
  assert.ok(Math.abs(horizontal / .06 / 4 * 3600 / 1852 - 150) < .1, 'Travel speed is 150 knots');
  const nose = new THREE.Vector3(1,0,0).applyQuaternion(plane.quaternion);
  assert.ok(nose.dot(travel.normalize()) > .999, 'The nose faces along the direction of travel');

  relief.update(30, 1, .25);
  assert.deepEqual(plane.position.toArray(), second.toArray(), 'Lighting does not alter the scene clock');
  relief.update(65.5, 1, .25);
  assert.equal(plane.visible, true);
  assert.ok(paint.opacity > 0 && paint.opacity < .15, 'The end of the visible leg feathers out');
  relief.update(66, 1, .25);
  assert.equal(plane.visible, false);
  relief.update(240, 0, .25);
  assert.equal(plane.visible, true);
  assert.deepEqual(plane.position.toArray(), second.toArray(), 'The next simulated approach follows the same route');
});

test('the East Bay shoreline preserves its port peninsulas, tidal entrance and homes on Alameda',()=>{
  const wet=[[-122.338,37.816],[-122.323,37.7958],[-122.307,37.7935],[-122.333,37.785]];
  const dry=[[-122.309,37.786],[-122.312,37.803],[-122.332,37.784]];
  for(const p of wet)assert.ok(bayReliefGround(...bayReliefPosition(...p))<waterSurface.level,'chart water '+p);
  for(const p of dry)assert.ok(bayReliefGround(...bayReliefPosition(...p))>waterSurface.level,'chart land '+p);
});


function ringReference(points){
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const west=Math.min(...xs),east=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys);
  return (x,y)=>{
    if(x<west||x>east||y<south||y>north)return false;
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [ax,ay]=points[i],[bx,by]=points[j];
      if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside;
  };
}

test('scanline cover matches the original eastward ray at every park and coast grid vertex',()=>{
  for(const grid of survey.grids){
    for(const [name,rings] of [['parks',survey.cover],['coasts',survey.coasts]]){
      const contains=rings.map(ringReference),expected=new Uint8Array(grid.cols*grid.rows);
      for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.cols;col++){
        const x=grid.west+col*grid.step,y=grid.south+row*grid.step;
        expected[row*grid.cols+col]=Number(contains.some(inside=>inside(x,y)));
      }
      assert.deepEqual(reliefCover(grid,rings),expected,grid.name+' '+name);
    }
  }
});

test('mask unions overlapping rings and clips half-open edges at exact grid coordinates',()=>{
  const grid={west:0,south:0,step:1,cols:5,rows:5};
  const left=[[-1,0],[3,0],[3,3],[-1,3],[-1,0]];
  const right=[[2,1],[2,4],[5,4],[5,1]];
  const expected=['11100','11111','11111','00111','00000'].join('');
  assert.equal(reliefCover(grid,[[],left,right,left]).join(''),expected);
  const diamond=[[2,0],[4,2],[2,4],[0,2]];
  assert.equal(reliefCover(grid,[diamond]).join(''),['00000','01100','11110','01100','00000'].join(''));
});

test('the mapped Telegraph Hill carriageways stay above the ridge and the walking paths stay unlit',()=>{
  const roads=relief.root.getObjectByName('Mapped hill streets and park paths');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  for(const [x,z] of [[74.4931256,-24.2406235],[74.18846733,-24.26053021],[74.71181224,-24.25833835]]){
    ray.ray.origin.set(x,20,z);
    const hit=ray.intersectObject(roads,true)[0];
    assert.ok(hit);assert.ok(hit.point.y>bayReliefGround(x,z)+.003);
  }
  const levels=new Set();
  roads.traverse(o=>{if(o.isMesh)for(const v of o.geometry.getAttribute('roadLight').array)levels.add(v);});
  assert.deepEqual([...levels].sort((a,b)=>a-b),[0,70,130,185]);
  const ground=relief.root.getObjectByName('city elevation').children[0];
  assert.equal(ground.geometry.hasAttribute('roadLight'),false);
  assert.notEqual(ground.material,roads.children[0].material);
});

test('regional occupied rooms use only generic vertical housing faces and follow the actual lit share',()=>{
  for(const name of ['North Beach, Bernal Heights and island buildings','Downtown Oakland skyline']){
    const housing=relief.root.getObjectByName(name);let walls=0,roofs=0;
    housing.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const g=mesh.geometry,grid=g.getAttribute('surveyRoomGrid'),normal=g.getAttribute('normal');
      assert.equal(grid.count,normal.count);
      for(let i=0;i<grid.count;i++){
        if(grid.getX(i)>0){assert.ok(Math.abs(normal.getY(i))<.03);walls++;}
        if(normal.getY(i)>.95){assert.equal(grid.getX(i),0);roofs++;}
      }
    });
    assert.ok(walls>30&&roofs>10);
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    housing.children[0].material.onBeforeCompile(shader,{});
    relief.update(0,1,.4,undefined,465,.11);assert.equal(shader.uniforms.surveyRoomShare.value,.11);
    relief.update(0,0,.4,undefined,465,0);assert.equal(shader.uniforms.surveyRoomShare.value,0);
  }
  const roads=relief.root.getObjectByName('Mapped hill streets and park paths');
  assert.equal(roads.children[0].geometry.hasAttribute('surveyRoomGrid'),false);
});
