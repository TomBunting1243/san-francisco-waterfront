import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ferryCycle,ferryPose} from '../app/motion.ts';
import {vessels,berthThresholds,ferryClockAt} from '../app/ferry-service.ts';
import {createServiceFerry,updatePyxisBoardingDoor} from '../app/service-ferries.ts';
import {createBoardingBrows,buildFerryTerminal} from '../app/ferry-terminal.ts';
import {waterSurface} from '../app/water-surface.ts';
import {sfMap} from '../app/sf-map.ts';
const V=THREE.Vector3,mat=new THREE.MeshStandardMaterial();
const put=(g,c,x,y,z,root)=>{const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);root.add(m);return m;};
const clock={weekend:false,minutes:435};
test('operator-specific vessel proportions, numbered berths and working gangways meet both ramp and ship',()=>{
  const terminal=buildFerryTerminal(put,new THREE.Group()),brows=createBoardingBrows(vessels.length);
  terminal.updateMatrixWorld(true);
  for(const [i,v] of vessels.entries()){
    const mesh=createServiceFerry(put,i),p=ferryPose(29-v.offset,i,clock);
    assert.equal(p.brow,1);assert.equal(p.phase,'alongside');assert.equal(p.wake,0);
    assert.equal(p.berth,['E1','E2','G1','F2','F1','C','B','B'][i]);
    const size=new THREE.Box3().setFromObject(mesh,true).getSize(new V());
    assert.ok(Math.abs(size.x-v.length*.06)<.003&&Math.abs(size.z-v.beam*.06)<.003);
    if(v.family!=='dorado'){
      for(const side of [-1,1])for(const fraction of [.911,.935,.956]){
        const eye=new V(v.door+.0021,v.sill+.004,side*fraction*v.beam*.03);
        const hits=new THREE.Raycaster(eye,new V(0,-1,0),0,.006).intersectObject(mesh,true);
        const colors=hits.map(h=>new THREE.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a).getHexString());
        assert.deepEqual(colors,['b9baaa'],v.name+' has one flush landing plate');
      }
    }
    mesh.position.set(p.x,p.y,p.z);mesh.rotation.y=p.heading;mesh.updateMatrixWorld(true);
    const side=Math.sign(p.x-p.stopX),ledge=p.x-side*(p.hullHalfBeam-.0065);
    const down=(x,z,o,y=1.5)=>new THREE.Raycaster(new V(x,y,z),new V(0,-1,0)).intersectObject(o,true)[0]?.point.y;
    assert.ok(Math.abs(down(ledge,p.stopZ,mesh,p.y+v.sill+.014)-(p.y+v.sill))<.003,v.name+' sill');
    brows.update(i,p);
    const m=new THREE.Matrix4();brows.mesh.getMatrixAt(i,m);
    const box=new THREE.Box3().setFromBufferAttribute(brows.mesh.geometry.attributes.position).applyMatrix4(m);
    const gap=p.x-side*(p.hullHalfBeam-.006);
    assert.ok(box.min.x<gap&&box.max.x>gap,v.name+' brow intersects hull ledge');
    const shore=p.gate==='C'?.084+.0495:waterSurface.level+v.sill;
    assert.ok(Math.abs(down(p.stopX+(p.gate==='C'?.026:.009)*side,p.stopZ,terminal)-shore)<.005,v.name+' shore threshold');
  }
});
test('the page snapshots the Pacific service day across UTC midnight and summer time',()=>{
  assert.deepEqual(ferryClockAt(new Date('2026-11-22T05:20:00Z')),{date:'2026-11-21',weekend:true,minutes:1280});
  assert.deepEqual(ferryClockAt(new Date('2026-07-21T06:20:00Z')),{date:'2026-07-20',weekend:false,minutes:1400});
  assert.deepEqual(ferryClockAt(new Date('2026-11-16T08:00:00Z')),{date:'2026-11-16',weekend:false,minutes:0});
});
test('operator patterns include the 11:20 weekday Richmond exception, weekend quay and weekday-only services',()=>{
  const dock=(i,w,minutes)=>ferryPose(28-vessels[i].offset,i,{weekend:w,minutes});
  assert.equal(dock(1,false,680).berth,'F2');assert.equal(dock(1,false,681).berth,'E2');
  assert.equal(dock(1,true,435).berth,'F2');
  for(const i of [3,4])assert.equal(dock(i,true,435).phase,'off service');
  const first=ferryPose(0,0);
  assert.equal(first.phase,'arriving');assert.ok(first.z-berthThresholds.E1[1]>3&&first.z-berthThresholds.E1[1]<6);
  assert.ok(ferryPose(2,0).z<first.z);
});
test('round trips actually reach separate East Bay, North Bay and island destinations, with continuous local motion',()=>{
  const remote=new Map();
  for(let i=0;i<vessels.length;i++){
    for(let visit=0;visit<3;visit++){
      let prev;const cycle=i===7?ferryCycle/2:ferryCycle;
      for(let t=0;t<=cycle;t+=.25){
        const p=ferryPose(t-vessels[i].offset+visit*cycle,i,clock);
        if(prev){
          const d=Math.hypot(p.x-prev.x,p.z-prev.z),range=Math.hypot(p.x,p.z);
          assert.ok(d<.78+range*.012,`${vessels[i].name} jumped ${d} at ${t}`);
          if(range<60)assert.ok(Math.abs(Math.atan2(Math.sin(p.heading-prev.heading),Math.cos(p.heading-prev.heading)))<.45);
        }
        if(p.phase==='remote layover')remote.set(p.route,[p.x,p.z]);
        if(p.phase!=='alongside')assert.equal(p.brow,0);
        prev=p;
      }
    }
  }
  assert.equal(remote.size,11);
  assert.ok(remote.get('Vallejo')[0]>1100&&remote.get('Vallejo')[1]>1600);
  assert.ok(remote.get('Harbor Bay')[0]<-700&&remote.get('Oakland')[1]>470);
  assert.ok(remote.get('Sausalito')[1]<-100&&remote.get('Tiburon')[0]>600);
  assert.ok(remote.get('Treasure Island')[1]>170&&remote.get('Treasure Island')[1]<180);
});
function overlap(a,b){
  return [a,b].every(poly=>poly.every((p,i)=>{
    const q=poly[(i+1)%poly.length],dx=p[1]-q[1],dz=q[0]-p[0];
    const A=a.map(([x,z])=>x*dx+z*dz),B=b.map(([x,z])=>x*dx+z*dz);
    return Math.max(...A)>Math.min(...B)&&Math.max(...B)>Math.min(...A);
  }));
}
test('eight vessels clear terminal structures, guide piles and one another across multiple rotations',()=>{
  const piles=[];
  for(const gate of Object.keys(berthThresholds)){
    if(gate==='C'||gate.endsWith('2'))continue;
    const plate=sfMap.piers.find(p=>p.name==='Ferry Building Gate '+gate[0]).p.slice(0,-1);
    const cx=plate.reduce((s,p)=>s+p[0],0)/plate.length,z=plate.map(p=>p[1]);
    for(const side of [-1,1])for(const end of [Math.min(...z)+.08,Math.max(...z)-.067])piles.push([cx+side*.454,end]);
  }
  const piers=sfMap.piers.filter(p=>p.closed).flatMap(p=>{
    const ring=p.p.map(([x,z])=>new THREE.Vector2(x,z));
    return THREE.ShapeUtils.triangulateShape(ring,[]).map(f=>{
      const tri=f.map(i=>[ring[i].x,ring[i].y]);
      return {tri,minX:Math.min(...tri.map(p=>p[0])),maxX:Math.max(...tri.map(p=>p[0])),minZ:Math.min(...tri.map(p=>p[1])),maxZ:Math.max(...tri.map(p=>p[1]))};
    });
  });
  for(const conditions of [clock,{weekend:true,minutes:680},{weekend:false,minutes:680}]){
    for(let t=0;t<3*ferryCycle;t+=.33){
      const seen=[];
      for(const [i,v] of vessels.entries()){
        const p=ferryPose(t,i,conditions),c=Math.cos(p.heading),s=Math.sin(p.heading),l=v.length*.03,w=v.beam*.03;
        const hull=[[-l,-w],[-l,w],[l,w],[l,-w]].map(([x,z])=>[p.x+c*x+s*z,p.z-s*x+c*z]);
        for(const other of seen)if(Math.hypot(other.x-p.x,other.z-p.z)<3.3)assert.ok(!overlap(hull,other.hull),`collision at ${t} with ${other.name} / ${v.name}`);
        seen.push({...p,hull,name:v.name});
        if(p.z<16&&Math.abs(p.x)<45){
          for(const [x,z] of piles){
            const X=Math.abs(c*(x-p.x)-s*(z-p.z)),Z=Math.abs(s*(x-p.x)+c*(z-p.z));
            assert.ok(Math.hypot(Math.max(0,X-l),Math.max(0,Z-w))>.055,v.name+' pile');
          }
          for(const q of piers)if(p.x+2>q.minX&&p.x-2<q.maxX&&p.z+2>q.minZ&&p.z-2<q.maxZ)
            assert.ok(!overlap(hull,q.tri),v.name+' pier at '+t);
        }
      }
    }
  }
});

test('Pyxis E1 boarding path has a working port door, solid sill and clear recessed vestibule',()=>{
  const group=createServiceFerry(put,0),p=ferryPose(23,0,clock),floor=p.y+vessels[0].sill;
  group.position.set(p.x,p.y,p.z);group.rotation.y=p.heading;group.updateMatrixWorld(true);
  const body=group.children[0],positions=body.geometry.getAttribute('position');
  assert.ok(body.userData.pyxisBoardingBody);assert.equal(group.children.length,1);
  const cast=(x,y,z,dir)=>new THREE.Raycaster(new V(x,y,z),dir).intersectObject(body)[0]?.point;
  const inward=(dz,h)=>cast(p.stopX,floor+h,p.stopZ+dz,new V(1,0,0));
  const shut=inward(0,.080).x;
  updatePyxisBoardingDoor(group,.99);assert.equal(inward(0,.080).x,shut);
  const version=positions.version;
  updatePyxisBoardingDoor(group,1);
  for(const dz of [-.052,0,.052]){
    for(const h of [.008,.068,.125]){
      const hit=inward(dz,h);
      assert.ok(hit.x>p.x-.3312+.145&&hit.x<p.x-.3312+.155,'body envelope fits through to the rear wall');
    }
    for(const depth of [-.018,.012,.060,.11]){
      const hit=cast(p.x-.3312+depth,floor+.008,p.stopZ+dz,new V(0,-1,0));
      assert.ok(Math.abs(hit.y-floor)<.00001);
    }
  }
  for(const dz of [-.06,.06])assert.ok(inward(dz,.075).x<p.x-.3312+.001);
  assert.ok(inward(0,.137).x<p.x-.3312+.001);
  updatePyxisBoardingDoor(group,1);assert.equal(positions.version,version+1);
  updatePyxisBoardingDoor(group,0);assert.equal(inward(0,.080).x,shut);
  assert.equal(positions.version,version+2);
});

test('Pyxis has two fine stems, a raked forehouse and a single painted skin around the wraparound wheelhouse',()=>{
  const group=createServiceFerry(put,0),body=group.children[0],g=body.geometry,v=vessels[0];
  group.updateMatrixWorld(true);
  assert.equal(group.children.length,1);assert.ok(g.index.count/3<1600);
  const cast=(x,y,z,dx,dy,dz)=>new THREE.Raycaster(new V(x,y,z),new V(dx,dy,dz)).intersectObject(body);
  const color=hit=>new THREE.Color().fromBufferAttribute(g.attributes.color,hit.face.a).getHexString();
  const atBow=(metres,z=.012)=>cast(2,v.sill+.06*metres,z,-1,0,0)[0];
  assert.ok(atBow(2.85).point.x-atBow(4.71).point.x>.26,'sloping upper forehouse');
  assert.ok(atBow(6.05).point.x>atBow(5.25).point.x+.014,'forward-raked wheelhouse glass');
  for(const z of [-.124,.012,.124])assert.equal(color(atBow(5.62,z)),'243941');
  for(const z of [-.2268,.2268])assert.ok(cast(1.19,.42,z,0,-1,0)[0]);
  assert.equal(cast(1.19,.42,0,0,-1,0).length,0,'open tunnel between twin stems');
  for(const [x,h,tint] of [[-.45,1.44,'364e55'],[.37,.55,'6f9d46'],[.48,.37,'233860']]){
    const hits=cast(x*1.23,v.sill+h*.06,-.8,0,0,1);
    assert.equal(color(hits[0]),tint);
    assert.equal(hits.filter(hit=>Math.abs(hit.point.z+.3312)<.003).length,1,
      'pigment and nearest hull triangle share one geometric surface');
  }
});
