import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import data from '../public/data/survey-blocks.json' with {type:'json'};
import {addSurveyBlocks,addSurveyFront,surveyedHeight,outsideSurveyRoads} from '../app/survey-blocks.ts';

function geometryGroup(){
  const group=new THREE.Group();
  return {group,mesh(geo){
    const part=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true}));
    group.add(part);
    return part;
  }};
}
const plate=(px,py)=>[-83+px*.04,-37+py*.04];
function hit(group,x,z){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,12,z),new THREE.Vector3(0,-1,0));
  return ray.intersectObjects(group.children)[0];
}
test('rendered Brannan carriageway meets its sidewalks and stops at the buildings',()=>{
  const {group,mesh}=geometryGroup();
  addSurveyBlocks(mesh);
  group.updateMatrixWorld();
  for(const [pixel,y] of [
    [[96,147],.031],[[95,131],.045],[[95,161],.045],
    [[349,289],.022],[[356,369],.027],[[450,548],.013],
  ]){
    const face=hit(group,...plate(...pixel));
    assert.ok(face,pixel.join(','));
    assert.ok(Math.abs(face.point.y-y)<.0001,pixel.join(','));
  }
  assert.equal(hit(group,...plate(174,265)),undefined);
  assert.ok(group.children.length<90);
  for(const road of outsideSurveyRoads)for(let i=1;i<road.p.length;i++){
    const [x,z]=road.p[i].map((v,j)=>(v+road.p[i-1][j])/2);
    assert.ok(x<=-111.999||x>=34.999||z<=-61.999||z>=5.999);
  }
});

test('the courtyard wings have a raised open parapet and physically recessed glazing',()=>{
  const {group,mesh}=geometryGroup();
  assert.equal(addSurveyFront(mesh,37058255,.72),true);
  assert.equal(addSurveyFront(mesh,0,.72),false);
  const geometry=group.children[0].geometry;
  const [a,b]=data.fronts['37058255'].plan[0];
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  const ray=new THREE.Raycaster();
  const position=(along,height,inside)=>new THREE.Vector3(
    a[0]+(dx*along-dz*inside)/len,height,a[1]+(dz*along+dx*inside)/len);
  for(const [dist,height] of [[.021,.772],[.074,.72]]){
    const pos=position(len*.5,3,dist);
    assert.ok(Math.abs(hit(group,pos.x,pos.z).point.y-height)<.001);
  }
  const bay=len/Math.max(1,Math.round(len/.31));
  ray.set(position(bay/2,.104,-.09),new THREE.Vector3(-dz/len,0,dx/len));
  const pane=ray.intersectObjects(group.children)[0];
  assert.ok(Math.abs(pane.distance-.122)<.001);
  assert.ok(geometry.index.count>400);
  assert.ok(Object.keys(data.fronts).length>=12);
  assert.ok(data.buildings.length>=170);
  assert.equal(surveyedHeight(32947380),3.551);
});
