import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { bayReliefElevation, bayReliefGround, bayReliefPosition, createBayRelief } from '../app/bay-relief.ts';
import { bridgeLayout, bridgePoint } from '../app/bridge-layout.ts';
import { waterSurface } from '../app/water-surface.ts';

const relief = createBayRelief();
relief.root.updateMatrixWorld(true);

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
