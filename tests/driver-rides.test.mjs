import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {driverPose,rideDuration} from '../app/driver-rides.ts';
import {addBridgeDeck,roadPaintLift} from '../app/bridge-deck.ts';
import {bridgeLayout,bridgePoint} from '../app/bridge-layout.ts';
import {approachPose,buildApproachRoad} from '../app/approach-road.ts';
import {bayReliefGround} from '../app/bay-relief.ts';
import {streetcarPose} from '../app/streets.ts';
import {pccDimensions} from '../app/streetcar.ts';

const near=(x,y,eps=1e-6)=>assert.ok(Math.abs(x-y)<=eps,x+' vs '+y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
test('the westbound driver clears YBI and stays at seated eye height over both constructed road surfaces',()=>{
  const road=new T.Group(),bridge=new T.Group(),material=new T.MeshBasicMaterial();
  bridge.position.set(bridgeLayout.origin[0],0,bridgeLayout.origin[1]);bridge.rotation.y=bridgeLayout.angle;road.add(bridge);
  const meshes=[],approachPaint=[];
  const make=(g,color,x,y,z,parent)=>{
    const m=new T.Mesh(g,material);m.position.set(x,y,z);parent.add(m);
    if(parent.name==='Mapped I-80 west approach and SoMa ramps'&&g.userData.roadPaint)approachPaint.push(m);
    if(color==='#728383'||color==='#738587')meshes.push(m);
    return m;
  };
  addBridgeDeck(bridge,make,bridgeLayout.length,bridgeLayout.lowerDeck,bridgeLayout.upperDeck);
  const updateApproach=buildApproachRoad(make,road);road.updateMatrixWorld(true);
  const start=driverPose('bridge',0),end=driverPose('bridge',Infinity);
  assert.ok(start.station<bridgeLayout.length+8.6-1.15/2);
  assert.ok(start.eye.y-bayReliefGround(start.eye.x,start.eye.z)>.7);
  near(start.eye.y,bridgeLayout.upperDeck+.0755+1.18*.06);
  const down=new T.Vector3(0,-1,0);
  // Sample the actual diagonal planes on curved and sloping pavement, including the city end of the joint.
  const cast=new T.Raycaster(),probe=new T.Vector3();
  let count=0;
  for(const piece of approachPaint.slice(0,380).filter((_,i)=>i%7===0)){
    const g=piece.geometry,pos=g.attributes.position;
    for(let i=0;i<pos.count;i+=Math.max(3,3*Math.floor(pos.count/9))){
      probe.set(0,0,0);
      for(let k=i;k<i+3;k++)probe.add(new T.Vector3().fromBufferAttribute(pos,k));
      probe.multiplyScalar(1/3);
      assert.ok(g.attributes.normal.getY(i)>.98);
      const height=probe.y;probe.y+=.001;cast.set(probe,down);cast.far=.002;
      const hit=cast.intersectObjects(meshes,false)[0];assert.ok(hit);
      near(height-hit.point.y,roadPaintLift,.00001);count++;
    }
  }
  assert.ok(count>100);
  for(const station of [...bridgeLayout.towers,bridgeLayout.anchor,15.64,1,-1,-12,-26,-32]){
    const p=driverPose('bridge',(start.station-station)/1.10);
    near(p.station,station);
    const center=station>=0?bridgePoint(.216,station):approachPose(false,-station,1);
    near(Math.hypot(p.eye.x-center.x,p.eye.z-center.z),.38*.06,station<0?.003:.000001);
    const dx=p.look.x-p.eye.x,dz=p.look.z-p.eye.z;
    near(((center.x-p.eye.x)*-dz+(center.z-p.eye.z)*dx)/Math.hypot(dx,dz),.38*.06,.003);
    const hit=new T.Raycaster(new T.Vector3(p.eye.x,p.eye.y,p.eye.z),down,0,.2).intersectObjects(meshes,false)[0];
    assert.ok(hit,'the westbound tire contact must be on real asphalt at '+station);
    near(p.eye.y-hit.point.y,1.18*.06,.001);
    assert.ok(p.look.z<p.eye.z-2.4);
  }
  near(end.station,-32);assert.ok(end.eye.y<start.eye.y-.95);
  const streams=[];
  road.traverse(node=>{if(node.isInstancedMesh&&node.name==='Skyway traffic')streams.push(node);});
  assert.equal(streams.length,4);
  const matrix=new T.Matrix4(),point=new T.Vector3();
  // Include the joint from the span side and every frame of the descending approach.
  for(let tick=Math.floor((start.station-6)/1.1*30);tick<=Math.ceil(rideDuration('bridge')*30);tick++){
    const t=tick/30,p=driverPose('bridge',t);
    updateApproach(t);
    const dx=p.look.x-p.eye.x,dz=p.look.z-p.eye.z,n=Math.hypot(dx,dz);
    const centerX=p.eye.x-.38*.06*dz/n,centerZ=p.eye.z+.38*.06*dx/n;
    for(const stream of streams)for(let i=0;i<stream.count;i++){
      stream.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
      if(Math.abs(point.y-p.eye.y)>.26)continue;
      const x=point.x-centerX,z=point.z-centerZ;
      const lateral=Math.abs((-dz*x+dx*z)/n),along=Math.abs((dx*x+dz*z)/n);
      assert.ok(lateral>.14||along>2.7,'west approach vehicle clearance at '+t);
    }
  }
  const join=start.station/1.1;
  assert.ok(distance(driverPose('bridge',join-.001).eye,driverPose('bridge',join+.001).eye)<.003);
});
test('1051 stops northbound at the correct doors, holds at Washington, then brakes into Broadway',()=>{
  const door=1.21*pccDimensions.length/3.629,leg=(15.1602+1.1513)/.72+.72/.075;
  for(const [time,stop] of [[0,-1.1513],[leg,15.1602],[leg+3,15.1602],[leg+7,15.1602],[Infinity,35.3121]]){
    const p=driverPose('streetcar',time),body=streetcarPose(p.station);
    near(p.station+door,stop);
    near(p.eye.y-body.y,2.15*.06);
    const dx=Math.cos(body.heading),dz=-Math.sin(body.heading);
    near((p.eye.x-body.x)*dz-(p.eye.z-body.z)*dx,.30*.06);
    near((p.eye.x-body.x)*dx+(p.eye.z-body.z)*dz,1.801*pccDimensions.length/3.629-1.04*.06);
    assert.ok(p.look.x>p.eye.x+2);
  }
  const station=t=>driverPose('streetcar',t).station;
  near(station(11.1)-station(11),.072);
  near(station(leg)-station(leg-.1),.5*.075*.1**2);
  near(station(leg+7.1)-station(leg+7),.5*.075*.1**2);
});
test('routes clamp at their endpoints without wrapping and have continuous forward motion',()=>{
  for(const mode of ['streetcar','bridge']){
    const duration=rideDuration(mode),begin=driverPose(mode,0),end=driverPose(mode,duration);
    assert.deepEqual(driverPose(mode,-10),begin);assert.deepEqual(driverPose(mode,NaN),begin);
    assert.deepEqual(driverPose(mode,duration+100),end);
    let prev=begin;
    for(let t=.1;t<duration;t+=.1){
      const current=driverPose(mode,t);
      assert.ok(distance(prev.eye,current.eye)<.115);
      assert.ok(mode==='streetcar'?current.station>=prev.station:current.station<=prev.station);
      prev=current;
    }
  }
});


test('westbound lead-in retains five lanes, two shoulders and asphalt through the tunnel mouth',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const {architectureChunks}=createLandscape(),ray=new T.Raycaster();
  const down=new T.Vector3(0,-1,0),y=bridgeLayout.upperDeck;
  function surface(x,z){
    const p=bridgePoint(x,z),start=new T.Vector3(p.x,y+.16,p.z);
    ray.set(start,down);ray.far=.15;
    const h=ray.intersectObjects(architectureChunks,false)[0];
    assert.ok(h,'road is present at bridge station '+z);
    return {chunk:h.object,normal:h.face.normal,y:h.point.y,color:new T.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a)};
  }
  function matches(hit,tint,height){
    const expected=new T.Color(tint);
    for(const channel of ['r','g','b'])near(hit.color[channel],expected[channel],.5/255+.00001);
    near(hit.y,y+height,.00003);
    if(tint!=='#728383'){
      assert.equal(hit.chunk.castShadow,false);assert.equal(hit.chunk.receiveShadow,true);
      assert.equal(hit.chunk.material.polygonOffsetUnits,-3);assert.equal(hit.chunk.material.polygonOffset,true);
      assert.ok(hit.normal.y>.9999);
    }
  }
  const join=bridgeLayout.length;
  for(const z of [join-.003,join+.003,join+7.65,join+8.6,join+10.05]){
    matches(surface(0,z),'#728383',.0755);
    for(const side of [-1,1])near(surface(side*.597,z).y,y+.0755+.06,.00003);
    matches(surface(-.548,z),'#c4ab72',.0755+roadPaintLift);
    matches(surface(.548,z),'#d8d8c3',.0755+roadPaintLift);
  }
  for(const z of [.62+218*.86,.62+219*.86,.62+228*.86]){
    for(const x of [-.324,-.108,.108,.324]){
      matches(surface(x,z),'#cbcbbb',.0755+roadPaintLift);
      matches(surface(x,z+.30),'#728383',.0755);
    }
  }
});
