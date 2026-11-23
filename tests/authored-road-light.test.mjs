import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import records from '../public/data/authored-street-lamps.json' with {type:'json'};
import {authoredStreetField} from '../app/authored-road-light.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {buildApproachRoad} from '../app/approach-road.ts';
import {distantEastSpan} from '../app/east-span.ts';
import {bayReliefPosition} from '../app/bay-relief.ts';

test('every retained SFPUC pole has a local road-light sample',()=>{
  const {bounds,texture}=authoredStreetField(),{data,width,height}=texture.image;
  const bytes=Buffer.from(records.coordinates,'base64');
  assert.equal(bytes.length,records.count*4);assert.equal(records.count,2068);
  for(let i=0;i<bytes.length;i+=4){
    const x=bytes.readInt16LE(i)/100,z=bytes.readInt16LE(i+2)/100;
    const col=Math.floor((x-bounds.x)*width/bounds.z),row=Math.floor((z-bounds.y)*height/bounds.w);
    assert.ok(col>=0&&row>=0&&col<width&&row<height);
    assert.ok(data[row*width+col]>210);
  }
  assert.equal(data[0],0);texture.dispose();
});

test('a shared road and building batch keeps the road contribution off walls and the underside',()=>{
  const material=new T.MeshStandardMaterial(),cube=new T.BoxGeometry(),road=new T.Mesh(cube,material),building=road.clone();
  road.userData.roadExposure=1;
  building.position.y=4;building.updateMatrixWorld();
  const g=bakeRigidChunk('paired',[road,building],material).geometry;
  const a=g.getAttribute('roadExposure'),n=g.getAttribute('normal');
  for(let i=0;i<a.count;i++)assert.equal(a.getX(i),i<24&&n.getY(i)>.99?1:0);
  assert.equal(a.array.filter(x=>x===1).length,4);
});

test('skyway and ramp pavement and lane paint carry longitudinal phase, while girders and lenses stay independent',()=>{
  const root=new T.Group(),material=new T.MeshStandardMaterial();
  buildApproachRoad((g,c,x,y,z,parent)=>{const m=new T.Mesh(g,material);m.position.set(x,y,z);parent.add(m);return m;},root);
  const covered=new Set();let lenses=0;
  root.traverse(m=>{
    if(!m.geometry)return;
    const a=m.geometry.getAttribute('roadExposure');
    if(a){
      assert.ok(a.count>0);
      for(const v of a.array)assert.ok(v>=100);
      covered.add(m.geometry.userData.roadPaint?'striping':'pavement');
    }
    if(m.name==='Skyway roadway lens'){lenses++;assert.ok(m.userData.signLight);assert.ok(!a);}
    if(m.name.includes('Concrete'))assert.ok(!a);
  });
  assert.deepEqual([...covered].sort(),['pavement','striping']);assert.ok(lenses>100);
});

test('both eastern carriageways receive the neutral LED wash above their drawn surfaces alone',()=>{
  const m=distantEastSpan(bayReliefPosition,0,new T.MeshStandardMaterial()),g=m.geometry;
  const a=g.getAttribute('eastRoadway'),n=g.getAttribute('normal');
  assert.ok(a.count===n.count&&a.array.some(x=>!x));
  for(let i=0;i<a.count;i++)if(a.getX(i))assert.ok(n.getY(i)>.9);
  for(const lat of [37.81877,37.81916]){
    const [x,z]=bayReliefPosition(-122.35,lat),ray=new T.Raycaster(new T.Vector3(x,15,z),new T.Vector3(0,-1,0));
    const [hit]=ray.intersectObject(m);assert.equal(a.getX(hit.face.a),1);
  }
});
