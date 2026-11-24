import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {addHowardTrees,howardTrees} from '../app/howard-trees.ts';
import {bakeTreeBatches,createTreeDraw} from '../app/tree-batches.ts';
import {addSurveyBlocks} from '../app/survey-blocks.ts';
import {sfMap} from '../app/sf-map.ts';
import {add201Spear} from '../app/201-spear.ts';
import {add211Main} from '../app/211-main.ts';
import {addFolgerBuilding} from '../app/folger-building.ts';
import {waterfrontLandscape} from '../app/waterfront-gardens.ts';
import {spearWalkerPose,spearWalkerCount} from '../app/spear-walkers.ts';

const mat=new THREE.MeshStandardMaterial({vertexColors:true});
function make(root){
  return (g,_color,x,y,z)=>{
    const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);root.add(m);return m;
  };
}
const planting=new THREE.Group(),anchors=addHowardTrees(make(planting));
const paved=new THREE.Group();addSurveyBlocks(make(paved));paved.updateMatrixWorld(true);
planting.updateMatrixWorld(true);
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
const near=(a,b,tol=.00005)=>assert.ok(Math.abs(a-b)<tol,a+' vs '+b);
const uv=(x,z)=>[.988686*(x+25.894)-.150004*(z+12.650),.150004*(x+25.894)+.988686*(z+12.650)];
function support(x,z){
  ray.set(new THREE.Vector3(x,.125,z),down);ray.far=.13;
  return ray.intersectObjects(paved.children,false).map(h=>h.point.y);
}

test('individual inventory sites have well support, grounded trunks and no preexisting OSM duplicate',()=>{
  assert.equal(anchors.length,46);
  assert.equal(new Set(anchors.map(a=>a.id)).size,anchors.length);
  assert.equal(howardTrees.filter(r=>r[7]).length,16);
  for(const [i,a] of anchors.entries()){
    assert.ok(waterfrontLandscape.trees.every(t=>Math.hypot(a.x-t.p[0],a.z-t.p[1])>.15));
    const well=planting.children.find(o=>o.userData.treeSite===a.id),pot=howardTrees[i][7];
    assert.ok(well);
    well.geometry.computeBoundingBox();
    const bounds=well.geometry.boundingBox;
    for(const [u,v] of [[0,0],[-.48,-.48],[-.48,.48],[.48,-.48],[.48,.48]]){
      const w=well.localToWorld(new THREE.Vector3(u,0,v));
      const hits=support(w.x,w.z);
      assert.ok(hits.some(y=>Math.abs(y-.045)<.00006),a.id+' well edge must rest on sidewalk '+hits);
      assert.ok(Math.max(...hits)<.0452,a.id+' higher surface crosses well');
    }
    near(a.y,well.position.y+(pot?.80*well.scale.y:0));
    assert.ok(bounds.max.x>0&&bounds.min.x<0);
    const wood=planting.children.find(o=>o.userData.plantAnchor&&!o.userData.plantCrown&&Math.abs(o.position.x-a.x)<.00001&&Math.abs(o.position.z-a.z)<.00001);
    assert.ok(wood);wood.geometry.computeBoundingBox();near(wood.geometry.boundingBox.min.y+a.y,a.y,.006);
  }
});

test('Spear stops and walk paths stay clear of the registered stems and wells',()=>{
  const masts=[[-26.435,-11.916],[-25.1128,-12.10097]];
  for(const [id,x,z,,, ,ft] of howardTrees){
    const radius=ft*.3048*.03*Math.SQRT2;
    for(const [xx,zz] of masts)assert.ok(Math.hypot(x-xx,z-zz)>radius+.028,id+' mast');
    for(let i=0;i<spearWalkerCount;i++)for(let t=0;t<128;t+=.125){
      const p=spearWalkerPose(t,i);assert.ok(Math.hypot(x-p.x,z-p.z)>radius+.019,id+' walker '+i);
    }
  }
});

test('the Folger Howard wall and adjoining 211 Main match their measured sections',()=>{
  const front=sfMap.buildings.find(b=>b.id===192305909);
  for(const i of [0,3])near(uv(...front.p[i])[0],-.65,.0001);
  const main=sfMap.buildings.find(b=>b.id===154217696);
  near(uv(...main.p[0])[0],-.598,.008);near(uv(...main.p[7])[0],-3.59,.008);
  for(const [id,x,z,,,,ft,pot] of howardTrees){
    if(!pot)continue;
    const [u,v]=uv(x,z),wall=v< -3.34?-.598:-.65;
    assert.ok((u-wall-ft*.3048*.03)/.06>1.22,id+' clear facade passage');
    assert.ok(-.425-u-ft*.3048*.03>.025,id+' planter clear of curb lip');
  }
});

test('the planting row leaves a usable passage to the rendered south-side frontages',()=>{
  const facades=new THREE.Group();
  for(const b of sfMap.buildings){
    add201Spear(b,facades,[]);add211Main(b,facades,[]);addFolgerBuilding(b,facades,[]);
  }
  facades.updateMatrixWorld(true);
  for(const [id,x,z,,,,feet] of howardTrees){
    const [u]=uv(x,z);if(u>=0)continue;
    const direction=new THREE.Vector3(-.988686,0,.150004);
    if(id===192188||id===192189)direction.set(.150004,0,.988686);
    if(id===190289)direction.set(-.150004,0,-.988686);
    ray.set(new THREE.Vector3(x,.120,z),direction.normalize());ray.far=1.5;
    const hit=ray.intersectObject(facades,true)[0];
    assert.ok(hit,id+' registered frontage');
    assert.ok((hit.distance-feet*.3048*.03)/.06>=1.5,id+' well-to-facade clearance');
  }
});

test('trees retain connected wood and painted foliage in the common near/far draw',()=>{
  const parts=planting.children.filter(o=>o.userData.plantAnchor);
  assert.equal(new Set(parts.map(o=>o.userData.plantAnchor)).size,46);
  const bins=bakeTreeBatches(parts,mat);
  const fine=bins.reduce((s,b)=>s+b.high.index.count/3,0),coarse=bins.reduce((s,b)=>s+b.low.index.count/3,0);
  assert.ok(fine<210000&&coarse<fine*.8);
  assert.ok(bins.every(b=>b.low.getAttribute('position')===b.high.getAttribute('position')));
  assert.equal(createTreeDraw(bins,mat).isBatchedMesh,true);
});
