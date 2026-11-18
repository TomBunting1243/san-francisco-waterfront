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
  const batches=prefix=>group.children.filter(m=>m.name.startsWith(prefix));
  // The renderer handles sidewalk joints as a separate material, and paint is batched by station.
  assert.ok(batches('Surveyed streets and buildings').length+batches('Surveyed curb faces').length<90);
  for(const prefix of ['Promenade sidewalk slabs','Embarcadero crosswalk paint']){
    const tiles=batches(prefix);assert.ok(tiles.length>0&&tiles.length<=9,prefix);
    assert.equal(new Set(tiles.map(m=>m.name)).size,tiles.length);
  }
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

test('all crossing paint sits on the street or its gutter, including the bars cut by curb ramps',()=>{
  const {group,mesh}=geometryGroup();addSurveyBlocks(mesh);group.updateMatrixWorld(true);
  const markings=group.children.filter(m=>m.name.startsWith('Embarcadero crosswalk paint'));
  const substrates=group.children.filter(m=>!markings.includes(m));
  for(const m of substrates)m.geometry.computeBoundingBox();
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.12);
  let north=false,south=false,slopingGutter=false;
  for(const m of markings){
    const p=m.geometry.attributes.position;
    for(let i=0;i<p.count;i+=3){
      for(const w of [[1/3,1/3,1/3],[.7,.2,.1]]){
        const x=w.reduce((v,k,j)=>v+k*p.getX(i+j),0),y=w.reduce((v,k,j)=>v+k*p.getY(i+j),0),z=w.reduce((v,k,j)=>v+k*p.getZ(i+j),0);
        const near=substrates.filter(o=>{const b=o.geometry.boundingBox;return x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z;});
        ray.ray.origin.set(x,.14,z);
        const h=ray.intersectObjects(near,false)[0]?.point.y;
        assert.ok(Math.abs(y-h-.00024)<.00003,`paint loses contact at (${x}, ${z}): ${h}`);
        north||=x>22;south||=x< -46;slopingGutter||=h>.0316&&h<.032;
      }
    }
  }
  assert.ok(north&&south&&slopingGutter);
});
