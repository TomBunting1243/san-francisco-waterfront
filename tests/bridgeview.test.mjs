import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {addBridgeview} from '../app/bridgeview.ts';
import city from '../public/data/sf-waterfront.json' with {type:'json'};
import fontData from '../app/harbor-font.json' with {type:'json'};

const tower=260318167,podium=1474572306;
const angle=Math.atan2(-.1583,.9874),c=Math.cos(angle),s=Math.sin(angle);
function world(u,v,h){return new THREE.Vector3(-54.2+.06*(u*c-v*s),.04+.06*h,-23.25+.06*(u*s+v*c));}
function scene(){
  const root=new THREE.Group(),windows=[],font=new FontLoader().parse(fontData);
  for(const id of [podium,tower])assert.equal(addBridgeview(city.buildings.find(b=>b.id===id),root,windows,font),true);
  return {root,windows};
}

test('the roof transitions across the source part into a shorter red wing and a stepped north tower',()=>{
  const {root}=scene();
  const down=(u,v)=>new THREE.Raycaster(world(u,v,95),new THREE.Vector3(0,-1,0)).intersectObject(root)[0];
  // USGS DSM minus 4.6 m observed at Beale. Samples include the chamfered
  // end of the tall building, its central bulkhead, and the low pavilion.
  for(const [u,v,h] of [[-19,1,39.6],[-31,5,43.2],[11,0,81.4],[31,0,74.9],[41,1,69],[-44,-11,9.06]]){
    assert.ok(Math.abs((down(u,v).point.y-.04)/.06-h)<.08);
  }
  assert.equal(down(18,18),undefined,'Beale sidewalk remains open');
  assert.equal(addBridgeview({id:288645692,p:[]},root,[]),false,'388 Beale is independent');
  assert.equal(root.children.length,2);
  assert.ok(root.children.every(mesh=>mesh.isMesh && mesh.geometry.index && mesh.material.vertexColors));
  assert.ok(root.children.reduce((n,m)=>n+m.geometry.index.count/3,0)<11000);
});

test('Beale balconies have physical recesses behind the rails and the entry projects into view',()=>{
  const {root,windows}=scene();
  const towardWall=new THREE.Vector3(s,0,-c);
  const front=(u,h)=>23-new THREE.Raycaster(world(u,23,h),towardWall).intersectObject(root)[0].distance/.06;
  assert.ok(front(-8,24.7)-front(-18,24.7)>1.5);
  assert.ok(front(-18,26.1)-front(-18,24.7)>1.4);
  assert.ok(front(13.8,4.28)>15.8,'entry canopy projects beyond the podium');
  assert.ok(windows.length>40 && windows.length<180);
  // In the production light pass these are single-sided instanced planes.
  const beale=windows.filter(w=>new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry)).dot(towardWall)<-.99);
  assert.ok(beale.length>5);
  for(const w of windows){
    const normal=new THREE.Vector3(Math.sin(w.ry),0,Math.cos(w.ry));
    const start=new THREE.Vector3(w.x,w.y,w.z).addScaledVector(normal,.003);
    const hit=new THREE.Raycaster(start,normal.negate(),0,.009).intersectObject(root)[0];
    assert.ok(hit,'each outward-facing night pane has a wall immediately behind it');
  }
});
