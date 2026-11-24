import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addHowardParking} from '../app/howard-parking.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {howardTrees} from '../app/howard-trees.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';
import {driverPose,rideDuration} from '../app/driver-rides.ts';
import {waterfrontCar,waterfrontCarCount} from '../app/waterfront-routes.ts';
import {signalPeriod} from '../app/waterfront-signals.ts';

const C=.988686,S=.150004,scale=C*C+S*S;
const scene=(u,y,v)=>new THREE.Vector3(-25.894+C*u+S*v,y,-12.65-S*u+C*v);
function local({x,y,z}){
  return {u:(C*(x+25.894)-S*(z+12.65))/scale,v:(S*(x+25.894)+C*(z+12.65))/scale,y};
}
const ys=[1081,1094,1107,1120,1133,1146,1159,1171,1184,1197,1210];
const root=new THREE.Group(),mesh=addHowardParking(root),g=mesh.geometry;
const points=Array.from({length:g.attributes.position.count},(_,i)=>local(new THREE.Vector3().fromBufferAttribute(g.attributes.position,i)));
const mark=points.filter((_,i)=>g.attributes.roadExposure.getX(i)===1);
const bikes=points.filter((_,i)=>g.attributes.roadExposure.getX(i)===0);
const stalls=ys.slice(1).map((high,i)=>bikes.filter(p=>p.v>(ys[i]-1400)/200&&p.v<(high-1400)/200));
const ground=new THREE.Group(),receiver=new THREE.MeshBasicMaterial();
addSurveyBlocks((g,c,x,y,z)=>{const m=new THREE.Mesh(g,receiver);m.position.set(x,y,z);ground.add(m);return m;});
ground.updateMatrixWorld(true);
const bayBounds=new THREE.Box3().setFromObject(mesh).expandByScalar(.004);
const nearby=ground.children.filter(m=>new THREE.Box3().setFromObject(m).intersectsBox(bayBounds));
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
function surface(u,v){
  ray.set(scene(u,.12,v),down);
  return ray.intersectObjects(nearby,false)[0];
}
const near=(a,b,e)=>assert.ok(Math.abs(a-b)<e,a+' vs '+b);

test('eleven independently measured transverse dividers follow exposed gutter and asphalt up to the eastbound limit line',()=>{
  for(const [i,y] of ys.entries()){
    const mid=(y-1400)/200,verts=mark.filter(p=>Math.abs(p.v-mid)<.006);
    assert.ok(verts.length>=4);
    const left=Math.min(...verts.map(p=>p.u)),right=Math.max(...verts.map(p=>p.u));
    near(left*200+300,[227,229,230,229,219,221,231,219,219,219,219][i],.01);
    near(right*200+300,i===10?239.8:243,.01);
    for(let u=left+.001;u<right;u+=.002){
      const hit=surface(u,mid);
      assert.ok(hit&&!hit.object.name.includes('Crosswalk paint'),'overlapping crossing paint');
      ray.set(scene(u,.12,mid),down);
      const parking=ray.intersectObject(mesh)[0];
      assert.ok(parking,'missing stripe at '+u+','+y);
      assert.ok(Math.abs(parking.point.y-hit.point.y-.00024)<.00006,JSON.stringify([u,mid,parking.point.y,hit.point.y,hit.object.name]));
    }
  }
  assert.equal(mark.length,68);
});

test('five full-size two-wheelers each place two distinct tire patches on the actual surface and leave five bays empty',()=>{
  assert.deepEqual(stalls.map((s,i)=>s.length?i:null).filter(i=>i!==null),[0,3,5,7,9]);
  assert.equal(stalls.flat().length,bikes.length);
  for(const [slot,points] of stalls.entries()){
    if(!points.length)continue;
    const u=points.map(p=>p.u),v=points.map(p=>p.v),y=points.map(p=>p.y);
    assert.ok((Math.max(...u)-Math.min(...u))/.06>1.75&&(Math.max(...u)-Math.min(...u))/.06<2.28);
    assert.ok(Math.min(...v)>(ys[slot]-1400)/200+.003&&Math.max(...v)<(ys[slot+1]-1400)/200-.003);
    assert.ok((Math.max(...y)-Math.min(...y))/.06>1.13);
    const feet=points.filter(p=>p.y<.0321);
    const patches=feet.filter(p=>Math.abs(p.y-surface(p.u,p.v).point.y)<.00005);
    for(const side of [-1,1]){
      const contact=patches.find(p=>(p.u+.348)*side>.033);
      assert.ok(contact,'missing tire contact in space '+slot);
    }
    for(const p of feet)assert.ok(p.y>=surface(p.u,p.v).point.y-.00009,'buried wheel '+JSON.stringify([slot,p,surface(p.u,p.v).point.y,surface(p.u,p.v).object.name]));
  }
});

test('the forward wheel of the standard motorcycle has a real axle, rim and open space between spokes',()=>{
  const theta=-.06,cs=Math.cos(theta),sn=Math.sin(theta),centerV=(ys[0]+ys[1])/400-7;
  // Probe the streetward half-wheel from the side, clear of the fork.
  function sideHit(x,y){
    const u=-.348+.06*cs*x,v=centerV+.06*sn*x;
    const dir=new THREE.Vector3(-C*sn+S*cs,0,S*sn+C*cs).normalize();
    ray.set(scene(u,.031+y*.06,v).addScaledVector(dir,-.030),dir);ray.far=.06;
    return ray.intersectObject(mesh).length;
  }
  assert.ok(sideHit(.71,.32)>0);
  assert.ok(sideHit(.71+.30,.32)>0);
  assert.equal(sideHit(.71+.132,.32-.115),0);
  ray.far=Infinity;
});

test('the silver scooter has an open step-through above a continuous low floorboard',()=>{
  function probe(x,y){
    const theta=-.06,mid=(ys[9]+ys[10])/400-7;
    const u=-.348+.06*Math.cos(theta)*x,v=mid+.06*Math.sin(theta)*x;
    const dir=new THREE.Vector3(C*-Math.sin(theta)+S*Math.cos(theta),0,-S*-Math.sin(theta)+C*Math.cos(theta)).normalize();
    ray.set(scene(u,.031+y*.06,v).addScaledVector(dir,-.032),dir);ray.far=.064;
    return ray.intersectObject(mesh).length;
  }
  assert.ok(probe(.02,.284)>0,'floorboard');
  assert.equal(probe(.02,.55),0,'knee space');
  assert.ok(probe(.42,.66)>0,'forward leg shield');
  assert.ok(probe(-.45,.55)>0,'rear body');
  ray.far=Infinity;
});

test('the baked bank clears planted wells, moving vehicles and the passenger drive',()=>{
  const baked=bakeRigidChunk('verify parking',[mesh],new THREE.MeshStandardMaterial({vertexColors:true}));
  assert.equal(root.children.length,1);
  assert.ok(g.index.count/3<7500);assert.equal(baked.geometry.index.count,g.index.count);
  const edge=Math.max(...bikes.map(p=>p.u));
  const first=(ys[0]-1400)/200,last=(ys.at(-1)-1400)/200;
  for(const [id,x,z,,,,ft] of howardTrees){
    const p=local({x,z});if(p.v<first-.06||p.v>last+.06||p.u>0)continue;
    assert.ok(p.u+ft*.3048*.03<Math.min(...mark.map(p=>p.u))-.02,'well '+id);
  }
  let passages=0;
  for(let t=0;t<rideDuration('bridge');t+=.05){
    const p=local(driverPose('bridge',t).eye);if(p.v<first-.15||p.v>last+.15)continue;
    if(Math.abs(p.u)>1)continue;
    assert.ok(p.u-edge>.08,'body clearance at '+t);passages++;
  }
  assert.ok(passages>30);
  for(let t=0;t<signalPeriod*2;t+=.5)for(let i=0;i<waterfrontCarCount();i++){
    const car=waterfrontCar(t,i);if(!car.active)continue;
    const p=local(car);if(p.v>=first-.15&&p.v<=last+.15)assert.ok(p.u<-.60||p.u>edge+.08);
  }
});
