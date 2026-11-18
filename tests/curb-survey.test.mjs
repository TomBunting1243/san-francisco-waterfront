import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import curb from '../public/data/curb-survey.json' with {type:'json'};
import plaza from '../public/data/plaza-survey.json' with {type:'json'};
import {addSurveyCurbs,curbFaceHeight,curbRuns,gutterTop,harryBridgesGround,marketAxis,medianTop,westMarketGround} from '../app/curb-survey.ts';
import {createMarketPaving} from '../app/market-paving.ts';
import {createLandscape} from '../app/landscape.ts';
import {trackCenterlines} from '../app/streets.ts';

const edges=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true});
addSurveyCurbs((g)=>{const mesh=new THREE.Mesh(g,material);edges.add(mesh);return mesh;});
edges.updateMatrixWorld(true);
function down(objects,x,z,top=.16){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,top,z),new THREE.Vector3(0,-1,0));
  return ray.intersectObjects(objects,false)[0]?.point.y;
}
test('Rincon, Ferry and Steuart expose six-inch battered roadway faces and distinct caps',()=>{
  const ids=[3827353,3801397,3798175];
  for(const id of ids){
    const paths=curbRuns.filter(row=>row[0]===id).map(row=>row[2]);
    assert.ok(paths.length);
    const stations=paths.flatMap(path=>path.slice(1).map((b,i)=>[path[i],b])).filter(([a,b])=>a[4]===1&&b[4]===1&&Math.hypot(a[0]-b[0],a[1]-b[1])>.15);
    assert.ok(stations.some(([a,b])=>{
      const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,nx=(a[2]+b[2])/2,nz=(a[3]+b[3])/2;
      const low=down(edges.children,x+nx*.0026,z+nz*.0026),high=down(edges.children,x-nx*.005,z-nz*.005);
      return Math.abs((high-low)-curbFaceHeight)<.0004;
    }),String(id));
  }
  assert.ok(curbFaceHeight===.1524*.06&&edges.children.length<70);
});
test('surveyed median, separate planting island, and curved grade preserve all tree supports and rail clearances',()=>{
  for(const tree of plaza.trees.filter(v=>v.supplemental))assert.ok(Math.abs(harryBridgesGround(...tree.p)-medianTop)<.0001);
  const pavement=createMarketPaving();
  for(const path of trackCenterlines){
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];if(a[0]*b[0]>0)continue;
      const z=a[1]+(b[1]-a[1])*(-a[0])/(b[0]-a[0]);
      assert.equal(harryBridgesGround(0,z),undefined);
      assert.equal(down([pavement],0,z),undefined);
    }
  }
  assert.ok(curb.medianGates.length>=4);
  assert.ok(curb.ramps.some(([x,z])=>Math.hypot(x+2.2,z+10.49)<.15));
});
test('production paving descends to the actual roadway at each end, without a concealed raised slab',()=>{
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const pavement=world.root.getObjectByName('Market granite and herringbone promenade');
  const all=[...world.architectureChunks,pavement];
  for(let z=-9.04;z<-6.27;z+=.06){
    const x=marketAxis(z),height=down(all,x,z);
    assert.ok(Math.abs(height-westMarketGround(x,z))<.0025,`grade at ${z} = ${height}`);
  }
  for(const [x,z] of curb.medianGates){
    const height=down(all,x,z);
    assert.ok(Math.abs(height-gutterTop)<.005,`raised obstacle at ${x},${z}: ${height}`);
  }
  assert.ok(Math.abs(down(all,marketAxis(-5.75),-5.75)-.031)<.001);
  for(const [x,z,ground] of [[-5.35,-1.84,.031],[-4.48,3.96,.096],[.33,-9.52,.139]]){
    assert.ok(Math.abs(down(all,x,z)-ground)<.001);
  }
});
