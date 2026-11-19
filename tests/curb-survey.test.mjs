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
test('granite covers each surveyed island facet once and turns through the Ferry refuge',()=>{
  const paving=createMarketPaving(),downward=new THREE.Vector3(0,-1,0);
  const hitAt=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,.16,z),downward).intersectObject(paving)[0];
  for(const tri of curb.medianSlab){
    const x=tri.reduce((sum,v)=>sum+v[0]/3,0),z=tri.reduce((sum,v)=>sum+v[1]/3,0);
    const hit=hitAt(x,z);
    assert.ok(hit,'missing island facet at '+[x,z]);
    assert.ok(Math.abs(hit.uv.x-x)<.00001&&Math.abs(hit.uv.y-z)<.00001);
    if(down(edges.children,x,z)!==undefined){
      const nearest=Math.min(...[curb.median,curb.plantingIsland].flatMap(ring=>ring.map(([ax,az],i)=>{
        const [bx,bz]=ring[(i+1)%ring.length],dx=bx-ax,dz=bz-az;
        const t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);
        return Math.hypot(x-ax-t*dx,z-az-t*dz);
      })));
      assert.ok(nearest<.0311,'second curb fill beyond the physical cap at '+[x,z]);
    }
  }
  const refuge=hitAt(-.2013,-3.245);
  assert.ok(Math.abs(refuge.uv.x+.2013)<.00001&&Math.abs(refuge.uv.y+11.245)<.00001);
  const west=hitAt(marketAxis(-7),-7);
  assert.ok(Math.abs(west.uv.x)<.00001&&Math.abs(west.uv.y-7)<.00001);
});

test('production paving descends to the actual roadway at each end, without a concealed raised slab',()=>{
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const pavement=world.root.getObjectByName('Market granite and herringbone promenade');
  const all=[...world.architectureChunks,pavement,world.root.getObjectByName('Halprin brick court')];
  for(let z=-9.04;z<-6.27;z+=.06){
    const x=marketAxis(z),height=down(all,x,z);
    assert.ok(Math.abs(height-westMarketGround(x,z))<.0025,`grade at ${z} = ${height}`);
  }
  for(const [x,z] of curb.medianGates){
    const height=down(all,x,z);
    assert.ok(Math.abs(height-gutterTop)<.005,`raised obstacle at ${x},${z}: ${height}`);
  }
  assert.ok(Math.abs(down(all,marketAxis(-5.75),-5.75)-.031)<.001);
  for(const [x,z,ground] of [[-5.35,-1.84,.031],[-4.48,3.96,.096],[.33,-9.52,.116],[2.22,-8.74,.12614]]){
    assert.ok(Math.abs(down(all,x,z)-ground)<.001,`surface at (${x}, ${z})`);
  }
});

test('Howard and Beale meets the actual painted landing, then widens past six planted beds to the driveway',async()=>{
  const {addSurveyBlocks}=await import('../app/survey-blocks.ts');
  const surface=new THREE.Group();
  addSurveyBlocks(g=>{const mesh=new THREE.Mesh(g,material);surface.add(mesh);return mesh;});
  function at(px,py){
    const x=(px-300)/200,z=(py-300)/200;
    const ray=new THREE.Raycaster(new THREE.Vector3(-27.825250+.988686*x+.150004*z,.16,-25.574915-.150004*x+.988686*z),new THREE.Vector3(0,-1,0));
    return ray.intersectObjects(surface.children);
  }
  assert.equal(curb.bealeBeds.length,6);
  for(const [x,z] of [[446,353],[414,415]]){
    const [pad,next]=at(x,z);
    assert.equal(new THREE.Color().fromBufferAttribute(pad.object.geometry.attributes.color,pad.face.a).getHexString(),'bd9c55');
    assert.ok(pad.point.y>.0315&&pad.point.y<.045&&pad.point.y-next.point.y>.004);
  }
  assert.ok(Math.abs(at(446,335)[0].point.y-gutterTop)<.001);
  assert.ok(Math.abs(at(690,419)[0].point.y-.045)<.0001,'no old curb running through the widened footway');
  assert.ok(Math.abs(at(990,400)[0].point.y-.061)<.0001,'low planting occupies the widening');
});

test('Harry Bridges northbound refuge has one finished surface through both sloped approaches and the waiting area',()=>{
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const paving=world.root.getObjectByName('Market granite and herringbone promenade');
  const limits=new THREE.Box3(new THREE.Vector3(-.361,.028,-3.46),new THREE.Vector3(-.062,.046,-3.025));
  const floor=new THREE.Group(),box=new THREE.Box3();
  for(const mesh of [...world.architectureChunks,paving]){
    if(!box.setFromObject(mesh).intersectsBox(limits))continue;
    const geo=mesh.geometry,pos=geo.attributes.position,tri=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],points=[];
    for(let i=0;i<geo.index.count;i+=3){
      for(let n=0;n<3;n++)tri[n].fromBufferAttribute(pos,geo.index.getX(i+n)).applyMatrix4(mesh.matrixWorld);
      if(!box.setFromPoints(tri).intersectsBox(limits))continue;
      for(const p of tri)points.push(p.x,p.y,p.z);
    }
    if(points.length){
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
      const part=new THREE.Mesh(g,material);part.name=mesh.name;floor.add(part);
    }
  }
  floor.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.019);
  for(const x of [-.3505,-.3107,-.2653,-.2013,-.1357,-.0973,-.0691]){
    for(let i=0;i<155;i++){
      const z=-3.4193+i*.00230;ray.ray.origin.set(x,.047,z);
      const hits=ray.intersectObjects(floor.children).filter(h=>h.face.normal.y>.8);
      assert.ok(hits.length,'no hole at '+[x,z]);
      assert.ok(hits.length===1||hits[0].distance+.003<hits[1].distance,'competing surface at '+[x,z]);
      if(z> -3.260&&z< -3.226){
        assert.equal(hits[0].object.name,paving.name);
        assert.ok(Math.abs(hits[0].point.y-medianTop)<.00001,'level central landing');
      }
    }
  }
  for(const [z,y] of [[-3.412,.03150],[-3.339,.03607],[-3.266,.040644],[-3.245,.040644],[-3.215,.040644],[-3.142,.03607],[-3.069,.03150]]){
    assert.ok(Math.abs(down(floor.children,-.2001,z,.047)-y)<.00011,'physical curb profile at '+z);
  }
  for(const part of floor.children)part.geometry.dispose();
});
