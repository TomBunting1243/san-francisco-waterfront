import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {ferryPublicRealm} from '../app/ferry-architecture.ts';
import {driverPose,museumLegDuration} from '../app/driver-rides.ts';
import {createRideInteriors,placePassenger} from '../app/ride-interior.ts';
import {createLandscape} from '../app/landscape.ts';
import {plazaBenches,plazaTreeRecords,southPlazaTop} from '../app/plaza-survey.ts';
import {waterfrontGardens} from '../app/waterfront-gardens.ts';
import {sfMap} from '../app/sf-map.ts';
import survey from '../public/data/plaza-survey.json' with {type:'json'};

let sharedLandscape;
const landscape=()=>sharedLandscape??=createLandscape();

test('all observed crowns are rendered on mapped stems at lidar height and spread; aerial-only estimates stay distinct',()=>{
  const measured=survey.trees.filter(row=>row.heightM);
  const median=survey.trees.filter(row=>row.supplemental);
  assert.equal(measured.length,196);
  assert.equal(median.length,26);
  assert.equal(median.filter(t=>t.estimatedHeightM&&!t.heightM).length,2);
  const gardens=waterfrontGardens(sfMap.buildings);
  for(const row of [...measured,...median.filter(t=>!t.heightM)]){
    if(row.heightM)assert.ok(row.canopyReturns>=36&&row.groundReturns>=8&&Number.isFinite(row.groundM));
    const tree=gardens.root.getObjectByName('Surveyed tree '+row.id);
    assert.ok(tree,'Missing '+row.id);
    const {x,y,z}=tree.position;
    if(tree.userData.stationClearance){
      assert.ok(Math.abs(x-row.p[0])<.0015&&Math.abs(z-row.p[1])<.19,'small cross-track registration of obscured wells');
      assert.equal(gardens.treeAnchors.find(t=>t.id===row.id).z,z);
    }else assert.ok(Math.hypot(x-row.p[0],z-row.p[1])<.0015);
    assert.equal(gardens.treeAnchors.filter(t=>t.id===row.id).length,1);
    const bounds=new THREE.Box3().setFromObject(tree,true),size=bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs((bounds.max.y-y)/.06-(row.heightM??row.estimatedHeightM))<.02);
    const diameter=Math.sqrt(size.x*size.z)/.06,surveyWidth=row.crownM??row.estimatedCrownM;
    if(tree.userData.stationClearance)assert.ok(diameter<=surveyWidth+.02&&diameter>surveyWidth*.64);
    else assert.ok(Math.abs(diameter-surveyWidth)<.02);
    assert.ok(bounds.min.y<=y+.0001,'Floating trunk '+row.id);
  }
  assert.ok(plazaTreeRecords.get(2069721836).palm);
});

test('36 benches have mapped seats, correct scale, independent feet and a supporting finished surface',()=>{
  const realm=ferryPublicRealm(),field=realm.getObjectByName('Mapped waterfront benches');
  const world=landscape();
  world.root.updateMatrixWorld(true);realm.updateMatrixWorld(true);
  const meshes=[...world.architectureChunks];
  world.relief.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const bounds=meshes.map(o=>new THREE.Box3().setFromObject(o)),ray=new THREE.Raycaster();
  const counts=Object.fromEntries(['north','south','rincon'].map(area=>[area,plazaBenches.filter(b=>b.area===area).length]));
  assert.deepEqual(counts,{north:13,south:17,rincon:6});
  assert.equal(new Set(plazaBenches.map(t=>t.id)).size,field.children.length);
  for(const row of plazaBenches){
    const bench=field.getObjectByName('Bench '+row.id);
    assert.ok(bench&&world.root.getObjectByName(bench.name));
    const [x,z]=row.p;
    assert.ok(Math.hypot(x-bench.position.x,z-bench.position.z)<.00001);
    assert.ok(bench.children.some(o=>Math.abs((o.position.y+o.scale.y/2)/.06-.4583)<.001));
    assert.ok(Math.abs(bench.children[0].scale.x/.06-((row.seats??3)*.53+.12))<.001);
    assert.equal(bench.children.length,row.arms?15:11);
    for(const foot of bench.getObjectsByProperty('name','Bench foot')){
      const p=foot.localToWorld(new THREE.Vector3(0,-.5,0));
      assert.ok(Math.abs(p.y-bench.position.y)<1e-6);
      ray.set(p.clone().add(new THREE.Vector3(0,.001,0)),new THREE.Vector3(0,-1,0));ray.far=.004;
      const hit=ray.intersectObjects(meshes.filter((o,i)=>ray.ray.intersectsBox(bounds[i])),false)[0];
      assert.ok(hit&&Math.abs(hit.point.y-p.y)<.002,'Bench foot unsupported '+row.id+' '+p.toArray());
      if(row.id===10968514766){
        // The upper Rincon path turns beside the planted bank. Both runners
        // must stand level across their full widths, clear of the lower slope.
        for(const u of [-.5,.5])for(const v of [-.5,.5]){
          const corner=foot.localToWorld(new THREE.Vector3(u,-.5,v));
          ray.set(corner.clone().add(new THREE.Vector3(0,.012,0)),new THREE.Vector3(0,-1,0));ray.far=.015;
          const top=ray.intersectObjects(meshes.filter((o,i)=>ray.ray.intersectsBox(bounds[i])),false)
            .find(h=>h.face.normal.y>.9);
          assert.ok(top&&Math.abs(top.point.y-corner.y)<.0001,'upper path supports the whole bench runner '+corner.toArray()+' surface '+top?.point.y);
        }
      }
    }
  }
  const inlay=realm.getObjectByName('Bay inlay');
  const top=new THREE.Box3().setFromObject(inlay).max.y;
  assert.ok(top>southPlazaTop&&southPlazaTop>.096,'The granite map must clear the adjacent ferry apron');
});

test('the inventory trees have species-specific branching, seasonal foliage and compact indexed surfaces',async()=>{
  const {waterfrontTree,waterfrontPalm}=await import('../app/waterfront-trees.ts');
  function plant(species,month){
    const group=new THREE.Group();
    const mesh=(g,c,x,y,z)=>{
      const part=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c}));group.add(part);part.position.set(x,y,z);return part;
    };
    if(/Phoenix|Washingtonia/.test(species))waterfrontPalm(mesh,0,0,0,12,.85,.37,.02,species);
    else waterfrontTree(mesh,0,0,0,12,1,species,month);
    const bounds=new THREE.Box3().setFromObject(group,true),size=bounds.getSize(new THREE.Vector3());
    const crowns=group.children.filter(m=>m.userData.plantCrown),branches=group.children.filter(m=>!m.userData.plantCrown);
    assert.equal(new Set(group.children.map(m=>m.userData.plantAnchor)).size,1);
    assert.ok(group.children.every(m=>m.userData.plantAnchor&&m.userData.waterfrontPlant));
    for(const part of group.children)assert.ok(part.geometry.getAttribute('normal').array.every(Number.isFinite));
    const triangles=group.children.reduce((sum,m)=>sum+m.geometry.index.count/3,0);
    assert.ok(triangles<2500);
    return {crowns,branches,size,triangles};
  }
  const oak=plant('Quercus virginiana',7),ginkgo=plant('Ginkgo biloba',7),plane=plant('Platanus x hispanica',7);
  assert.ok(oak.size.x/oak.size.y>ginkgo.size.x/ginkgo.size.y*1.5);
  const dormant=plant('Platanus x hispanica',1);
  assert.equal(dormant.crowns.length,0);
  assert.ok(dormant.branches[0].geometry.index.count>plane.branches[0].geometry.index.count);
  assert.equal(plant('Magnolia grandiflora',1).crowns.length,1);
  assert.equal(plant('Ligustrum lucidum',1).crowns.length,1);
  assert.notDeepEqual(ginkgo.crowns[0].geometry.getAttribute('color').array,
    plant('Ginkgo biloba',11).crowns[0].geometry.getAttribute('color').array);
  const date=plant('Phoenix canariensis',1),fan=plant('Washingtonia robusta',1);
  assert.equal(date.crowns[0].name,'Date palm foliage');
  assert.equal(fan.crowns[0].name,'Fan palm foliage');
  assert.ok(fan.branches.some(m=>m.name==='Fan palm petioles'));
  assert.notEqual(date.triangles,fan.triangles);
});

test('recorded plots distinguish Market bronze grates, open beds, pavement cutouts and raised pots',async()=>{
  const {treeWell}=await import('../app/tree-wells.ts');
  const {default:plots}=await import('../public/data/tree-wells.json',{with:{type:'json'}});
  const group=new THREE.Group();
  function mesh(g,c,x,y,z){
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c}));m.position.set(x,y,z);group.add(m);return m;
  }
  for(const [id,[kind,width,depth]] of Object.entries(plots)){
    const site=treeWell(mesh,Number(id),3,.045,5);
    if(kind==='yard'){assert.equal(site,undefined);continue;}
    assert.ok(site);assert.equal(site.userData.treeSite,Number(id));
    const b=new THREE.Box3().setFromObject(site),size=b.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x-width*.3048*.06)<.00001);assert.ok(Math.abs(size.z-depth*.3048*.06)<.00001);
    assert.ok(size.y<.0001 || kind==='pot');assert.ok(kind!=='pot' || size.y>.03);
    assert.equal(site.geometry.userData.paintVertices,true);
  }
  assert.equal(group.getObjectsByProperty('name','Inventory tree planter').length,6);
  assert.equal(treeWell(mesh,0,0,0,0),undefined);
  const air=treeWell(mesh,-870100,0,.04,0,0,true);assert.equal(air.name,'Tree cutout');
});

test('each surveyed envelope remains available as a closed, shaded crown for other broadleaf taxa',async()=>{
  const {observedCanopy}=await import('../app/surveyed-canopies.ts');
  const {waterfrontTree}=await import('../app/waterfront-trees.ts');
  const {default:data}=await import('../public/data/plaza-canopies.json',{with:{type:'json'}});
  assert.equal(Object.keys(data).length,36);
  let apertures=0;
  for(const key of Object.keys(data)){
    const id=Number(key),source=observedCanopy(id,true);
    const group=new THREE.Group();
    waterfrontTree((g,c)=>{const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:c}));group.add(m);return m;},0,0,0,id,1,'Fraxinus',7);
    assert.ok(group.children.reduce((tri,m)=>tri+m.geometry.index.count/3,0)<=1230);
    const g=group.children.find(o=>o.userData.plantCrown).geometry;
    assert.equal(g.userData.crownSource,'individual lidar envelope');
    assert.equal(g.userData.crownSourceId,id);
    assert.ok(g.userData.plantCrown);
    const normals=g.getAttribute('normal'),pos=g.getAttribute('position'),color=g.getAttribute('color');
    assert.equal(pos.count,source.points.length);
    assert.ok(new Set(source.density).size>25);
    const adjacency=Array.from({length:pos.count},()=>new Set()),edges=new Map();
    for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){
      const a=g.index.getX(i+j),b=g.index.getX(i+(j+1)%3);
      adjacency[a].add(b);adjacency[b].add(a);
      const edge=a<b?a+','+b:b+','+a;edges.set(edge,(edges.get(edge)??0)+1);
    }
    assert.ok([...edges.values()].every(n=>n>=2),'exposed sheet edge '+key);
    const seen=new Set(),queue=[0];
    while(queue.length){
      const next=queue.pop();
      if(!seen.has(next)){seen.add(next);queue.push(...adjacency[next]);}
    }
    assert.equal(seen.size,pos.count,'detached foliage '+key);
    if(pos.count-edges.size+g.index.count/3<2)apertures++;
    let min=1,max=0;
    for(let i=0;i<normals.count;i++){
      assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<.001);
      min=Math.min(min,color.getY(i));max=Math.max(max,color.getY(i));
    }
    assert.ok(max-min>.06,'flat canopy pigment '+key);
  }
  assert.ok(apertures>0,'the survey-backed light gaps should survive reconstruction');
});

test('the streetcar sees dry Ferry Building forecourt, stepped entry and open water beyond the hall',()=>{
  const world=landscape();world.root.updateMatrixWorld(true);
  const water=world.root.children.find(m=>m.material===world.waterMaterial);
  const candidates=[water,...world.architectureChunks],ray=new THREE.Raycaster();
  const camera=new THREE.PerspectiveCamera(52,1280/760,.013,1800);
  const p=driverPose('streetcar',museumLegDuration);camera.position.copy(p.eye);
  camera.lookAt(p.look.x,p.look.y,p.look.z);
  const cab=createRideInteriors();cab.show('tram');
  cab.root.position.copy(camera.position);cab.root.quaternion.copy(camera.quaternion);cab.root.updateMatrixWorld(true);
  placePassenger(camera,'tram');
  const cabMeshes=[];cab.root.traverseVisible(o=>{if(o.isMesh)cabMeshes.push(o);});
  // One ordinary drag at 1280×760, from (960,380) to (360,369), at arrival.
  // The cab stays aligned with the car as the seated passenger turns toward the entry.
  const radiansPerPixel=Math.PI/760;
  camera.rotateY(-600*radiansPerPixel);camera.rotateX(-11*radiansPerPixel);camera.updateMatrixWorld(true);
  function first(){
    return ray.intersectObjects(candidates.filter(o=>!o.geometry.boundingBox||ray.ray.intersectsBox(o.geometry.boundingBox)||o===water),false)[0];
  }
  for(const [x,y,color,height] of [[164,408,'c9c5b3',.037975],[660,383,'ccc4b1',.0515714],[647,373,'ccc4b1',.0824286]]){
    ray.setFromCamera(new THREE.Vector2(x/640-1,1-y/380),camera);
    const h=first();assert.ok(h&&h.object!==water);
    const cabHit=ray.intersectObjects(cabMeshes,false)[0];
    assert.ok(!cabHit||cabHit.distance>h.distance,'forecourt sightline clears the right-hand cab window');
    const c=new THREE.Color().fromBufferAttribute(h.object.geometry.attributes.color,h.face.a);
    assert.equal(c.getHexString(),color);
    assert.ok(Math.abs(h.point.y-height)<.0001,'finished forecourt or tread height at '+[x,y]);
  }
  cab.dispose();
  const down=new THREE.Vector3(0,-1,0);
  for(const [x,z,y] of [[-5.35,-1.84,.031],[2.5,-1.84,.031]]){
    ray.set(new THREE.Vector3(x,.115,z),down);assert.ok(Math.abs(first().point.y-y)<.0001);
  }
  for(const [z,y] of [[-2.01,.031],[-1.968,.0412857],[-1.94,.0515714],[-1.909,.0618571],[-1.875,.0721429],[-1.845,.0824286],[-1.813,.0927143],[-1.78,.103],[-1.53,.103]]){
    ray.set(new THREE.Vector3(-.12,.115,z),down);assert.ok(Math.abs(first().point.y-y)<.00005);
  }
  ray.set(new THREE.Vector3(3.6,.15,5),down);assert.equal(first().object,water);
});

test('plaza date palm crowns hold a layered feather silhouette and warm lower fronds within the mobile mesh budget',async()=>{
  const {waterfrontPalm}=await import('../app/waterfront-trees.ts');
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,0,-1);
  let samples=0,filled=0;
  for(const id of [2069721989,2069721979,2069721841]){
    const row=plazaTreeRecords.get(id),group=new THREE.Group();
    waterfrontPalm((g,c,x,y,z)=>{
      const m=new THREE.Mesh(g);m.position.set(x,y,z);group.add(m);return m;
    },0,0,0,id,row.heightM*.06,row.crownM*.03,.02);
    const crown=group.getObjectByName('Date palm foliage');
    assert.equal(group.children.length,10);
    assert.ok(group.children.reduce((count,m)=>count+m.geometry.index.count/3,0)<=2016);
    const {position,color}=crown.geometry.attributes,bounds=new THREE.Box3().setFromObject(crown,true);
    let ochreBelow=0,sageAbove=0;
    for(let i=0;i<position.count;i++){
      const height=(position.getY(i)-bounds.min.y)/(bounds.max.y-bounds.min.y);
      if(height<.30&&color.getX(i)>color.getY(i)*1.05)ochreBelow++;
      if(height>.70&&color.getY(i)>color.getX(i)*1.15)sageAbove++;
    }
    assert.ok(ochreBelow>20&&sageAbove>20,'warm hanging fronds and green upper feathers');
    for(const angle of [0,.8,1.6]){
      crown.rotation.y=angle;crown.updateMatrixWorld(true);
      bounds.setFromObject(crown,true);
      for(let ix=0;ix<22;ix++)for(let iy=0;iy<22;iy++){
        const x=THREE.MathUtils.lerp(bounds.min.x,bounds.max.x,(ix+.5)/22);
        const y=THREE.MathUtils.lerp(bounds.min.y,bounds.max.y,(iy+.5)/22);
        ray.set(new THREE.Vector3(x,y,1),direction);
        if(ray.intersectObject(crown,false).length)filled++;
        samples++;
      }
    }
  }
  const coverage=filled/samples;
  assert.ok(coverage>1/3&&coverage<.60,'projected fronds carry continuous color with open sky between them: '+coverage);
});
