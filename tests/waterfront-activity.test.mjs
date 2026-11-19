import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {waterfrontCar,waterfrontCarCount,waterfrontWalker,waterfrontWalkerCount} from '../app/waterfront-routes.ts';
import {createWaterfrontTraffic} from '../app/waterfront-traffic.ts';
import {plazaSkaterCount,plazaSkaterPose} from '../app/plaza-skaters.ts';
import {createLandscape,createCityVignette} from '../app/landscape.ts';
import {harryBridgesBoundary} from '../app/curb-survey.ts';

test('a rebuilt waterfront keeps each set of skaters on its own single weather shader',()=>{
  function skaterPaint(){
    const world=createLandscape(),materials=new Set();
    world.skaters.root.traverse(mesh=>{if(mesh.isMesh)materials.add(mesh.material);});
    assert.equal(materials.size,1);
    return {material:[...materials][0],rain:world.rainOnStone};
  }
  const first=skaterPaint(),second=skaterPaint();
  assert.notEqual(first.material,second.material);
  assert.equal(first.material.customProgramCacheKey(),second.material.customProgramCacheKey());
  for(const {material,rain} of [first,second]){
    const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <fog_fragment>'};
    material.onBeforeCompile(shader,{});
    assert.equal(shader.vertexShader.match(/varying vec3 pigmentPosition;/g)?.length,1);
    assert.equal(shader.uniforms.rainOnStone,rain);
  }
});

test('both road directions keep varied headways and move forward through the curved carriageways',()=>{
  for(const region of [undefined,'street','plaza']){
    const count=waterfrontCarCount(region);
    for(const t of [0,5,22,143,9141]){
      for(const parity of [0,1]){
        const lane=Array.from({length:count/2},(_,i)=>waterfrontCar(t,2*i+parity,region)).filter(p=>p.active).map(p=>p.x).sort((a,b)=>a-b);
        const gaps=lane.slice(1).map((p,i)=>p-lane[i]);
        assert.ok(Math.min(...gaps)>.60&&Math.max(...gaps)>4*Math.min(...gaps));
        for(let i=parity;i<count;i+=2){
          const p=waterfrontCar(t,i,region),q=waterfrontCar(t+.001,i,region);
          if(p.active&&q.active)assert.ok((q.x-p.x)*(parity?1:-1)>=-1e-10);
        }
      }
    }
  }
  const full=createWaterfrontTraffic(new THREE.MeshStandardMaterial());
  assert.equal(full.traffic.length,12);assert.equal(full.traffic.reduce((sum,b)=>sum+b.count,0),56);
  const b=full.traffic[0];full.update(26);
  const paused=b.instanceMatrix.array.slice();full.update(26);assert.deepEqual(paused,b.instanceMatrix.array);
  full.update(27);assert.notDeepEqual(paused,b.instanceMatrix.array);
});

test('the five added waterfront walking paths meet their physical surfaces',()=>{
  const scene=createLandscape();scene.root.updateMatrixWorld(true);
  const bricks=scene.root.getObjectByName('Halprin brick court');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.28);
  const courts=[bricks,...scene.architectureChunks,scene.root.getObjectByName('Market granite and herringbone promenade')];
  for(const mesh of courts)mesh.geometry.computeBoundingBox();
  function checkFloor(p,meshes,tolerance){
    ray.ray.origin.set(p.x,p.y+.21,p.z);
    const local=meshes.filter(m=>{const b=m.geometry.boundingBox;return p.x>=b.min.x&&p.x<=b.max.x&&p.z>=b.min.z&&p.z<=b.max.z});
    const actual=ray.intersectObjects(local)[0]?.point.y;
    assert.ok(Math.abs(actual-p.y)<tolerance,'Unsupported or obstructed at '+JSON.stringify({x:p.x,z:p.z,y:p.y,actual}));
  }
  assert.ok(waterfrontWalkerCount()>=60);
  // Sample each of the five added paths, including both halves of the pier.
  for(const id of [22,32,40,50,58]){
    for(let t=0;t<360;t+=7.8)checkFloor(waterfrontWalker(t,id),courts,.01);
  }
});

test('two shared walkers turn inside Pier 1½, pause, then return on supported clear lanes',()=>{
  const scene=createLandscape(),positions=[];
  scene.root.updateMatrixWorld(true);
  // Keep the actual baked triangles around this short route, including curb
  // furniture, roof beams and glazing. Probe both sides of the opaque geometry.
  const area=new THREE.Box3(new THREE.Vector3(15,-.15,-2.2),new THREE.Vector3(16.85,.67,-.83));
  const tri=new THREE.Triangle(),bounds=new THREE.Box3();
  for(const m of scene.architectureChunks){
    if(!area.intersectsBox(m.geometry.boundingBox))continue;
    const g=m.geometry,pos=g.attributes.position;
    for(let i=0;i<g.index.count;i+=3){
      for(const [k,v] of [tri.a,tri.b,tri.c].entries())v.fromBufferAttribute(pos,g.index.getX(i+k)).applyMatrix4(m.matrixWorld);
      bounds.setFromPoints([tri.a,tri.b,tri.c]);if(!area.intersectsBox(bounds))continue;
      for(const v of [tri.a,tri.b,tri.c])positions.push(v.x,v.y,v.z);
    }
  }
  const local=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(),v=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
  const first=waterfrontWalkerCount()-2,plaza=waterfrontWalkerCount('plaza')-2;
  let minSpace=Infinity;
  for(let i=0;i<2;i++){
    let outside=false,entered=false,looked=false,returned=false,held;
    for(let t=0;t<=155;t+=.38){
      const p=waterfrontWalker(t,first+i),other=waterfrontWalker(t,first+1-i);
      minSpace=Math.min(minSpace,Math.hypot(other.x-p.x,other.z-p.z));
      assert.deepEqual(p,waterfrontWalker(t,plaza+i,'plaza'));
      if(p.z<-1.94){outside=true;if(looked)returned=true;}
      if(p.z>-1.7&&p.z<-1.25){entered=true;assert.ok(Math.abs(p.x-16.515)<.06);}
      if(p.standing){
        assert.ok(p.x<15.45&&Math.abs(p.z+1.045)<.05);looked=true;
        if(held){assert.ok(Math.hypot(held.x-p.x,held.z-p.z)<1e-7);}
        held=p;
      }else held=undefined;
      assert.ok(p.z<-.98,'stay landward of the slip');
      for(const offset of [-.012,0,.012]){
        const x=p.x+Math.sin(p.heading)*offset,z=p.z-Math.cos(p.heading)*offset;
        ray.set(v.set(x,p.y+.012,z),down);ray.far=.022;
        const floor=ray.intersectObject(local,false)[0];assert.ok(floor&&Math.abs(floor.point.y-p.y)<.004,'foot support '+JSON.stringify(p));
      }
      ray.set(v.set(p.x,p.y+.012,p.z),up);ray.far=.136;
      assert.equal(ray.intersectObject(local,false).length,0,'head clearance '+JSON.stringify(p));
      for(const sign of [-1,1]){
        ray.set(v.set(p.x,p.y+.068,p.z),new THREE.Vector3(sign*Math.sin(p.heading),0,-sign*Math.cos(p.heading)));
        ray.far=.026;assert.equal(ray.intersectObject(local,false).length,0,'shoulder clearance '+JSON.stringify(p));
      }
    }
    assert.ok(outside&&entered&&looked&&returned);
  }
  assert.ok(minSpace>.055,'opposing pedestrians have separate passing lanes');
});

test('four ferry travelers cross the hall and bayside promenade on supported, clear routes to the E gangway',async()=>{
  const {ferryPassengerPose}=await import('../app/ferry-passengers.ts');
  const {ferryPose}=await import('../app/motion.ts');
  const {ferryCycle}=await import('../app/ferry-service.ts');
  const world=createLandscape(),cell=.42,tiles=new Map(),probe=new THREE.Raycaster();
  const extent=new THREE.Box3(new THREE.Vector3(-8.4,.014,-2.23),new THREE.Vector3(1.20,.26,3.10));
  const tri=new THREE.Triangle(),box=new THREE.Box3();
  // Index only the actual production faces along the west entry and east apron.
  for(const chunk of world.architectureChunks){
    const g=chunk.geometry;
    if(!extent.intersectsBox(g.boundingBox))continue;
    for(let i=0;i<g.index.count;i+=3){
      const verts=[tri.a,tri.b,tri.c];
      verts.forEach((v,k)=>v.fromBufferAttribute(g.attributes.position,g.index.getX(i+k)));
      box.setFromPoints(verts).intersect(extent);
      if(box.isEmpty())continue;
      for(let x=Math.floor(box.min.x/cell);x<=Math.floor(box.max.x/cell);x++)
        for(let z=Math.floor(box.min.z/cell);z<=Math.floor(box.max.z/cell);z++){
          if(x*cell<-.84&&z*cell<1.25)continue;
          const key=x+','+z,positions=tiles.get(key)??[];
          if(!tiles.has(key))tiles.set(key,positions);
          for(const v of verts)positions.push(v.x,v.y,v.z);
        }
    }
  }
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  for(const [key,positions] of tiles){
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    tiles.set(key,new THREE.Mesh(g,material));
  }
  const down=new THREE.Vector3(0,-1,0),point=new THREE.Vector3(),all=[];
  for(let person=0;person<4;person++){
    const visits=new Set();
    for(let t=0;t<2*ferryCycle;t+=.32){
      const p=ferryPassengerPose(t,person,ferryPose(t,0));
      if(!extent.containsPoint(point.set(p.x,p.y,p.z))||p.standing)continue;
      visits.add(p.z< -1.75?'steps':p.z<1.67?'hall':p.z<2.97?'promenade':'gangway joint');
      for(const shift of [-.016,0,.016]){
        const x=p.x+Math.sin(p.heading)*shift,z=p.z-Math.cos(p.heading)*shift;
        const tile=tiles.get(Math.floor(x/cell)+','+Math.floor(z/cell));
        probe.set(point.set(x,p.y+.117,z),down);probe.far=.145;
        const ground=tile&&probe.intersectObject(tile,false)[0]?.point.y;
        const tolerance=z>3.0?.012:shift?.011:.0035;
        assert.ok(Number.isFinite(ground)&&Math.abs(ground-p.y)<tolerance,
          'ground or body clearance at '+[person,t,x,p.y,z,ground].join(','));
      }
    }
    all.push(visits);
  }
  for(const visits of all)assert.deepEqual([...visits].sort(),['gangway joint','hall','promenade','steps']);
});

test('travelers clear the gangway before retraction and ride on the moving Pyxis deck across repeated calls',async()=>{
  const {ferryPassengerPose}=await import('../app/ferry-passengers.ts');
  const {ferryPose}=await import('../app/motion.ts');
  const {ferryCycle,vessels}=await import('../app/ferry-service.ts');
  const ship=vessels[0],frame=new THREE.Object3D(),sole=new THREE.Vector3();
  const boarded=[0,0,0,0],alighted=[0,0,0,0],wasRiding=[];
  let separation=Infinity,crossings=0;
  for(let time=0;time<=4*ferryCycle;time+=.25){
    const boat=ferryPose(time,0);
    frame.position.set(boat.x,boat.y,boat.z);
    frame.rotation.set(0,boat.heading,Math.sin(time*1.2)*.007*(1-boat.brow));
    frame.updateMatrixWorld();
    const poses=Array.from({length:4},(_,i)=>ferryPassengerPose(time,i,boat));
    for(const [i,p] of poses.entries()){
      for(let j=0;j<i;j++)separation=Math.min(separation,Math.hypot(p.x-poses[j].x,p.z-poses[j].z));
      const local=frame.worldToLocal(sole.set(p.x,p.y,p.z));
      const riding=p.standing&&Math.abs(local.z+.222)<.001;
      if(riding){
        assert.ok(Math.abs(local.y-ship.sill)<.00001&&Math.abs(local.x-ship.door)<.034,'soles on the rigid vestibule floor');
        if(boat.brow===0)assert.ok(Math.cos(p.heading+boat.heading)>.99999,'passengers face the bow as the hull turns');
      }
      if(time&&riding!==wasRiding[i]){
        assert.equal(boat.brow,1);assert.equal(boat.phase,'alongside');
        if(riding)boarded[i]++;else alighted[i]++;
      }
      if(p.x>boat.stopX+.027&&p.x<boat.stopX+.149&&Math.abs(p.z-boat.stopZ)<.04&&!p.standing){
        assert.equal(boat.brow,1,'brow spans the water before passengers cross');crossings++;
      }
      wasRiding[i]=riding;
    }
  }
  assert.ok(separation>.044,'travelers maintain individual body clearance across phases');
  assert.ok(crossings>70);
  assert.deepEqual(boarded,[2,2,2,2]);assert.deepEqual(alighted,[2,2,2,2]);
});

test('six skaters carve the inland Harry Bridges granite with four grounded wheels and a planted push in both city views',()=>{
  const city=createLandscape(),vignette=createCityVignette('plaza');
  const down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster(),point=new THREE.Vector3();
  for(const world of [city,vignette]){
    world.root.updateMatrixWorld(true);
    const local=[],region=new THREE.Box3(new THREE.Vector3(1.70,.025,-5.02),new THREE.Vector3(3.86,.171,-4.19));
    const box=new THREE.Box3(),corners=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
    for(const mesh of [...world.architectureChunks,world.root.getObjectByName('Market granite and herringbone promenade')]){
      if(!box.setFromObject(mesh).intersectsBox(region))continue;
      const geo=mesh.geometry,coords=geo.attributes.position;
      for(let i=0;i<geo.index.count;i+=3){
        for(let k=0;k<3;k++)corners[k].fromBufferAttribute(coords,geo.index.getX(i+k)).applyMatrix4(mesh.matrixWorld);
        if(box.setFromPoints(corners).intersectsBox(region))for(const c of corners)local.push(c.x,c.y,c.z);
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(local,3));
    const floor=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    function assertSupport(p,label){
      ray.set(point.set(p.x,.165,p.z),down);
      const hit=ray.intersectObject(floor)[0];assert.ok(hit&&Math.abs(hit.point.y-p.y)<.00012,label+' '+[p.x,p.y,p.z,hit?.point.y]);
    }
    // Exercise the real market batches at full Saturday trade before moving
    // into a night when their stalls have been taken down.
    world.ferryMarket.update(Date.parse('2026-11-21T12:00:00-08:00'));
    const marketBoxes=[],matrix=new THREE.Matrix4();
    world.ferryMarket.root.traverse(o=>{
      if(!o.isInstancedMesh||!o.visible)return;
      o.geometry.computeBoundingBox();
      for(let j=0;j<o.count;j++){
        o.getMatrixAt(j,matrix);matrix.premultiply(o.matrixWorld);
        const b=o.geometry.boundingBox.clone().applyMatrix4(matrix);
        if(b.clone().expandByScalar(.10).intersectsBox(region))marketBoxes.push(b);
      }
    });
    const {root,update}=world.skaters;
    const board=root.getObjectByName('Skateboards with four wheels'),back=root.getObjectByName('Trailing skate legs');
    assert.equal(board.count,6);assert.equal(back.count,6);assert.equal(root.children.length,5);
    assert.ok(root.children.every(m=>m.isInstancedMesh));
    assert.ok(root.children.reduce((n,m)=>n+m.geometry.index.count*m.count/3,0)<=3900);
    const boardMatrix=new THREE.Matrix4(),legMatrix=new THREE.Matrix4();
    let plants=0,coasts=0;
    for(let tick=0;tick<=440;tick++){
      if(tick===220)world.ferryMarket.update(Date.parse('2026-11-21T23:00:00-08:00'));
      const t=86390+tick*.07;update(t);root.updateMatrixWorld(true);
      for(let i=0;i<plazaSkaterCount;i++){
        const p=plazaSkaterPose(t,i);
        for(let j=i+1;j<plazaSkaterCount;j++){
          const q=plazaSkaterPose(t,j);
          assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>.087,'separate rolling envelopes');
        }
        board.getMatrixAt(i,boardMatrix);back.getMatrixAt(i,legMatrix);
        assert.ok(Math.hypot(p.x-1.266,p.z+4.647)>.53,'clear of north light steps');
        assert.ok(p.x>1.80,'north of the Market pedestrian crossing');
        for(const b of marketBoxes){
          point.set(p.x,p.y+.055,p.z);assert.ok(b.distanceToPoint(point)>.06,'clear of open market furnishings');
        }
        let clearance=Infinity;
        for(let j=0;j<harryBridgesBoundary.length;j++){
          const a=harryBridgesBoundary[j],b=harryBridgesBoundary[(j+1)%harryBridgesBoundary.length],dx=b[0]-a[0],dz=b[1]-a[1];
          const u=THREE.MathUtils.clamp(((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz),0,1);
          clearance=Math.min(clearance,Math.hypot(p.x-a[0]-dx*u,p.z-a[1]-dz*u));
        }
        assert.ok(clearance>.16,'clear of curb and tracks');
        for(const x of [-.245,.245])for(const z of [-.088,.088]){
          if(!tick){
            const pos=board.geometry.attributes.position;
            assert.ok(Array.from({length:pos.count},(_,n)=>n).some(n=>Math.abs(pos.getX(n)-x)<.00001&&
              Math.abs(pos.getZ(n)-z)<.016&&Math.abs(pos.getY(n))<.00001),'wheel tread at support probe');
          }
          assertSupport(new THREE.Vector3(x,0,z).applyMatrix4(boardMatrix),'wheel');
        }
        if(!back.geometry.boundingBox)back.geometry.computeBoundingBox();
        const sole=new THREE.Vector3(-.153,back.geometry.boundingBox.min.y,-.012).applyMatrix4(legMatrix);
        if(p.push>.9999){assertSupport(sole,'push sole');plants++;}
        if(!p.footSide){
          const deck=new THREE.Vector3(-.194,.1195,.033).applyMatrix4(boardMatrix);
          assert.ok(sole.distanceTo(deck)<.00001,'coasting shoe meets deck');coasts++;
        }
      }
    }
    assert.ok(plants>10&&coasts>100);
    update(631);const fixed=board.instanceMatrix.array.slice(),version=board.instanceMatrix.version;update(631);
    assert.deepEqual(board.instanceMatrix.array,fixed);assert.equal(board.instanceMatrix.version,version);
    update(632);assert.notDeepEqual(board.instanceMatrix.array,fixed);
    g.dispose();floor.material.dispose();
  }
});

test('the two skating lines pass one another with clearance through many laps',()=>{
  let passes=0,previous,smallest=Infinity;
  for(let t=0;t<360;t+=.13){
    const poses=Array.from({length:plazaSkaterCount},(_,i)=>plazaSkaterPose(t,i));
    for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++){
      const a=poses[i],b=poses[j],separation=Math.hypot(a.x-b.x,a.z-b.z);
      smallest=Math.min(smallest,separation);
      if(i<3&&j>=3&&previous&&separation<.27&&Math.cos(a.heading-b.heading)>.9&&
        (previous[i].x-previous[j].x)*(a.x-b.x)<0)passes++;
    }
    previous=poses;
  }
  assert.ok(smallest>.087,'minimum center spacing '+smallest);
  assert.ok(passes>4,'parallel overtakes on distinct lines: '+passes);
});
