import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import map from '../public/data/sf-waterfront.json' with {type:'json'};
import {addSalesforceTransitCenter} from '../app/salesforce-transit-center.ts';
import {transitScreenName} from '../app/transit-center-screen.ts';
import {createLandscape} from '../app/landscape.ts';

const station=map.buildings.find(b=>b.id===542375290);
const ex=.15135,ez=Math.sqrt(1-ex*ex);
function pt(s,d,h){
  return new T.Vector3(-22.938495+.06*(s*ex-d*ez),.031+.06*h,-32.902787+.06*(s*ez+d*ex));
}
function through(meshes,s,h){
  const a=pt(s,30,h),b=pt(s,-30,h);
  return new T.Raycaster(a,b.clone().sub(a).normalize(),0,a.distanceTo(b)).intersectObjects(meshes,false);
}
test('Fremont and First pass beneath the assembled transit hall at passenger and bus height',()=>{
  const city=createLandscape(),chunks=[...city.architectureChunks,city.root.getObjectByName(transitScreenName)];
  for(const mesh of chunks)if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  for(const x of [0,-110])for(const lane of [-5,0,5]){
    const s=x+lane,box=new T.Box3().setFromPoints([pt(s,30,.4),pt(s,-30,16)]).expandByScalar(.05);
    const local=chunks.filter(m=>m.geometry.boundingBox.intersectsBox(box));
    for(const y of [1.7,4.5])assert.equal(through(local,s,y).length,0,'blocked lane '+[s,y]);
    const aperture=new T.Raycaster(pt(s,2,2),new T.Vector3(0,1,0),0,1).intersectObjects(local,false);
    assert.ok(aperture.some(hit=>Math.abs(hit.point.y-pt(s,2,12.45).y)<.001&&hit.face.normal.y<-.99));
  }
});
test('the terminal has a metal skirt, an upper garden and stationary soffit illumination',()=>{
  const root=new T.Group();assert.ok(addSalesforceTransitCenter(station,root));
  assert.equal(addSalesforceTransitCenter({...station,id:0},root),false);
  const screen=root.getObjectByName(transitScreenName),mesh=root.children.find(o=>o!==screen);assert.equal(root.children.length,2);
  const g=mesh.geometry;assert.ok(g.index.count/3<6000);
  const down=new T.Raycaster(pt(0,0,25),new T.Vector3(0,-1,0),0,.6).intersectObject(mesh);
  assert.ok(down.some(h=>Math.abs(h.point.y-pt(0,0,21.34).y)<.0001&&h.face.normal.y>.99));
  assert.ok(through([screen],0,17).length>=1);
  assert.ok(through([screen],0,8.2).length>=1);
  assert.equal(through([screen],0,7.5).length,0);
  assert.ok(screen.material.map.generateMipmaps);
  const tile=screen.material.map.image.data;
  const openings=tile.filter((value,i)=>i%4===0&&value<100).length/(tile.length/4);
  assert.ok(openings>.34&&openings<.40,'open fraction '+openings);
  assert.ok(g.index.count/3+screen.geometry.index.count/3<6000);
  assert.ok(g.getAttribute('signLight').array.some(v=>v>125));
});
