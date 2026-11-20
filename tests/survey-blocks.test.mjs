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

test('daylight rays see both continental crossings, upstream stop lines and their worn gaps beside Harry Bridges Plaza',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const scene=createLandscape();scene.root.updateMatrixWorld(true);
  const paint=scene.root.getObjectByName('Waterfront crossings paint'),surfaces=[];
  const box=new THREE.Box3(),target=new THREE.Box3(new THREE.Vector3(-1.6,-.08,-6.26),new THREE.Vector3(.65,.14,-2.22));
  scene.root.traverseVisible(o=>{
    if(!o.isMesh||o.isInstancedMesh||o.isBatchedMesh||o.material.transparent)return;
    if(box.setFromObject(o).intersectsBox(target))surfaces.push(o);
  });
  assert.ok(surfaces.includes(paint));
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,.14);
  function hits(u,v){
    ray.ray.origin.set(-3+u/132,.14,2-(420+v)/132);
    return ray.intersectObjects(surfaces,false).filter(h=>h.face?.normal.y>.7);
  }
  const colors=new Set();
  function light(u,v){
    const h=hits(u,v),road=h.find(q=>q.object!==paint);
    assert.equal(h[0]?.object.name,paint.name,'aerial paint '+[u,v]);
    assert.ok(road&&Math.abs(h[0].point.y-road.point.y-.00024)<.00003);
    const color=(hit)=>hit.object.geometry.getAttribute('color').getY(hit.face.a);
    assert.ok(color(h[0])>1.8*color(road),'day pigment contrast '+[u,v]);
    colors.add(color(h[0]));
  }
  for(const u of [271,377,453]){
    for(const [left,right] of [[176.4,174.9],[189.4,187.9],[201.9,200.1],[214.7,212.2],[227.1,225.4],[240.2,238.3]]){
      light(u,left+(right-left)*(u-264.2)/201.2);
    }
  }
  for(const u of [223,249,305]){
    for(const [left,right] of [[578.1,583.1],[591.7,596.5],[605.6,610.5],[619.1,624],[631,635.4],[644,648.2]]){
      light(u,left+(right-left)*(u-217)/97.3);
    }
  }
  for(const [u,v] of [[237.5,218],[238,239],[332,582],[331,637]])light(u,v);
  assert.ok(colors.size>3,'slightly varied paint retained through city batching');
  for(const [u,v] of [[340,226.6],[286.5,634.1],[400,220],[248,585],[358,261],[365,325]]){
    assert.notEqual(hits(u,v)[0]?.object,paint,'worn gap, asphalt, or pedestrian paving '+[u,v]);
  }
  assert.equal(paint.castShadow,false);assert.ok(paint.material.polygonOffsetUnits<0);
});

test('the two distal streets retain surveyed walks, trees, tracks and continuous passenger-lane asphalt',async()=>{
  const {group,mesh}=geometryGroup();addSurveyBlocks(mesh);group.updateMatrixWorld(true);
  const {northWaterfrontGrade,streetPose,trackAt,trackCenterlines,waterfrontRailTop}=await import('../app/streets.ts');
  const market=group.getObjectByName('Market Street beyond Montgomery');
  const quay=group.getObjectByName('Northern Embarcadero street and pier approaches');
  assert.ok(market&&quay&&(market.geometry.index.count+quay.geometry.index.count)/3<6000);
  const down=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  const surfaces=(m,x,z)=>{
    down.ray.origin.set(x,8,z);
    return down.intersectObject(m).map(face=>face.point.y);
  };
  for(const [x,y] of [[-13.2,.045],[-12.4,.031]]){
    assert.ok(Math.abs(surfaces(market,x,-80)[0]-y)<.0001);
  }
  assert.ok(surfaces(market,-11.6,-80)[0]>.4);
  assert.deepEqual(surfaces(market,-13.6,-80),[]);
  assert.ok(Math.abs(surfaces(quay,50,-3)[0]-.068)<.0001);
  const {default:data}=await import('../public/data/sightline-streets.json',{with:{type:'json'}});
  for(const [,line] of data.rails){
    const [[ax,az],[bx,bz]]=line,len=Math.hypot(bx-ax,bz-az);
    const x=(ax+bx)/2,z=(az+bz)/2;
    for(const sign of [-1,1]){
      const d=sign*.06*1.435/2;
      assert.ok(Math.abs(surfaces(market,x+d*(bz-az)/len,z+d*(ax-bx)/len)[0]-.062)<.0001);
    }
  }
  for(let x=35.13;x<95.5;x+=.47){
    const lane=streetPose(x,1),px=x+.185*Math.sin(lane.heading),z=lane.z+.185*Math.cos(lane.heading);
    const ys=surfaces(quay,px,z),grade=northWaterfrontGrade(px);
    assert.ok(ys.some(y=>Math.abs(y-grade)<.0001),'missing asphalt at '+px);
    assert.ok(ys[0]-grade<.0031,'raised obstruction at '+px);
    for(const road of outsideSurveyRoads.filter(r=>r.name==='The Embarcadero')){
      assert.ok(!road.p.slice(1).some(([x2],i)=>px>Math.min(x2,road.p[i][0])&&px<Math.max(x2,road.p[i][0])),'duplicate fallback road at '+px);
    }
  }
  for(const line of trackCenterlines){
    assert.equal(line.at(-1)[0],96);
    assert.ok(line.every(([x],i)=>i===0||x>line[i-1][0]));
    assert.ok(Math.abs(trackAt(87,line).z-streetPose(87,1).z)<1.2);
  }
  assert.ok(Math.abs(waterfrontRailTop(85)-northWaterfrontGrade(85)-.003)<.0001);
});
