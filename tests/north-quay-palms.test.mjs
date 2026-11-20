import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {waterfrontGardens} from '../app/waterfront-gardens.ts';
import {northQuayPalms} from '../app/north-quay-palms.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {pccDimensions} from '../app/pcc-layout.ts';
import {streetPose,trackAt,trackCenterlines,streetcarTrack,waterfrontRailTop} from '../app/streets.ts';

test('both surveyed Chestnut palm rows sit on median paving and clear the streetcar, contact wire and lanes',()=>{
  const gardens=waterfrontGardens([]),road=new T.Group();
  addSurveyBlocks(geo=>{const mesh=new T.Mesh(geo);road.add(mesh);return mesh;});
  const pavement=road.getObjectByName('Northern Embarcadero street and pier approaches');
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  const stems=gardens.treeAnchors.filter(a=>a.x>=81&&a.x<93.5&&trackCenterlines.some(line=>Math.abs(a.z-trackAt(a.x,line).z)<.4));
  assert.deepEqual(stems.map(a=>a.id),[132106,132087,132107,132088,132108,132089,132109,132090,132110]);
  for(const [id,x,z,height,,dbh] of northQuayPalms){
    const tree=gardens.root.getObjectByName('Surveyed tree '+id);
    const y=tree.position.y,radius=dbh*.0254*.03;
    for(let i=0;i<32;i++){
      const angle=i*Math.PI/16;
      ray.ray.origin.set(x+radius*Math.cos(angle),2,z+radius*Math.sin(angle));
      const hit=ray.intersectObject(pavement)[0];
      assert.ok(hit&&Math.abs(hit.point.y-y)<.0012,'trunk ring on paving '+id);
    }
    tree.updateMatrixWorld(true);
    assert.ok(Math.abs(new T.Box3().setFromObject(tree,true).max.y-y-height*.06)<.0001);
    const point=new T.Vector3(),lowParts=tree.children.filter(m=>!m.userData.plantCrown&&!m.geometry.userData.plantCrown);
    assert.ok(lowParts.length>0);
    for(const part of tree.children){
      assert.equal(part.userData.waterfrontPlant,'palm');
      const bounds=new T.Box3().setFromObject(part,true);
      // Only geometry below wire height can intrude on either transit envelope.
      if(bounds.min.y>waterfrontRailTop(x)+streetcarTrack.wireRise+.025)continue;
      const attr=part.geometry.getAttribute('position');
      for(let i=0;i<attr.count;i++){
        point.fromBufferAttribute(attr,i).applyMatrix4(part.matrixWorld);
        for(const path of trackCenterlines){
          const rail=trackAt(point.x,path);
          const lateral=Math.abs((point.z-rail.z)*Math.cos(rail.heading));
          assert.ok(lateral>pccDimensions.width/2+.018,'PCC sweep/wire '+id);
        }
        for(const direction of [-1,1]){
          const lane=streetPose(point.x,direction);
          assert.ok(Math.abs((point.z-lane.z)*Math.cos(lane.heading))>.16,'vehicle lane '+id);
        }
      }
    }
  }
});
