import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import survey from '../public/data/fremont-approach-curbs.json' with {type:'json'};
import {driverPose} from '../app/driver-rides.ts';

const meshes=[];
addSurveyBlocks(g=>{
  g.computeBoundingBox();const m=new T.Mesh(g);meshes.push(m);return m;
});
function point(u,v,y){
  return new T.Vector3(-27.00800104+.0012973094*u-.0084729829*v,y,-33.37263659+.0084728164*u+.0012965840*v);
}
const down=new T.Vector3(0,-1,0);
function sample(u,v){
  const p=point(u,v,.10),r=new T.Raycaster(p,down,0,.08);
  const hits=r.intersectObjects(meshes.filter(({geometry:{boundingBox:b}})=>b.min.x<=p.x&&b.max.x>=p.x&&b.min.z<=p.z&&b.max.z>=p.z));
  return hits;
}
const tone=h=>new T.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a).getHexString();

test('Fremont has inward-visible stone faces between the asphalt and two continuous, light-receiving sidewalks',()=>{
  for(const v of [359.3,400.7,448.1,512.5,598.8]){
    for(const [road,side] of [[90,51],[161,198]]){
      const asphalt=sample(road,v)[0],walk=sample(side,v)[0];
      assert.ok(Math.abs(asphalt.point.y-.031)<.00001);
      assert.ok(Math.abs(walk.point.y-.045)<.00001);
      assert.equal(walk.object.geometry.attributes.roadExposure.getX(walk.face.a),1);
      const origin=point(road,v,.036),to=point(side,v,.036),d=to.clone().sub(origin);
      const probe=new T.Raycaster(origin,d.clone().normalize(),0,d.length()),face=probe.intersectObjects(meshes)[0];
      assert.ok(face&&tone(face)==='aeaa9f'&&face.face.normal.dot(d.normalize())<-.94,'roadward visible curb face');
      const eye=driverPose('bridge',251).eye;
      const target=face.point.clone(),from=new T.Vector3(eye.x,eye.y,eye.z);
      if(v<430)assert.ok(target.clone().sub(from).dot(face.face.normal)<0);
    }
    // The street-facing arcade begins at surveyed u=206. Its sill meets the
    // deck, which owns the preceding municipal sidewalk.
    const westWall=30-3*(v-311)/(893-311);
    for(const u of [westWall+.10,205.85])assert.ok(Math.abs(sample(u,v)[0].point.y-.045)<.00001);
    assert.ok(Math.abs(sample(32.15,44.75)[0].point.y-.045)<.00001);
  }
});

test('each southern crossing entrance has a sloped warning strip with one operative upper surface',()=>{
  const groups=new Set();
  for(let i=0;i<survey.faces.warning.length;i+=3){
    const pts=survey.faces.warning.slice(i,i+3).map(j=>survey.vertices[j]);
    const sum=pts.reduce((s,p)=>s.map((n,i)=>n+p[i]),[0,0,0]).map(n=>n/3);
    const [u,v,y]=sum,at=sample(u,v);
    if(!at.length||Math.abs(at[0].point.y-y)>.00003)continue;
    assert.equal(tone(at[0]),'c0a16b');
    assert.ok(y>.031&&y<.045&&at[0].face.normal.y>.9&&at[0].face.normal.y<.9999);
    assert.equal(at.filter(h=>Math.abs(h.point.y-y)<.00003).length,1);
    groups.add((u<100?'west':'east')+(v<303?'Howard':'Fremont'));
  }
  assert.deepEqual([...groups].sort(),['eastFremont','eastHoward','westFremont','westHoward']);
});
