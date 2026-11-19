import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {mappedBuildings} from '../app/sf-map.ts';
import {createSalesforceTower,createTransamericaPyramid,salesforceScale} from '../app/skyline-towers.ts';

const tower=name=>mappedBuildings.find(b=>b.name===name);
const bounds=o=>new THREE.Box3().setFromObject(o);
const meter=.06;
const feet=length=>length*.3048*meter;

test('Salesforce preserves the mapped base, measured taper and continuous summit rim',()=>{
  const site=tower('Salesforce Tower'),model=createSalesforceTower(site);
  const body=model.getObjectByName('Rounded-square glazed shaft');
  const crown=model.getObjectByName('Perforated aluminum lantern');
  const plant=model.getObjectByName('Recessed crown plant');
  assert.ok(Math.abs(bounds(model).max.y-site.h)<.0001);
  assert.equal(salesforceScale(0),salesforceScale(382));
  assert.ok(salesforceScale(675)<1&&salesforceScale(912)<salesforceScale(675));
  assert.ok(Math.abs(salesforceScale(1070)-88.5/172)<.00001);
  assert.ok(Math.abs(bounds(body).max.y-feet(954.5))<.012);
  assert.ok(bounds(crown).min.y>=bounds(body).max.y-.0001);
  assert.ok(bounds(plant).max.y<bounds(model).max.y-.7);
  const lower=bounds(body);
  const outline=new THREE.Box2().setFromPoints(site.p.map(p=>new THREE.Vector2(...p)));
  assert.ok(Math.abs(lower.min.x-outline.min.x)<.0001&&Math.abs(lower.max.z-outline.max.y)<.0001);
  const center=lower.getCenter(new THREE.Vector3());
  const ray=new THREE.Raycaster(new THREE.Vector3(center.x,site.h+1,center.z),new THREE.Vector3(0,-1,0));
  assert.equal(ray.intersectObject(crown).length,0,'A solid rooftop must not close the steel screen');
  assert.ok(ray.intersectObject(plant).length>0);
});

test('Transamerica retains the 853-foot summit, quartz spire, two service fins and truss base',()=>{
  const site=tower('Transamerica Pyramid'),{root,windows}=createTransamericaPyramid(site);
  const body=root.getObjectByName('Tapered quartz-clad frame and spire');
  const wings=root.getObjectByName('East and west service fins');
  const truss=root.getObjectByName('Pereira plaza truss');
  assert.ok(Math.abs(bounds(body).max.y-feet(853))<.005);
  assert.ok(Math.abs(bounds(wings).min.y-feet(384))<.005);
  assert.ok(bounds(wings).max.y<feet(654));
  assert.ok(Math.max(...windows.map(p=>p.y+p.h/2))<feet(640.5));
  assert.equal(truss.children.length,72);
  const center=bounds(root).getCenter(new THREE.Vector3());
  const ray=new THREE.Raycaster(new THREE.Vector3(center.x,8,5),new THREE.Vector3(0,0,-1));
  assert.ok(ray.intersectObject(root,true).length>0,'Pyramid faces the opening waterfront camera');
});

test('the perforated lantern presents continuous metal coverage as the camera moves, with filtered panels and night imagery',()=>{
  const site=tower('Salesforce Tower'),night={value:0},time={value:2},root=createSalesforceTower(site,night,time);
  const screen=root.getObjectByName('Perforated aluminum lantern'),b=bounds(screen),center=b.getCenter(new THREE.Vector3());
  assert.equal(site.id,431972186);assert.equal(screen.geometry.index.count/3,820);
  const metal=screen.material;
  assert.ok(!metal.transparent&&metal.depthWrite&&metal.alphaTest===0&&!metal.alphaToCoverage);
  assert.ok(metal.map.generateMipmaps&&metal.map.minFilter===THREE.LinearMipmapLinearFilter);
  assert.equal(metal.map.image.width,256);
  const ray=new THREE.Raycaster(),eye=new THREE.Vector3(),point=new THREE.Vector3(),side=new THREE.Vector3();
  for(const angle of [-1.4,0,.67,1.9])for(const distance of [6,95,190]){
    eye.set(center.x+Math.cos(angle)*distance,center.y-.07*distance,center.z+Math.sin(angle)*distance);
    side.set(-Math.sin(angle),0,Math.cos(angle));
    for(const scale of [-.33,0,.33])for(let i=1;i<20;i++){
      point.copy(center).addScaledVector(side,scale);point.y=THREE.MathUtils.lerp(b.min.y,b.max.y,i/20);
      ray.set(eye,point.sub(eye).normalize());assert.ok(ray.intersectObject(screen).length);
    }
  }
  const shader={...THREE.ShaderLib.standard,uniforms:{}};
  metal.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.lanternNight,night);assert.equal(shader.uniforms.lanternTime,time);
  assert.ok(shader.fragmentShader.includes('totalEmissiveRadiance+=')&&shader.fragmentShader.includes('#include <fog_fragment>'));
  const alpha=metal.map.image.data;
  for(let i=3;i<alpha.length;i+=4)assert.equal(alpha[i],255);
  metal.dispose();
});
