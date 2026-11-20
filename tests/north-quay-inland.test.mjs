import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import reliefData from '../public/data/bay-relief.json' with {type:'json'};
import {createBayRelief,bayReliefPosition,bayReliefGround} from '../app/bay-relief.ts';
import {isWaterfrontPlazaFootprint} from '../app/north-quay-inland.ts';

test('the Chestnut passenger faces four floors of set-back glass behind the brick grid at 1700 Montgomery',()=>{
  const entries=reliefData.buildings.filter(([,p])=>isWaterfrontPlazaFootprint(...p[0]));
  assert.equal(entries.length,1);
  const [[height,source]]=entries;
  const pts=source.slice(0,-1).map(p=>new T.Vector2(...bayReliefPosition(...p))).reverse();
  const center=pts.reduce((a,b)=>a.add(b),new T.Vector2()).multiplyScalar(1/pts.length);
  const floor=bayReliefGround(center.x,center.y),storey=height*.06/4;
  const {root}=createBayRelief();root.updateMatrixWorld(true);
  const building=root.getObjectByName('North Beach, Bernal Heights and island buildings');
  const ray=new T.Raycaster();ray.far=.2;
  // Both ends and the recessed lawn-facing walls are hit from their exterior.
  for(const edge of [1,2,3,4]){
    const a=pts[edge],b=pts[(edge+1)%pts.length],len=a.distanceTo(b);
    const direction=b.clone().sub(a).divideScalar(len),inward=new T.Vector3(direction.y,0,-direction.x);
    const bay=len/Math.round(len/.46);
    const at=(u,y)=>{
      const pos=new T.Vector3(a.x+direction.x*u,y,a.y+direction.y*u).addScaledVector(inward,-.1);
      ray.set(pos,inward);
      const hit=ray.intersectObject(building,true)[0];
      assert.ok(hit,'missing facade '+edge);
      return hit.distance;
    };
    for(let level=0;level<4;level++){
      const y=floor+storey*(level+.45);
      assert.ok(Math.abs(at(.008,y)-.1)<.0001,'full-height brick pier');
      assert.ok(Math.abs(at(bay*.43,y)-(.1+(level===0?.055:.028)))<.0001,'unobstructed inset glazing');
      assert.ok(Math.abs(at(bay*.43,floor+storey*(level+.91))-.1)<.0001,'brick spandrel');
    }
  }
  // The curved path is a strip cut through the turf and follows local grade.
  const down=new T.Vector3(0,-1,0);
  for(const [x,z,tone] of [[88.03,-8.465,'c4bcaa'],[88.03,-7.72,'8b9d65'],[87.51,-8.345,'c4bcaa']]){
    ray.set(new T.Vector3(x,1,z),down);ray.far=2;
    const [hit]=ray.intersectObject(building,true);
    const color=new T.Color().fromBufferAttribute(hit.object.geometry.attributes.color,hit.face.a);
    assert.equal(color.getHexString(),tone);assert.ok(Math.abs(hit.point.y-bayReliefGround(x,z)-.017)<.006);
  }
});

test('fifteen London planes and the lawn specimen retain their measured size and stay clear of traffic',async()=>{
  const {waterfrontPlazaTrees}=await import('../app/north-quay-inland.ts');
  const {waterfrontGardens}=await import('../app/waterfront-gardens.ts');
  const {addSurveyBlocks}=await import('../app/survey-blocks.ts');
  const {streetPose,trackAt,trackCenterlines,northWaterfrontGrade}=await import('../app/streets.ts');
  const {root}=waterfrontGardens([]),paved=new T.Group();
  addSurveyBlocks(geo=>{const mesh=new T.Mesh(geo);paved.add(mesh);return mesh;});
  const street=paved.getObjectByName('Northern Embarcadero street and pier approaches');
  const garden=createBayRelief().root.getObjectByName('North Beach, Bernal Heights and island buildings');
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  assert.deepEqual(waterfrontPlazaTrees.map(row=>row[0]),[...Array.from({length:15},(_,i)=>135213-i),-170001]);
  for(const [id,x,z,height,width] of waterfrontPlazaTrees){
    const tree=root.getObjectByName('Surveyed tree '+id),y=tree.position.y;
    const bounds=new T.Box3().setFromObject(tree,true),span=bounds.getSize(new T.Vector3());
    assert.ok(Math.abs(span.y-height*.06)<.003);
    assert.ok(Math.abs(Math.sqrt(span.x*span.z)-width*.06)<.0001);
    for(let i=0;i<8;i++){
      const theta=i*Math.PI/4;ray.ray.origin.set(x+.013*Math.cos(theta),2,z+.013*Math.sin(theta));
      const support=ray.intersectObject(id<0?garden:street,true)[0];
      assert.ok(support&&Math.abs(support.point.y-y)<.002,'supported trunk '+id);
    }
    tree.updateMatrixWorld(true);
    const point=new T.Vector3();
    for(const mesh of tree.children){
      assert.ok(mesh.userData.plantAnchor,'tree belongs to the existing LOD batches');
      const p=mesh.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
        if(point.y>northWaterfrontGrade(point.x)+4.2*.06)continue;
        for(const dir of [-1,1]){
          const lane=streetPose(point.x,dir);
          assert.ok(Math.abs((point.z-lane.z)*Math.cos(lane.heading))>.17,'lane clearance '+id);
        }
        for(const path of trackCenterlines)assert.ok(Math.abs(point.z-trackAt(point.x,path).z)>.13,'rail clearance '+id);
      }
    }
  }
});
