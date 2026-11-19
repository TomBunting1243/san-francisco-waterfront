import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addFerryMarketPlatforms,ferryMarketBoardingHeight} from '../app/ferry-market-platform.ts';
import {trackAt,trackCenterlines,streetcarTrack} from '../app/streets.ts';
const platforms=new T.Group();addFerryMarketPlatforms(platforms);
platforms.updateMatrixWorld(true);
const down=new T.Vector3(0,-1,0);
function below(objects,x,z,from){
  return new T.Raycaster(new T.Vector3(x,from,z),down,0,1).intersectObjects(objects,false)[0]?.point.y;
}
test('two staggered Ferry Terminal canopies curve down away from different tracks at surveyed height',()=>{
  assert.deepEqual(platforms.children.map(p=>p.name),['Ferry Terminal wayside platform 14513','Ferry Terminal wayside platform 17283']);
  for(const [i,x,lip,dir] of [[0,1.53,.132,1],[1,-1.86,.058,-1]]){
    const mesh=platforms.children[i],rail=trackAt(x,trackCenterlines[i]).z;
    for(const [f,y] of [[.04,.340],[.5,.325],[.94,.263]]){
      const top=below([mesh],x,rail+dir*(lip+.248*f),.5);
      assert.ok(Math.abs(top-y)<.005,'asymmetric curved roof at '+f+' measured '+top);
    }
    assert.equal(below([mesh],x,rail,.5),undefined,'rail head and pantograph envelope stay outside roof');
    const tag=mesh.geometry.attributes.signLight,values=tag.array.filter(v=>v!==0);
    assert.ok(values.length>0&&values.length<tag.count*2,'small soffit lenses use existing district light mask');
    assert.ok(mesh.geometry.index.count/3<5200);
  }
  for(let x=-.80;x<.41;x+=.10)
    for(let z=-4.15;z< -3.2;z+=.06)assert.equal(below(platforms.children,x,z,.5),undefined,'market-axis crossing remains open');
});
test('regular stops and accessible boarding at the far end of each shelter connect by a walkable ramp',()=>{
  for(const [i,dir,regular,a,b,c] of [[0,1,2.217,2.236,2.887,3.034],[1,-1,-2.478,-2.702,-3.327,-3.465]]){
    function floor(x){
      return below(platforms.children,x,trackAt(x,trackCenterlines[i]).z+dir*.118,.13);
    }
    const high=streetcarTrack.railTop+34*.0254*.06;
    assert.ok(Math.abs(floor(regular)-.067)<.0001);
    assert.ok(Math.abs(floor(c)-high)<.0001);
    assert.ok(Math.abs(floor((a+b)/2)-(.067+high)/2)<.0001);
    assert.ok((high-.067)/Math.abs(b-a)<1/12);
  }
  assert.ok(Math.abs(ferryMarketBoardingHeight(.415)-.031)<1e-8);
  assert.ok(Math.abs(ferryMarketBoardingHeight((.415+.849)/2)-(.067+.031)/2)<.001);
});
test('the assembled Wharf-bound exit meets the actual track bed and leaves the pedestrian crossing clear',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const world=createLandscape(),objects=world.architectureChunks;
  world.root.updateMatrixWorld(true);
  const axis=[[1,0],[0,1],[-1,0],[0,-1]];
  for(let x=-.223;x<1.795;x+=.041){
    const z=x>=.849?-3.46:-3.48+.020*(x+.224)/1.073,h=ferryMarketBoardingHeight(x);
    const top=below(objects,x,z,h+.006);
    assert.ok(Number.isFinite(top)&&Math.abs(top-h)<.0008,'finished aisle grade at '+x+' / '+top);
    for(const [dx,dz] of axis){
      const direction=new T.Vector3(dx,0,dz);
      const ray=new T.Raycaster(new T.Vector3(x,h+.072,z),direction.normalize(),0,.014);
      assert.equal(ray.intersectObjects(objects,false).length,0,'aisle obstruction at '+x);
    }
  }
  for(const [x,z] of [[-.224,-3.48],[-.207,-3.34],[-.187,-3.103]]){
    for(const d of [-1,1]){
      const ray=new T.Raycaster(new T.Vector3(x+.022*d,.13,z),new T.Vector3(-d,0,0),0,.044);
      assert.equal(ray.intersectObjects(objects,false).length,0,'surveyed pedestrian crossing obstructed');
    }
  }
});
