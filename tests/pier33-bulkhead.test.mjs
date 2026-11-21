import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {addPier33Bulkhead,pier33Floor,pier33FrontZ,pier33SurveyPart} from '../app/pier33-bulkhead.ts';
import {bayReliefGround} from '../app/bay-relief.ts';
import {createUrbanContext} from '../app/urban-context.ts';

test('the Chestnut passenger sees the registered Pier 33 wings and portal on the municipal tile',()=>{
  assert.equal(pier33SurveyPart(94.97,-4.37),'south');
  assert.equal(pier33SurveyPart(98,-5.54),'north');
  assert.equal(pier33SurveyPart(92.04,-3.78),undefined);
  const city=createUrbanContext(),camera=new T.PerspectiveCamera(52,760/460,.013,145);
  camera.position.set(82.155918,.337952,-3.103871);camera.lookAt(95,.3,-5.85);camera.updateMatrixWorld(true);
  assert.ok(city.prepareRideView(camera,Infinity));
  const ray=new T.Raycaster();
  function face(x,y,z,dx,dy,dz){
    ray.set(new T.Vector3(x,y,z),new T.Vector3(dx,dy,dz));
    return ray.intersectObjects(city.children)[0];
  }
  for(const [x,height,expected] of [[94.63,.13,.254],[94.63,.22,.146],[94.26,.46,.202],
    [96.59,.19,.290],[96.49,.525,.290],[96.49,.686,.134],[98.61,.46,.202],[99.9,.215,.207]]){
    const hit=face(x,pier33Floor+height,pier33FrontZ(x)-.18,0,0,1);
    assert.ok(hit&&Math.abs(hit.distance-expected)<.002,'facade depth at '+[x,height]);
    assert.equal(hit.object.geometry.attributes.uv.getX(hit.face.a),-1);
  }
  // From the boarding plaza, the returned south wing has its own recessed sash.
  const depth=.4025,z=-4.88+depth,x=93.92+.27*depth/.66;
  const south=face(x-.15,pier33Floor+.47,z,1,0,0);
  assert.ok(south&&south.distance>.16&&south.distance<.18);
  for(const [x,rise] of [[94.4,.655],[96.48,.9685],[98.2,.655],[99.6,.655]]){
    const hit=face(x,3,pier33FrontZ(x)+.28,0,-1,0);
    assert.ok(hit&&Math.abs(hit.point.y-pier33Floor-rise)<.002,'measured roof at '+x);
  }
  for(let x=94.013;x<100.05;x+=.17){
    const z=pier33FrontZ(x)-.078,ground=bayReliefGround(x,z);
    const threshold=face(x,2,z,0,-1,0);
    assert.ok(threshold&&Math.abs(threshold.point.y-pier33Floor)<.00001);
    assert.ok(ground<pier33Floor&&ground>pier33Floor-.19,'foundation reaches surveyed ground at '+x);
    const skirt=face(x,(ground+pier33Floor)/2,z-.02,0,0,1);
    assert.ok(skirt&&Math.abs(skirt.distance-.013)<.0001,'public threshold has a supported face');
  }
});

test('the entire Pier 33 front stays within one streamed tile and its facade budget',()=>{
  let vertices=0,triangles=0;
  addPier33Bulkhead({vertex(x,y,z){
    assert.ok(x>=93.88&&x<=100.3&&z>=-7.35&&z<=-4.19,'bulkhead registration');
    return vertices++;
  },quad(){triangles+=2;},triangle(){triangles++;}});
  assert.ok(triangles<2450&&vertices<5800);
});
