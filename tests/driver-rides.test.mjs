import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {driverPose,rideDuration,museumLegDuration} from '../app/driver-rides.ts';
import {addBridgeDeck,roadPaintLift} from '../app/bridge-deck.ts';
import {bridgeLayout,bridgePoint} from '../app/bridge-layout.ts';
import {westboundExitPose,fremontFork,buildApproachRoad} from '../app/approach-road.ts';
import {bayReliefGround} from '../app/bay-relief.ts';
import {museumDoorStation} from '../app/streetcar-ride-path.ts';
import {northWaterfrontGrade,streetPose,trackAt,trackCenterlines} from '../app/streets.ts';
import {waterfrontCar,waterfrontCarCount} from '../app/waterfront-routes.ts';
import {ambientStreetcarCall} from '../app/washington-call.ts';
import {howardTurnStopLine,roadStopLines,signalAspects,spearStopLine} from '../app/waterfront-signals.ts';
import {pccDimensions} from '../app/streetcar.ts';

const near=(x,y,eps=1e-6)=>assert.ok(Math.abs(x-y)<=eps,x+' vs '+y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
test('the westbound driver clears YBI and stays at seated eye height over both constructed road surfaces',()=>{
  const road=new T.Group(),bridge=new T.Group(),material=new T.MeshBasicMaterial();
  bridge.position.set(bridgeLayout.origin[0],0,bridgeLayout.origin[1]);bridge.rotation.y=bridgeLayout.angle;road.add(bridge);
  const meshes=[],parapets=[],approachPaint=[];
  const make=(g,color,x,y,z,parent)=>{
    const m=new T.Mesh(g,material);m.position.set(x,y,z);parent.add(m);
    if(parent.name==='Mapped I-80 west approach and SoMa ramps'&&g.userData.roadPaint)approachPaint.push(m);
    if(color==='#728383'||color==='#738587')meshes.push(m);
    if(color==='#a6aba1')parapets.push(m);
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
    const center=station>=0?bridgePoint(.432,station):westboundExitPose(-station);
    near(Math.hypot(p.eye.x-center.x,p.eye.z-center.z),.38*.06,station<0?.003:.000001);
    const dx=p.look.x-p.eye.x,dz=p.look.z-p.eye.z;
    near(((center.x-p.eye.x)*-dz+(center.z-p.eye.z)*dx)/Math.hypot(dx,dz),.38*.06,.003);
    const hit=new T.Raycaster(new T.Vector3(p.eye.x,p.eye.y,p.eye.z),down,0,.2).intersectObjects(meshes,false)[0];
    assert.ok(hit,'the westbound tire contact must be on real asphalt at '+station);
    near(p.eye.y-hit.point.y,1.18*.06,.001);
    assert.ok(Math.hypot(dx,dz)>2.48&&Math.hypot(dx,dz)<2.72);
  }
  // Sample a 1.8 m wide car through the two-lane ramp mouth. Test the
  // actual poured road and parapet meshes, including both sides of the gore.
  for(let distance=fremontFork-1;distance<32;distance+=.083){
    const center=westboundExitPose(distance);
    const right=new T.Vector3(Math.sin(center.heading),0,Math.cos(center.heading));
    for(const offset of [-.054,0,.054]){
      const top=new T.Vector3(center.x,center.y+.135,center.z).addScaledVector(right,offset);
      const ray=new T.Raycaster(top,down,0,.16);
      const asphalt=ray.intersectObjects(meshes,false)[0];
      assert.ok(asphalt&&Math.abs(asphalt.point.y-center.y)<.0035,'Fremont pavement at '+[distance,offset,center.y,asphalt?.point.y]);
      assert.ok(!ray.intersectObjects(parapets,false).some(h=>h.point.y>center.y+.015),
        'clear of both concrete gore noses at '+distance);
    }
  }
  // Beyond the fork the driver follows the Fremont exit to its broad right
  // curve; the mainline here continues several hundred metres further south.
  const curve=driverPose('bridge',(start.station+32)/1.10);
  assert.ok(curve.eye.x> -46&&curve.eye.z> -47&&curve.look.x>curve.eye.x+2.45);
  assert.ok(end.eye.x>82.5&&end.eye.x<82.6&&end.eye.y<start.eye.y-3);
  const streams=[];
  road.traverse(node=>{if(node.isInstancedMesh&&node.name==='Skyway traffic')streams.push(node);});
  assert.equal(streams.length,4);
  const matrix=new T.Matrix4(),point=new T.Vector3();
  // Include the joint from the span side and every frame of the descending approach.
  for(let tick=Math.floor((start.station-6)/1.1*30);tick<=245*30;tick++){
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
  const door=1.521*pccDimensions.length/3.629,leg=(15.1602-2.217)/.72+.72/.075;
  const depart=museumLegDuration+7;
  for(const [time,stop] of [[0,museumDoorStation],[museumLegDuration,2.217],[depart,2.217],[depart+leg,15.1602],[depart+leg+3,15.1602],[depart+leg+7,15.1602],[Infinity,35.3121]]){
    const p=driverPose('streetcar',time),body=p.body;
    near(p.station+door,stop);
    near(p.eye.y-body.y,2.15*.06);
    const dx=Math.cos(body.heading),dz=-Math.sin(body.heading);
    near((p.eye.x-body.x)*dz-(p.eye.z-body.z)*dx,.30*.06);
    near((p.eye.x-body.x)*dx+(p.eye.z-body.z)*dz,1.801*pccDimensions.length/3.629-1.04*.06);
    near(p.look.x-p.eye.x,2.1*dx);near(p.look.z-p.eye.z,2.1*dz);
  }
  const station=t=>driverPose('streetcar',depart+t).station;
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


test('constructed pavement supports the five-lane tunnel entrance and all three tire probes through Chestnut',async()=>{
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
  const hiddenEnd=bridgePoint(.432,bridgeLayout.length+10.10);
  assert.ok(bayReliefGround(hiddenEnd.x,hiddenEnd.z)>y+.0755+.7);
  const join=bridgeLayout.length;
  for(const z of [join-.003,join+.003,join+7.65,join+8.6,join+10.05]){
    matches(surface(0,z),'#728383',.0755);
    for(const side of [-1,1]){
      near(surface(side*.597,z).y,y+.0755+.016,.00003);
      near(surface(side*.639,z).y,y+.0755+.062,.00003);
    }
    matches(surface(-.548,z),'#c4ab72',.0755+roadPaintLift);
    matches(surface(.548,z),'#d8d8c3',.0755+roadPaintLift);
  }
  for(const z of [.62+218*.86,.62+219*.86,.62+228*.86]){
    for(const x of [-.324,-.108,.108,.324]){
      matches(surface(x,z),'#cbcbbb',.0755+roadPaintLift);
      matches(surface(x,z+.30),'#728383',.0755);
    }
  }
  // Probe the actual baked road under both sides of the sedan and its center.
  // A ray starting just above the expected roof also catches raised curbs or rails.
  function tireOnRoad(x,z,pavement){
    const chunks=architectureChunks.filter(({geometry:g})=>{
      const {min,max}=g.boundingBox;
      return x>=min.x&&x<=max.x&&z>=min.z&&z<=max.z&&pavement+.14>=min.y&&pavement-.02<=max.y;
    });
    ray.set(new T.Vector3(x,pavement+.14,z),down);ray.far=.16;
    const hit=ray.intersectObjects(chunks,false)[0];
    assert.ok(hit&&Math.abs(hit.point.y-pavement)<.009,'sedan tire at '+[x.toFixed(2),z.toFixed(2),hit?.point.y,pavement]);
  }
  for(let t=230;t<rideDuration('bridge');t+=(t>310&&t<373?.29:3.83)){
    const {eye,look}=driverPose('bridge',t),vx=look.x-eye.x,vz=look.z-eye.z,n=Math.hypot(vx,vz);
    for(const offset of [-.054,0,.054])
      tireOnRoad(eye.x-(.38*.06+offset)*vz/n,eye.z+(.38*.06+offset)*vx/n,eye.y-1.18*.06);
  }
  // Continue down the road visible ahead of the parked sedan, across the
  // far end of the survey into the lower-detail boulevard.
  for(const x of [84,89,95.93,96,96.07,98,102]){
    const road=streetPose(x);
    for(const offset of [.131,.185,.239]){
      const wheelX=x+offset*Math.sin(road.heading);
      tireOnRoad(wheelX,road.z+offset*Math.cos(road.heading),northWaterfrontGrade(wheelX));
    }
  }
});

test('the passenger sedan waits behind the Spear limit line, then clears the crosswalk on green',()=>{
  let stoppedOnRed=false,passed=false,previousDistance;
  for(let tick=2850;tick<=3020;tick++){
    const t=tick/10,pose=driverPose('bridge',t),{eye,look}=pose;
    const forward=new T.Vector2(look.x-eye.x,look.z-eye.z).normalize();
    const noseX=eye.x-.0228*forward.y+.14*forward.x;
    const noseZ=eye.z+.0228*forward.x+.14*forward.y;
    const signed=(noseX-spearStopLine.x)*spearStopLine.nx+(noseZ-spearStopLine.z)*spearStopLine.nz;
    if(signalAspects(t)[1]===0&&pose.station===driverPose('bridge',t+.09).station){
      assert.ok(signed<-.04&&signed>-.08,'bumper stops about a metre behind the line');
      stoppedOnRed=true;
    }
    if(previousDistance<0&&signed>=0){assert.equal(signalAspects(t)[1],2);passed=true;}
    if(signed>=0&&signed<1.6)assert.equal(signalAspects(t)[1],2,'green across both marked legs');
    previousDistance=signed;
  }
  assert.ok(stoppedOnRed&&passed);
});
test('the sedan follows Fremont and Howard, clears moving cars and crosses the three waterfront signals on green',()=>{
  const milestones=[[243,-34,-31.1],[255,-29.3,-31.8],[290,-26.3,-14.6],[326.4,-24.93,-4.44],[370,-23.58,-1],
    [400,-6.41,-2.68],[433,10.82,-2.92],[490,33.26,-2.22],[540,63.26,-1.69],[591,82.53,-3.2]];
  for(const [t,x,z] of milestones){
    const {eye}=driverPose('bridge',t);
    assert.ok(Math.hypot(eye.x-x,eye.z-z)<.45,'city landmark at '+t);
  }
  const duration=rideDuration('bridge'),end=driverPose('bridge',duration);
  assert.deepEqual(driverPose('bridge',duration-2.999),end);
  assert.ok(distance(driverPose('bridge',duration-3.5).eye,end.eye)<.02);
  assert.ok(end.look.x>end.eye.x+2.3);
  const {mission,market,washington}=roadStopLines.north;
  const stops=[mission,market,washington],crossings=[];
  let previousX=-Infinity,railSamples=0;
  for(let t=305;t<=duration;t+=.1){
    const {eye,look}=driverPose('bridge',t);
    const dx=look.x-eye.x,dz=look.z-eye.z,n=Math.hypot(dx,dz);
    const x=eye.x-.0228*dz/n,z=eye.z+.0228*dx/n;
    for(const line of stops)if(previousX+.14<line&&x+.14>=line){
      assert.equal(signalAspects(t)[0],2,'nose crossed stop line on green at '+t);crossings.push(line);
    }
    previousX=x;
    if(x< -24&&x> -25){
      const rails=trackCenterlines.map(line=>trackAt(x,line).z);
      if(z>=Math.min(...rails)-.2&&z<=Math.max(...rails)+.2){
        railSamples++;
        assert.ok(Math.abs(x-ambientStreetcarCall(t).station)>2,'clear of PCC while crossing the rails');
      }
    }
    for(let i=0;i<waterfrontCarCount();i++){
      const car=waterfrontCar(t,i);
      if(!car.active)continue;
      const a=car.x-x,b=car.z-z;
      assert.ok(Math.abs((a*dx+b*dz)/n)>.30||Math.abs((a*dz-b*dx)/n)>.14,'clear of car '+i+' at '+t);
    }
  }
  assert.deepEqual(crossings,stops);
  assert.ok(railSamples>=10);
});

test('the Howard left-turning sedan stops at its staggered stripe and clears the median before through traffic returns',()=>{
  const h=howardTurnStopLine;
  const progress=(x,z)=>(x-h.x)*h.nx+(z-h.z)*h.nz;
  let previous=-Infinity,rest=0,departed=false,passed=false,merged=false;
  for(let tick=3100;tick<=3840;tick++){
    const t=tick/10,p=driverPose('bridge',t);
    const d=new T.Vector2(p.look.x-p.eye.x,p.look.z-p.eye.z).normalize();
    const x=p.eye.x-.0228*d.y,z=p.eye.z+.0228*d.x;
    const nose=progress(x+.14*d.x,z+.14*d.y);
    if(p.station===driverPose('bridge',t+.05).station){
      assert.ok(nose<-.045&&nose>-.075,'left-turn bumper stays behind its stripe');
      assert.ok(Math.abs(x-h.x)<.055,'centered on the left-turn approach at rest');
      rest++;
    }else if(rest&&!departed){
      assert.equal(signalAspects(t)[1],2);departed=true;
    }
    if(nose>=0&&previous<0){
      assert.equal(signalAspects(t)[1],2);passed=true;
    }
    if(passed&&!merged){
      assert.equal(signalAspects(t)[1],2,'cross street retains green throughout turn');
      if(x-.15>roadStopLines.south.howard)merged=true;
    }
    if(signalAspects(t)[0]===2&&passed)assert.ok(merged);
    previous=nose;
  }
  assert.ok(rest>300&&departed&&passed&&merged);
});
