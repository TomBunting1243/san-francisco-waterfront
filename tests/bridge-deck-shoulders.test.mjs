import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {addUpperParapet,addBridgeMarkings} from '../app/bridge-deck.ts';
import {bridgeLayout} from '../app/bridge-layout.ts';
import {westTowerCableX,westMainCableRadius} from '../app/west-span-towers.ts';
import {bakeBlocks} from '../app/city-blocks.ts';

const root=new T.Group(),asphalt=bridgeLayout.upperDeck+.0755;
function mesh(g,c,x,y,z,p){const m=new T.Mesh(g,new T.MeshStandardMaterial({color:c}));m.position.set(x,y,z);p.add(m);return m;}
for(const [a,b] of [[0,bridgeLayout.length],[bridgeLayout.length,bridgeLayout.length+10.1]])addUpperParapet(root,mesh,a,b,asphalt);
root.updateMatrixWorld(true);
const guards=[...root.children];
function top(x,z){const r=new T.Raycaster(new T.Vector3(x,asphalt+.3,z),new T.Vector3(0,-1,0));return r.intersectObjects(guards,false)[0]?.point.y;}

test('both raised shoulder treads receive all four suspender legs and continue through the island joint',()=>{
  for(const z of [.1,15.64,36.85,100.31,163.771,bridgeLayout.length-.0001,bridgeLayout.length+.0001,bridgeLayout.length+10]){
    for(const side of [-1,1]){
      assert.equal(top(side*.5535,z),undefined,'outer edge of painted shoulder stripe stays exposed');
      for(const dx of [-westMainCableRadius,westMainCableRadius])for(const dz of [-.008,.008]){
        const y=top(side*westTowerCableX+dx,z+dz);
        assert.ok(y>=asphalt+.014&&y<=asphalt+.018,'hanger lands on raised tread');
      }
      const ray=new T.Raycaster(new T.Vector3(0,asphalt+.051,z),new T.Vector3(side,0,0));
      const wall=ray.intersectObjects(guards,false)[0];
      assert.ok(wall&&Math.abs(wall.point.x)>.625404);
      assert.ok(top(side*.639,z)<asphalt+.065,'clear seated view above the guard');
    }
  }
});

test('fasteners and tread joints carry pigment through the geographic architecture batch',()=>{
  assert.ok(guards.length<50);
  for(const g of guards){assert.ok(g.geometry.userData.paintVertices);assert.ok(g.geometry.attributes.color.count===g.geometry.attributes.position.count);}
  const chunks=bakeBlocks(guards,new T.MeshStandardMaterial());
  const tones=new Set(chunks.flatMap(c=>Array.from(c.geometry.attributes.color.array)));
  assert.ok(tones.size>10);
  const marks=new T.Group();
  addBridgeMarkings(marks,mesh,0,1,asphalt,true);
  for(const shoulder of marks.children.filter(m=>m.name.includes('shoulder')))assert.equal(Math.abs(shoulder.position.x),.548);
});
