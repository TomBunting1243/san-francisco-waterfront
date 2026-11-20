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

test('both Ferry Terminal roofs clear the plaza trees and their wells stand on the adjacent paving',async()=>{
  const {waterfrontGardens}=await import('../app/waterfront-gardens.ts');
  const {sfMap}=await import('../app/sf-map.ts');
  const {addSurveyCurbs}=await import('../app/curb-survey.ts');
  const {createMarketPaving}=await import('../app/market-paving.ts');
  const gardens=waterfrontGardens(sfMap.buildings),paving=[createMarketPaving()];
  addSurveyCurbs(geometry=>{
    const mesh=new T.Mesh(geometry);paving.push(mesh);return mesh;
  });
  gardens.root.updateMatrixWorld(true);
  const triangle=new T.Triangle(),point=new T.Vector3();
  for(const station of platforms.children){
    // Bound the full curved sheet, ribs, and clear space between their heights.
    // Testing triangles catches limbs whose endpoints straddle the roof.
    const roof=new T.Box3(),deck=new T.Box3();
    const vertices=station.geometry.attributes.position;
    for(let i=0;i<vertices.count;i++){
      point.fromBufferAttribute(vertices,i);
      if(point.y>.24)roof.expandByPoint(point);
      if(point.y<.12)deck.expandByPoint(point);
    }
    roof.expandByScalar(.006);
    const nearby=gardens.treeAnchors.filter(({x,z})=>
      x>roof.min.x-.60&&x<roof.max.x+.60&&z>roof.min.z-.55&&z<roof.max.z+.55
    );
    assert.ok(nearby.length>=2,station.name+' has adjacent trees');
    for(const {id} of nearby){
      const tree=gardens.root.getObjectByName('Surveyed tree '+id);
      assert.ok(tree);
      for(const part of tree.children){
        const {position}=part.geometry.attributes,index=part.geometry.index;
        for(let i=0;i<index.count;i+=3){
          triangle.a.fromBufferAttribute(position,index.getX(i)).applyMatrix4(part.matrixWorld);
          triangle.b.fromBufferAttribute(position,index.getX(i+1)).applyMatrix4(part.matrixWorld);
          triangle.c.fromBufferAttribute(position,index.getX(i+2)).applyMatrix4(part.matrixWorld);
          assert.ok(!roof.intersectsTriangle(triangle),'tree '+id+' enters roof band at '+station.name);
          assert.ok(!deck.intersectsTriangle(triangle),'tree '+id+' enters boarding deck at '+station.name);
        }
      }
      const well=gardens.root.children.find(part=>part.userData.treeSite===id);
      assert.ok(well,'tree well '+id);
      const box=new T.Box3().setFromObject(well,true);
      assert.ok(!box.intersectsBox(deck),'well inside boarding deck '+id);
      const trunkBase=new T.Box3().setFromObject(tree,true).min.y;
      const center=box.getCenter(new T.Vector3());
      assert.ok(Math.hypot(center.x-tree.position.x,center.z-tree.position.z)<.00001,'well centered on trunk '+id);
      for(const [x,z] of [[center.x,center.z],[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]]){
        const support=below(paving,x,z,box.max.y+.006);
        assert.ok(Math.abs(support-trunkBase)<.001,'trunk meets paving at '+id);
        assert.ok(Math.abs(box.max.y-support-.0009)<.001,'cutout rim sits directly on paving at '+id);
      }
    }
  }
});

test('the median bough before the Ferry Building clears the rigid PCC through the curve',async()=>{
  const {waterfrontGardens}=await import('../app/waterfront-gardens.ts');
  const {sfMap}=await import('../app/sf-map.ts');
  const {streetcarRideBody}=await import('../app/streetcar-ride-path.ts');
  const {pccDimensions:car}=await import('../app/pcc-layout.ts');
  const garden=waterfrontGardens(sfMap.buildings),tree=garden.root.getObjectByName('Surveyed tree -870123');
  tree.updateMatrixWorld(true);
  const body=new T.Object3D(),transform=new T.Matrix4(),tri=new T.Triangle();
  const box=new T.Box3(new T.Vector3(-car.length/2,0,-car.width/2),new T.Vector3(car.length/2,car.height,car.width/2));
  for(let station=-6.25;station< -4.2;station+=.04){
    const p=streetcarRideBody(station);
    body.position.set(p.x,p.y,p.z);body.rotation.set(0,p.heading,p.pitch);body.updateMatrixWorld();
    for(const part of tree.children){
      transform.copy(body.matrixWorld).invert().multiply(part.matrixWorld);
      const g=part.geometry;
      for(let k=0;k<g.index.count;k+=3){
        tri.a.fromBufferAttribute(g.attributes.position,g.index.getX(k)).applyMatrix4(transform);
        tri.b.fromBufferAttribute(g.attributes.position,g.index.getX(k+1)).applyMatrix4(transform);
        tri.c.fromBufferAttribute(g.attributes.position,g.index.getX(k+2)).applyMatrix4(transform);
        assert.ok(!box.intersectsTriangle(tri),part.name+' enters the car at '+station);
      }
    }
  }
});

test('the warning strip is set into each platform and bench posts meet the backrest',()=>{
  for(const [i,dir,high,end] of [[0,1,2.887,3.039],[1,-1,-3.327,-3.479]]){
    const mesh=platforms.children[i];
    for(const f of [.12,.45,.86]){
      const x=high+(end-high)*f,rail=trackAt(x,trackCenterlines[i]).z;
      const y=streetcarTrack.railTop+34*.0254*.06;
      for(const [offset,tint] of [[.083,'a49b8c'],[.088,'b5a065'],[.106,'b5a065'],[.114,'a49b8c']]){
        const r=new T.Raycaster(new T.Vector3(x,y+.003,rail+dir*offset),down,0,.004);
        const hits=r.intersectObject(mesh);
        assert.equal(hits.length,1,'one exposed platform surface at '+[x,offset]);
        assert.ok(Math.abs(hits[0].point.y-y)<1e-6);
        const pigment=new T.Color().fromBufferAttribute(mesh.geometry.attributes.color,hits[0].face.a);
        assert.ok(Math.abs(pigment.r-new T.Color('#'+tint).r)<.003);
      }
    }
  }
  const mesh=platforms.children[0];
  for(const [x,z,side] of [[1.256307,-3.316298,-1],[1.468807,-3.312102,1]]){
    const r=new T.Raycaster(new T.Vector3(x,.111304,z+side*.001),new T.Vector3(0,0,-side),0,.0018);
    assert.equal(r.intersectObject(mesh).length,1,'single backrest finish');
  }
});
