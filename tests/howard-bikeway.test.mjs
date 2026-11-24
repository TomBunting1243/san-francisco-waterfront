import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {addHowardBikeway} from '../app/howard-bikeway.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {addHowardParking} from '../app/howard-parking.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';

const C=.988686,S=.150004,N=C*C+S*S;
const toWorld=(x,y)=>new THREE.Vector3(-25.894+C*(x-300)/200+S*(y-1400)/200,.08,-12.65-S*(x-300)/200+C*(y-1400)/200);
const toPlate=(x,z)=>[300+200*(C*(x+25.894)-S*(z+12.65))/N,1400+200*(S*(x+25.894)+C*(z+12.65))/N];
const root=new THREE.Group(),mark=addHowardBikeway(root),g=mark.geometry,pos=g.attributes.position;
const ground=new THREE.Group(),material=new THREE.MeshBasicMaterial();
addSurveyBlocks((g,c,x,y,z)=>{const m=new THREE.Mesh(g,material);m.position.set(x,y,z);ground.add(m);return m;});
addHowardParking(ground);ground.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(mark).expandByScalar(.025);
const pavement=ground.children.filter(m=>new THREE.Box3().setFromObject(m).intersectsBox(bounds));
const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,.10);
const tint=new THREE.Color();
function pigment(x,y){
  ray.ray.origin.copy(toWorld(x,y));const hit=ray.intersectObject(mark)[0];
  return hit?tint.fromBufferAttribute(g.attributes.color,hit.face.a).getHexString():undefined;
}

test('all three paint colors sit on exposed asphalt through each bend, edge, and driveway break',()=>{
  const p=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<g.index.count;i+=3){
    a.fromBufferAttribute(pos,g.index.getX(i));b.fromBufferAttribute(pos,g.index.getX(i+1));c.fromBufferAttribute(pos,g.index.getX(i+2));
    for(const q of [[.334,.333],[.997,.001],[.001,.997],[.001,.001],[.499,.499],[.125,.40]]){
      p.copy(a).multiplyScalar(q[0]).addScaledVector(b,q[1]).addScaledVector(c,1-q[0]-q[1]);
      ray.ray.origin.set(p.x,.08,p.z);const hit=ray.intersectObjects(pavement,false)[0];
      assert.ok(hit,'missing support at '+toPlate(p.x,p.z));
      assert.ok(Math.abs(p.y-hit.point.y-.00024)<.00002,'covered, inclined or missing asphalt '+toPlate(p.x,p.z)+' '+hit.object.name+' '+hit.point.y);
      const layer=ray.intersectObject(mark);assert.equal(layer.length,1,'overlapping front faces '+toPlate(p.x,p.z));
    }
  }
});

test('the Main mixing zone has separate white edges, open driveways and plain asphalt; the yellow pair stops before each crossing',()=>{
  for(const x of [356.5,370.8])assert.equal(pigment(x,310),'dedbd0');
  for(const y of [465,550,625,704])for(const x of [354,356,361,370])assert.equal(pigment(x,y),undefined);
  assert.equal(pigment(363,310),undefined);
  assert.equal(pigment(362,750),undefined);
  assert.equal(pigment(281,1400),undefined);
  for(const y of [1270,1400,1525,2560])for(let x=275;x<=415;x+=2)assert.equal(pigment(x,y),undefined);
  for(const [x,y] of [[315.6,750],[277.6,1680],[295.3,2050]]){
    assert.equal(pigment(x-1.35,y),'ddbd64');assert.equal(pigment(x+1.35,y),'ddbd64');assert.equal(pigment(x,y),undefined);
  }
});

test('on the Steuart block the protected lane, hatched buffer, pedestrian crossing and two yield teeth have distinct pavement underneath',()=>{
  assert.equal(pigment(400,1850),'749580');
  assert.equal(pigment(381,1820),undefined);
  assert.equal(pigment(393.5,2046),'dedbd0');
  assert.equal(pigment(397,2050),undefined);
  assert.equal(pigment(397,2115),'dedbd0');
  assert.equal(pigment(407.6,2115),'dedbd0');
  assert.equal(pigment(402,2115),'749580');
  assert.equal(pigment(412,2115),'749580');
  assert.equal(pigment(402,1720),'749580');
});

test('the static road paint joins the standard architectural material in one indexed mesh',()=>{
  const baked=bakeRigidChunk('Howard paint',[mark],material).geometry;
  assert.equal(root.children.length,1);
  assert.ok(!mark.castShadow&&mark.receiveShadow);
  assert.ok(baked.attributes.roadExposure.array.every(v=>v===1));
  assert.ok(g.index.count/3<210);
  assert.deepEqual(new Set(Array.from({length:g.attributes.color.count},(_,i)=>tint.fromBufferAttribute(g.attributes.color,i).getHexString())),new Set(['dedbd0','ddbd64','749580']));
});

test('the realigned curb joins asphalt and walk, retaining both original ramp endpoints',async()=>{
  const {curbRuns}=await import('../app/curb-survey.ts');
  const {default:original}=await import('../public/data/curb-survey.json',{with:{type:'json'}});
  const path=curbRuns.find(([id])=>id===3811435)[2];
  const old=original.lines.find(([id])=>id===3811435)[2];
  assert.deepEqual([path[0],path.at(-1)],[old[0],old.at(-1)]);
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    for(const t of [.05,.48,.94]){
      for(const [offset,expected] of [[.038,.031],[.036,.032],[-.030,.0451],[-.032,.045]]){
        const x=THREE.MathUtils.lerp(a[0]+a[2]*offset,b[0]+b[2]*offset,t);
        const z=THREE.MathUtils.lerp(a[1]+a[3]*offset,b[1]+b[3]*offset,t);
        ray.ray.origin.set(x,.08,z);const hits=ray.intersectObjects(ground.children);
        assert.ok(hits.length&&Math.abs(hits[0].point.y-expected)<.00035,'ground seam '+toPlate(x,z)+' '+offset+' '+hits[0]?.point.y);
      }
    }
  }
});

test('floating parking and the adjacent travel lane fit full production vehicle envelopes',async()=>{
  const {createStreetVehicle}=await import('../app/street-vehicles.ts');
  const vehicleHalfWidth=i=>{
    const car=createStreetVehicle(i,material);car.scale.setScalar(.25);
    return new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3()).z*100;
  };
  const parked=vehicleHalfWidth(1),travel=vehicleHalfWidth(3);
  // Source plate centres, including the westbound travel lane and parked
  // vehicles in the SF 2024 aerial. Bounds include physical mirrors.
  for(const [y,park,drive,centerline,buffer] of [[1800,359,311,283,374],[1860,358,312,289,373],[2290,354,316,295,370],[2400,354,317,295,370]]){
    assert.ok(park+parked<buffer-.85,'parking crosses buffer '+y);
    assert.ok(park-parked>drive+travel,'parked sedan overlaps through van '+y);
    assert.ok(drive-travel>centerline+2.15,'through van crosses centre marking '+y);
  }
});
